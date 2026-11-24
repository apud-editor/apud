// Mudar um bloco de lugar (etapa 2d da v2): arrastar pela alça ⋮⋮ ou "Mover para cima / para baixo".
//
// Aqui fica só a conta, sem tela, para ser testada:
//  - de todas as lacunas entre os blocos (0 = antes do primeiro, n = depois do último), qual
//    fica mais perto do mouse (`lacunaDaSoltura`);
//  - onde desenhar a linha cobalto (`alturaDaLinha`);
//  - o que mover (`podeMover`), para onde (`lacunaAoMover`) e a mudança no texto (`moverBloco`).
//
// Cada bloco anda sozinho, inclusive os títulos: arrastar um Título 1 não leva o texto de baixo.
// Ficam onde estão, por serem montados pelo Apud, a lista de Referências (que não tem alça) e as
// linhas de "Página nova" do modelo (que são só um desenho e acompanham o título sozinhas).
// Tudo o que depende da ordem (numeração dos títulos, citações numéricas, Estrutura, Prévia)
// se refaz sozinho, porque mover é uma mudança comum no texto.

import { Selection, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { Node as NoPM } from "@tiptap/pm/model";
import { NO_DA_LISTA_DE_REFERENCIAS } from "../documento/tiptap";

/** O espaço que um bloco ocupa na tela, de cima (topo) até embaixo (base), na mesma medida do mouse. */
export interface Faixa {
  topo: number;
  base: number;
}

/** Metade do espaço entre dois blocos (18 px), onde a linha cobalto é desenhada. */
export const MEIA_MARGEM = 9;

/**
 * A lacuna de soltura para o mouse na altura `y`. A lacuna `k` fica antes do bloco `k`: com o mouse
 * na metade de cima de um bloco o bloco cai antes dele, na de baixo cai depois.
 */
export function lacunaDaSoltura(faixas: Faixa[], y: number): number {
  for (let k = 0; k < faixas.length; k++) {
    if (y < (faixas[k].topo + faixas[k].base) / 2) return k;
  }
  return faixas.length;
}

/** Soltar o bloco `de` na lacuna `lacuna` não muda nada (a lacuna é a de cima ou a de baixo dele). */
export const ficaNoMesmoLugar = (de: number, lacuna: number) => lacuna === de || lacuna === de + 1;

/** A altura da linha cobalto: logo abaixo do bloco de cima (ou logo acima do primeiro). */
export function alturaDaLinha(faixas: Faixa[], lacuna: number): number | null {
  if (faixas.length === 0) return null;
  if (lacuna <= 0) return faixas[0].topo - MEIA_MARGEM;
  return faixas[Math.min(lacuna, faixas.length) - 1].base + MEIA_MARGEM;
}

/** O bloco pode ser movido? Só a lista de Referências, montada pelo Apud, fica no lugar. */
export const podeMover = (no: NoPM | null | undefined): boolean => !!no && no.type.name !== NO_DA_LISTA_DE_REFERENCIAS;

/**
 * A lacuna para onde o bloco `de` vai ao "subir" ou "descer" um lugar. Nulo no primeiro bloco
 * (não sobe) e no último (não desce).
 */
export function lacunaAoMover(de: number, quantos: number, sentido: "cima" | "baixo"): number | null {
  if (sentido === "cima") return de > 0 ? de - 1 : null;
  return de < quantos - 1 ? de + 2 : null;
}

/** Onde o bloco fica, na ordem dos blocos, depois de ser solto na lacuna. */
export const indiceDepoisDeMover = (de: number, lacuna: number) => (lacuna > de ? lacuna - 1 : lacuna);

/** A mudança no texto que leva o bloco `de` para a lacuna `lacuna`. Nula se nada muda ou se o bloco não pode ser movido. */
export function moverBloco(estado: EditorState, de: number, lacuna: number): Transaction | null {
  const doc = estado.doc;
  if (de < 0 || de >= doc.childCount || lacuna < 0 || lacuna > doc.childCount) return null;
  if (ficaNoMesmoLugar(de, lacuna)) return null;
  const no = doc.child(de);
  if (!podeMover(no)) return null;

  const inicio = (indice: number) => {
    let pos = 0;
    for (let i = 0; i < indice; i++) pos += doc.child(i).nodeSize;
    return pos;
  };
  const posDe = inicio(de);
  const posLacuna = inicio(lacuna);
  const tr = estado.tr;
  // Põe a cópia no destino e depois apaga o original. Uma só mudança: o Ctrl+Z desfaz tudo.
  tr.insert(posLacuna, no);
  const novaPos = lacuna > de ? posLacuna - no.nodeSize : posLacuna;
  if (lacuna > de) tr.delete(posDe, posDe + no.nodeSize);
  else tr.delete(posDe + no.nodeSize, posDe + 2 * no.nodeSize);
  // O cursor vai para dentro do bloco movido, que continua sendo o bloco ativo.
  tr.setSelection(Selection.near(tr.doc.resolve(Math.min(novaPos + 1, tr.doc.content.size)), 1));
  return tr.scrollIntoView();
}
