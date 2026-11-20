// O formato do arquivo .apud.
//
// É um arquivo de texto (JSON), legível em qualquer editor de texto: se um dia
// algo der errado, o conteúdo do trabalho ainda pode ser recuperado à mão.
// Exemplo:
//
//   {
//     "formato": "apud",
//     "versao": 2,
//     "nome": "Relato de experiência de estágio",
//     "perfil": { "perfil": "ABNT", "versao": "2025", "revisao": 3 },
//     "ajustes": { "ABNT": { "referências, prenomes": "abreviados" } },
//     "criadoEm": "2026-11-20T18:40:00.000Z",
//     "modificadoEm": "2026-11-20T19:02:11.000Z",
//     "documento": { "versao": 2, "blocos": [ ... ], "referencias": [ ... ] }
//   }
//
// "perfil" guarda com que versão da norma o trabalho foi feito: um trabalho já
// entregue nunca muda sozinho quando o perfil for atualizado.
//
// "ajustes" guarda as escolhas do autor e os valores que dependem da faculdade,
// separados por norma. Quem troca de ABNT para APA e volta encontra as
// escolhas da ABNT como deixou.
//
// Versões do arquivo:
//   1. Fase 1: nome, perfil, datas e o texto (documento na versão 1).
//   2. Fase 2: o documento ganha referências e citações (versão 2) e o arquivo
//      ganha os ajustes. Um arquivo da versão 1 é lido normalmente e passa a
//      ser gravado na versão 2 quando o trabalho mudar. Nada se perde: a
//      conversão só acrescenta o que não existia (lista de referências e
//      ajustes vazios).
//
// Arquivo de uma versão mais nova, ou estragado, é recusado com o motivo, e o
// arquivo no disco fica como está.

import {
  TIPOS_DE_REFERENCIA,
  VERSAO_DO_FORMATO,
  type Autor,
  type Bloco,
  type Citacao,
  type Data,
  type Documento,
  type ItemDeLista,
  type Localizador,
  type ObraCitada,
  type Referencia,
  type Trecho,
} from "../documento/modelo";

export const VERSAO_DO_ARQUIVO = 2;

export interface PerfilDoTrabalho {
  perfil: string;
  versao: string;
  revisao: number;
}

/** Ajustes do trabalho por norma: { "ABNT": { "nome da regra": "valor" } }. */
export type AjustesDoTrabalho = Record<string, Record<string, string>>;

export interface Trabalho {
  nome: string;
  perfil: PerfilDoTrabalho;
  ajustes: AjustesDoTrabalho;
  criadoEm: string;
  modificadoEm: string;
  documento: Documento;
}

export type Leitura = { ok: true; trabalho: Trabalho } | { ok: false; erro: string };

/** Escreve o trabalho como texto do arquivo .apud. */
export function escreverArquivo(t: Trabalho): string {
  const arquivo = {
    formato: "apud",
    versao: VERSAO_DO_ARQUIVO,
    nome: t.nome,
    perfil: t.perfil,
    ajustes: t.ajustes,
    criadoEm: t.criadoEm,
    modificadoEm: t.modificadoEm,
    documento: t.documento,
  };
  return JSON.stringify(arquivo, null, 2) + "\n";
}

/**
 * Lê o texto de um arquivo .apud e confere se está inteiro.
 * Nunca "conserta" em silêncio: se algo estiver errado, devolve o motivo, e o
 * arquivo fica como está no disco. Arquivos de versões anteriores são
 * convertidos para a versão atual (só em memória; o disco muda quando o
 * trabalho for salvo).
 */
export function lerArquivo(texto: string): Leitura {
  let dados: unknown;
  try {
    dados = JSON.parse(texto.replace(/^﻿/, ""));
  } catch {
    return { ok: false, erro: "o arquivo não é um .apud válido (o texto está incompleto ou foi alterado)" };
  }
  if (!objeto(dados) || dados.formato !== "apud") return { ok: false, erro: "o arquivo não é um trabalho do Apud" };
  if (typeof dados.versao !== "number" || !Number.isInteger(dados.versao) || dados.versao < 1) {
    return { ok: false, erro: "falta a versão do arquivo" };
  }
  if (dados.versao > VERSAO_DO_ARQUIVO) {
    return { ok: false, erro: "este trabalho foi feito numa versão mais nova do Apud. Atualize o Apud para abrir" };
  }
  if (typeof dados.nome !== "string") return { ok: false, erro: "falta o nome do trabalho" };
  const perfil = dados.perfil;
  if (!objeto(perfil) || typeof perfil.perfil !== "string" || typeof perfil.versao !== "string" || typeof perfil.revisao !== "number") {
    return { ok: false, erro: "falta a norma do trabalho" };
  }
  // Versão 1: não havia ajustes.
  const ajustes = dados.versao === 1 && dados.ajustes === undefined ? {} : conferirAjustes(dados.ajustes);
  if (!ajustes) return { ok: false, erro: "os ajustes da norma do trabalho estão estragados" };
  const documento = conferirDocumento(dados.documento);
  if (typeof documento === "string") return { ok: false, erro: documento };
  return {
    ok: true,
    trabalho: {
      nome: dados.nome,
      perfil: { perfil: perfil.perfil, versao: perfil.versao, revisao: perfil.revisao },
      ajustes,
      criadoEm: typeof dados.criadoEm === "string" ? dados.criadoEm : "",
      modificadoEm: typeof dados.modificadoEm === "string" ? dados.modificadoEm : "",
      documento,
    },
  };
}

