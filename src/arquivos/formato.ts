// O formato do arquivo .apud (versão 8; a versão 5 foi a primeira da versão 2 do Apud).
//
// É um arquivo de texto (JSON), legível em qualquer editor de texto: se um dia
// algo der errado, o conteúdo do trabalho ainda pode ser recuperado à mão.
// Exemplo:
//
//   {
//     "formato": "apud",
//     "versao": 8,
//     "nome": "Relato de experiência de estágio",
//     "modelo": { "nome": "ABNT", "versao": "2025", "revisao": 10, "cadeia": [...],
//                 "valores": { ... }, "atalhos": { ... } },
//     "ajustes": { "ABNT": { "referências, prenomes": "abreviados" } },
//     "criadoEm": "2026-11-20T18:40:00.000Z",
//     "modificadoEm": "2026-11-20T19:02:11.000Z",
//     "documento": { "versao": 8, "dados": { ... }, "abertura": { ... },
//                    "blocos": [ ... ], "referencias": [ ... ], "imagens": [ ... ] }
//   }
//
// "modelo" é a cópia inteira do modelo do trabalho (decisão 4 da v2), já
// somada (Em branco + ABNT), com a origem de cada valor: o trabalho abre igual
// mesmo que um dia o modelo mude (modelos/arquivo.ts).
//
// "ajustes" guarda as escolhas do trabalho (Escolhas do autor e valores
// ajustáveis), separadas por modelo. Quem troca de ABNT para APA e volta
// encontra as escolhas da ABNT como deixou. Cada escolha vai pelo caminho do
// elemento ("Texto › fonte") ou, nas citações e referências, só pelo nome da
// regra ("referências, prenomes").
//
// Versão 6 (etapa 2 da v2): parágrafos e títulos podem ter exceções ("só este"):
//   { "tipo": "paragrafo", "trechos": [...], "excecoes": { "alinhamento": "centralizado" } }
// Cada exceção é conferida pelo tipo da propriedade; uma estragada recusa o
// arquivo. A versão subiu para proteger as exceções: um Apud que só conhece a
// versão 5 recusa o arquivo, em vez de abrir e apagar as exceções ao salvar.
// Um arquivo da versão 5 é o mesmo trabalho, sem exceções: abre como está e é
// gravado na versão 6 quando o trabalho muda.
//
// Versão 7 (etapa 3 da v2, parte 3a): a abertura vira uma lista de blocos, como
// o texto:
//   "abertura": { "blocos": [ { "tipo": "capa" }, { "tipo": "dedicatoria", "paragrafos": [...] },
//                             { "tipo": "resumo", "idioma": "pt-BR", "trechos": [...], "palavrasChave": [...] } ],
//                 "guardados": [ ... ], "semIdentificacao": false }
// "guardados" são os textos tirados da abertura (voltam com "Adicionar à
// abertura"). Um arquivo das versões 5 e 6 (caixas de marcar) é convertido ao
// abrir, sem perder nada: o que estava ligado vira bloco, e uma dedicatória,
// epígrafe ou agradecimentos desligados mas com texto ficam guardados. Ele é
// gravado na versão 7 quando o trabalho muda. A versão subiu para que um Apud
// antigo recuse o arquivo, em vez de não achar a abertura e perdê-la.
//
// Versão 8 (etapa 3b): a citação longa pode ter exceções "só este" (tamanho,
// entrelinha, recuo à esquerda, espaço antes e depois, alinhamento). A versão
// subiu para que um Apud que só conhece a 7 recuse o arquivo em vez de apagar
// essas exceções ao salvar. Um arquivo da versão 7 abre como está.
//
// Os arquivos das versões 1 a 4 são da versão de testes do Apud (a versão 1 do
// programa) e não abrem mais (decisão do Francisco, 23/11/2026): são recusados
// com uma mensagem clara e ficam como estão no disco. Arquivo de uma versão
// mais nova, ou estragado, também é recusado com o motivo, sem ser alterado.

