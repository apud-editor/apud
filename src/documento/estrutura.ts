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

/** Os números que podem vir depois de `atual` (o último número escrito): o próximo irmão em cada nível ou o primeiro filho. */
function numerosPossiveis(atual: number[]): string[] {
  if (atual.length === 0) return ["1"];
  const lista: string[] = [];
  for (let i = atual.length; i >= 1; i--) lista.push([...atual.slice(0, i - 1), atual[i - 1] + 1].join("."));
  lista.push([...atual, 1].join("."));
  return lista;
}

/**
 * Confere se os números que a pessoa escreveu nos títulos seguem a ordem (1, 1.1, 1.2, 2…).
 * Devolve o aviso de cada título fora de ordem, pelo índice do bloco. Título sem número é
 * ignorado (o Apud não numera sozinho). Depois de um número fora de ordem, a conferência
 * segue dele, para um engano só gerar um aviso.
 */
export function avisosDeNumeracao(titulos: EntradaDaEstrutura[]): Map<number, string> {
  const avisos = new Map<number, string>();
  let atual: number[] = [];
  for (const t of titulos) {
    if (t.referencias) continue;
    const { numero } = separarNumero(t.texto);
    if (!numero) continue;
    const partes = numero.replace(/\.$/, "").split(".").map(Number);
    const possiveis = numerosPossiveis(atual);
    if (!possiveis.includes(partes.join("."))) {
      const dito = possiveis.slice(0, 3).join(", ").replace(/, ([^,]*)$/, " ou $1");
      avisos.set(
        t.indice,
        atual.length === 0
          ? `O primeiro título numerado deveria ser o 1, e não o ${partes.join(".")}.`
          : `O número ${partes.join(".")} está fora de ordem: depois do ${atual.join(".")} viria ${dito}.`,
      );
    }
    atual = partes;
  }
  return avisos;
}
