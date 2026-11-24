import { useCallback, useEffect, useState } from "react";
import { rodandoNoPrograma } from "../arquivos/armazenamento";
import { arquivoDoIcone, gravarIcone, lerIcone, type IdDoIcone } from "./icone";

/**
 * Põe o ícone escolhido na janela do programa (e na barra de tarefas).
 * Ao abrir, aplica o guardado (o padrão cobalto é o mesmo do instalador, só em tamanho único).
 * No navegador (sem o programa) não há janela para mudar.
 */
async function pontoNaJanela(id: IdDoIcone): Promise<void> {
  if (!rodandoNoPrograma) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const resposta = await fetch(arquivoDoIcone(id));
    const bytes = new Uint8Array(await resposta.arrayBuffer());
    await getCurrentWindow().setIcon(bytes);
  } catch {
    // Sem permissão ou sem a imagem: o ícone do instalador continua, e o programa segue normalmente.
  }
}

export function useIcone() {
  const [escolhido, setEscolhido] = useState<IdDoIcone>(() => lerIcone());

  useEffect(() => {
    void pontoNaJanela(escolhido);
  }, [escolhido]);

  const escolher = useCallback((novo: IdDoIcone) => {
    setEscolhido(novo);
    gravarIcone(novo);
  }, []);

  return { escolhido, escolher };
}
