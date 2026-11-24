// Os títulos automáticos no editor (decisão 10 da v2, etapa 2).
//
// O editor não imita o PDF (decisão 12): o título continua com as letras que a
// pessoa escreveu. Só duas marcas do modelo aparecem:
//   - o número do título, em cinza, antes do texto (não é texto: não se apaga
//     nem se seleciona);
//   - a linha "Página nova" acima do título que começa numa página nova, com o
//     jeito de uma quebra de página. Clicar nela e apertar Delete (ou Backspace)
//     tira a página nova só daquele título (uma exceção "só este").
// Os dois vêm da mesma conta do PDF (modelos/titulos.ts) e se refazem a cada
// mudança: mover, apagar ou trocar o nível de um título renumera tudo.
//
// Com a numeração automática, o número escrito à mão no começo de um título
// ("1.1 Contexto", da v1) sai do texto sozinho, ao abrir o trabalho e quando a
// numeração liga (decisão do Francisco, 24/11/2026). É uma mudança só, que o
// Ctrl+Z desfaz.

import { Extension } from "@tiptap/core";
import type { Node as NoPM } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Bloco, Excecoes, NivelDeTitulo, TipoDeTrabalho } from "../documento/modelo";
import { mudarSoEste } from "../modelos/excecoes";
import { formaDosTitulos, numeraSozinho, numeroEscritoNoTitulo, type FormaDoTitulo } from "../modelos/titulos";
import type { ModeloResolvido } from "../modelos/tipos";

/**
 * O que os títulos do editor precisam saber do trabalho: o modelo (já com as
 * escolhas do trabalho) e o tipo de trabalho (na ABNT, artigo não tem página
 * nova). A tela do trabalho avisa quando muda.
 */
export class TitulosDoTrabalho extends EventTarget {
  modelo: ModeloResolvido | null = null;
  tipo: TipoDeTrabalho = "disciplina";

  mudar(modelo: ModeloResolvido | null, tipo: TipoDeTrabalho) {
    if (modelo === this.modelo && tipo === this.tipo) return;
    this.modelo = modelo;
    this.tipo = tipo;
    this.dispatchEvent(new Event("mudou"));
  }

  ouvir = (f: () => void) => {
    this.addEventListener("mudou", f);
    return () => this.removeEventListener("mudou", f);
  };

  /** Se o nível de título sai com número automático (para a dica do título vazio). */
  numera(nivel: NivelDeTitulo): boolean {
    return !!this.modelo && numeraSozinho(this.modelo, nivel);
  }

  /** A forma de cada título do texto, pela posição do bloco (para a Estrutura). Os vazios não contam. */
  formasDosBlocos(blocos: Bloco[]): Map<number, FormaDoTitulo> {
    if (!this.modelo) return new Map();
    const titulos = blocos.flatMap((b, indice) => (b.tipo === "titulo" && temAlgo(b) ? [{ indice, nivel: b.nivel, excecoes: b.excecoes }] : []));
    const formas = formaDosTitulos(this.modelo, titulos, this.tipo);
    return new Map(titulos.map((t, i) => [t.indice, formas[i]]));
  }
}

const temAlgo = (b: Extract<Bloco, { tipo: "titulo" }>) => b.trechos.some((t) => !("texto" in t) || t.texto.trim());

/** O título tem algo escrito (texto, citação ou nota): o vazio não sai no PDF e não conta. */
const noComConteudo = (no: NoPM) => no.textContent.trim().length > 0 || no.content.content.some((f) => !f.isText);

interface TituloNoEditor {
  pos: number;
  no: NoPM;
  nivel: NivelDeTitulo;
  excecoes?: Excecoes;
  forma: FormaDoTitulo;
  /** O bloco de cima é uma quebra de página posta pela pessoa: a linha "Página nova" não se repete. */
  depoisDeQuebra: boolean;
}

/** Os títulos do texto com a forma de cada um, na ordem. */
export function titulosDoEditor(doc: NoPM, modelo: ModeloResolvido, tipo: TipoDeTrabalho): TituloNoEditor[] {
  const achados: Omit<TituloNoEditor, "forma">[] = [];
  let anterior: NoPM | null = null;
  doc.forEach((no, pos) => {
    if (no.type.name === "heading" && noComConteudo(no)) {
      achados.push({ pos, no, nivel: no.attrs.level as NivelDeTitulo, excecoes: no.attrs.excecoes ?? undefined, depoisDeQuebra: anterior?.type.name === "quebraDePagina" });
    }
    anterior = no;
  });
  const formas = formaDosTitulos(modelo, achados, tipo);
  return achados.map((t, i) => ({ ...t, forma: formas[i] }));
}

/**
 * Tira o número de seção escrito à mão no começo dos títulos que o Apud numera.
 * Null quando não há nada a tirar.
 */
