// Antes de o programa fechar, o trabalho aberto grava o que faltar.
//
// Quando a pessoa fecha a janela, o Tauri avisa a interface e espera. Se a
// gravação falhar, a janela não fecha: aparece um aviso, e um segundo clique
// em fechar sai mesmo assim (a pessoa decide).

import { rodandoNoPrograma } from "../arquivos/armazenamento";

type AntesDeSair = () => Promise<boolean>;

let atual: AntesDeSair | null = null;
let jaAvisou = false;

export function registrarAntesDeSair(f: AntesDeSair): () => void {
  atual = f;
  jaAvisou = false;
  return () => {
    if (atual === f) atual = null;
  };
}

/** Liga o aviso de fechamento da janela. Chamado uma vez, ao abrir o programa. */
let vigiando = false;

export async function vigiarFechamento(): Promise<void> {
  // Uma vez só: dois vigias fechariam a janela sem esperar um ao outro.
  if (!rodandoNoPrograma || vigiando) return;
  vigiando = true;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().onCloseRequested(async (evento) => {
    if (!atual || jaAvisou) return; // nada aberto, ou a pessoa já foi avisada e fechou de novo
    const ok = await atual();
    if (!ok) {
      jaAvisou = true;
      evento.preventDefault();
    }
  });
}
