// O "@" rápido (etapa 1.5): digitar "@sil" mostra, embaixo do cursor, as obras
// que combinam; Enter (ou clique) põe a citação no lugar e a pessoa continua
// escrevendo. Depois da vírgula vai o localizador: "@silva, p. 15".
//
// A janela completa continua existindo ("Mais opções…") para o que a lista
// não faz: várias obras, citação de citação (apud), grifo, tradução, fala.
//
// Esta parte guarda o estado da lista (como a barra "/") e liga o "@" ao
// editor. A tela da lista está em CitarRapido.tsx; a lógica de consulta e de
// montar a citação, em citacoes/rapida.ts (sem editor, testada à parte).

import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import type { Localizador, Referencia } from "../documento/modelo";
import { citacaoRapida, consultaRapida, obrasDoArroba, type ConsultaRapida } from "../citacoes/rapida";
import { resumoDaReferencia, type ResumoDaReferencia } from "../referencias/lista";
import type { ControleDaJanela } from "./citacoes";
import { inserirCitacao } from "./citar";
import type { Posicao } from "./posicao";

/** Quantas obras a lista mostra de uma vez; as outras aparecem ao digitar mais. */
export const MAXIMO_NA_LISTA = 6;

export type ItemDoArroba =
  | { tipo: "obra"; referencia: Referencia; resumo: ResumoDaReferencia }
  /** Só informa que há mais obras; não se escolhe. */
  | { tipo: "restantes"; quantas: number }
  /** Abre a janela completa. */
  | { tipo: "janela" }
  /** Abre a gaveta de referências para cadastrar uma obra. */
  | { tipo: "cadastrar" };

const escolhivel = (i: ItemDoArroba) => i.tipo !== "restantes";

/** O que vai da lista para o editor quando a pessoa escolhe. */
export interface EscolhaDoArroba {
  item: ItemDoArroba;
  /** Shift+Enter: o autor faz parte da frase, "Silva (2019)". */
  autorNoTexto: boolean;
  localizador?: Localizador;
}

/** As linhas da lista para o que foi digitado depois do "@". */
export function itensDoArroba(referencias: Referencia[], consulta: ConsultaRapida): ItemDoArroba[] {
  const obras = obrasDoArroba(referencias, consulta.busca);
  const itens: ItemDoArroba[] = obras.slice(0, MAXIMO_NA_LISTA).map((r) => ({ tipo: "obra", referencia: r, resumo: resumoDaReferencia(r) }));
  if (obras.length > MAXIMO_NA_LISTA) itens.push({ tipo: "restantes", quantas: obras.length - MAXIMO_NA_LISTA });
  itens.push({ tipo: "janela" }, { tipo: "cadastrar" });
  return itens;
}

export interface EstadoDoArroba {
  aberta: boolean;
  itens: ItemDoArroba[];
  /** -1: nenhuma escolhida (nenhuma obra combina); aí Enter e Tab seguem como sempre. */
  selecionado: number;
  posicao: Posicao | null;
  consulta: ConsultaRapida;
  /** Quantas obras o trabalho tem (0: ainda não cadastrou nenhuma). */
  totalDeObras: number;
}

const FECHADO: EstadoDoArroba = { aberta: false, itens: [], selecionado: -1, posicao: null, consulta: { busca: "" }, totalDeObras: 0 };

export class ControleDoArroba {
  estado: EstadoDoArroba = FECHADO;
  /** Ligado quando o editor tem obras para citar (sem isso, o "@" é só um @). */
  ativo = false;
  lerReferencias: () => Referencia[] = () => [];
  /** A lista pede para cadastrar uma obra: a tela abre a gaveta. */
  aoCadastrar: (() => void) | null = null;
  private ouvintes = new Set<() => void>();
  private comando: ((e: EscolhaDoArroba) => void) | null = null;

  ouvir = (f: () => void) => {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  };
  ler = () => this.estado;

  private mudar(e: EstadoDoArroba) {
    this.estado = e;
    this.ouvintes.forEach((f) => f());
  }

