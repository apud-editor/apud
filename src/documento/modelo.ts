// O modelo do documento: como o Apud guarda um trabalho.
//
// O trabalho é uma sequência de blocos com significado ("isto é um título de
// nível 2", "isto é uma lista"), nunca formatação ("Times 12, negrito"). Quem
// decide a aparência é o perfil da norma, na hora de montar o PDF.
//
// Este formato é do Apud, e não da biblioteca do editor (TipTap). Assim, se um
// dia o editor mudar, os arquivos dos trabalhos continuam valendo. A conversão
// entre os dois fica em tiptap.ts.

/** Versão do formato. Sobe quando o formato mudar, para os arquivos antigos serem convertidos. */
export const VERSAO_DO_FORMATO = 1;

/** Marcas dentro do texto. Itálico, por exemplo, para palavras estrangeiras. */
export type Marca = "negrito" | "italico" | "sobrescrito";

/** Um pedaço de texto com as mesmas marcas. */
export interface Trecho {
  texto: string;
  /** Sempre na ordem negrito, italico, sobrescrito. Ausente quando não há marcas. */
  marcas?: Marca[];
}

export type NivelDeTitulo = 1 | 2 | 3 | 4 | 5;

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

export type Bloco = Titulo | Paragrafo | Lista;

/** O texto do trabalho. Dados do trabalho, referências e ajustes da norma entram nas próximas etapas. */
export interface Documento {
  versao: typeof VERSAO_DO_FORMATO;
  blocos: Bloco[];
}

export const ORDEM_DAS_MARCAS: readonly Marca[] = ["negrito", "italico", "sobrescrito"];

/** Junta o texto de vários trechos, sem as marcas. */
export function textoSimples(trechos: Trecho[]): string {
  return trechos.map((t) => t.texto).join("");
}

export function documentoVazio(): Documento {
  return { versao: VERSAO_DO_FORMATO, blocos: [{ tipo: "paragrafo", trechos: [] }] };
}
