// As peças do editor: o que ele aceita (títulos, parágrafos, listas, negrito,
// itálico, sobrescrito) e o que ele recusa de propósito.

import { Extension, Node, type Editor, type Range } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Superscript from "@tiptap/extension-superscript";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Placeholder from "@tiptap/extension-placeholder";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { Plugin, PluginKey, Selection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { buscarBlocos, type TipoDeBloco } from "./blocos";
import {
  NO_DA_CITACAO,
  NO_DA_CITACAO_LONGA,
  NO_DA_FONTE_DA_ILUSTRACAO,
  NO_DA_LISTA_DE_REFERENCIAS,
  NO_DA_NOTA_DA_ILUSTRACAO,
  NO_DO_TITULO_DA_ILUSTRACAO,
} from "../documento/tiptap";
import type { Citacao } from "../documento/modelo";
import type { CitacaoMontada } from "../citacoes/motor";
import { CitacoesNoTexto, ControleDaJanela } from "./citacoes";
import { arrobaRapido, ControleDoArroba } from "./arroba";
import { ControleDoReconhecimento, reconhecerCitacaoEscrita } from "./reconhecer";
import { citacaoSelecionada, colagemDoApud } from "./citar";
import { nosDaFase3, type ControlesDosNos } from "./nos";
import { excecoesQueValem } from "../modelos/excecoes";
import { TitulosDoTrabalho, titulosAutomaticos } from "./titulos";
import { colarNaGrade, cursorNaGrade, gradeDoTextoColado, tabelaDaPlanilha } from "./ilustracoes";

// ---------------------------------------------------------------------------
// Colar como texto simples (decisão da versão 1). A exceção é o que foi
// copiado do próprio Apud com citações: aí as citações vêm junto.

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
  // Antes do colar da tabela (prosemirror-tables), que também quer a colagem
  // quando o cursor está numa tabela: a planilha tem de passar por aqui primeiro.
  priority: 1000,
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("colarSemFormatacao"),
        props: {
          handlePaste: (_view, event) => {
            // Trecho copiado do Apud: o editor cola como está, com as citações.
            if (colagemDoApud(event.clipboardData?.getData("text/html") ?? "")) return false;
            // Planilha (Excel, Calc): dentro de uma tabela, preenche a grade; num parágrafo vazio, cria a tabela.
            const planilha = gradeDoTextoColado(event.clipboardData?.getData("text/plain") ?? "");
            if (planilha) {
              const estado = editor.state;
              const tr = cursorNaGrade(estado)
                ? colarNaGrade(estado, planilha)
                : /<table[\s>]/i.test(event.clipboardData?.getData("text/html") ?? "")
                  ? tabelaDaPlanilha(estado, planilha)
                  : null;
              if (tr) {
                editor.view.dispatch(tr);
                return true;
              }
            }
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
// - Shift+Enter dentro da lista sai dela: vai para o parágrafo em branco logo
//   depois da lista, ou cria um, se não houver.
// - Shift+Enter fora da lista vai para o parágrafo de baixo, se ele estiver em branco.

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
        if (!info) {
          // Fora da lista (num título ou parágrafo): vai para o parágrafo de baixo, se ele estiver em branco.
          const { $from } = state.selection;
          if ($from.depth < 1) return false;
          const fimDoBloco = $from.after(1);
          const abaixo = state.doc.nodeAt(fimDoBloco);
          if (abaixo?.type.name !== "paragraph" || abaixo.content.size !== 0) return true; // não faz nada
          editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, fimDoBloco + 1)).scrollIntoView());
          return true;
        }
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
  /** Quem atende os blocos que precisam de uma pergunta (a tela do editor). */
  aoPedir: ((o: NonNullable<TipoDeBloco["pedir"]>) => void) | null = null;

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
            if (props.pedir) controle.aoPedir?.(props.pedir);
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
// Quebra de página: um bloco que a pessoa põe onde quiser (Ctrl+Enter, como no Word)

const QuebraDePagina = HorizontalRule.extend({
  name: "quebraDePagina",
  parseHTML() {
    return [{ tag: "div[data-quebra]" }];
  },
  renderHTML() {
    return ["div", { "data-quebra": "", class: "quebra", contenteditable: "false" }, ["span", {}, "Quebra de página"]];
  },
  // Sem atalhos de digitação ("---"): a quebra só entra quando a pessoa pede.
  addInputRules() {
    return [];
  },
  addKeyboardShortcuts() {
    return { "Mod-Enter": () => this.editor.commands.setHorizontalRule() };
  },
});

/** Insere uma quebra de página onde está o cursor; o texto depois do cursor vai para a página nova. */
export function inserirQuebra(editor: Editor) {
  editor.chain().focus().setHorizontalRule().run();
}

// ---------------------------------------------------------------------------
// Lista de referências: um bloco que a pessoa põe onde quiser (decisão de
// 20/11/2026: tudo o que sai no PDF tem um lugar no editor). O bloco mostra o
// título da norma (REFERÊNCIAS na ABNT, Referências na APA), que muda sozinho
// quando a pessoa troca a norma.

