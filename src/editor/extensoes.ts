// As peças do editor: o que ele aceita (títulos, parágrafos, listas, negrito,
// itálico, sobrescrito) e o que ele recusa de propósito.

import { Extension, type Editor, type Range } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Superscript from "@tiptap/extension-superscript";
import Placeholder from "@tiptap/extension-placeholder";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { Plugin, PluginKey, Selection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { buscarBlocos, type TipoDeBloco } from "./blocos";

// ---------------------------------------------------------------------------
// Colar sempre como texto simples (decisão da versão 1)

/** Divide o texto colado em parágrafos: cada quebra de linha é um parágrafo novo. */
export function paragrafosColados(texto: string): string[] {
  return texto
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[\t ]+/g, " ").replace(/ {2,}/g, " ").trim())
    .filter(Boolean);
}

const ColarSemFormatacao = Extension.create({
  name: "colarSemFormatacao",
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("colarSemFormatacao"),
        props: {
          handlePaste: (_view, event) => {
            const partes = paragrafosColados(event.clipboardData?.getData("text/plain") ?? "");
            if (partes.length === 0) return true; // sem texto (uma imagem, por exemplo): ignora
            const conteudo =
              partes.length === 1
                ? { type: "text", text: partes[0] }
                : partes.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] }));
            editor.chain().focus().insertContent(conteudo).run();
            return true;
          },
          // Texto arrastado de fora também entra sem formatação.
          handleDrop: (_view, event, _slice, moved) => {
            if (moved) return false;
            const partes = paragrafosColados(event.dataTransfer?.getData("text/plain") ?? "");
            if (partes.length === 0) return false;
            editor.chain().focus().insertContent(partes.join(" ")).run();
            return true;
          },
        },
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Listas mais fáceis de apagar e de sair
//
// - Backspace num item vazio apaga o item e o cursor volta para o fim do item de
//   cima, sem sair da lista. (Antes, o item virava um parágrafo depois da lista.)
// - Shift+Enter dentro da lista sai dela: cria um parágrafo logo depois da lista.

/** Onde está o item de lista do cursor, se o cursor estiver num item. */
function itemDoCursor(state: EditorState) {
  const { $from, empty } = state.selection;
  if (!empty) return null;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "listItem") {
      const item = $from.node(d);
      const vazio = item.childCount === 1 && item.firstChild!.content.size === 0 && $from.parent === item.firstChild;
      return { $from, d, vazio };
    }
  }
  return null;
}

/**
 * Apaga o item vazio do cursor sem sair da lista. O cursor vai para o fim do
 * item de cima ou, se o item era o primeiro, para o começo do item de baixo.
 * Se o item for o único da sublista, apaga a sublista inteira (uma lista não pode ficar vazia).
 * Devolve null quando o item é o único da lista: aí não há onde ficar na lista.
 */
function apagarItemVazio(state: EditorState): Transaction | null {
  const info = itemDoCursor(state);
  if (!info?.vazio) return null;
  const { $from, d } = info;
  const lista = $from.node(d - 1);
  const sublistaInteira = lista.childCount === 1;
  if (sublistaInteira && d - 1 === 1) return null; // o único item da lista
  const [de, ate] = sublistaInteira ? [$from.before(d - 1), $from.after(d - 1)] : [$from.before(d), $from.after(d)];
  const [inicioDaLista, fimDaLista] = [$from.before(1), $from.after(1)];

  const anterior = Selection.findFrom(state.doc.resolve(de), -1, true);
  const seguinte = Selection.findFrom(state.doc.resolve(ate), 1, true);
  const tr = state.tr.delete(de, ate);
  if (anterior && anterior.from > inicioDaLista) {
    return tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(anterior.from, -1)));
  }
  if (seguinte && seguinte.from < fimDaLista) {
    return tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(seguinte.from, 1)));
  }
  return null;
}

