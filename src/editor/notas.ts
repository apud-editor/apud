// A nota de rodapé dentro do editor: o que a janela da nota está fazendo e
// como a nota entra, troca e sai do texto. Funções puras sobre o estado do
// editor (ProseMirror), para poderem ser testadas sem navegador.

import { NodeSelection, Selection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { NO_DA_NOTA, blocosDoEditor, editorDosBlocos, normalizar } from "../documento/tiptap";
import { ehTexto, type NotaDeRodape, type TrechoDeTexto } from "../documento/modelo";

export interface EstadoDaJanelaDaNota {
  aberta: boolean;
  /** Sobe a cada abertura: a janela começa do zero toda vez. */
  chave: number;
  /** "inserir": nota nova. "editar": uma que já está no texto. */
  modo: "inserir" | "editar";
  /** Onde a nota nova entra, ou onde está a que se edita. */
  de: number;
  ate: number;
  nota: NotaDeRodape | null;
}

const FECHADA: EstadoDaJanelaDaNota = { aberta: false, chave: 0, modo: "inserir", de: 0, ate: 0, nota: null };

export class ControleDaNota {
  estado: EstadoDaJanelaDaNota = FECHADA;
  private ouvintes = new Set<() => void>();

  ouvir = (f: () => void) => {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  };
  ler = () => this.estado;

  private mudar(e: EstadoDaJanelaDaNota) {
    this.estado = e;
    this.ouvintes.forEach((f) => f());
  }

  abrirParaInserir(de: number, ate = de) {
    this.mudar({ aberta: true, chave: this.estado.chave + 1, modo: "inserir", de, ate, nota: null });
  }

  abrirParaEditar(pos: number, nota: NotaDeRodape) {
    this.mudar({ aberta: true, chave: this.estado.chave + 1, modo: "editar", de: pos, ate: pos + 1, nota });
  }

  fechar() {
    if (this.estado.aberta) this.mudar({ ...this.estado, aberta: false });
  }
}

/** Coloca a nota no ponto de..ate e leva o cursor para depois dela. */
export function inserirNota(state: EditorState, de: number, ate: number, nota: NotaDeRodape): Transaction {
  const no = state.schema.nodes[NO_DA_NOTA].create({ dados: nota });
  const tr = state.tr.replaceWith(de, ate, no);
  return tr.setSelection(Selection.near(tr.doc.resolve(de + no.nodeSize), 1)).scrollIntoView();
}

/** Troca o texto da nota que está em pos. Com null, apaga a nota. Devolve null se pos não tem uma nota. */
export function trocarNota(state: EditorState, pos: number, nota: NotaDeRodape | null): Transaction | null {
  const no = state.doc.nodeAt(pos);
  if (no?.type.name !== NO_DA_NOTA) return null;
  if (nota === null) {
    const tr = state.tr.delete(pos, pos + no.nodeSize);
    return tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size)), -1)).scrollIntoView();
  }
  return state.tr.setNodeMarkup(pos, undefined, { dados: nota }).scrollIntoView();
}

/** Se a seleção é uma nota (depois de um clique ou de setas), onde ela está. */
export function notaSelecionada(state: EditorState): { pos: number; nota: NotaDeRodape } | null {
  const s = state.selection;
  if (!(s instanceof NodeSelection) || s.node.type.name !== NO_DA_NOTA || !s.node.attrs.dados) return null;
  return { pos: s.from, nota: s.node.attrs.dados as NotaDeRodape };
}

// ---------------------------------------------------------------------------
// O campo de texto da janela é um editorzinho de um parágrafo só. Estas duas
// funções levam a nota para ele e de volta, com a mesma conversão do editor
// grande (negrito, itálico e sobrescrito).

export function notaParaCampo(nota: NotaDeRodape | null) {
  return editorDosBlocos([{ tipo: "paragrafo", trechos: nota?.trechos ?? [] }]);
}

/**
 * Lê o que a pessoa escreveu no campo. Se ela colou mais de um parágrafo, eles
 * se juntam num só (a nota é um parágrafo). Devolve null se a nota ficou vazia.
 */
export function campoParaNota(json: Parameters<typeof blocosDoEditor>[0]): NotaDeRodape | null {
  const trechos: TrechoDeTexto[] = [];
  for (const bloco of blocosDoEditor(json)) {
    if (bloco.tipo !== "paragrafo") continue;
    const texto = bloco.trechos.filter(ehTexto);
    if (!texto.some((t) => t.texto.trim())) continue;
    if (trechos.length) trechos.push({ texto: " " });
    trechos.push(...texto);
  }
  return trechos.length ? { trechos: normalizar(trechos) as TrechoDeTexto[] } : null;
}
