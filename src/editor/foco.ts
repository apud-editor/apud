// O Tab dentro de uma janela (como a do "@"): o foco dá a volta nas pontas e
// nunca sai para o texto de trás.
//
// A parte que decide é pura (sem navegador), para ser testada sem jsdom. A
// janela só lê os elementos da tela e chama estas funções.

/** Os elementos que o Tab pode visitar. */
export const SELETOR_DE_FOCO =
  'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Um elemento que recebe foco. Só os botões de opção (rádio) têm algo a mais: o grupo e se estão marcados. */
export interface ItemDeFoco {
  radio?: { grupo: string; marcado: boolean };
}

/**
 * As paradas do Tab, na ordem da tela. Num grupo de opções (rádio), o Tab
 * para uma vez só: na opção marcada, ou na primeira, se nenhuma estiver
 * marcada. É o que o navegador faz; as setas andam dentro do grupo.
 */
export function paradasDoTab(itens: readonly ItemDeFoco[]): number[] {
  const marcadoDoGrupo = new Map<string, number>();
  const primeiroDoGrupo = new Map<string, number>();
  itens.forEach((item, i) => {
    if (!item.radio?.grupo) return;
    const { grupo, marcado } = item.radio;
    if (!primeiroDoGrupo.has(grupo)) primeiroDoGrupo.set(grupo, i);
    if (marcado && !marcadoDoGrupo.has(grupo)) marcadoDoGrupo.set(grupo, i);
  });
  return itens.flatMap((item, i) => {
    if (!item.radio?.grupo) return [i];
    const grupo = item.radio.grupo;
    return (marcadoDoGrupo.get(grupo) ?? primeiroDoGrupo.get(grupo)) === i ? [i] : [];
  });
}

/**
 * Para onde o foco vai ao apertar Tab (ou Shift+Tab, quando voltar é true).
 * - atual: o índice do elemento com foco na lista de itens, ou -1 se o foco
 *   está fora da janela (no texto de trás, por exemplo).
 * - Devolve o índice do item que deve receber o foco, ou null quando o
 *   navegador pode seguir sozinho (o foco está no meio da janela).
 * Na última parada, o Tab volta para a primeira; na primeira, o Shift+Tab vai
 * para a última. Foco fora da janela volta para dentro.
 */
export function destinoDoTab(paradas: readonly number[], atual: number, voltar: boolean): number | null {
  if (!paradas.length) return null;
  const primeira = paradas[0];
  const ultima = paradas[paradas.length - 1];
  const posicao = paradas.indexOf(atual);
  if (posicao < 0) return voltar ? ultima : primeira;
  if (!voltar && posicao === paradas.length - 1) return primeira;
  if (voltar && posicao === 0) return ultima;
  return null;
}

/** Junta as duas: lê os elementos da janela e move o foco quando preciso. Devolve true se cuidou da tecla. */
export function prenderTab(janela: HTMLElement, voltar: boolean): boolean {
  const elementos = Array.from(janela.querySelectorAll<HTMLElement>(SELETOR_DE_FOCO)).filter((el) => el.getClientRects().length > 0);
  const itens: ItemDeFoco[] = elementos.map((el) =>
    el instanceof HTMLInputElement && el.type === "radio" ? { radio: { grupo: el.name, marcado: el.checked } } : {},
  );
  const destino = destinoDoTab(paradasDoTab(itens), elementos.indexOf(document.activeElement as HTMLElement), voltar);
  if (destino === null) return false;
  elementos[destino].focus();
  return true;
}
