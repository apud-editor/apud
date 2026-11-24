// O ⚙ do bloco, a alça de arrastar, a janelinha de ajustes e o quadro de valores da barra (etapas 2c e 2d da v2).
// A conta do que mostrar e do que escrever está em janelinha.ts (testada); aqui só se desenha.
//
// - O ⚙ aparece na margem do bloco sob o mouse (ou do cursor). Clicar nele, clicar no
//   quadro da barra ou apertar Alt+F abre a janelinha.
// - A janelinha escolhe entre "Todos os iguais" (muda o elemento inteiro, nas escolhas do
//   trabalho) e "Só este" (uma exceção neste bloco). Vale no PDF; o editor não imita o PDF.
// - A alça ⋮⋮, ao lado do ⚙, arrasta o bloco para outro lugar (arrastar.ts). A janelinha tem
//   "Mover para cima / para baixo", a saída sem mouse. A conta do movimento está em mover.ts.

import { useEffect, useLayoutEffect, useReducer, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useEditorState, type Editor as EditorTipTap } from "@tiptap/react";
import { ehAtalhoDosAjustes, ATALHO_DOS_AJUSTES } from "../telas/atalhos";
import { useArrastar } from "./arrastar";
import { destacar } from "./destaque";
import { Icone } from "./icones";
import { indiceDepoisDeMover, lacunaAoMover, moverBloco, podeMover } from "./mover";
import {
  blocoAjustavel,
  escreverSoEste,
  excecoesDoBloco,
  linhasDaJanelinha,
  nomeDoBloco,
  origemDaJanelinha,
  quadroDosValores,
  type AplicarA,
  type BlocoAjustavel,
  type Escrita,
  type LinhaDaJanelinha,
} from "./janelinha";
import type { TitulosDoTrabalho } from "./titulos";

/** Quem pede para abrir os ajustes de fora (o quadro da barra). */
export class ControleDosAjustes extends EventTarget {
  alternar() {
    this.dispatchEvent(new Event("alternar"));
  }
}

/** O resultado de mudar "todos os iguais", dado pela tela do trabalho (que guarda as escolhas). */
export type MudarTodos = (elemento: string, escrita: Escrita) => { ok: true; avisos: string[] } | { ok: false; erro: string };

// ---------------------------------------------------------------------------
// A janelinha em si (só desenho)

interface PropsDaJanelinha {
  nome: string;
  origem: string;
  linhas: LinhaDaJanelinha[];
  aplicarA: AplicarA;
  /** Propriedades com exceção neste bloco (para o "Voltar ao do modelo"). */
  excecoes: string[];
  avisos: string[];
  erro: string | null;
  aoMudarAplicarA: (a: AplicarA) => void;
  aoEscolher: (escrita: Escrita) => void;
  aoVoltar: () => void;
  aoFechar: () => void;
  /** Se o bloco tem para onde andar um lugar. */
  podeMover: { cima: boolean; baixo: boolean };
  aoMover: (sentido: "cima" | "baixo") => void;
  style?: CSSProperties;
}

