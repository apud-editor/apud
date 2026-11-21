// As referências e as citações no modelo do Apud.
//
// Como o resto do modelo, este formato é do Apud: não é o do Typst (hayagriva),
// nem o do CSL, nem o do editor. Quem converte para o Typst é
// src/citacoes/hayagriva.ts. Assim, se um dia o motor de PDF mudar, os
// trabalhos continuam valendo.
//
// Uma referência guarda os dados da obra, nunca a forma: "SILVA, João Pedro."
// ou "Silva, J. P." quem decide é o perfil da norma.

// ---------------------------------------------------------------------------
// Referências

/** Os tipos de referência da versão 1, na ordem em que aparecem no cadastro. */
export const TIPOS_DE_REFERENCIA = [
  "livro",
  "capitulo",
  "artigo",
  "site",
  "lei",
  "tese",
  "relatorio",
  "evento",
  "noticia",
  "rede-social",
] as const;

export type TipoDeReferencia = (typeof TIPOS_DE_REFERENCIA)[number];

/** Uma pessoa: "Oliveira" e "Lucas Freitas de" (a partícula fica no fim dos prenomes). */
export interface Pessoa {
  sobrenome: string;
  prenomes?: string;
}

/**
 * Uma instituição como autora, escrita como deve sair: por extenso
 * ("Associação Brasileira de Ensino de Psicologia"), pela sigla ("IBGE") ou
 * pela jurisdição, no caso de órgão de governo ("Brasil").
 */
export interface Instituicao {
  instituicao: string;
}

export type Autor = Pessoa | Instituicao;

export const ehInstituicao = (a: Autor): a is Instituicao => "instituicao" in a;

/**
 * Os níveis de uma instituição com subordinação, escrita com ponto entre eles,
 * a entidade principal (ou a jurisdição) primeiro: "Brasil. Ministério da
 * Saúde" vira ["Brasil", "Ministério da Saúde"]. Sem subordinação, um nível só.
 * Na ABNT, a chamada usa só o primeiro: (Brasil, 2014).
 */
export function niveisDaInstituicao(nome: string): string[] {
  const niveis = nome
    .split(/\.\s+(?=\p{Lu})/u)
    .map((n) => n.trim())
    .filter(Boolean);
  return niveis.length ? niveis : [nome.trim()];
}

/** Uma data. Só o ano é obrigatório. */
export interface Data {
  ano: number;
  /** 1 a 12 */
  mes?: number;
  dia?: number;
}

/**
 * Onde a obra foi publicada, quando ela é parte de outra: o livro de um
 * capítulo, a revista de um artigo, os anais de um trabalho em evento, o
 * jornal de uma notícia, a rede social de uma postagem.
 */
export interface Publicacao {
  titulo: string;
  subtitulo?: string;
  /** Organizadores do livro ou dos anais. */
  organizadores?: Autor[];
  /** Cidade da revista ou do jornal. */
  cidade?: string;
  volume?: string;
  numero?: string;
}

/** O evento de um trabalho publicado em anais. */
export interface Evento {
  nome: string;
  /** Número da edição do evento: "20" (20.º seminário). */
  numero?: string;
  ano?: string;
  cidade?: string;
}

/**
 * Uma referência. Os campos que cada tipo usa:
 *
 * - livro: autores, titulo, subtitulo, edicao, cidade, editora, data
 * - capitulo: autores, titulo, publicacao (o livro, com organizadores),
 *   edicao, cidade, editora (do livro), data, paginas
 * - artigo: autores, titulo, subtitulo, publicacao (a revista: titulo, cidade,
 *   volume, numero), data (com o mês, se houver), paginas ou numeroEletronico, doi
 * - site: autores, titulo, editora (o site ou a instituição), cidade, data
 * - lei: autores (a jurisdição: Brasil), titulo, ementa, cidade, editora, data
 * - tese: autores, titulo, subtitulo, tipoDoTrabalho (Tese, Dissertação),
 *   grau (Doutorado em Psicologia), editora (a universidade), cidade, data, folhas
 * - relatorio: autores, titulo, serie (Nota Técnica), numeroNaSerie, cidade, editora, data
 * - evento: autores, titulo, evento, publicacao (os anais), cidade, editora, data, paginas
 * - noticia: autores (muitas vezes nenhum), titulo, publicacao (o jornal, com a cidade), data
 * - rede-social: autores, titulo (o texto da postagem), perfil (@perfil),
 *   tipoDaPostagem (Vídeo), publicacao (a rede: Instagram), cidade, data
 *
 * Todos aceitam url e acesso (data em que a página foi vista), e doi.
 * Sem autores, a obra entra pelo título, como a norma manda.
 */
