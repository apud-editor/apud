// A estrutura do trabalho (a barra da esquerda do editor): os títulos, como a
// pessoa escreveu, e a lista de referências, onde ela pôs. O número também é
// dela ("1.1 Contexto"): o Apud não numera sozinho.

import { textoSimples, type Bloco, type NivelDeTitulo } from "./modelo";

export interface EntradaDaEstrutura {
  /** Posição do título (ou da lista de referências) na lista de blocos. */
  indice: number;
  nivel: NivelDeTitulo;
  texto: string;
  /** É a lista de referências: o texto (título) vem da norma. */
  referencias?: boolean;
}

export function estrutura(blocos: Bloco[]): EntradaDaEstrutura[] {
  const saida: EntradaDaEstrutura[] = [];
  blocos.forEach((b, indice) => {
    if (b.tipo === "titulo") saida.push({ indice, nivel: b.nivel, texto: textoSimples(b.trechos).trim() });
    if (b.tipo === "referencias") saida.push({ indice, nivel: 1, texto: "", referencias: true });
  });
  return saida;
}

/**
 * Separa o número que a pessoa escreveu no começo do título: "1.1 Contexto"
 * vira { numero: "1.1", resto: "Contexto" }. Sem número, numero fica vazio.
 * Aceita "1", "1.1", "2.3.1" e também com ponto no fim ("1.").
 */
export function separarNumero(texto: string): { numero: string; resto: string } {
  const m = texto.match(/^\s*(\d+(?:\.\d+)*\.?)\s+(?=\S)/);
  return m ? { numero: m[1], resto: texto.slice(m[0].length) } : { numero: "", resto: texto };
}
