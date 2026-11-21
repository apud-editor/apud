// Atalhos de teclado da tela do trabalho, em funções puras (testadas sem navegador).
//
// Alt+R abre e fecha a gaveta de Referências; Alt+P, a Prévia. Foram escolhidos
// porque não brigam com o Word nem com o navegador do Windows (Ctrl+R recarrega
// a página, Ctrl+P imprime). Usa o código da tecla (KeyR, KeyP), e não a letra,
// para funcionar em qualquer teclado. Com Ctrl junto (o AltGr do teclado
// brasileiro manda Ctrl+Alt), o atalho não vale.

export type Painel = "previa" | "referencias";

export const ATALHOS_DOS_PAINEIS: Record<Painel, { codigo: string; texto: string }> = {
  referencias: { codigo: "KeyR", texto: "Alt+R" },
  previa: { codigo: "KeyP", texto: "Alt+P" },
};

/** O que importa da tecla apertada. */
export interface Tecla {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  repeat?: boolean;
}

/** Qual painel a tecla abre ou fecha, ou null se não for um atalho. */
export function painelDoAtalho(t: Tecla): Painel | null {
  if (!t.altKey || t.ctrlKey || t.shiftKey || t.metaKey || t.repeat) return null;
  for (const [painel, atalho] of Object.entries(ATALHOS_DOS_PAINEIS) as [Painel, { codigo: string }][]) {
    if (t.code === atalho.codigo) return painel;
  }
  return null;
}