export interface Referencia {
  /** Código interno, que as citações usam. A pessoa nunca vê. */
  id: string;
  tipo: TipoDeReferencia;
  autores: Autor[];
  titulo: string;
  subtitulo?: string;
  data?: Data;
  /**
   * Data que não se sabe ao certo, já escrita como a ABNT pede: "[2019?]",
   * "[201-]", "[201-?]". Na APA, a obra sai sem data (s.d.).
   */
  dataIncerta?: string;
  edicao?: string;
  cidade?: string;
  editora?: string;
  /** Páginas da parte citada dentro da obra maior: "9-30". */
  paginas?: string;
  /** Artigo sem página: o número eletrônico ("e2024017"). */
  numeroEletronico?: string;
  /** Tese ou dissertação: total de folhas. */
  folhas?: string;
  /** Tese: "Tese", "Dissertação", "Trabalho de Conclusão de Curso". */
  tipoDoTrabalho?: string;
  /** Tese: "Doutorado em Serviço Social". */
  grau?: string;
  /** Relatório: o nome da série ("Nota Técnica") e o número nela. */
  serie?: string;
  numeroNaSerie?: string;
  /** Lei: a ementa. */
  ementa?: string;
  /** Rede social: o perfil ("@jupavan") e o tipo da postagem ("Vídeo"). */
  perfil?: string;
  tipoDaPostagem?: string;
  evento?: Evento;
  publicacao?: Publicacao;
  doi?: string;
  url?: string;
  /** Quando a página foi acessada (Acesso em: 15 maio 2025). */
  acesso?: Data;
}

/** Um código novo para uma referência, diferente dos que já existem. */
export function novoIdDeReferencia(existentes: Iterable<string>, sorteio: () => number = Math.random): string {
  const usados = new Set(existentes);
  for (;;) {
    const id = "r" + Math.floor(sorteio() * 36 ** 6).toString(36).padStart(6, "0");
    if (!usados.has(id)) return id;
  }
}

// ---------------------------------------------------------------------------
// Citações no texto

/**
 * Onde, dentro da obra, está o trecho citado. A página guarda só o número
 * ("15" ou "4-5"): o rótulo ("p.", e "pp." na APA) vem do perfil. Outros
 * localizadores guardam o rótulo: "cap. 3", "local. 7", "min 12".
 */
export type Localizador = { tipo: "pagina"; valor: string } | { tipo: "outro"; rotulo: string; valor: string };

/** Uma obra dentro de uma citação. */
export interface ObraCitada {
  /** O código da referência (Referencia.id). */
  referencia: string;
  localizador?: Localizador;
  /** Destaque seu no trecho citado (grifo nosso; na APA, ênfase adicionada). */
  grifo?: boolean;
  /** Tradução sua (tradução nossa). */
  traducao?: boolean;
}

/**
 * Uma citação, guardada como uma peça dentro do texto.
 *
 * - parenteses: (Silva, 2019, p. 15), também com várias obras:
 *   (Ferreira, 2006; Silva, 2007)
 * - narrativa: o autor faz parte da frase: Silva (2019, p. 15)
 * - apud: citação de citação. "original" é a obra que você não leu, escrita
 *   por você ("Freud, 1915"); só a obra lida vai para as referências:
 *   (Freud, 1915 apud Costa, 2021)
 * - sem-referencia: fala de paciente ou participante, ou comunicação pessoal,
 *   que não entra na lista: (Usuária A)
 *
 * "direta" marca a citação direta (transcrição): a norma pede a página.
 */
export type Citacao =
  | { tipo: "parenteses"; direta?: boolean; obras: ObraCitada[] }
  | { tipo: "narrativa"; direta?: boolean; obra: ObraCitada }
  | { tipo: "apud"; direta?: boolean; original: string; obra: ObraCitada }
  | { tipo: "sem-referencia"; texto: string };

/** As obras de uma citação (nenhuma, na citação sem referência). */
export function obrasDaCitacao(c: Citacao): ObraCitada[] {
  switch (c.tipo) {
    case "parenteses":
      return c.obras;
    case "narrativa":
    case "apud":
      return [c.obra];
    case "sem-referencia":
      return [];
  }
}