// ---------------------------------------------------------------------------
// Conferência

function objeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function conferirAjustes(v: unknown): AjustesDoTrabalho | null {
  if (!objeto(v)) return null;
  const saida: AjustesDoTrabalho = {};
  for (const [norma, regras] of Object.entries(v)) {
    if (!objeto(regras) || !Object.values(regras).every((x) => typeof x === "string")) return null;
    saida[norma] = { ...(regras as Record<string, string>) };
  }
  return saida;
}

/** Devolve o documento conferido (já na versão atual), ou o motivo do erro. */
function conferirDocumento(v: unknown): Documento | string {
  if (!objeto(v) || !Array.isArray(v.blocos)) return "falta o texto do trabalho";
  if (v.versao !== 1 && v.versao !== VERSAO_DO_FORMATO) return "o texto do trabalho está numa versão que este Apud não conhece";

  // Versão 1 → 2: não havia referências; a lista começa vazia.
  let referencias: Referencia[] = [];
  if (v.versao !== 1 || v.referencias !== undefined) {
    if (!Array.isArray(v.referencias)) return "falta a lista de referências do trabalho";
    const ids = new Set<string>();
    for (const [i, r] of v.referencias.entries()) {
      const ref = conferirReferencia(r);
      if (!ref) return `a referência ${i + 1} da lista está estragada`;
      if (ids.has(ref.id)) return `a referência ${i + 1} usa o mesmo código de outra (${ref.id})`;
      ids.add(ref.id);
      referencias.push(ref);
    }
  }

  const blocos: Bloco[] = [];
  for (const [i, b] of v.blocos.entries()) {
    const bloco = conferirBloco(b);
    if (!bloco) return `o bloco ${i + 1} do texto está estragado`;
    blocos.push(bloco);
  }
  return { versao: VERSAO_DO_FORMATO, blocos, referencias };
}

function conferirBloco(b: unknown): Bloco | null {
  if (!objeto(b)) return null;
  switch (b.tipo) {
    case "paragrafo": {
      const trechos = conferirTrechos(b.trechos);
      return trechos && { tipo: "paragrafo", trechos };
    }
    case "titulo": {
      const trechos = conferirTrechos(b.trechos);
      const nivel = b.nivel;
      if (!trechos || ![1, 2, 3, 4, 5].includes(nivel as number)) return null;
      // (Uma versão de teste guardava "numerado"; hoje o número é escrito no texto, e o campo é ignorado.)
      return { tipo: "titulo", nivel: nivel as 1 | 2 | 3 | 4 | 5, trechos };
    }
    case "lista": {
      const itens = conferirItens(b.itens);
      if (!itens || typeof b.sequencia !== "boolean") return null;
      return { tipo: "lista", sequencia: b.sequencia, itens };
    }
    case "quebra":
      return { tipo: "quebra" };
    default:
      return null;
  }
}

function conferirItens(v: unknown): ItemDeLista[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const itens: ItemDeLista[] = [];
  for (const it of v) {
    if (!objeto(it)) return null;
    const trechos = conferirTrechos(it.trechos);
    if (!trechos) return null;
    const item: ItemDeLista = { trechos };
    if (it.subitens !== undefined) {
      const sub = conferirItens(it.subitens);
      if (!sub) return null;
      item.subitens = sub;
    }
    itens.push(item);
  }
  return itens;
}

const MARCAS = ["negrito", "italico", "sobrescrito"];

function conferirTrechos(v: unknown): Trecho[] | null {
  if (!Array.isArray(v)) return null;
  const trechos: Trecho[] = [];
  for (const t of v) {
    if (!objeto(t)) return null;
    if (t.citacao !== undefined) {
      const citacao = conferirCitacao(t.citacao);
      if (!citacao) return null;
      trechos.push({ citacao });
      continue;
    }
    if (typeof t.texto !== "string") return null;
    if (t.marcas === undefined) {
      trechos.push({ texto: t.texto });
      continue;
    }
    if (!Array.isArray(t.marcas) || !t.marcas.every((m) => MARCAS.includes(m))) return null;
    const marcas = MARCAS.filter((m) => (t.marcas as string[]).includes(m)) as ("negrito" | "italico" | "sobrescrito")[];
    trechos.push(marcas.length ? { texto: t.texto, marcas } : { texto: t.texto });
  }
  return trechos;
}

