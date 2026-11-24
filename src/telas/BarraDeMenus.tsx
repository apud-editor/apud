import { useEffect, useRef, useState } from "react";
import { menuVizinho, primeiroItem, proximoItem, ultimoItem, type Menu } from "./menus";

interface Props {
  menus: Menu[];
}

/**
 * A barra de menus do cabeçalho, no padrão de teclado dos programas do Windows:
 * Tab chega na barra; Setas esquerda e direita andam entre os menus; Seta para
 * baixo, Enter ou Espaço abrem; Setas sobem e descem nos itens; Esc fecha e
 * devolve o foco ao menu; clicar fora fecha.
 */
export default function BarraDeMenus({ menus }: Props) {
  const [aberto, setAberto] = useState<number | null>(null);
  /** Por onde o teclado anda na barra quando nada está aberto. */
  const [naBarra, setNaBarra] = useState(0);
  const [item, setItem] = useState(-1);
  const raiz = useRef<HTMLDivElement>(null);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const itens = useRef<(HTMLButtonElement | null)[]>([]);
  const devolverFoco = useRef(false);

  // O foco acompanha o item escolhido pelo teclado.
  useEffect(() => {
    if (aberto !== null && item >= 0) itens.current[item]?.focus();
  }, [aberto, item]);

  useEffect(() => {
    if (aberto === null && devolverFoco.current) {
      devolverFoco.current = false;
      botoes.current[naBarra]?.focus();
    }
  }, [aberto, naBarra]);

  useEffect(() => {
    if (aberto === null) return;
    const fora = (ev: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(ev.target as Node)) setAberto(null);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const abrir = (i: number, comFoco: "primeiro" | "ultimo" | "nenhum") => {
    setAberto(i);
    setNaBarra(i);
    const lista = menus[i].itens;
    setItem(comFoco === "primeiro" ? primeiroItem(lista) : comFoco === "ultimo" ? ultimoItem(lista) : -1);
  };

  const fechar = (devolver: boolean) => {
    devolverFoco.current = devolver;
    setAberto(null);
    setItem(-1);
  };

  const aoApertarNaBarra = (ev: React.KeyboardEvent, i: number) => {
    const ir = (passo: 1 | -1) => {
      ev.preventDefault();
      const j = menuVizinho(menus.length, i, passo);
      if (aberto !== null) abrir(j, "primeiro");
      else {
        setNaBarra(j);
        botoes.current[j]?.focus();
      }
    };
    if (ev.key === "ArrowRight") ir(1);
    else if (ev.key === "ArrowLeft") ir(-1);
    else if (ev.key === "ArrowDown" || ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      abrir(i, "primeiro");
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      abrir(i, "ultimo");
    } else if (ev.key === "Escape" && aberto !== null) {
      ev.preventDefault();
      fechar(true);
    }
  };

  const aoApertarNoItem = (ev: React.KeyboardEvent, menu: number) => {
    const lista = menus[menu].itens;
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setItem(proximoItem(lista, item, 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setItem(proximoItem(lista, item, -1));
    } else if (ev.key === "Home") {
      ev.preventDefault();
      setItem(primeiroItem(lista));
    } else if (ev.key === "End") {
      ev.preventDefault();
      setItem(ultimoItem(lista));
    } else if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
      ev.preventDefault();
      abrir(menuVizinho(menus.length, menu, ev.key === "ArrowRight" ? 1 : -1), "primeiro");
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      fechar(true);
    } else if (ev.key === "Tab") {
      fechar(false);
    }
  };

  const escolher = (menu: number, i: number) => {
    const it = menus[menu].itens[i];
    if (it.tipo !== "acao" && it.tipo !== "opcao") return;
    if (it.tipo === "acao" && it.desativado) return;
    // Fecha antes: o que o item faz pode mudar o foco (o editor, uma janela).
    setAberto(null);
    setItem(-1);
    it.aoEscolher();
  };

  return (
    <div className="mn-barra" role="menubar" aria-label="Menus do trabalho" ref={raiz}>
      {menus.map((m, i) => (
        <div key={m.id} className="mn-menu">
          <button
            type="button"
            ref={(e) => {
              botoes.current[i] = e;
            }}
            id={`mn-${m.id}`}
            role="menuitem"
            className={`mn-botao ${aberto === i ? "on" : ""}`}
            aria-haspopup="menu"
            aria-expanded={aberto === i}
            aria-controls={aberto === i ? `mn-lista-${m.id}` : undefined}
            tabIndex={naBarra === i ? 0 : -1}
            onClick={() => (aberto === i ? fechar(false) : abrir(i, "nenhum"))}
            onMouseEnter={() => aberto !== null && aberto !== i && abrir(i, "nenhum")}
            onKeyDown={(ev) => aoApertarNaBarra(ev, i)}
          >
            {m.rotulo}
          </button>
          {aberto === i && (
            <div className="mn-lista" id={`mn-lista-${m.id}`} role="menu" aria-labelledby={`mn-${m.id}`}>
              {m.itens.map((it, k) => {
                if (it.tipo === "separador") return <div key={it.id} className="mn-separador" role="separator" />;
                if (it.tipo === "titulo")
                  return (
                    <div key={it.id} className="mn-titulo" role="presentation">
                      {it.rotulo}
                    </div>
                  );
                const desativado = it.tipo === "acao" && it.desativado;
                return (
                  <button
                    key={it.id}
                    type="button"
                    ref={(e) => {
                      itens.current[k] = e;
                    }}
                    role={it.tipo === "opcao" ? "menuitemradio" : "menuitem"}
                    aria-checked={it.tipo === "opcao" ? it.marcado : undefined}
                    aria-disabled={desativado || undefined}
                    aria-keyshortcuts={it.tipo === "acao" ? it.atalho : undefined}
                    className={`mn-item ${desativado ? "off" : ""}`}
                    tabIndex={-1}
                    onClick={() => escolher(i, k)}
                    onMouseEnter={() => !desativado && setItem(k)}
                    onKeyDown={(ev) => aoApertarNoItem(ev, i)}
                  >
                    <span className="mn-marca" aria-hidden="true" />
                    <span className="mn-rotulo">{it.rotulo}</span>
                    {it.tipo === "acao" && it.atalho && <span className="mn-atalho">{it.atalho}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
