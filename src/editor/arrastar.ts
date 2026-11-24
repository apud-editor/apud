// Arrastar um bloco pela alça ⋮⋮ (etapa 2d da v2).
//
// É um arrastar feito à mão, com o mouse (apertar, mover, soltar), e não o arrastar do navegador
// (HTML5): aquele falha na janela do programa (WebView). A conta de para onde o bloco vai está em
// mover.ts (testada); aqui só se acompanha o mouse e se desenha a linha cobalto.
//
// Esc cancela. Perto da borda de cima ou de baixo da folha, ela rola sozinha. Um clique na alça,
// sem arrastar, só põe o cursor no bloco.

import { useCallback, useEffect, useRef, useState, type MouseEvent as MouseDoReact, type RefObject } from "react";
import type { Editor as EditorTipTap } from "@tiptap/react";
import { Selection } from "@tiptap/pm/state";
import { destacar } from "./destaque";
import { alturaDaLinha, ficaNoMesmoLugar, lacunaDaSoltura, moverBloco, type Faixa } from "./mover";

/** O que a tela desenha durante o arrastar. */
export interface Arrasto {
  /** O bloco que está sendo arrastado. */
  de: number;
  /** A linha cobalto, na medida da folha que rola. Nula quando soltar ali não mudaria nada. */
  linha: { top: number; left: number; largura: number } | null;
}

/** Quanto o mouse precisa andar (em px) para um clique na alça virar arrastar. */
const LIMIAR = 4;
/** A faixa, junto da borda da folha, em que ela rola sozinha. */
const BORDA_DA_ROLAGEM = 48;

/** O espaço de cada bloco do topo na tela (na medida do mouse). Um bloco sem desenho ocupa um ponto só. */
export function faixasDosBlocos(editor: EditorTipTap): Faixa[] {
  const doc = editor.state.doc;
  const faixas: Faixa[] = [];
  let pos = 0;
  let ultimaBase = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const el = editor.view.nodeDOM(pos) as HTMLElement | null;
    pos += doc.child(i).nodeSize;
    if (el?.getBoundingClientRect) {
      const r = el.getBoundingClientRect();
      faixas.push({ topo: r.top, base: r.bottom });
      ultimaBase = r.bottom;
    } else {
      faixas.push({ topo: ultimaBase, base: ultimaBase });
    }
  }
  return faixas;
}

export function useArrastar(editor: EditorTipTap, folha: RefObject<HTMLElement | null>) {
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const encerrar = useRef<(() => void) | null>(null);
  /** Verdadeiro do apertar do mouse na alça até soltar. Vale na hora (o `arrasto` da tela chega depois). */
  const emCurso = useRef(false);

  // Se a tela sai do ar no meio do arrastar, solta tudo.
  useEffect(() => () => encerrar.current?.(), []);

  const iniciar = useCallback(
    (de: number, ev: MouseDoReact) => {
      const el = folha.current;
      if (ev.button !== 0 || !el) return;
      // Sem isto o mouse começaria a selecionar texto e o editor perderia o foco.
      ev.preventDefault();
      encerrar.current?.();
      emCurso.current = true;

      const inicioX = ev.clientX;
      const inicioY = ev.clientY;
      let comecou = false;
      let lacuna: number | null = null;
      let y = inicioY;
      let quadro = 0;

      const atualizar = () => {
        const faixas = faixasDosBlocos(editor);
        lacuna = lacunaDaSoltura(faixas, y);
        const altura = alturaDaLinha(faixas, lacuna);
        if (ficaNoMesmoLugar(de, lacuna) || altura === null) return setArrasto({ de, linha: null });
        const folhaR = el.getBoundingClientRect();
        const primeiro = (editor.view.nodeDOM(0) as HTMLElement | null)?.getBoundingClientRect();
        setArrasto({
          de,
          linha: {
            top: altura - folhaR.top + el.scrollTop,
            left: primeiro ? primeiro.left - folhaR.left + el.scrollLeft : 0,
            largura: primeiro?.width ?? 0,
          },
        });
      };

      // Perto da borda, a folha rola sozinha (mais depressa quanto mais perto) e a linha acompanha.
      const rolar = () => {
        const r = el.getBoundingClientRect();
        let passo = 0;
        if (y < r.top + BORDA_DA_ROLAGEM) passo = -Math.ceil((r.top + BORDA_DA_ROLAGEM - y) / 4);
        else if (y > r.bottom - BORDA_DA_ROLAGEM) passo = Math.ceil((y - (r.bottom - BORDA_DA_ROLAGEM)) / 4);
        if (passo) {
          const antes = el.scrollTop;
          el.scrollTop += passo;
          if (el.scrollTop !== antes) atualizar();
        }
        quadro = requestAnimationFrame(rolar);
      };

      const aoMover = (e: MouseEvent) => {
        y = e.clientY;
        if (!comecou) {
          if (Math.hypot(e.clientX - inicioX, e.clientY - inicioY) < LIMIAR) return;
          comecou = true;
          destacar(editor.view, { arrastando: de });
          document.body.classList.add("arrastando-bloco");
          quadro = requestAnimationFrame(rolar);
        }
        atualizar();
      };

      const terminar = (aplicar: boolean) => {
        document.removeEventListener("mousemove", aoMover);
        document.removeEventListener("mouseup", aoSoltar);
        document.removeEventListener("keydown", aoApertar, true);
        cancelAnimationFrame(quadro);
        document.body.classList.remove("arrastando-bloco");
        encerrar.current = null;
        emCurso.current = false;
        setArrasto(null);
        if (!editor.isDestroyed) destacar(editor.view, { arrastando: null });
        if (editor.isDestroyed) return;
        if (!comecou) {
          // Um clique na alça, sem arrastar: o cursor vai para dentro do bloco.
          const doc = editor.state.doc;
          let pos = 0;
          for (let i = 0; i < de; i++) pos += doc.child(i).nodeSize;
          editor.view.dispatch(editor.state.tr.setSelection(Selection.near(doc.resolve(Math.min(pos + 1, doc.content.size)), 1)));
          editor.view.focus();
          return;
        }
        if (aplicar && lacuna !== null) {
          const tr = moverBloco(editor.state, de, lacuna);
          if (tr) editor.view.dispatch(tr);
        }
        editor.view.focus();
      };
      const aoSoltar = () => terminar(true);
      const aoApertar = (e: KeyboardEvent) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        terminar(false);
      };

      document.addEventListener("mousemove", aoMover);
      document.addEventListener("mouseup", aoSoltar);
      document.addEventListener("keydown", aoApertar, true);
      encerrar.current = () => terminar(false);
    },
    [editor, folha],
  );

  return { arrasto, iniciar, emCurso };
}
