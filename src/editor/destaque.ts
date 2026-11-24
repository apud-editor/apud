// Quais blocos aparecem em destaque (etapa 2d da v2): o editor é limpo por padrão.
//
// - o bloco sob o mouse ganha contorno tracejado e a etiqueta do tipo na margem (`bloco-sobre`);
// - o bloco do cursor (ou os da seleção) ganha contorno cobalto contínuo e a etiqueta (`bloco-selecionado`);
// - o bloco que está sendo arrastado fica esmaecido (`bloco-arrastado`);
// - "Ver elementos" põe a etiqueta em todos os blocos de uma vez, sem contorno (`ver-elementos` no texto).
//
// Tudo é só desenho (decorações do ProseMirror): nada disso entra no arquivo nem no PDF. O CSS está
// em App.css. Quem diz o bloco sob o mouse e o que se arrasta é a tela (Ajustes.tsx), por `destacar`.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

export interface EstadoDoDestaque {
  /** O índice do bloco sob o mouse. */
  sobre: number | null;
  /** O índice do bloco que está sendo arrastado. */
  arrastando: number | null;
  /** "Ver elementos": a etiqueta em todos os blocos. */
  verTudo: boolean;
}

const CHAVE = new PluginKey<EstadoDoDestaque>("destaqueDosBlocos");

const VAZIO: EstadoDoDestaque = { sobre: null, arrastando: null, verTudo: false };

/** Muda uma parte do destaque (só desenho: não entra no histórico do Ctrl+Z). */
export function destacar(view: EditorView, mudanca: Partial<EstadoDoDestaque>) {
  const atual = CHAVE.getState(view.state) ?? VAZIO;
  const novo = { ...atual, ...mudanca };
  if (novo.sobre === atual.sobre && novo.arrastando === atual.arrastando && novo.verTudo === atual.verTudo) return;
  view.dispatch(view.state.tr.setMeta(CHAVE, mudanca).setMeta("addToHistory", false));
}

export const destaqueAtual = (estado: EditorState): EstadoDoDestaque => CHAVE.getState(estado) ?? VAZIO;

/** Os índices dos blocos do topo que a seleção toca. */
export function blocosDaSelecao(estado: EditorState): number[] {
  const { from, to } = estado.selection;
  const indices: number[] = [];
  estado.doc.forEach((no, inicio, indice) => {
    const fim = inicio + no.nodeSize;
    // O cursor sozinho conta no bloco em que está; uma faixa conta nos blocos que ela cobre de verdade.
    if (from === to ? from >= inicio && from <= fim : from < fim && to > inicio) indices.push(indice);
  });
  return indices;
}

function desenhar(estado: EditorState): DecorationSet {
  const { sobre, arrastando } = destaqueAtual(estado);
  const selecionados = new Set(blocosDaSelecao(estado));
  const marcas: Decoration[] = [];
  estado.doc.forEach((no, inicio, indice) => {
    const classes: string[] = [];
    if (selecionados.has(indice)) classes.push("bloco-selecionado");
    else if (indice === sobre) classes.push("bloco-sobre");
    if (indice === arrastando) classes.push("bloco-arrastado");
    if (classes.length) marcas.push(Decoration.node(inicio, inicio + no.nodeSize, { class: classes.join(" ") }));
  });
  return DecorationSet.create(estado.doc, marcas);
}

export const destaqueDosBlocos = Extension.create({
  name: "destaqueDosBlocos",
  addProseMirrorPlugins() {
    return [
      new Plugin<EstadoDoDestaque>({
        key: CHAVE,
        state: {
          init: () => VAZIO,
          apply(tr, valor) {
            const pedido = tr.getMeta(CHAVE) as Partial<EstadoDoDestaque> | undefined;
            // Os índices dos blocos mudam quando o texto muda: o "sob o mouse" e o "arrastando" ficam para a tela refazer.
            const base = tr.docChanged ? { ...valor, sobre: null, arrastando: null } : valor;
            return pedido ? { ...base, ...pedido } : base;
          },
        },
        props: {
          decorations: desenhar,
          // "Ver elementos" é uma classe no texto todo.
          attributes: (estado): Record<string, string> => (destaqueAtual(estado).verTudo ? { class: "ver-elementos" } : {}),
        },
      }),
    ];
  },
});
