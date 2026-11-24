// Onde os trabalhos ficam guardados.
//
// - No programa de computador: arquivos .apud na pasta Documentos\Apud, pelos
//   comandos da parte "de dentro" (src-tauri), que gravam de forma segura.
// - Na prévia no navegador (npm run dev): na memória do próprio navegador,
//   só para testar a interface. Nada disso vai para o computador.

import { invoke } from "@tauri-apps/api/core";

export interface ArquivoNaPasta {
  arquivo: string;
  /** Última modificação do arquivo, em milissegundos. */
  modificado: number;
  conteudo?: string;
  erro?: string;
}

export interface Armazenamento {
  /** Onde ficam os trabalhos, para mostrar à pessoa. */
  pasta(): Promise<string>;
  listar(): Promise<ArquivoNaPasta[]>;
  ler(arquivo: string): Promise<string>;
  /** Cria um arquivo novo; devolve o nome do arquivo (pode ganhar "(2)"). */
  criar(nome: string, conteudo: string): Promise<string>;
  salvar(arquivo: string, conteudo: string): Promise<void>;
  /** Troca o nome do arquivo; devolve o nome novo. */
  renomear(arquivo: string, nome: string): Promise<string>;
  mostrarPasta(): Promise<void>;
  /** A Times New Roman e a Arial instaladas no computador, para o PDF usar as fontes de verdade. */
  fontesDoComputador(): Promise<Array<{ nome: string; dados: Uint8Array }>>;
  /** Pergunta onde salvar e grava o PDF. Devolve onde ficou, ou null se a pessoa cancelou. */
  exportarPdf(nomeSugerido: string, pdf: Uint8Array): Promise<string | null>;
  /** Abre o último PDF exportado no leitor de PDF do computador. */
  abrirPdfExportado(): Promise<void>;
}

/** Arquivos das fontes do Windows que o Apud procura. */
export const FONTES_DO_WINDOWS = [
  "times.ttf",
  "timesbd.ttf",
  "timesi.ttf",
  "timesbi.ttf",
  "arial.ttf",
  "arialbd.ttf",
  "ariali.ttf",
  "arialbi.ttf",
  "calibri.ttf",
  "calibrib.ttf",
  "calibrii.ttf",
  "calibriz.ttf",
  "georgia.ttf",
  "georgiab.ttf",
  "georgiai.ttf",
  "georgiaz.ttf",
];

export const rodandoNoPrograma = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Erro dos comandos em português, já pronto para mostrar. */
function erro(e: unknown): Error {
  return new Error(typeof e === "string" ? e : e instanceof Error ? e.message : String(e));
}

const chamar = async <T>(comando: string, args?: Record<string, unknown>): Promise<T> => {
  try {
    return await invoke<T>(comando, args);
  } catch (e) {
    throw erro(e);
  }
};

const noPrograma: Armazenamento = {
  pasta: () => chamar("pasta_dos_trabalhos"),
  listar: () =>
    chamar<Array<{ arquivo: string; modificado: number; conteudo: string | null; erro: string | null }>>(
      "listar_trabalhos",
    ).then((l) => l.map((a) => ({ arquivo: a.arquivo, modificado: a.modificado, conteudo: a.conteudo ?? undefined, erro: a.erro ?? undefined }))),
  ler: (arquivo) => chamar("ler_trabalho", { arquivo }),
  criar: (nome, conteudo) => chamar("criar_trabalho", { nome, conteudo }),
  salvar: (arquivo, conteudo) => chamar("salvar_trabalho", { arquivo, conteudo }),
  renomear: (arquivo, nome) => chamar("renomear_trabalho", { arquivo, nome }),
  mostrarPasta: () => chamar("mostrar_pasta"),
  fontesDoComputador: async () => {
    const lidas = await Promise.all(
      FONTES_DO_WINDOWS.map(async (nome) => {
        try {
          const dados = await invoke<ArrayBuffer>("ler_fonte", { nome });
          return { nome, dados: new Uint8Array(dados) };
        } catch {
          return null; // essa fonte não está instalada: o Apud usa a de reserva
        }
      }),
    );
    return lidas.filter((f): f is { nome: string; dados: Uint8Array } => f !== null);
  },
  exportarPdf: async (nomeSugerido, pdf) => {
    try {
      return await invoke<string | null>("exportar_pdf", pdf, { headers: { nome: encodeURIComponent(nomeSugerido) } });
    } catch (e) {
      throw erro(e);
    }
  },
  abrirPdfExportado: () => chamar("abrir_pdf_exportado"),
};

// ---------------------------------------------------------------------------
// Prévia no navegador

const CHAVE = "apud:previa:";

/** Mesmo jeito de escolher nomes do programa, simplificado. */
function nomeDeArquivo(nome: string): string {
  const base = nome.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").replace(/^[. ]+|[. ]+$/g, "");
  return `${base || "Trabalho sem título"}.apud`;
}

function nomeLivre(desejado: string, ignorar?: string): string {
  const ocupado = (n: string) => n !== ignorar && localStorage.getItem(CHAVE + n) !== null;
  if (!ocupado(desejado)) return desejado;
  const base = desejado.slice(0, -5);
  for (let i = 2; ; i++) if (!ocupado(`${base} (${i}).apud`)) return `${base} (${i}).apud`;
}

export function armazenamentoDoNavegador(): Armazenamento {
  const ler = (arquivo: string) => {
    const s = localStorage.getItem(CHAVE + arquivo);
    if (s === null) throw new Error(`o arquivo ${arquivo} não está mais na pasta`);
    return JSON.parse(s) as { conteudo: string; modificado: number };
  };
  const gravar = (arquivo: string, conteudo: string) =>
    localStorage.setItem(CHAVE + arquivo, JSON.stringify({ conteudo, modificado: Date.now() }));
  return {
    pasta: async () => "memória do navegador (prévia)",
    listar: async () =>
      Object.keys(localStorage)
        .filter((k) => k.startsWith(CHAVE))
        .map((k) => {
          const a = k.slice(CHAVE.length);
          const { conteudo, modificado } = ler(a);
          return { arquivo: a, modificado, conteudo };
        })
        .sort((a, b) => b.modificado - a.modificado),
    ler: async (arquivo) => ler(arquivo).conteudo,
    criar: async (nome, conteudo) => {
      const a = nomeLivre(nomeDeArquivo(nome));
      gravar(a, conteudo);
      return a;
    },
    salvar: async (arquivo, conteudo) => {
      ler(arquivo);
      gravar(arquivo, conteudo);
    },
    renomear: async (arquivo, nome) => {
      const desejado = nomeDeArquivo(nome);
      if (desejado === arquivo) return arquivo;
      const novo = nomeLivre(desejado, arquivo);
      const { conteudo } = ler(arquivo);
      gravar(novo, conteudo);
      if (novo !== arquivo) localStorage.removeItem(CHAVE + arquivo);
      return novo;
    },
    mostrarPasta: async () => {},
    fontesDoComputador: async () => [],
    exportarPdf: async (nomeSugerido, pdf) => {
      // Na prévia no navegador, o PDF vai para os downloads.
      const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeSugerido;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return `Downloads/${nomeSugerido}`;
    },
    abrirPdfExportado: async () => {},
  };
}

export const armazenamento: Armazenamento = rodandoNoPrograma ? noPrograma : armazenamentoDoNavegador();
