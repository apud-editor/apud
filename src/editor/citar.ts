// A citação dentro do editor: onde o "@" pode abrir a janela, como a citação
// entra, troca e sai do texto, e o que a colagem guarda. Funções puras sobre o
// estado do editor (ProseMirror), para poderem ser testadas sem navegador.

import { NodeSelection, Selection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { Node as NoPM } from "@tiptap/pm/model";
import { NO_DA_CITACAO } from "../documento/tiptap";
import type { Citacao } from "../documento/modelo";

/**
 * O "@" abre a janela no começo de um parágrafo ou depois de um espaço. Em
 * qualquer outro lugar ("ana@exemplo.org") ele é só um @. Mesma regra da barra "/".
 */
export function podeAbrirAqui(doc: NoPM, pos: number): boolean {
  const $p = doc.resolve(pos);
  if (!$p.parent.isTextblock) return false;
  if ($p.parentOffset === 0) return true;
  const antes = $p.parent.textBetween($p.parentOffset - 1, $p.parentOffset, undefined, "￼");
  return /^\s$/u.test(antes);
}

/** Coloca a citação no lugar do trecho de..ate (um ponto, quando de == ate) e leva o cursor para depois dela. */
export function inserirCitacao(state: EditorState, de: number, ate: number, c: Citacao): Transaction {
  const no = state.schema.nodes[NO_DA_CITACAO].create({ dados: c });
  const tr = state.tr.replaceWith(de, ate, no);
  return tr.setSelection(Selection.near(tr.doc.resolve(de + no.nodeSize), 1)).scrollIntoView();
}

/** Troca os dados da citação que está em pos. Com null, apaga a citação. Devolve null se pos não tem uma citação. */
export function trocarCitacao(state: EditorState, pos: number, c: Citacao | null): Transaction | null {
  const no = state.doc.nodeAt(pos);
  if (no?.type.name !== NO_DA_CITACAO) return null;
  if (c === null) {
    const tr = state.tr.delete(pos, pos + no.nodeSize);
    return tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size)), -1)).scrollIntoView();
  }
  return state.tr.setNodeMarkup(pos, undefined, { dados: c }).scrollIntoView();
}

/** Escreve o texto "@" no lugar do trecho (quando a pessoa quer mesmo um @, e não uma citação). */
export function escreverArroba(state: EditorState, de: number, ate: number): Transaction {
  return state.tr.insertText("@", de, ate);
}

/** Se a seleção é uma citação (por exemplo, depois de um clique ou de setas), onde ela está. */
export function citacaoSelecionada(state: EditorState): { pos: number; citacao: Citacao } | null {
  const s = state.selection;
  if (!(s instanceof NodeSelection) || s.node.type.name !== NO_DA_CITACAO || !s.node.attrs.dados) return null;
  return { pos: s.from, citacao: s.node.attrs.dados as Citacao };
}

/**
 * O que foi copiado veio do próprio Apud, com citações? Então a colagem
 * mantém as citações. O resto (Word, Docs, páginas da internet) continua
 * entrando como texto simples, sem formatação (decisão da versão 1).
 */
export function colagemDoApud(html: string): boolean {
  return /\sdata-citacao\s*=/i.test(html);
}

/** As citações do documento, na ordem do texto, com o lugar de cada uma. Citação sem dados (arquivo estragado) fica de fora, como no modelo. */
export function citacoesDoEditor(doc: NoPM): { no: NoPM; pos: number }[] {
  const achadas: { no: NoPM; pos: number }[] = [];
  doc.descendants((no, pos) => {
    if (no.type.name === NO_DA_CITACAO && no.attrs.dados) achadas.push({ no, pos });
    return true;
  });
  return achadas;
}