  abrir(p: SuggestionProps<ItemDoArroba, EscolhaDoArroba>) {
    this.comando = p.command;
    const r = p.clientRect?.();
    const consulta = consultaRapida(p.query);
    this.mudar({
      aberta: true,
      itens: p.items,
      selecionado: p.items.some((i) => i.tipo === "obra") ? 0 : -1,
      posicao: r ? { x: r.left, y: r.bottom + 6, acima: r.top - 6 } : null,
      consulta,
      totalDeObras: this.lerReferencias().length,
    });
  }

  fechar() {
    this.comando = null;
    if (this.estado.aberta) this.mudar({ ...this.estado, aberta: false });
  }

  confirmar(indice = this.estado.selecionado, autorNoTexto = false) {
    const item = this.estado.itens[indice];
    if (!item || !escolhivel(item) || !this.comando) return;
    this.comando({ item, autorNoTexto, localizador: this.estado.consulta.localizador });
  }

  /** As setas andam entre as linhas que se escolhem; Enter e Tab escolhem. O Esc é do próprio editor. */
  tecla(e: KeyboardEvent): boolean {
    if (!this.estado.aberta) return false;
    const vias = this.estado.itens.map((i, k) => (escolhivel(i) ? k : -1)).filter((k) => k >= 0);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const atual = vias.indexOf(this.estado.selecionado);
      const passo = e.key === "ArrowDown" ? 1 : -1;
      const proximo = vias[(atual + passo + vias.length) % vias.length];
      this.mudar({ ...this.estado, selecionado: proximo });
      return true;
    }
    if ((e.key === "Enter" || e.key === "Tab") && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // Nenhuma obra combina e a pessoa não escolheu nada: Enter continua sendo Enter.
      if (this.estado.selecionado < 0) return false;
      this.confirmar(this.estado.selecionado, e.shiftKey && e.key === "Enter");
      return true;
    }
    return false;
  }
}

/**
 * O "@" no começo do parágrafo ou depois de um espaço abre a lista (em
 * "ana@exemplo.org" ele é só um @). Esc fecha a lista e deixa o que foi
 * digitado como texto. Se o que vem depois do "@" deixa de combinar com
 * qualquer obra e já tem espaço, a lista some sozinha: a pessoa está escrevendo.
 */
export function arrobaRapido(controle: ControleDoArroba, janela: ControleDaJanela) {
  return Extension.create({
    name: "arrobaRapido",
    // Antes dos atalhos do editor (o Shift+Enter das listas fáceis, por exemplo).
    priority: 1100,
    addProseMirrorPlugins() {
      return [
        Suggestion<ItemDoArroba, EscolhaDoArroba>({
          editor: this.editor,
          pluginKey: new PluginKey("arrobaRapido"),
          char: "@",
          startOfLine: false,
          allowedPrefixes: [" "],
          // Com espaços, a busca pode ter mais de uma palavra ("silva 2019") e o localizador depois da vírgula.
          allowSpaces: true,
          allow: ({ state, range }) => {
            if (!controle.ativo) return false;
            const digitado = state.doc.textBetween(range.from + 1, range.to, undefined, "￼");
            if (/[\s,]/.test(digitado) && obrasDoArroba(controle.lerReferencias(), consultaRapida(digitado).busca).length === 0) return false;
            return true;
          },
          items: ({ query }) => itensDoArroba(controle.lerReferencias(), consultaRapida(query)),
          command: ({ editor, range, props }: { editor: Editor; range: Range; props: EscolhaDoArroba }) => {
            const { item, autorNoTexto, localizador } = props;
            if (item.tipo === "obra") {
              editor.view.dispatch(inserirCitacao(editor.state, range.from, range.to, citacaoRapida(item.referencia.id, localizador, autorNoTexto)));
              return;
            }
            // Os outros caminhos saem do que foi digitado: o "@silva" some e a janela (ou a gaveta) abre no lugar.
            editor.view.dispatch(editor.state.tr.delete(range.from, range.to));
            if (item.tipo === "janela") janela.abrirParaInserir("botao", range.from);
            else if (item.tipo === "cadastrar") controle.aoCadastrar?.();
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