import {
  FORMATOS_DE_IMAGEM,
  TIPOS_DE_REFERENCIA,
  TIPOS_DE_TRABALHO,
  PRIMEIRA_VERSAO_DO_FORMATO,
  VERSAO_DO_FORMATO,
  ORDEM_DA_ABERTURA,
  temTextoNaAbertura,
  type Abertura,
  type Autor,
  type Bloco,
  type Citacao,
  type DadosDoTrabalho,
  type Data,
  type Documento,
  type BlocoDaAbertura,
  type TextoGuardavel,
  type Excecoes,
  type Identificacao,
  type Imagem,
  type ItemDeLista,
  type Localizador,
  type ObraCitada,
  type Referencia,
  type Resumo,
  type Trecho,
  type TrechoDeTexto,
} from "../documento/modelo";
import { modeloDoArquivo, modeloParaArquivo } from "../modelos/arquivo";
import { conferirExcecoes } from "../modelos/excecoes";
import { ELEMENTO_DA_ABERTURA } from "../conversor/abertura";
import type { ModeloResolvido } from "../modelos/tipos";

export const VERSAO_DO_ARQUIVO = 8;

/** A primeira versão do arquivo na versão 2 do Apud. As anteriores são da versão de testes. */
export const PRIMEIRA_VERSAO_DA_V2 = 5;

/** Escolhas do trabalho por modelo: { "ABNT": { "referências, prenomes": "abreviados", "Texto › fonte": "Arial" } }. */
export type AjustesDoTrabalho = Record<string, Record<string, string>>;