export function JanelinhaDoBloco(p: PropsDaJanelinha) {
  return (
    <div
      className="janelinha"
      role="dialog"
      aria-label={`Ajustes do ${p.nome}`}
      data-ajustes=""
      style={p.style}
      onKeyDown={(ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          ev.stopPropagation();
          p.aoFechar();
        }
      }}
    >
      <div className="janelinha-topo">
        <strong>{p.nome}</strong>
        <button type="button" className="fb" aria-label="Fechar os ajustes" title="Fechar (Esc)" onClick={p.aoFechar}>
          <Icone nome="fechar" tamanho={16} />
        </button>
      </div>
      <p className="janelinha-origem">{p.origem}</p>
      <p className="dica">Vale no PDF. Veja o efeito na Prévia.</p>

      <p className="janelinha-rotulo">Aplicar a</p>
      <div className="janelinha-seg" role="group" aria-label="Aplicar a">
        <button type="button" className={p.aplicarA === "todos" ? "on" : ""} aria-pressed={p.aplicarA === "todos"} onClick={() => p.aoMudarAplicarA("todos")}>
          Todos os iguais
        </button>
        <button type="button" className={p.aplicarA === "este" ? "on" : ""} aria-pressed={p.aplicarA === "este"} onClick={() => p.aoMudarAplicarA("este")}>
          Só este
        </button>
      </div>

      {p.linhas.map((l) =>
        l.forma === "opcoes" ? (
          <div key={l.rotulo}>
            <p className="janelinha-rotulo">
              {l.rotulo}
              {p.aplicarA === "este" && l.deExcecao && <span className="janelinha-so-este"> · só neste</span>}
            </p>
            <div className="janelinha-seg" role="group" aria-label={l.rotulo}>
              {l.opcoes.map((o) => (
                <button key={o.rotulo} type="button" className={o.ativa ? "on" : ""} aria-pressed={o.ativa} onClick={() => p.aoEscolher(o.escrita)}>
                  {o.rotulo}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            key={l.rotulo}
            type="button"
            role="switch"
            aria-checked={l.opcoes[0].ativa}
            className={`janelinha-chave ${l.opcoes[0].ativa ? "on" : ""}`}
            onClick={() => p.aoEscolher(l.opcoes[0].escrita)}
          >
            <span>
              {l.rotulo}
              {p.aplicarA === "este" && l.deExcecao && <span className="janelinha-so-este"> · só neste</span>}
            </span>
            <span className="janelinha-tg" aria-hidden="true" />
          </button>
        ),
      )}

      {p.erro && (
        <p className="janelinha-erro" role="alert">
          {p.erro}
        </p>
      )}
      {p.avisos.map((a) => (
        <p key={a} className="janelinha-aviso" role="status">
          {a}
        </p>
      ))}

      <div className="janelinha-mover" role="group" aria-label="Mudar de lugar">
        <button type="button" className="btn" disabled={!p.podeMover.cima} onClick={() => p.aoMover("cima")}>
          <Icone nome="cima" tamanho={15} /> Mover para cima
        </button>
        <button type="button" className="btn" disabled={!p.podeMover.baixo} onClick={() => p.aoMover("baixo")}>
          <Icone nome="baixo" tamanho={15} /> Mover para baixo
        </button>
      </div>

      <div className="janelinha-pe">
        {p.excecoes.length > 0 && (
          <button type="button" className="btn" onClick={p.aoVoltar} title={`Tira o “só este” (${p.excecoes.join(", ")}): o bloco volta a seguir o modelo.`}>
            Voltar ao do modelo
          </button>
        )}
        <button type="button" className="btn" disabled title="O painel completo chega na etapa 3.">
          Mais opções…
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// O quadro de valores da barra

export function QuadroDosValores({ texto, aoAbrir }: { texto: string; aoAbrir: () => void }) {
  return (
    <button
      type="button"
      className="quadro-valores"
      data-ajustes=""
      aria-label={`Valores do elemento: ${texto}. Abrir os ajustes.`}
      title={`Abre os ajustes deste elemento (${ATALHO_DOS_AJUSTES.texto})`}
      aria-keyshortcuts={ATALHO_DOS_AJUSTES.texto}
      // mousedown, e não click: assim o editor não perde a seleção.
      onMouseDown={(ev) => {
        ev.preventDefault();
        aoAbrir();
      }}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          aoAbrir();
        }
      }}
    >
      <span>{texto}</span>
      <Icone nome="engrenagem" tamanho={15} />
    </button>
  );
}

/** O quadro da barra: segue o bloco do cursor e o modelo do trabalho. Some quando o bloco não tem ajustes (ainda). */
export function QuadroNaBarra({ editor, titulos, controle }: { editor: EditorTipTap | null; titulos: TitulosDoTrabalho; controle: ControleDosAjustes }) {
  useSyncExternalStore(titulos.ouvir, () => titulos.versao);
  const bloco = useEditorState({ editor, selector: ({ editor: e }) => (e ? blocoAjustavel(e.state.doc.maybeChild(e.state.selection.$from.index(0))) : null) });
  const texto = titulos.modelo ? quadroDosValores(titulos.modelo, titulos.tipo, bloco) : null;
  if (!texto) return null;
  return <QuadroDosValores texto={texto} aoAbrir={() => controle.alternar()} />;
}

// ---------------------------------------------------------------------------
// O ⚙ na margem e a janelinha, ligados ao editor

interface JanelaAberta {
  indice: number;
  aplicarA: AplicarA;
  avisos: string[];
  erro: string | null;
}

/** A posição de um bloco do topo do texto, dentro da folha que rola. */
function medirBloco(editor: EditorTipTap, folha: HTMLElement, indice: number): { top: number; left: number } | null {
  const doc = editor.state.doc;
  if (indice < 0 || indice >= doc.childCount) return null;
  let pos = 0;
  for (let i = 0; i < indice; i++) pos += doc.child(i).nodeSize;
  const el = editor.view.nodeDOM(pos) as HTMLElement | null;
  if (!el?.getBoundingClientRect) return null;
  const r = el.getBoundingClientRect();
  const f = folha.getBoundingClientRect();
  return { top: r.top - f.top + folha.scrollTop, left: r.left - f.left + folha.scrollLeft };
}

/** Qual bloco do topo está na altura `y` (da tela): o primeiro cujo fim, mais meia margem, ainda passa de y. */
function blocoNaAltura(editor: EditorTipTap, y: number): number | null {
  const doc = editor.state.doc;
  let pos = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const el = editor.view.nodeDOM(pos) as HTMLElement | null;
    pos += doc.child(i).nodeSize;
    if (!el?.getBoundingClientRect) continue;
    const r = el.getBoundingClientRect();
    if (y < r.top - 9) return null;
    if (y < r.bottom + 9) return i;
  }
  return null;
}