/** O que o editor mostra e que depende da norma do trabalho. Avisa quando muda. */
export class AparenciaDaNorma extends EventTarget {
  constructor(public rotuloDasReferencias = "Referências") {
    super();
  }

  mudar(rotulo: string) {
    this.rotuloDasReferencias = rotulo;
    this.dispatchEvent(new Event("mudou"));
  }
}

function listaDeReferenciasNoEditor(aparencia: AparenciaDaNorma) {
  return Node.create({
    name: NO_DA_LISTA_DE_REFERENCIAS,
    group: "block",
    atom: true,
    selectable: true,
    draggable: false,
    parseHTML() {
      return [{ tag: "div[data-lista-de-referencias]" }];
    },
    renderHTML() {
      return ["div", { "data-lista-de-referencias": "", class: "lista-referencias" }];
    },
    addNodeView() {
      return () => {
        const caixa = document.createElement("div");
        caixa.className = "lista-referencias";
        caixa.setAttribute("data-lista-de-referencias", "");
        caixa.contentEditable = "false";
        const titulo = document.createElement("strong");
        const nota = document.createElement("span");
        nota.className = "dica";
        nota.textContent = "As obras citadas entram aqui, na ordem e na forma da norma.";
        caixa.append(titulo, nota);
        const mostrar = () => (titulo.textContent = aparencia.rotuloDasReferencias);
        mostrar();
        aparencia.addEventListener("mudou", mostrar);
        return { dom: caixa, destroy: () => aparencia.removeEventListener("mudou", mostrar) };
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Citação: uma peça dentro do texto, que não se divide. O cursor pula por
// cima dela, e o Backspace a apaga inteira. Os dados ficam como estão no
// modelo do Apud (documento/referencias.ts).

/** Como a citação aparece no editor. A tela do trabalho troca pelo texto já na norma. */
export type DescreverCitacao = (c: Citacao) => string;

const descricaoSimples: DescreverCitacao = (c) => (c.tipo === "sem-referencia" ? `(${c.texto})` : "[citação]");

/** Os pedaços da citação como elementos: o itálico vira <i> (et al., apud na APA...). */
function pedacosNoDom(m: CitacaoMontada): (HTMLElement | Text)[] {
  return m.pedacos.map((p) => {
    if (!p.italico) return document.createTextNode(p.texto);
    const i = document.createElement("i");
    i.textContent = p.texto;
    return i;
  });
}

function citacaoNoEditor(descrever: DescreverCitacao, citacoes: CitacoesNoTexto, janela: ControleDaJanela) {
  return Node.create({
    name: NO_DA_CITACAO,
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    addAttributes() {
      return {
        dados: {
          default: null,
          parseHTML: (el) => {
            try {
              return JSON.parse(el.getAttribute("data-citacao") ?? "null");
            } catch {
              return null;
            }
          },
          renderHTML: (attrs) => ({ "data-citacao": JSON.stringify(attrs.dados) }),
        },
      };
    },
    parseHTML() {
      return [{ tag: "span[data-citacao]" }];
    },
    renderHTML({ node, HTMLAttributes }) {
      return ["span", { ...HTMLAttributes, class: "citacao" }, node.attrs.dados ? descrever(node.attrs.dados) : ""];
    },
    // Ao copiar para fora do Apud, a citação vai escrita na norma.
    renderText({ node }) {
      const m = citacoes.textoDe(node);
      if (m) return m.pedacos.map((p) => p.texto).join("");
      return node.attrs.dados ? descrever(node.attrs.dados) : "";
    },
    addKeyboardShortcuts() {
      return {
        // Com a citação selecionada (clique ou setas), Enter abre a janela para editar.
        Enter: ({ editor }) => {
          const sel = citacaoSelecionada(editor.state);
          if (!sel) return false;
          janela.abrirParaEditar(sel.pos, sel.citacao);
          return true;
        },
      };
    },
    addNodeView() {
      return ({ node, getPos }) => {
        let atual = node;
        const dom = document.createElement("span");
        dom.setAttribute("role", "button");
        dom.tabIndex = -1;
        const desenhar = () => {
          const dados = atual.attrs.dados as Citacao | null;
          const m = citacoes.textoDe(atual);
          const avisos = m?.avisos ?? [];
          const apagada = avisos.some((a) => a.tipo === "referencia-apagada");
          dom.className = `citacao${avisos.length ? (apagada ? " aviso-grave" : " aviso") : ""}`;
          if (avisos.length) dom.title = avisos.map((a) => `Atenção: ${a.mensagem}`).join("\n");
          else dom.title = "Clique para editar ou apagar esta citação";
          dom.replaceChildren(...(m ? pedacosNoDom(m) : [document.createTextNode(dados ? descrever(dados) : "")]));
          dom.setAttribute("aria-label", `Citação ${dom.textContent}${avisos.length ? ". Com aviso: " + avisos.map((a) => a.mensagem).join(" ") : ""}. Enter para editar.`);
        };
        desenhar();
        citacoes.addEventListener("mudou", desenhar);
        dom.addEventListener("click", () => {
          const pos = getPos();
          const dados = atual.attrs.dados as Citacao | null;
          if (typeof pos === "number" && dados) janela.abrirParaEditar(pos, dados);
        });
        return {
          dom,
          update(novo) {
            if (novo.type !== atual.type) return false;
            atual = novo;
            desenhar();
            return true;
          },
          destroy() {
            citacoes.removeEventListener("mudou", desenhar);
          },
        };
      };
    },
  });
}

// ---------------------------------------------------------------------------

/**
 * As exceções "só este" de um parágrafo ou título (etapa 2): um atributo do nó,
 * guardado como está no modelo do documento ({ "alinhamento": "centralizado" }).
 *   - Enter no fim do bloco começa um bloco sem a exceção; Enter no meio
 *     divide o bloco, e as duas partes ficam com ela (como no Word).
 *   - Trocar o tipo do bloco (parágrafo para título, Título 1 para Título 2)
 *     deixa só as exceções que o elemento novo aceita: um parágrafo com outra
 *     entrelinha vira um título sem ela.
 *   - O texto colado não traz exceções.
 * O bloco com exceção leva data-excecao, para a tela marcar.
 */
export const ExcecoesDoBloco = Extension.create({
  name: "excecoesDoBloco",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          excecoes: {
            default: null,
            keepOnSplit: false,
            parseHTML: () => null,
            renderHTML: (attrs) => (attrs.excecoes ? { "data-excecao": "" } : {}),
          },
        },
      },
    ];
  },
  addProseMirrorPlugins() {
    return [new Plugin({ key: new PluginKey("excecoesQueValem"), appendTransaction: (trs, _antes, estado) => limparExcecoes(trs, estado) })];
  },
});

/** Depois de cada mudança no texto, tira dos blocos as exceções que o elemento deles não aceita (o bloco mudou de tipo). */
export function limparExcecoes(trs: readonly Transaction[], estado: EditorState): Transaction | null {
  if (!trs.some((t) => t.docChanged)) return null;
  let tr: Transaction | null = null;
  estado.doc.forEach((no, pos) => {
    const ex = no.attrs.excecoes;
    if (!ex || (no.type.name !== "paragraph" && no.type.name !== "heading")) return;
    const elemento = no.type.name === "heading" ? `titulos.nivel${no.attrs.level}` : "paragrafo";
    const valem = excecoesQueValem(elemento, ex) ?? null;
    if (JSON.stringify(valem) === JSON.stringify(ex)) return;
    tr = (tr ?? estado.tr).setNodeMarkup(pos, undefined, { ...no.attrs, excecoes: valem });
  });
  return tr;
}

export function extensoesDoApud(
  controle: ControleDaBarra,
  descrever: DescreverCitacao = descricaoSimples,
  aparencia: AparenciaDaNorma = new AparenciaDaNorma(),
  citacoes: CitacoesNoTexto = new CitacoesNoTexto(() => []),
  janela: ControleDaJanela = new ControleDaJanela(),
  controles?: ControlesDosNos,
  /** O "@" rápido e a citação escrita à mão. Sem isto (nos testes), o "@" é só um @. */
  rapido: { arroba: ControleDoArroba; reconhecimento: ControleDoReconhecimento } = { arroba: new ControleDoArroba(), reconhecimento: new ControleDoReconhecimento() },
  /** Os títulos automáticos (número em cinza, página nova). Sem isto, os títulos ficam sem marcas. */
  titulos: TitulosDoTrabalho = new TitulosDoTrabalho(),
) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5] },
      // Fora do Apud de propósito: são formatação, não significado. A citação
      // longa é um bloco próprio do Apud (nos.ts), no lugar do blockquote.
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
    QuebraDePagina,
    ExcecoesDoBloco,
    titulosAutomaticos(titulos),
    Placeholder.configure({
      placeholder: ({ node }) => {
        switch (node.type.name) {
          case "heading":
            return titulos.numera(node.attrs.level) ? "Título (o número, o Apud põe sozinho)" : "Título. Para numerar, escreva o número antes: 1.1 Contexto";
          case NO_DO_TITULO_DA_ILUSTRACAO:
            return "Título (o número, como “Figura 1”, o Apud põe sozinho)";
          case NO_DA_FONTE_DA_ILUSTRACAO:
            return "Fonte: de onde vem (ou marque “Elaborado pelo próprio autor”)";
          case NO_DA_NOTA_DA_ILUSTRACAO:
            return "Nota (opcional)";
          case NO_DA_CITACAO_LONGA:
            return "Escreva ou cole a citação longa, sem aspas. A norma põe o recuo.";
          default:
            return "Escreva aqui. Digite / para escolher o tipo de bloco e @ para citar.";
        }
      },
    }),
    ColarSemFormatacao,
    ListasFaceis,
    barraDeBlocos(controle),
    arrobaRapido(rapido.arroba, janela),
    reconhecerCitacaoEscrita(rapido.reconhecimento),
    citacaoNoEditor(descrever, citacoes, janela),
    listaDeReferenciasNoEditor(aparencia),
    ...nosDaFase3(controles),
  ];
}
