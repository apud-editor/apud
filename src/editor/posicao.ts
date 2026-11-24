// Onde uma janelinha flutuante (a lista do "@", o aviso de transformar) fica
// embaixo do cursor, sem sair da tela: perto do fim da janela ela sobe para
// cima da linha, e perto da lateral ela volta para dentro. Conta pura, testada.

export interface Posicao {
  x: number;
  /** Logo abaixo da linha do cursor. */
  y: number;
  /** Logo acima da linha do cursor (para quando embaixo não cabe). */
  acima: number;
}

const MARGEM = 8;

/** O canto de cima e da esquerda da janelinha, dado o tamanho dela e o da tela. */
export function ondeFica(p: Posicao, largura: number, altura: number, telaL: number, telaA: number): { x: number; y: number } {
  const x = Math.max(MARGEM, Math.min(p.x, telaL - largura - MARGEM));
  const cabeEmbaixo = p.y + altura + MARGEM <= telaA;
  const y = cabeEmbaixo ? p.y : Math.max(MARGEM, p.acima - altura);
  return { x, y };
}
