// O modelo do documento: como o Apud guarda um trabalho.
//
// O trabalho é uma sequência de blocos com significado ("isto é um título de
// nível 2", "isto é uma lista"), nunca formatação ("Times 12, negrito"). Quem
// decide a aparência é o perfil da norma, na hora de montar o PDF.
//
// Este formato é do Apud, e não da biblioteca do editor (TipTap). Assim, se um
// dia o editor mudar, os arquivos dos trabalhos continuam valendo. A conversão
// entre os dois fica em tiptap.ts.
//
// Versões do formato:
//   1. Fase 1: títulos, parágrafos, listas e quebras de página.
//   2. Fase 2: as referências do trabalho e as citações dentro do texto.
//      Um documento da versão 1 vira versão 2 sem perder nada: ganha uma
//      lista de referências vazia (atualizarDocumento, em arquivos/formato.ts).

import type { Citacao, Referencia } from "./referencias";

export * from "./referencias";

/** Versão do formato. Sobe quando o formato mudar, para os arquivos antigos serem convertidos. */
export const VERSAO_DO_FORMATO = 2;

/** Marcas dentro do texto. Itálico, por exemplo, para palavras estrangeiras. */
export type Marca = "negrito" | "italico" | "sobrescrito";

/** Um pedaço de texto com as mesmas marcas. */
export interface TrechoDeTexto {
  texto: string;
  /** Sempre na ordem negrito, italico, sobrescrito. Ausente quando não há marcas. */
  marcas?: Marca[];
}

/** Uma citação no meio do texto. Ela não tem marcas: a forma vem da norma. */
export interface TrechoDeCitacao {
  citacao: Citacao;
}

/** O conteúdo de um parágrafo, título ou item de lista: texto e citações. */
export type Trecho = TrechoDeTexto | TrechoDeCitacao;

export const ehCitacao = (t: Trecho): t is TrechoDeCitacao => "citacao" in t;

export type NivelDeTitulo = 1 | 2 | 3 | 4 | 5;

/**
 * Um título. O número (1, 1.1, 2...) é escrito pela própria pessoa, no começo
 * do texto ("1.1 Contexto"); sem número escrito, o título sai sem número.
 */
export interface Titulo {
  tipo: "titulo";
  nivel: NivelDeTitulo;
  trechos: Trecho[];
}

export interface Paragrafo {
  tipo: "paragrafo";
  trechos: Trecho[];
}

export interface ItemDeLista {
  trechos: Trecho[];
  /** Itens dentro do item (na ABNT, as sub-alíneas). */
  subitens?: ItemDeLista[];
}

export interface Lista {
  tipo: "lista";
  /**
   * Se a ordem dos itens importa (passos de um procedimento).
   * A ABNT usa alíneas a), b) nos dois casos; a APA numera só as listas em sequência.
   */
  sequencia: boolean;
  itens: ItemDeLista[];
}

/** Quebra de página: o que vem depois começa numa página nova. A pessoa decide onde. */
export interface QuebraDePagina {
  tipo: "quebra";
}

export type Bloco = Titulo | Paragrafo | Lista | QuebraDePagina;

/** O texto do trabalho e as referências que ele usa. Os dados do trabalho (capa) entram na fase 3. */
export interface Documento {
  versao: typeof VERSAO_DO_FORMATO;
  blocos: Bloco[];
  /** As referências cadastradas, na ordem do cadastro. A lista final sai na ordem da norma. */
  referencias: Referencia[];
}

export const ORDEM_DAS_MARCAS: readonly Marca[] = ["negrito", "italico", "sobrescrito"];

/** Junta o texto de vários trechos, sem as marcas e sem as citações. */
export function textoSimples(trechos: Trecho[]): string {
  return trechos.map((t) => (ehCitacao(t) ? "" : t.texto)).join("");
}

export function documentoVazio(): Documento {
  return { versao: VERSAO_DO_FORMATO, blocos: [{ tipo: "paragrafo", trechos: [] }], referencias: [] };
}