const ListasFaceis = Extension.create({
  name: "listasFaceis",
  // Antes dos atalhos normais das listas.
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const tr = apagarItemVazio(editor.state);
        if (!tr) return false; // deixa o Backspace normal agir
        editor.view.dispatch(tr.scrollIntoView());
        return true;
      },
      "Shift-Enter": ({ editor }) => {
        const { state } = editor;
        const info = itemDoCursor(state);
        if (!info) return false;
        const paragrafo = state.schema.nodes.paragraph.create();
        const [inicio, fim] = [info.$from.before(1), info.$from.after(1)];
        let tr: Transaction;
        let cursor: number;
        if (info.vazio && state.doc.nodeAt(inicio)!.childCount === 1 && info.d === 2) {
          // A lista só tem este item, vazio: ela vira o parágrafo.
          tr = state.tr.replaceWith(inicio, fim, paragrafo);
          cursor = inicio + 1;
        } else {
          // Um item vazio some ao sair da lista.
          tr = apagarItemVazio(state) ?? state.tr;
          const fimDaLista = tr.mapping.map(fim);
          const depois = tr.doc.nodeAt(fimDaLista);
          // Se já há um parágrafo vazio logo depois da lista, o cursor vai para ele.
          if (!(depois?.type.name === "paragraph" && depois.content.size === 0)) tr = tr.insert(fimDaLista, paragrafo);
          cursor = fimDaLista + 1;
        }
        tr.setSelection(TextSelection.create(tr.doc, cursor));
        editor.view.dispatch(tr.scrollIntoView());
        return true;
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Barra "/": digitar / abre a lista de blocos

export interface EstadoDaBarra {
  aberta: boolean;
  itens: TipoDeBloco[];
  selecionado: number;
  /** Onde desenhar a lista na tela. */
  posicao: { x: number; y: number } | null;
}

/** Guarda o estado da barra "/" e avisa a tela quando ele muda. */
export class ControleDaBarra {
  estado: EstadoDaBarra = { aberta: false, itens: [], selecionado: 0, posicao: null };
  private ouvintes = new Set<() => void>();
  private escolher: ((t: TipoDeBloco) => void) | null = null;

  ouvir = (f: () => void) => {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  };
  ler = () => this.estado;

  mudar(parcial: Partial<EstadoDaBarra>) {
    this.estado = { ...this.estado, ...parcial };
    this.ouvintes.forEach((f) => f());
  }

  abrir(props: SuggestionProps<TipoDeBloco, TipoDeBloco>) {
    this.escolher = props.command;
    const r = props.clientRect?.();
    this.mudar({
      aberta: true,
      itens: props.items,
      selecionado: 0,
      posicao: r ? { x: r.left, y: r.bottom + 6 } : null,
    });
  }

  fechar() {
    this.escolher = null;
    this.mudar({ aberta: false });
  }

  confirmar(indice = this.estado.selecionado) {
    const t = this.estado.itens[indice];
    if (t && this.escolher) this.escolher(t);
  }

  tecla(e: KeyboardEvent): boolean {
    const n = this.estado.itens.length;
    if (!this.estado.aberta) return false;
    if (e.key === "Escape") {
      this.fechar();
      return true;
    }
    if (n === 0) return false;
    if (e.key === "ArrowDown") this.mudar({ selecionado: (this.estado.selecionado + 1) % n });
    else if (e.key === "ArrowUp") this.mudar({ selecionado: (this.estado.selecionado - 1 + n) % n });
    else if (e.key === "Enter" || e.key === "Tab") this.confirmar();
    else return false;
    return true;
  }
}

function barraDeBlocos(controle: ControleDaBarra) {
  return Extension.create({
    name: "barraDeBlocos",
    addProseMirrorPlugins() {
      return [
        Suggestion<TipoDeBloco, TipoDeBloco>({
          editor: this.editor,
          pluginKey: new PluginKey("barraDeBlocos"),
          char: "/",
          startOfLine: false,
          // Só abre no começo do texto ou depois de um espaço, para não atrapalhar "e/ou" e datas.
          allowedPrefixes: [" "],
          items: ({ query }) => buscarBlocos(query),
          command: ({ editor, range, props }: { editor: Editor; range: Range; props: TipoDeBloco }) => {
            props.aplicar(editor.chain().focus().deleteRange(range)).run();
          },
          render: () => ({
            onStart: (p) => controle.abrir(p),
            onUpdate: (p) => controle.abrir(p),
            onExit: () => controle.fechar(),
            onKeyDown: ({ event }) => controle.tecla(event),
          }),
        }),
      ];
    },
  });
}

// ---------------------------------------------------------------------------

export function extensoesDoApud(controle: ControleDaBarra) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5] },
      // Fora do Apud de propósito: são formatação, não significado,
      // ou chegam depois como blocos próprios (citação longa, na fase 3).
      blockquote: false,
      code: false,
      codeBlock: false,
      hardBreak: false,
      horizontalRule: false,
      link: false,
      strike: false,
      underline: false,
    }),
    Superscript,
    Placeholder.configure({
      placeholder: ({ node }) =>
        node.type.name === "heading" ? "Título" : "Escreva aqui. Digite / para escolher o tipo de bloco.",
    }),
    ColarSemFormatacao,
    ListasFaceis,
    barraDeBlocos(controle),
  ];
}
