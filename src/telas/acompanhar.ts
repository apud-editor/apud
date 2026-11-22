// A prévia acompanha o cursor: as contas, em funções puras (testadas sem navegador).
//
// O conversor põe, só na prévia, uma marca antes de cada bloco do texto, e o
// motor diz onde cada marca ficou: (bloco, página, altura em pt desde o topo da
// página). Com isso a prévia sabe em que página está o bloco do cursor.

/** [bloco, página (a partir de 1), altura em pt desde o topo da página]. */
export type PosicaoDoBloco = [number, number, number];

/**
 * Onde está o bloco do cursor. Um bloco sem marca (parágrafo vazio, por exemplo)
 * fica onde está o último bloco marcado antes dele; antes de todos, no primeiro.
 */
export function lugarDoBloco(posicoes: PosicaoDoBloco[], indice: number): { pagina: number; y: number } | null {
  if (posicoes.length === 0) return null;
  let achado = posicoes[0];
  for (const p of posicoes) {
    if (p[0] <= indice && p[0] >= achado[0]) achado = p;
  }
  if (achado[0] > indice) achado = posicoes[0];
  return { pagina: achado[1], y: achado[2] };
}

/**
 * A altura, no desenho da prévia (em pt), de um ponto de uma página: as páginas
 * vêm uma embaixo da outra, com `espaco` entre elas.
 */
export function alturaNaPrevia(alturasDasPaginas: number[], espaco: number, pagina: number, y: number): number {
  let topo = 0;
  for (let i = 0; i < pagina - 1 && i < alturasDasPaginas.length; i++) topo += alturasDasPaginas[i] + espaco;
  return topo + y;
}

/**
 * Para onde rolar a prévia, ou null se o ponto já está à vista (aí não mexe,
 * para não pular à toa). O ponto vai para um terço da altura visível.
 * Tudo em pixels da tela.
 */
export function rolagemPara(alvo: number, topoVisivel: number, alturaVisivel: number, margem = 40): number | null {
  if (alvo >= topoVisivel + margem && alvo <= topoVisivel + alturaVisivel - margem) return null;
  return Math.max(0, alvo - alturaVisivel / 3);
}
