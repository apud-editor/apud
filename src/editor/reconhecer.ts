// Citação escrita à mão (etapa 1.5): quem escreve "(Silva, 2019)" ou "Silva
// (2019)" e a obra está cadastrada vê o trecho sublinhado de leve; com o
// cursor nele aparece "Tab para transformar em citação". Tab (ou o clique)
// troca o texto pela citação ligada à obra; Esc deixa como texto; Ctrl+Z
// desfaz. Só reconhece quando há UMA obra possível: com duas "Silva, 2021" o
// Apud não adivinha, e a pessoa escolhe pelo "@".

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node as NoPM } from "@tiptap/pm/model";
import type { Citacao, Referencia } from "../documento/modelo";
import { criarReconhecedor, type CitacaoReconhecida } from "../citacoes/rapida";
import { inserirCitacao } from "./citar";
import type { Posicao } from "./posicao";

export interface TrechoReconhecido {
  /** Posições no texto todo (ProseMirror). */
  de: number;
  ate: number;
  citacao: Citacao;
}

type Reconhecedor = (texto: string) => CitacaoReconhecida[];

/** Por bloco de texto: o que foi reconhecido (guardado enquanto o bloco não muda: o ProseMirror reaproveita os blocos intactos). */
const guardados = new WeakMap<Reconhecedor, WeakMap<NoPM, CitacaoReconhecida[]>>();

function noBloco(no: NoPM, reconhecer: Reconhecedor): CitacaoReconhecida[] {
  let porNo = guardados.get(reconhecer);
  if (!porNo) guardados.set(reconhecer, (porNo = new WeakMap()));
  let achadas = porNo.get(no);
  if (!achadas) {
    // Cada peça que não é texto (a citação já feita, a nota) vale um caractere, como no documento.
    achadas = reconhecer(no.textBetween(0, no.content.size, undefined, "￼"));
    porNo.set(no, achadas);
  }
  return achadas;
}

/** O que o documento tem de citação escrita à mão. Só nos parágrafos comuns (não em títulos nem na lista de referências). */
export function reconhecidasNoDoc(doc: NoPM, reconhecer: Reconhecedor): TrechoReconhecido[] {
  const saida: TrechoReconhecido[] = [];
  doc.descendants((no, pos) => {
    if (no.type.name !== "paragraph") return no.isBlock && !no.isTextblock;
    for (const a of noBloco(no, reconhecer)) saida.push({ de: pos + 1 + a.de, ate: pos + 1 + a.ate, citacao: a.citacao });
    return false;
  });
  return saida;
}

/** O trecho em que o cursor está (dentro dele ou logo depois do último caractere), se for um dos reconhecidos. */
export function trechoNoCursor(trechos: TrechoReconhecido[], pos: number, ignorados: { de: number; ate: number }[]): TrechoReconhecido | null {
  return trechos.find((t) => pos >= t.de && pos <= t.ate && !ignorados.some((i) => i.de === t.de && i.ate === t.ate)) ?? null;
}

/** Troca o texto reconhecido pela citação (uma só mudança: Ctrl+Z volta ao texto). */
export function transformarEmCitacao(state: EditorState, t: TrechoReconhecido) {
  return inserirCitacao(state, t.de, t.ate, t.citacao);
}

// ---------------------------------------------------------------------------

export interface EstadoDoAviso {
  visivel: boolean;
  posicao: Posicao | null;
  trecho: TrechoReconhecido | null;
}

const SEM_AVISO: EstadoDoAviso = { visivel: false, posicao: null, trecho: null };

export class ControleDoReconhecimento {
  estado: EstadoDoAviso = SEM_AVISO;
  /** Ligado quando o editor tem obras para citar. */
  ativo = false;
  lerReferencias: () => Referencia[] = () => [];
  private ouvintes = new Set<() => void>();
  private ultimas: Referencia[] | null = null;
  private feito: Reconhecedor = () => [];
  /** Pede ao editor para transformar o trecho do aviso (a tela liga isto ao editor). */
  aoTransformar: ((t: TrechoReconhecido) => void) | null = null;

  ouvir = (f: () => void) => {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  };
  ler = () => this.estado;