// ---------------------------------------------------------------------------
// Citações

const texto = (v: unknown): v is string => typeof v === "string";
const opcional = <T>(v: unknown, conferir: (x: unknown) => x is T) => v === undefined || conferir(v);
const simOuNao = (v: unknown): v is boolean => typeof v === "boolean";

function conferirLocalizador(v: unknown): Localizador | null {
  if (!objeto(v) || !texto(v.valor)) return null;
  if (v.tipo === "pagina") return { tipo: "pagina", valor: v.valor };
  if (v.tipo === "outro" && texto(v.rotulo)) return { tipo: "outro", rotulo: v.rotulo, valor: v.valor };
  return null;
}

function conferirObra(v: unknown): ObraCitada | null {
  if (!objeto(v) || !texto(v.referencia) || !v.referencia) return null;
  if (!opcional(v.grifo, simOuNao) || !opcional(v.traducao, simOuNao)) return null;
  const obra: ObraCitada = { referencia: v.referencia };
  if (v.localizador !== undefined) {
    const l = conferirLocalizador(v.localizador);
    if (!l) return null;
    obra.localizador = l;
  }
  if (v.grifo) obra.grifo = true;
  if (v.traducao) obra.traducao = true;
  return obra;
}

/**
 * Confere uma citação. Uma citação que aponta para uma referência que não
 * existe mais não estraga o arquivo: o Apud avisa no texto (motor de citações).
 */
export function conferirCitacao(v: unknown): Citacao | null {
  if (!objeto(v) || !opcional(v.direta, simOuNao)) return null;
  const direta = v.direta ? { direta: true } : {};
  switch (v.tipo) {
    case "parenteses": {
      if (!Array.isArray(v.obras) || v.obras.length === 0) return null;
      const obras = v.obras.map(conferirObra);
      if (obras.some((o) => !o)) return null;
      return { tipo: "parenteses", ...direta, obras: obras as ObraCitada[] };
    }
    case "narrativa": {
      const obra = conferirObra(v.obra);
      return obra && { tipo: "narrativa", ...direta, obra };
    }
    case "apud": {
      const obra = conferirObra(v.obra);
      if (!obra || !texto(v.original)) return null;
      return { tipo: "apud", ...direta, original: v.original, obra };
    }
    case "sem-referencia":
      return texto(v.texto) ? { tipo: "sem-referencia", texto: v.texto } : null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Referências

function conferirData(v: unknown): v is Data {
  if (!objeto(v) || typeof v.ano !== "number" || !Number.isInteger(v.ano)) return false;
  if (v.mes !== undefined && !(Number.isInteger(v.mes) && (v.mes as number) >= 1 && (v.mes as number) <= 12)) return false;
  if (v.dia !== undefined && !(Number.isInteger(v.dia) && (v.dia as number) >= 1 && (v.dia as number) <= 31)) return false;
  return true;
}

function conferirAutor(v: unknown): v is Autor {
  if (!objeto(v)) return false;
  if (v.instituicao !== undefined) return texto(v.instituicao) && v.sobrenome === undefined;
  return texto(v.sobrenome) && opcional(v.prenomes, texto);
}

const autores = (v: unknown): v is Autor[] => Array.isArray(v) && v.every(conferirAutor);

/** Os campos de texto simples de uma referência (todos opcionais). */
const CAMPOS_DE_TEXTO = [
  "subtitulo",
  "dataIncerta",
  "edicao",
  "cidade",
  "editora",
  "paginas",
  "numeroEletronico",
  "folhas",
  "tipoDoTrabalho",
  "grau",
  "serie",
  "numeroNaSerie",
  "ementa",
  "perfil",
  "tipoDaPostagem",
  "doi",
  "url",
] as const;

/**
 * Confere uma referência. Campos que este Apud não conhece são mantidos como
 * estão, para nunca se perder dado de um arquivo.
 */
export function conferirReferencia(v: unknown): Referencia | null {
  if (!objeto(v) || !texto(v.id) || !v.id) return null;
  if (!(TIPOS_DE_REFERENCIA as readonly unknown[]).includes(v.tipo)) return null;
  if (!autores(v.autores) || !texto(v.titulo)) return null;
  if (!CAMPOS_DE_TEXTO.every((c) => opcional(v[c], texto))) return null;
  if (!opcional(v.data, conferirData) || !opcional(v.acesso, conferirData)) return null;
  if (v.evento !== undefined) {
    const e = v.evento;
    if (!objeto(e) || !texto(e.nome) || !["numero", "ano", "cidade"].every((c) => opcional(e[c], texto))) return null;
  }
  if (v.publicacao !== undefined) {
    const p = v.publicacao;
    if (!objeto(p) || !texto(p.titulo)) return null;
    if (!["subtitulo", "cidade", "volume", "numero"].every((c) => opcional(p[c], texto))) return null;
    if (!opcional(p.organizadores, autores)) return null;
  }
  return structuredClone(v) as unknown as Referencia;
}
