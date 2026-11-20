// Os nomes dos tipos de referência como aparecem nos perfis ("capítulo",
// "trabalho em evento"), ligados aos tipos do modelo do Apud ("capitulo", "evento").

import type { TipoDeReferencia } from "../documento/modelo";

export const NOME_DO_TIPO: Record<TipoDeReferencia, string> = {
  livro: "livro",
  capitulo: "capítulo",
  artigo: "artigo",
  site: "site",
  lei: "lei",
  tese: "tese",
  relatorio: "relatório",
  evento: "trabalho em evento",
  noticia: "notícia",
  "rede-social": "rede social",
};

export const NOMES_DOS_TIPOS: readonly string[] = Object.values(NOME_DO_TIPO);
