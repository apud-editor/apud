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
    const { invoke } = await import("@tauri-apps/api/core");
    const resposta = await fetch(arquivoDoIcone(id));
    const bytes = new Uint8Array(await resposta.arrayBuffer());
    // O comando do programa troca o ícone pequeno e o da barra de tarefas (o setIcon do Tauri só troca o pequeno).
    await invoke("definir_icone_da_janela", { png: Array.from(bytes) });
  } catch (e) {
    // O ícone do instalador continua, e o programa segue normalmente.
    console.error("Não consegui trocar o ícone:", e);
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