export function tirarNumerosEscritos(estado: EditorState, modelo: ModeloResolvido): Transaction | null {
  const cortes: Array<[number, number]> = [];
  estado.doc.forEach((no, pos) => {
    if (no.type.name !== "heading" || !numeraSozinho(modelo, no.attrs.level, no.attrs.excecoes ?? undefined)) return;
    const primeiro = no.firstChild;
    if (!primeiro?.isText) return;
    const escrito = numeroEscritoNoTitulo(primeiro.text ?? "");
    if (!escrito) return;
    const tamanho = (primeiro.text ?? "").length - escrito.resto.length;
    cortes.push([pos + 1, pos + 1 + tamanho]);
  });
  if (!cortes.length) return null;
  const tr = estado.tr;
  // De trás para a frente, para as posições não mudarem.
  for (const [de, ate] of cortes.reverse()) tr.delete(de, ate);
  return tr;
}

/** "Só este: sem página nova" no título em `pos`. */
export function tirarPaginaNova(estado: EditorState, pos: number, modelo: ModeloResolvido): Transaction | null {
  const no = estado.doc.nodeAt(pos);
  if (!no || no.type.name !== "heading") return null;
  const r = mudarSoEste(modelo, `titulos.nivel${no.attrs.level}`, no.attrs.excecoes ?? undefined, "página nova", "não");
  if (!r.ok) return null;
  return estado.tr.setNodeMarkup(pos, undefined, { ...no.attrs, excecoes: r.resultado ?? null });
}

const CHAVE = new PluginKey<{ selecionada: number | null }>("titulosAutomaticos");

function desenhar(estado: EditorState, controle: TitulosDoTrabalho, view: () => EditorView | null): DecorationSet {
  const modelo = controle.modelo;
  if (!modelo) return DecorationSet.empty;
  const selecionada = CHAVE.getState(estado)?.selecionada ?? null;
  const marcas: Decoration[] = [];
  for (const t of titulosDoEditor(estado.doc, modelo, controle.tipo)) {
    if (t.forma.paginaNova && !t.depoisDeQuebra) {
      const pos = t.pos;
      marcas.push(
        Decoration.widget(
          pos,
          () => {
            const linha = document.createElement("div");
            linha.className = "pagina-nova" + (selecionada === pos ? " selecionada" : "");
            linha.contentEditable = "false";
            linha.setAttribute("role", "button");
            linha.setAttribute("aria-label", "Página nova, definida pelo modelo. Clique e aperte Delete para tirar só deste título.");
            linha.title = "Página nova, definida pelo modelo. Clique e aperte Delete para tirar só deste título.";
            const rotulo = document.createElement("span");
            rotulo.textContent = "Página nova";
            linha.append(rotulo);
            linha.addEventListener("mousedown", (ev) => {
              ev.preventDefault();
              const v = view();
              if (!v) return;
              v.dispatch(v.state.tr.setMeta(CHAVE, { selecionada: pos }));
              v.focus();
            });
            return linha;
          },
          { side: -1, key: `pagina-nova-${pos}-${selecionada === pos}` },
        ),
      );
    }
    if (t.forma.numero) {
      const numero = t.forma.numero;
      marcas.push(
        Decoration.widget(
          t.pos + 1,
          () => {
            const n = document.createElement("span");
            n.className = "titulo-numero";
            n.contentEditable = "false";
            n.textContent = numero;
            n.title = "Número posto pelo modelo";
            return n;
          },
          { side: -1, key: `numero-${numero}`, ignoreSelection: true },
        ),
      );
    }
  }
  return DecorationSet.create(estado.doc, marcas);
}

/** A extensão: desenha as marcas e cuida do Delete na linha "Página nova". */
export function titulosAutomaticos(controle: TitulosDoTrabalho) {
  return Extension.create({
    name: "titulosAutomaticos",
    addProseMirrorPlugins() {
      let vista: EditorView | null = null;
      return [
        new Plugin<{ selecionada: number | null }>({
          key: CHAVE,
          state: {
            init: () => ({ selecionada: null }),
            apply(tr, valor) {
              const pedido = tr.getMeta(CHAVE) as { selecionada: number | null } | undefined;
              if (pedido) return pedido;
              // Qualquer outra mudança no texto ou no cursor desfaz a seleção da linha.
              if (valor.selecionada !== null && (tr.docChanged || tr.selectionSet)) return { selecionada: null };
              return valor;
            },
          },
          view(v) {
            vista = v;
            // O modelo ou o tipo de trabalho mudou: redesenha (com uma mudança vazia).
            const parar = controle.ouvir(() => v.dispatch(v.state.tr.setMeta(CHAVE, { selecionada: null })));
            return { destroy: () => { parar(); vista = null; } };
          },
          props: {
            decorations: (estado) => desenhar(estado, controle, () => vista),
            handleKeyDown(view, ev) {
              const selecionada = CHAVE.getState(view.state)?.selecionada ?? null;
              if (selecionada === null) return false;
              if (ev.key === "Delete" || ev.key === "Backspace") {
                const tr = controle.modelo && tirarPaginaNova(view.state, selecionada, controle.modelo);
                if (tr) view.dispatch(tr.setMeta(CHAVE, { selecionada: null }));
                return true;
              }
              if (ev.key === "Escape") {
                view.dispatch(view.state.tr.setMeta(CHAVE, { selecionada: null }));
                return true;
              }
              return false;
            },
          },
        }),
      ];
    },
  });
}
