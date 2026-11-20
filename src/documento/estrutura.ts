// A estrutura do trabalho (a barra da esquerda do editor): os títulos, com a
// numeração progressiva da ABNT (NBR 6024): 1, 1.1, 1.1.1...

import { textoSimples, type Bloco, type NivelDeTitulo } from "./modelo";

export interface EntradaDaEstrutura {
  /** Posição do título na lista de blocos. */
  indice: number;
  nivel: NivelDeTitulo;
  /** "1.2", ou "" quando a norma não numera. */
  numero: string;
  texto: string;
}

/**
 * Lista os títulos com a numeração.
 * Se um nível for pulado (um título 3 logo depois de um título 1), o nível que
 * faltou aparece como 0 ("1.0.1"), para a pessoa perceber que falta um título.
 */
export function estrutura(blocos: Bloco[], numerar = true): EntradaDaEstrutura[] {
  const contadores = [0, 0, 0, 0, 0];
  const saida: EntradaDaEstrutura[] = [];
  blocos.forEach((b, indice) => {
    if (b.tipo !== "titulo") return;
    const texto = textoSimples(b.trechos).trim();
    // Um título vazio não aparece no PDF, então também não ganha número aqui.
    if (!texto) {
      saida.push({ indice, nivel: b.nivel, numero: "", texto });
      return;
    }
    contadores[b.nivel - 1] += 1;
    for (let i = b.nivel; i < contadores.length; i++) contadores[i] = 0;
    const numero = numerar ? contadores.slice(0, b.nivel).join(".") : "";
    saida.push({ indice, nivel: b.nivel, numero, texto });
  });
  return saida;
}