const posDoBloco = (doc: EditorTipTap["state"]["doc"], indice: number) => {
  let pos = 0;
  for (let i = 0; i < indice; i++) pos += doc.child(i).nodeSize;
  return pos;
};

export function AjustesDoBloco({
  editor,
  folha,
  titulos,
  controle,
  aoMudarTodos,
}: {
  editor: EditorTipTap;
  folha: React.RefObject<HTMLElement | null>;
  titulos: TitulosDoTrabalho;
  controle: ControleDosAjustes;
  aoMudarTodos: MudarTodos;
}) {
  useSyncExternalStore(titulos.ouvir, () => titulos.versao);
  const [, refazer] = useReducer((n: number) => n + 1, 0);
  const [passando, setPassando] = useState<number | null>(null);
  const [janela, setJanela] = useState<JanelaAberta | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  // Durante o arrastar, o bloco sob o mouse não vira o alvo (a alça fica no bloco que se arrasta).
  const { arrasto, iniciar, emCurso: emArrasto } = useArrastar(editor, folha);

  // Cada mudança no texto, ou no tamanho da janela, mexe no lugar dos blocos.
  useEffect(() => {
    editor.on("transaction", refazer);
    window.addEventListener("resize", refazer);
    return () => {
      editor.off("transaction", refazer);
      window.removeEventListener("resize", refazer);
    };
  }, [editor]);

  // O bloco sob o mouse. Pela altura, e não pelo alvo do mouse: o ⚙ fica na margem, fora do texto.
  useEffect(() => {
    const el = folha.current;
    if (!el) return;
    let quadro = 0;
    const mover = (ev: MouseEvent) => {
      if (emArrasto.current || (ev.target as Element | null)?.closest?.("[data-ajustes]")) return;
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        if (editor.isDestroyed || emArrasto.current) return;
        const indice = blocoNaAltura(editor, ev.clientY);
        setPassando(indice);
        // O contorno tracejado e a etiqueta do bloco sob o mouse (só desenho).
        destacar(editor.view, { sobre: indice });
      });
    };
    const sair = () => {
      cancelAnimationFrame(quadro);
      if (emArrasto.current) return;
      setPassando(null);
      if (!editor.isDestroyed) destacar(editor.view, { sobre: null });
    };
    el.addEventListener("mousemove", mover);
    el.addEventListener("mouseleave", sair);
    return () => {
      cancelAnimationFrame(quadro);
      el.removeEventListener("mousemove", mover);
      el.removeEventListener("mouseleave", sair);
    };
  }, [editor, folha, emArrasto]);

  const doCursor = () => editor.state.selection.$from.index(0);
  const abrirPara = (indice: number) => {
    const b = blocoAjustavel(editor.state.doc.maybeChild(indice));
    if (b) setJanela({ indice, aplicarA: b.excecoes ? "este" : "todos", avisos: [], erro: null });
  };
  const fechar = () => {
    setJanela(null);
    editor.commands.focus();
  };

  // Alt+F e o quadro da barra abrem (ou fecham) os ajustes do bloco do cursor.
  const alternarRef = useRef(() => {});
  alternarRef.current = () => (janela ? fechar() : abrirPara(doCursor()));
  useEffect(() => {
    const alternar = () => alternarRef.current();
    controle.addEventListener("alternar", alternar);
    const aoApertar = (ev: KeyboardEvent) => {
      if (!ehAtalhoDosAjustes(ev) || document.querySelector('[aria-modal="true"]')) return;
      ev.preventDefault();
      alternar();
    };
    document.addEventListener("keydown", aoApertar);
    return () => {
      controle.removeEventListener("alternar", alternar);
      document.removeEventListener("keydown", aoApertar);
    };
  }, [controle]);

  // Um clique fora da janelinha fecha; o Esc também, onde quer que esteja o foco (um botão apagado pela troca de valor o deixa no corpo da página).
  const aberta = janela !== null;
  useEffect(() => {
    if (!aberta) return;
    const fora = (ev: MouseEvent) => {
      if (!(ev.target as Element | null)?.closest?.("[data-ajustes]")) setJanela(null);
    };
    const esc = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || ev.defaultPrevented) return;
      setJanela(null);
      editor.commands.focus();
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberta, editor]);

  const doc = editor.state.doc;
  const bloco: BlocoAjustavel | null = janela ? blocoAjustavel(doc.maybeChild(janela.indice)) : null;
  // O bloco da janela sumiu (apagado, ou virou outra coisa): a janelinha fecha.
  useEffect(() => {
    if (janela && !bloco) setJanela(null);
  }, [janela, bloco]);

  // A janelinha aparece inteira: se abriu perto do fim da tela, a folha rola um pouco.
  useLayoutEffect(() => {
    if (janela) caixa.current?.scrollIntoView?.({ block: "nearest" });
  }, [janela?.indice, janela?.aplicarA, janela?.avisos.length, janela?.erro]); // eslint-disable-line react-hooks/exhaustive-deps

  const alvo = arrasto?.de ?? (passando !== null && podeMover(doc.maybeChild(passando)) ? passando : doCursor());
  const blocoDoAlvo = blocoAjustavel(doc.maybeChild(alvo));
  const lugarDoAlvo = folha.current && podeMover(doc.maybeChild(alvo)) ? medirBloco(editor, folha.current, alvo) : null;
  const lugarDaJanela = folha.current && janela && bloco ? medirBloco(editor, folha.current, janela.indice) : null;
  const modelo = titulos.modelo;

  const escolher = (escrita: Escrita) => {
    if (!janela || !bloco || !modelo) return;
    if (janela.aplicarA === "este") {
      const r = escreverSoEste(modelo, bloco, escrita);
      if (!r.ok) return setJanela({ ...janela, erro: r.erro, avisos: [] });
      const no = editor.state.doc.child(janela.indice);
      editor.view.dispatch(editor.state.tr.setNodeMarkup(posDoBloco(editor.state.doc, janela.indice), undefined, { ...no.attrs, excecoes: r.excecoes ?? null }));
      setJanela({ ...janela, erro: null, avisos: r.avisos });
    } else {
      const r = aoMudarTodos(bloco.elemento, escrita);
      setJanela({ ...janela, erro: r.ok ? null : r.erro, avisos: r.ok ? r.avisos : [] });
    }
  };

  /** Sobe ou desce o bloco um lugar. Devolve onde ele ficou (ou nulo se não pôde andar). */
  const moverUm = (indice: number, sentido: "cima" | "baixo"): number | null => {
    const lacuna = lacunaAoMover(indice, editor.state.doc.childCount, sentido);
    const tr = lacuna === null ? null : moverBloco(editor.state, indice, lacuna);
    if (lacuna === null || !tr) return null;
    editor.view.dispatch(tr);
    // O cursor foi para o bloco movido: ele passa a ser o alvo da alça e do ⚙.
    setPassando(null);
    return indiceDepoisDeMover(indice, lacuna);
  };

  const voltar = () => {
    if (!janela || !bloco) return;
    const no = editor.state.doc.child(janela.indice);
    editor.view.dispatch(editor.state.tr.setNodeMarkup(posDoBloco(editor.state.doc, janela.indice), undefined, { ...no.attrs, excecoes: null }));
    setJanela({ ...janela, erro: null, avisos: [] });
  };

  return (
    <>
      {lugarDoAlvo && (
        <button
          type="button"
          className="alca"
          data-ajustes=""
          style={{ top: lugarDoAlvo.top, left: Math.max(4, lugarDoAlvo.left - 58) }}
          aria-label={`Arrastar ${blocoDoAlvo ? `o ${nomeDoBloco(blocoDoAlvo).toLowerCase()}` : "o bloco"} para outro lugar`}
          title="Arraste para mudar de lugar. Com a alça em foco, as setas ↑ e ↓ também movem."
          onMouseDown={(ev) => {
            setJanela(null);
            iniciar(alvo, ev);
          }}
          onKeyDown={(ev) => {
            if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;
            ev.preventDefault();
            moverUm(alvo, ev.key === "ArrowUp" ? "cima" : "baixo");
          }}
        >
          <Icone nome="alca" tamanho={16} />
        </button>
      )}
      {lugarDoAlvo && blocoDoAlvo && !arrasto && (
        <button
          type="button"
          className="engrenagem"
          data-ajustes=""
          style={{ top: lugarDoAlvo.top, left: Math.max(4, lugarDoAlvo.left - 34) }}
          aria-label={`Ajustes do ${nomeDoBloco(blocoDoAlvo).toLowerCase()} (${ATALHO_DOS_AJUSTES.texto})`}
          title={`Ajustes deste ${blocoDoAlvo.tipo} (${ATALHO_DOS_AJUSTES.texto})`}
          onMouseDown={(ev) => ev.preventDefault()}
          onClick={() => (janela?.indice === alvo ? fechar() : abrirPara(alvo))}
        >
          <Icone nome="engrenagem" tamanho={16} />
        </button>
      )}
      {arrasto?.linha && <div className="linha-de-soltura" aria-hidden="true" style={{ top: arrasto.linha.top, left: arrasto.linha.left, width: arrasto.linha.largura }} />}
      {janela && bloco && modelo && lugarDaJanela && (
        <div ref={caixa} className="janelinha-lugar" data-ajustes="" style={{ top: lugarDaJanela.top + 32, left: Math.max(8, lugarDaJanela.left - 34) }}>
          <JanelinhaDoBloco
            nome={nomeDoBloco(bloco)}
            origem={origemDaJanelinha(modelo, bloco, janela.aplicarA)}
            linhas={linhasDaJanelinha(modelo, titulos.tipo, bloco, janela.aplicarA)}
            aplicarA={janela.aplicarA}
            excecoes={excecoesDoBloco(bloco)}
            avisos={janela.avisos}
            erro={janela.erro}
            aoMudarAplicarA={(a) => setJanela({ ...janela, aplicarA: a, avisos: [], erro: null })}
            aoEscolher={escolher}
            aoVoltar={voltar}
            aoFechar={fechar}
            podeMover={{ cima: janela.indice > 0, baixo: janela.indice < doc.childCount - 1 }}
            aoMover={(sentido) => {
              const novo = moverUm(janela.indice, sentido);
              if (novo !== null) setJanela({ ...janela, indice: novo });
            }}
          />
        </div>
      )}
    </>
  );
}
