// As peças do editor: o que ele aceita (títulos, parágrafos, listas, negrito,
// itálico, sobrescrito) e o que ele recusa de propósito.

import { Extension, type Editor, type Range } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Superscript from "@tiptap/extension-superscript";
import Placeholder from "@tiptap/extension-placeholder";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { Plugin, PluginKey } from "@tiptap/pm/state";
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
    barraDeBlocos(controle),
  ];
}
