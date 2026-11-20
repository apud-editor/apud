// Quem sabe como cada citação do texto aparece na norma, e o que a janela da
// citação está fazendo. O editor só mostra: o texto vem do motor de citações,
// que monta todas as citações juntas, na ordem do texto, depois de uma pausa.

import type { Node as NoPM } from "@tiptap/pm/model";
import { blocosDoEditor } from "../documento/tiptap";
import type { Bloco, Citacao } from "../documento/modelo";
import type { CitacaoMontada } from "../citacoes/motor";
import { avisosDoTexto, type AvisoDoTexto } from "../citacoes/todas";
import { citacoesDoEditor } from "./citar";

/** Quanto tempo esperar depois da última mudança para refazer as citações. */
export const PAUSA_DAS_CITACOES_MS = 300;

/**
 * Casa cada citação do editor com o texto que o motor montou para ela. As
 * duas listas seguem a ordem do texto. Se não baterem (não deveria acontecer),
 * devolve null e o editor mostra a forma simples.
 */
export function distribuirCitacoes(
  doc: NoPM,
  calcular: (blocos: Bloco[]) => CitacaoMontada[],
): { pares: [NoPM, CitacaoMontada][]; avisos: AvisoDoTexto[] } | null {
  const blocos = blocosDoEditor(doc.toJSON());
  const nos = citacoesDoEditor(doc);
  const montadas = calcular(blocos);
  if (montadas.length !== nos.length) return null;
  return { pares: nos.map(({ no }, i) => [no, montadas[i]]), avisos: avisosDoTexto(blocos) };
}

/**
 * Guarda o texto de cada citação na norma. Cada peça do editor (nó) tem o seu
 * texto; um nó que não mudou continua com o texto que tinha até a próxima
 * pausa, e um nó novo mostra a forma simples até lá.
 */
export class CitacoesNoTexto extends EventTarget {
  private montadas = new WeakMap<NoPM, CitacaoMontada>();
  private editor: { state: { doc: NoPM } } | null = null;
  private espera: ReturnType<typeof setTimeout> | undefined;
  /** Sobe a cada refeita: serve de "foto" para a tela se redesenhar. */
  versao = 0;
  avisosDoTexto: AvisoDoTexto[] = [];

  constructor(private calcular: (blocos: Bloco[]) => CitacaoMontada[]) {
    super();
  }

  ligar(editor: { state: { doc: NoPM } } | null) {
    this.editor = editor;
    if (!editor) clearTimeout(this.espera);
  }

  ouvir = (f: () => void) => {
    this.addEventListener("mudou", f);
    return () => this.removeEventListener("mudou", f);
  };
  ler = () => this.versao;

  textoDe(no: NoPM): CitacaoMontada | undefined {
    return this.montadas.get(no);
  }

  /** Refaz as citações daqui a um tempo; pedidos seguidos viram um só. */
  agendar(ms = PAUSA_DAS_CITACOES_MS) {
    clearTimeout(this.espera);
    this.espera = setTimeout(() => this.recalcular(), ms);
  }

  recalcular() {
    clearTimeout(this.espera);
    if (!this.editor) return;
    try {
      const feito = distribuirCitacoes(this.editor.state.doc, this.calcular);
      if (feito) {
        for (const [no, m] of feito.pares) this.montadas.set(no, m);
        this.avisosDoTexto = feito.avisos;
      }
    } catch (e) {
      // Nunca derruba o editor: o texto continua, com as citações na forma simples.
      console.warn("Não consegui montar as citações na norma:", e);
    }
    this.versao++;
    this.dispatchEvent(new Event("mudou"));
  }
}

// ---------------------------------------------------------------------------
// A janela da citação

export interface EstadoDaJanela {
  aberta: boolean;
  /** Sobe a cada abertura: a janela começa do zero toda vez. */
  chave: number;
  /** "inserir": citação nova. "editar": uma que já está no texto. */
  modo: "inserir" | "editar";
  /** De onde veio: o "@" (pode virar um @ comum), o botão ou o clique na citação. */
  origem: "arroba" | "botao" | "clique";
  /** Onde a citação nova entra (de == ate) ou onde está a que se edita (de). */
  de: number;
  ate: number;
  citacao: Citacao | null;
}

const FECHADA: EstadoDaJanela = { aberta: false, chave: 0, modo: "inserir", origem: "botao", de: 0, ate: 0, citacao: null };

export class ControleDaJanela {
  estado: EstadoDaJanela = FECHADA;
  private ouvintes = new Set<() => void>();

  ouvir = (f: () => void) => {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  };
  ler = () => this.estado;

  private mudar(e: EstadoDaJanela) {
    this.estado = e;
    this.ouvintes.forEach((f) => f());
  }

  abrirParaInserir(origem: "arroba" | "botao", de: number, ate = de) {
    this.mudar({ aberta: true, chave: this.estado.chave + 1, modo: "inserir", origem, de, ate, citacao: null });
  }

  abrirParaEditar(pos: number, citacao: Citacao) {
    this.mudar({ aberta: true, chave: this.estado.chave + 1, modo: "editar", origem: "clique", de: pos, ate: pos + 1, citacao });
  }

  fechar() {
    if (this.estado.aberta) this.mudar({ ...this.estado, aberta: false });
  }
}