  /** O reconhecedor das obras de agora. O índice só é refeito quando a lista de obras muda. */
  reconhecedor(): Reconhecedor {
    const refs = this.lerReferencias();
    if (refs !== this.ultimas) {
      this.ultimas = refs;
      this.feito = criarReconhecedor(refs);
    }
    return this.feito;
  }

  mostrar(e: EstadoDoAviso) {
    const a = this.estado;
    if (a.visivel === e.visivel && a.trecho?.de === e.trecho?.de && a.trecho?.ate === e.trecho?.ate && a.posicao?.x === e.posicao?.x && a.posicao?.y === e.posicao?.y) return;
    this.estado = e;
    this.ouvintes.forEach((f) => f());
  }
}

interface EstadoDoPlugin {
  trechos: TrechoReconhecido[];
  /** Trechos que a pessoa pediu para deixar como texto (Esc). Acompanham o texto quando ele muda. */
  ignorados: { de: number; ate: number }[];
  decoracoes: DecorationSet;
  /** Com que lista de obras foi feito (se a lista mudar, refaz). */
  usado: Reconhecedor | null;
}

const chave = new PluginKey<EstadoDoPlugin>("reconhecerCitacao");

function montar(doc: NoPM, controle: ControleDoReconhecimento, ignorados: { de: number; ate: number }[]): EstadoDoPlugin {
  if (!controle.ativo) return { trechos: [], ignorados: [], decoracoes: DecorationSet.empty, usado: null };
  const usado = controle.reconhecedor();
  const trechos = reconhecidasNoDoc(doc, usado);
  const visiveis = trechos.filter((t) => !ignorados.some((i) => i.de === t.de && i.ate === t.ate));
  return {
    trechos,
    ignorados,
    usado,
    decoracoes: DecorationSet.create(
      doc,
      visiveis.map((t) => Decoration.inline(t.de, t.ate, { class: "cit-possivel" })),
    ),
  };
}

export function reconhecerCitacaoEscrita(controle: ControleDoReconhecimento) {
  return Extension.create({
    name: "reconhecerCitacaoEscrita",
    // Antes dos outros: o Tab e o Esc daqui só valem com o aviso na tela.
    priority: 1200,
    addProseMirrorPlugins() {
      return [
        new Plugin<EstadoDoPlugin>({
          key: chave,
          state: {
            init: (_, estado) => montar(estado.doc, controle, []),
            apply: (tr, antigo, _antes, novo) => {
              const atual = controle.ativo ? controle.reconhecedor() : null;
              if (!tr.docChanged && tr.getMeta(chave) === undefined && atual === antigo.usado) return antigo;
              const adicional = tr.getMeta(chave) as { de: number; ate: number } | undefined;
              const ignorados = antigo.ignorados.map((i) => ({ de: tr.mapping.map(i.de, 1), ate: tr.mapping.map(i.ate, -1) }));
              if (adicional) ignorados.push(adicional);
              return montar(novo.doc, controle, ignorados);
            },
          },
          props: {
            decorations: (estado) => chave.getState(estado)?.decoracoes ?? DecorationSet.empty,
            handleKeyDown: (view, ev) => {
              const t = trechoDoAviso(view);
              if (!t) return false;
              if (ev.key === "Tab" && !ev.shiftKey && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
                view.dispatch(transformarEmCitacao(view.state, t));
                return true;
              }
              if (ev.key === "Escape") {
                view.dispatch(view.state.tr.setMeta(chave, { de: t.de, ate: t.ate }));
                return true;
              }
              return false;
            },
          },
          view: () => {
            const atualizar = (view: EditorView) => {
              const t = trechoDoAviso(view);
              if (!t) return controle.mostrar({ visivel: false, posicao: null, trecho: null });
              const c = view.coordsAtPos(t.ate);
              controle.mostrar({ visivel: true, posicao: { x: c.left, y: c.bottom + 6, acima: c.top - 6 }, trecho: t });
            };
            return { update: atualizar, destroy: () => controle.mostrar({ visivel: false, posicao: null, trecho: null }) };
          },
        }),
      ];
    },
  });

  function trechoDoAviso(view: EditorView): TrechoReconhecido | null {
    const e = chave.getState(view.state);
    if (!e || !view.state.selection.empty || !view.hasFocus()) return null;
    return trechoNoCursor(e.trechos, view.state.selection.head, e.ignorados);
  }
}