export interface Trabalho {
  nome: string;
  /** A cópia do modelo do trabalho, já somada (sem as escolhas do trabalho, que ficam em ajustes). */
  modelo: ModeloResolvido;
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
    modelo: modeloParaArquivo(t.modelo),
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
 * arquivo fica como está no disco.
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
  if (dados.versao < PRIMEIRA_VERSAO_DA_V2) {
    return { ok: false, erro: "este trabalho foi feito na versão de testes do Apud e não abre nesta versão" };
  }
  if (typeof dados.nome !== "string") return { ok: false, erro: "falta o nome do trabalho" };
  const modelo = dados.modelo === undefined ? "falta o modelo do trabalho" : modeloDoArquivo(dados.modelo);
  if (typeof modelo === "string") return { ok: false, erro: modelo };
  const ajustes = conferirAjustes(dados.ajustes);
  if (!ajustes) return { ok: false, erro: "as escolhas do trabalho estão estragadas" };
  const documento = conferirDocumento(dados.documento);
  if (typeof documento === "string") return { ok: false, erro: documento };
  return {
    ok: true,
    trabalho: {
      nome: dados.nome,
      modelo,
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

/** Devolve o documento conferido, ou o motivo do erro. */
function conferirDocumento(v: unknown): Documento | string {
  if (!objeto(v) || !Array.isArray(v.blocos)) return "falta o texto do trabalho";
  if (typeof v.versao !== "number" || v.versao < PRIMEIRA_VERSAO_DO_FORMATO || v.versao > VERSAO_DO_FORMATO) {
    return "o texto do trabalho está numa versão que este Apud não conhece";
  }

  if (!Array.isArray(v.referencias)) return "falta a lista de referências do trabalho";
  const referencias: Referencia[] = [];
  const ids = new Set<string>();
  for (const [i, r] of v.referencias.entries()) {
    const ref = conferirReferencia(r);
    if (!ref) return `a referência ${i + 1} da lista está estragada`;
    if (ids.has(ref.id)) return `a referência ${i + 1} usa o mesmo código de outra (${ref.id})`;
    ids.add(ref.id);
    referencias.push(ref);
  }

  const blocos: Bloco[] = [];
  for (const [i, b] of v.blocos.entries()) {
    const bloco = conferirBloco(b);
    if (!bloco) return `o bloco ${i + 1} do texto está estragado`;
    if (typeof bloco === "string") return `o bloco ${i + 1} do texto está estragado: ${bloco}`;
    blocos.push(bloco);
  }

  const dados = conferirDados(v.dados);
  if (!dados) return "os dados do trabalho (título, autores, curso...) estão estragados";
  // Versões 5 e 6: a abertura em caixas de marcar, convertida em blocos.
  const abertura = v.versao < 7 ? conferirAberturaDaVersao6(v.abertura) : conferirAbertura(v.abertura);
  if (typeof abertura === "string") return abertura;
  if (!Array.isArray(v.imagens)) return "falta a lista de imagens do trabalho";
  const imagens: Imagem[] = [];
  const idsDasImagens = new Set<string>();
  for (const [i, im] of v.imagens.entries()) {
    const imagem = conferirImagem(im);
    if (!imagem) return `a imagem ${i + 1} está estragada`;
    if (idsDasImagens.has(imagem.id)) return `a imagem ${i + 1} usa o mesmo código de outra (${imagem.id})`;
    idsDasImagens.add(imagem.id);
    imagens.push(imagem);
  }
  // Figura com imagem que não está no arquivo não estraga o trabalho: o Apud avisa na figura.
  return { versao: VERSAO_DO_FORMATO, dados, abertura, blocos, referencias, imagens };
}

/** O bloco conferido; null se estiver estragado; um texto com o motivo, quando há um (exceção estragada). */
function conferirBloco(b: unknown): Bloco | string | null {
  if (!objeto(b)) return null;
  const trechos = (x: unknown) => conferirTrechos(x, true);
  switch (b.tipo) {
    case "paragrafo": {
      const t = trechos(b.trechos);
      if (!t) return null;
      const ex = excecoesDoBloco(b, "paragrafo");
      return typeof ex === "string" ? ex : { tipo: "paragrafo", trechos: t, ...ex };
    }
    case "titulo": {
      const t = trechos(b.trechos);
      const nivel = b.nivel;
      if (!t || ![1, 2, 3, 4, 5].includes(nivel as number)) return null;
      // (Uma versão de teste guardava "numerado"; hoje o número é escrito no texto, e o campo é ignorado.)
      const ex = excecoesDoBloco(b, `titulos.nivel${nivel}`);
      return typeof ex === "string" ? ex : { tipo: "titulo", nivel: nivel as 1 | 2 | 3 | 4 | 5, trechos: t, ...ex };
    }
    case "lista": {
      const itens = conferirItens(b.itens);
      if (!itens || typeof b.sequencia !== "boolean") return null;
      return { tipo: "lista", sequencia: b.sequencia, itens };
    }
    case "quebra":
      return { tipo: "quebra" };
    case "referencias":
      return { tipo: "referencias" };
    // Fase 3 (versão 4)
    case "citacaoLonga": {
      const t = trechos(b.trechos);
      if (!t) return null;
      // Versão 8 (etapa 3b): a citação longa também pode ter "só este".
      const ex = excecoesDoBloco(b, "citacaoLonga");
      return typeof ex === "string" ? ex : { tipo: "citacaoLonga", trechos: t, ...ex };
    }
    case "figura": {
      if (!texto(b.imagem) || !b.imagem) return null;
      if (b.especie !== undefined && b.especie !== "grafico" && b.especie !== "quadro") return null;
      if (b.largura !== undefined && !(typeof b.largura === "number" && b.largura >= 10 && b.largura <= 100)) return null;
      const id = conferirIdentificacao(b);
      if (!id) return null;
      return {
        tipo: "figura",
        imagem: b.imagem,
        ...(b.especie ? { especie: b.especie } : {}),
        ...(b.largura !== undefined ? { largura: b.largura } : {}),
        ...id,
      };
    }
    case "tabela": {
      if (!Array.isArray(b.linhas) || b.linhas.length === 0) return null;
      const linhas: Trecho[][][] = [];
      for (const linha of b.linhas) {
        if (!Array.isArray(linha) || linha.length === 0) return null;
        const celulas: Trecho[][] = [];
        for (const c of linha) {
          const t = trechos(c);
          if (!t) return null;
          celulas.push(t);
        }
        linhas.push(celulas);
      }
      // A grade é retangular: toda linha com o mesmo número de células.
      if (linhas.some((l) => l.length !== linhas[0].length)) return null;
      const cab = b.cabecalho;
      if (typeof cab !== "number" || !Number.isInteger(cab) || cab < 0 || cab > linhas.length) return null;
      const id = conferirIdentificacao(b);
      return id && { tipo: "tabela", linhas, cabecalho: cab, ...id };
    }
    default:
      return null;
  }
}

/** As exceções de um parágrafo ou título ({} quando não há), ou o motivo do erro. */
function excecoesDoBloco(b: Record<string, unknown>, elemento: string): { excecoes?: Excecoes } | string {
  if (b.excecoes === undefined) return {};
  const c = conferirExcecoes(elemento, b.excecoes);
  if (!c.ok) return c.erro;
  return c.excecoes ? { excecoes: c.excecoes } : {};
}

/** Título, fonte e nota de uma figura ou tabela. */
function conferirIdentificacao(b: Record<string, unknown>): Identificacao | null {
  const titulo = conferirTrechos(b.titulo, true);
  const fonte = conferirTrechos(b.fonte, true);
  if (!titulo || !fonte || !opcional(b.fontePropria, simOuNao)) return null;
  let nota: Trecho[] | null | undefined;
  if (b.nota !== undefined) {
    nota = conferirTrechos(b.nota, true);
    if (!nota) return null;
  }
  return { titulo, fonte, ...(b.fontePropria ? { fontePropria: true as const } : {}), ...(nota?.length ? { nota } : {}) };
}

function conferirItens(v: unknown): ItemDeLista[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const itens: ItemDeLista[] = [];
  for (const it of v) {
    if (!objeto(it)) return null;
    const trechos = conferirTrechos(it.trechos, true);
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

/** Um pedaço de texto com marcas. */
function conferirTrechoDeTexto(t: Record<string, unknown>): TrechoDeTexto | null {
  if (typeof t.texto !== "string") return null;
  if (t.marcas === undefined) return { texto: t.texto };
  if (!Array.isArray(t.marcas) || !t.marcas.every((m) => MARCAS.includes(m))) return null;
  const marcas = MARCAS.filter((m) => (t.marcas as string[]).includes(m)) as ("negrito" | "italico" | "sobrescrito")[];
  return marcas.length ? { texto: t.texto, marcas } : { texto: t.texto };
}

/** Texto, citações e (desde a versão 4) notas de rodapé. */
function conferirTrechos(v: unknown, comNotas: boolean): Trecho[] | null {
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
    if (t.nota !== undefined) {
      if (!comNotas || !objeto(t.nota)) return null;
      const dentro = conferirSoTexto(t.nota.trechos);
      if (!dentro) return null;
      trechos.push({ nota: { trechos: dentro } });
      continue;
    }
    const tt = conferirTrechoDeTexto(t);
    if (!tt) return null;
    trechos.push(tt);
  }
  return trechos;
}

/** Só texto com marcas: notas de rodapé e os textos da abertura (resumo, dedicatória...). */
function conferirSoTexto(v: unknown): TrechoDeTexto[] | null {
  if (!Array.isArray(v)) return null;
  const trechos: TrechoDeTexto[] = [];
  for (const t of v) {
    const tt = objeto(t) ? conferirTrechoDeTexto(t) : null;
    if (!tt) return null;
    trechos.push(tt);
  }
  return trechos;
}

// ---------------------------------------------------------------------------
// Dados do trabalho, abertura e imagens (versão 4)

const CAMPOS_DOS_DADOS = ["subtitulo", "curso", "instituicao", "orientador", "cidade", "disciplina", "natureza"] as const;

/** Os dados do trabalho. Campos que este Apud não conhece são mantidos. */
function conferirDados(v: unknown): DadosDoTrabalho | null {
  if (!objeto(v)) return null;
  if (!(TIPOS_DE_TRABALHO as readonly unknown[]).includes(v.tipo)) return null;
  if (!texto(v.idioma) || !v.idioma || !texto(v.titulo)) return null;
  if (!Array.isArray(v.autores) || !v.autores.every(texto)) return null;
  if (!CAMPOS_DOS_DADOS.every((c) => opcional(v[c], texto))) return null;
  if (v.ano !== undefined && !(typeof v.ano === "number" && Number.isInteger(v.ano))) return null;
  if (!opcional(v.dataDeEntrega, conferirData)) return null;
  return structuredClone(v) as unknown as DadosDoTrabalho;
}

/** Parágrafos só de texto (dedicatória, epígrafe, agradecimentos). */
function conferirParagrafos(v: unknown): TrechoDeTexto[][] | null {
  if (!Array.isArray(v)) return null;
  const paragrafos: TrechoDeTexto[][] = [];
  for (const p of v) {
    const t = conferirSoTexto(p);
    if (!t) return null;
    paragrafos.push(t);
  }
  return paragrafos;
}

/** Os campos de um resumo (com ou sem o "tipo", que a versão 6 não tinha). */
function conferirResumo(v: unknown): Resumo | null {
  if (!objeto(v) || !texto(v.idioma) || !v.idioma || !opcional(v.titulo, texto)) return null;
  const trechos = conferirSoTexto(v.trechos);
  if (!trechos || !Array.isArray(v.palavrasChave) || !v.palavrasChave.every(texto)) return null;
  return { tipo: "resumo", idioma: v.idioma, ...(v.titulo !== undefined ? { titulo: v.titulo } : {}), trechos, palavrasChave: [...v.palavrasChave] };
}

/** Um bloco da abertura (versão 7), sem as exceções; null se estiver estragado. */
function conferirConteudoDaAbertura(v: Record<string, unknown>): BlocoDaAbertura | null {
  switch (v.tipo) {
    case "capa":
    case "folhaDeRosto":
    case "paginaDeTitulo":
    case "sumario":
      return { tipo: v.tipo };
    case "dedicatoria":
    case "agradecimentos": {
      const paragrafos = conferirParagrafos(v.paragrafos);
      return paragrafos ? { tipo: v.tipo, paragrafos } : null;
    }
    case "epigrafe": {
      const paragrafos = conferirParagrafos(v.paragrafos);
      return paragrafos && texto(v.autoria) ? { tipo: "epigrafe", paragrafos, autoria: v.autoria } : null;
    }
    case "resumo":
      return conferirResumo(v);
    default:
      return null;
  }
}

/**
 * Um bloco da abertura (versão 7), com as exceções "só este" conferidas como
 * as do texto. Null se estiver estragado; um texto com o motivo, quando há um.
 */
function conferirBlocoDaAbertura(v: unknown): BlocoDaAbertura | string | null {
  if (!objeto(v)) return null;
  const bloco = conferirConteudoDaAbertura(v);
  if (!bloco || v.excecoes === undefined) return bloco;
  const c = conferirExcecoes(ELEMENTO_DA_ABERTURA[bloco.tipo], v.excecoes);
  if (!c.ok) return c.erro;
  return c.excecoes ? { ...bloco, excecoes: c.excecoes } : bloco;
}

/** Dois blocos que não podem estar juntos: duas capas, ou dois resumos guardados no mesmo idioma. */
function repetido(blocos: BlocoDaAbertura[], umPorIdioma: boolean): BlocoDaAbertura | undefined {
  const vistos = new Set<string>();
  for (const b of blocos) {
    if (b.tipo === "resumo" && !umPorIdioma) continue;
    const chave = b.tipo === "resumo" ? `resumo ${b.idioma}` : b.tipo;
    if (vistos.has(chave)) return b;
    vistos.add(chave);
  }
  return undefined;
}

const NOME_NA_ABERTURA: Record<BlocoDaAbertura["tipo"], string> = {
  capa: "capa",
  folhaDeRosto: "folha de rosto",
  paginaDeTitulo: "página de título",
  dedicatoria: "dedicatória",
  agradecimentos: "agradecimentos",
  epigrafe: "epígrafe",
  resumo: "resumo",
  sumario: "sumário",
};

/** A abertura da versão 7: os blocos na ordem da norma, os guardados e a versão sem identificação. */
function conferirAbertura(v: unknown): Abertura | string {
  const erro = "os elementos antes do texto (capa, resumos...) estão estragados";
  if (!objeto(v) || !Array.isArray(v.blocos) || !Array.isArray(v.guardados) || typeof v.semIdentificacao !== "boolean") return erro;
  const blocos: BlocoDaAbertura[] = [];
  for (const [i, b] of v.blocos.entries()) {
    const bloco = conferirBlocoDaAbertura(b);
    if (!bloco) return `o bloco ${i + 1} da abertura está estragado`;
    if (typeof bloco === "string") return `o bloco ${i + 1} da abertura está estragado: ${bloco}`;
    const anterior = blocos[blocos.length - 1];
    if (anterior && ORDEM_DA_ABERTURA.indexOf(anterior.tipo) > ORDEM_DA_ABERTURA.indexOf(bloco.tipo)) {
      return `o bloco ${i + 1} da abertura (${NOME_NA_ABERTURA[bloco.tipo]}) está fora da ordem`;
    }
    blocos.push(bloco);
  }
  const dobrado = repetido(blocos, false);
  if (dobrado) return `a abertura tem ${NOME_NA_ABERTURA[dobrado.tipo]} duas vezes`;
  const guardados: TextoGuardavel[] = [];
  for (const [i, g] of v.guardados.entries()) {
    const bloco = conferirBlocoDaAbertura(g);
    if (!bloco || typeof bloco === "string" || bloco.tipo === "capa" || bloco.tipo === "folhaDeRosto" || bloco.tipo === "paginaDeTitulo" || bloco.tipo === "sumario") {
      return `o texto guardado ${i + 1} da abertura está estragado`;
    }
    guardados.push(bloco as TextoGuardavel);
  }
  const guardadoDobrado = repetido(guardados, true);
  if (guardadoDobrado) return `a abertura tem ${NOME_NA_ABERTURA[guardadoDobrado.tipo]} guardado duas vezes`;
  return { blocos, guardados, semIdentificacao: v.semIdentificacao };
}

/**
 * A abertura das versões 5 e 6 (caixas de marcar), convertida em blocos. Nada
 * se perde: o que estava ligado vira bloco, na ordem da norma; dedicatória,
 * agradecimentos e epígrafe desligados mas com texto ficam guardados (como na
 * versão 6, em que desligar guardava o texto). Todos os resumos viram blocos.
 */
export function conferirAberturaDaVersao6(v: unknown): Abertura | string {
  const erro = "os elementos antes do texto (capa, resumos...) estão estragados";
  if (!objeto(v)) return erro;
  const chaves = ["capa", "folhaDeRosto", "paginaDeTitulo", "sumario", "semIdentificacao"] as const;
  if (!chaves.every((c) => typeof v[c] === "boolean")) return erro;
  const elemento = (x: unknown) => (objeto(x) && typeof x.incluir === "boolean" ? { incluir: x.incluir, paragrafos: conferirParagrafos(x.paragrafos) } : null);
  const dedicatoria = elemento(v.dedicatoria);
  const agradecimentos = elemento(v.agradecimentos);
  const epigrafe = elemento(v.epigrafe);
  if (!dedicatoria?.paragrafos || !agradecimentos?.paragrafos || !epigrafe?.paragrafos || !objeto(v.epigrafe) || !texto(v.epigrafe.autoria)) return erro;
  if (!Array.isArray(v.resumos)) return erro;
  const resumos: Resumo[] = [];
  for (const [i, r] of v.resumos.entries()) {
    const resumo = conferirResumo(r);
    if (!resumo) return `o resumo ${i + 1} está estragado`;
    resumos.push(resumo);
  }
  const textos: TextoGuardavel[] = [
    { tipo: "dedicatoria", paragrafos: dedicatoria.paragrafos },
    { tipo: "agradecimentos", paragrafos: agradecimentos.paragrafos },
    { tipo: "epigrafe", paragrafos: epigrafe.paragrafos, autoria: v.epigrafe.autoria },
  ];
  const incluir = { dedicatoria: dedicatoria.incluir, agradecimentos: agradecimentos.incluir, epigrafe: epigrafe.incluir };
  const blocos: BlocoDaAbertura[] = [];
  const guardados: TextoGuardavel[] = [];
  for (const tipo of ["capa", "folhaDeRosto", "paginaDeTitulo"] as const) if (v[tipo]) blocos.push({ tipo });
  for (const t of textos) {
    const tipo = t.tipo as "dedicatoria" | "agradecimentos" | "epigrafe";
    if (incluir[tipo]) blocos.push(t);
    else if (temTextoNaAbertura(t)) guardados.push(t);
  }
  blocos.push(...resumos);
  if (v.sumario) blocos.push({ tipo: "sumario" });
  return { blocos, guardados, semIdentificacao: v.semIdentificacao as boolean };
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
const inteiroPositivo = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

/** Uma imagem: o código, o formato e o arquivo em base64. Campos desconhecidos são mantidos. */
function conferirImagem(v: unknown): Imagem | null {
  if (!objeto(v) || !texto(v.id) || !v.id) return null;
  if (!(FORMATOS_DE_IMAGEM as readonly unknown[]).includes(v.formato)) return null;
  if (!texto(v.dados) || v.dados.length % 4 !== 0 || !BASE64.test(v.dados)) return null;
  if (!opcional(v.largura, inteiroPositivo) || !opcional(v.altura, inteiroPositivo) || !opcional(v.nome, texto)) return null;
  return structuredClone(v) as unknown as Imagem;
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
  "notas",
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
  if (!opcional(v.autoresOrganizadores, simOuNao)) return null;
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
