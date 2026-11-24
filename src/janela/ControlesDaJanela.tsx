import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { rodandoNoPrograma } from "../arquivos/armazenamento";

/**
 * Minimizar, maximizar e fechar, no canto de cima à direita, no lugar da barra de
 * título do Windows (o programa abre sem ela: o cabeçalho do Apud faz esse papel,
 * e as áreas vazias dele arrastam a janela). Só aparecem no programa; no navegador
 * a janela é do navegador. Ficam por cima de tudo (inclusive das janelas abertas
 * no meio da tela), para sempre dar para fechar ou minimizar.
 */
export default function ControlesDaJanela() {
  const [maximizada, setMaximizada] = useState(false);

  useEffect(() => {
    if (!rodandoNoPrograma) return;
    document.documentElement.classList.add("jn-sem-barra");
    let desligar: (() => void) | null = null;
    let ativo = true;
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const janela = getCurrentWindow();
        const ler = async () =>
          ativo && setMaximizada(await janela.isMaximized());
        await ler();
        const parar = await janela.onResized(() => void ler());
        if (ativo) desligar = parar;
        else parar();
      } catch {
        // Sem a janela do programa (ou sem permissão): os botões seguem, só o ícone de restaurar pode errar.
      }
    })();
    return () => {
      ativo = false;
      desligar?.();
      document.documentElement.classList.remove("jn-sem-barra");
    };
  }, []);

  if (!rodandoNoPrograma) return null;

  const agir =
    (fazer: (j: Awaited<ReturnType<typeof janelaAtual>>) => Promise<unknown>) =>
    async () => {
      try {
        await fazer(await janelaAtual());
      } catch {
        // Se o Windows recusar, nada acontece (o botão não tem o que mostrar).
      }
    };

  return createPortal(
    <div className="jn-controles" role="group" aria-label="Controles da janela">
      <button
        type="button"
        className="jn-botao"
        aria-label="Minimizar"
        title="Minimizar"
        onClick={agir((j) => j.minimize())}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M0 5.5H10"
            stroke="currentColor"
            strokeWidth="1"
            fill="none"
          />
        </svg>
      </button>
      <button
        type="button"
        className="jn-botao"
        aria-label={maximizada ? "Restaurar" : "Maximizar"}
        title={maximizada ? "Restaurar" : "Maximizar"}
        onClick={agir((j) => j.toggleMaximize())}
      >
        {maximizada ? (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M2.5 2.5V0.5H9.5V7.5H7.5M0.5 2.5H7.5V9.5H0.5Z"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        ) : (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            aria-hidden="true"
            focusable="false"
          >
            <rect
              x="0.5"
              y="0.5"
              width="9"
              height="9"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="jn-botao jn-fechar"
        aria-label="Fechar"
        title="Fechar"
        onClick={agir((j) => j.close())}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M0.5 0.5L9.5 9.5M9.5 0.5L0.5 9.5"
            stroke="currentColor"
            strokeWidth="1"
            fill="none"
          />
        </svg>
      </button>
    </div>,
    document.body,
  );
}

async function janelaAtual() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}
