// O modelo do documento: como o Apud guarda um trabalho.
//
// O trabalho é uma sequência de blocos com significado ("isto é um título de
// nível 2", "isto é uma lista"), nunca formatação ("Times 12, negrito"). Quem
// decide a aparência é o perfil da norma, na hora de montar o PDF.
//
// Este formato é do Apud, e não da biblioteca do editor (TipTap). Assim, se um
// dia o editor mudar, os arquivos dos trabalhos continuam valendo. A conversão
// entre os dois fica em tiptap.ts.
//
// Versões do formato:
//   1. Fase 1: títulos, parágrafos, listas e quebras de página.
//   2. Fase 2: as referências do trabalho e as citações dentro do texto.
//   3. Fase 2: o bloco "lista de referências", que a pessoa põe onde quiser
//      (decisão de 20/11/2026: tudo o que sai no PDF tem um lugar no editor).
//   4. Fase 3: citação longa, figura, tabela e nota de rodapé; os dados do
//      trabalho (título, autores, curso...), os elementos antes do texto
//      (capa, folha de rosto, resumos...) e as imagens das figuras.
// Documentos antigos são convertidos ao abrir, sem perder nada (arquivos/formato.ts).

import type { Citacao, Data, Referencia } from "./referencias";

export * from "./referencias";

/** Versão do formato. Sobe quando o formato mudar, para os arquivos antigos serem convertidos. */
export const VERSAO_DO_FORMATO = 4;

/** Marcas dentro do texto. Itálico, por exemplo, para palavras estrangeiras. */
export type Marca = "negrito" | "italico" | "sobrescrito";

/** Um pedaço de texto com as mesmas marcas. */
export interface TrechoDeTexto {
  texto: string;
  /** Sempre na ordem negrito, italico, sobrescrito. Ausente quando não há marcas. */
  marcas?: Marca[];
}

/** Uma citação no meio do texto. Ela não tem marcas: a forma vem da norma. */
export interface TrechoDeCitacao {
  citacao: Citacao;
}

/**
 * Uma nota de rodapé, no ponto do texto onde fica o número dela. O número é
 * do Apud (contínuo no trabalho todo); o texto da nota é da pessoa.
 * Na versão 1, a nota só tem texto com negrito, itálico e sobrescrito.
 */
export interface NotaDeRodape {
  trechos: TrechoDeTexto[];
}

export interface TrechoDeNota {
  nota: NotaDeRodape;
}

/** O conteúdo de um parágrafo, título ou item de lista: texto, citações e notas. */
export type Trecho = TrechoDeTexto | TrechoDeCitacao | TrechoDeNota;

export const ehCitacao = (t: Trecho): t is TrechoDeCitacao => "citacao" in t;
export const ehNota = (t: Trecho): t is TrechoDeNota => "nota" in t;
export const ehTexto = (t: Trecho): t is TrechoDeTexto => "texto" in t;

export type NivelDeTitulo = 1 | 2 | 3 | 4 | 5;

/**
 * Um título. O número (1, 1.1, 2...) é escrito pela própria pessoa, no começo
 * do texto ("1.1 Contexto"); sem número escrito, o título sai sem número.
 */
export interface Titulo {
  tipo: "titulo";
  nivel: NivelDeTitulo;
  trechos: Trecho[];
}

export interface Paragrafo {
  tipo: "paragrafo";
  trechos: Trecho[];
}

export interface ItemDeLista {
  trechos: Trecho[];
  /** Itens dentro do item (na ABNT, as sub-alíneas). */
  subitens?: ItemDeLista[];
}

export interface Lista {
  tipo: "lista";
  /**
   * Se a ordem dos itens importa (passos de um procedimento).
   * A ABNT usa alíneas a), b) nos dois casos; a APA numera só as listas em sequência.
   */
  sequencia: boolean;
  itens: ItemDeLista[];
}

/** Quebra de página: o que vem depois começa numa página nova. A pessoa decide onde. */
export interface QuebraDePagina {
  tipo: "quebra";
}

/**
 * A lista de referências: o título (da norma) e as obras citadas, na ordem da
 * norma. A pessoa põe o bloco onde quiser, normalmente no fim do trabalho.
 */
export interface ListaDeReferencias {
  tipo: "referencias";
}

/**
 * Citação longa (em bloco): mais de 3 linhas na ABNT, 40 palavras ou mais na
 * APA. A pessoa escolhe o bloco; o recuo, a fonte e o espaço vêm da norma. A
 * citação com "@" vai dentro do bloco, normalmente no fim.
 */
export interface CitacaoLonga {
  tipo: "citacaoLonga";
  trechos: Trecho[];
}

/**
 * O que vem com toda figura e tabela: título (acima), fonte e nota (abaixo).
 * O número ("Figura 3") é do Apud, contado sozinho na ordem do texto.
 */
export interface Identificacao {
  titulo: Trecho[];
  /**
   * O que vem depois de "Fonte:". Pode ter citações. Com fontePropria, fica
   * guardada (para desmarcar sem perder) mas não sai no PDF.
   */
  fonte: Trecho[];
  /** A figura ou tabela é da própria pessoa: a fonte sai como a norma pede ("Elaborado pelo próprio autor" na ABNT). */
  fontePropria?: true;
  /** Legenda ou nota, abaixo da fonte. Ausente quando não há. */
  nota?: Trecho[];
}

/** Espécies de ilustração que a ABNT conta separadas ("Gráfico 1", "Quadro 2"). Na APA, tudo é Figura. */
export const ESPECIES_DE_ILUSTRACAO = ["figura", "grafico", "quadro"] as const;
export type EspecieDeIlustracao = (typeof ESPECIES_DE_ILUSTRACAO)[number];

export interface Figura extends Identificacao {
  tipo: "figura";
  /** O código da imagem em Documento.imagens. */
  imagem: string;
  /** Ausente: figura. */
  especie?: Exclude<EspecieDeIlustracao, "figura">;
  /** Largura na página, em porcentagem da largura do texto (10 a 100). Ausente: o tamanho da imagem (até a largura do texto). 100 é a largura toda. */
  largura?: number;
}

/**
 * Tabela: uma grade retangular de células (todas as linhas com o mesmo número
 * de células, sem juntar células na versão 1). As primeiras linhas podem ser
 * o cabeçalho. O desenho (fios, alinhamento) vem da norma.
 */
export interface Tabela extends Identificacao {
  tipo: "tabela";
  /** Linhas, cada uma com as suas células; cada célula é um texto. */
  linhas: Trecho[][][];
  /** Quantas linhas do topo são o cabeçalho (0 = nenhuma). */
  cabecalho: number;
}

export type Bloco = Titulo | Paragrafo | Lista | QuebraDePagina | ListaDeReferencias | CitacaoLonga | Figura | Tabela;

// ---------------------------------------------------------------------------
// Imagens das figuras (decisão de 21/11/2026: dentro do .apud, um arquivo só)

export const FORMATOS_DE_IMAGEM = ["png", "jpeg", "gif", "webp", "svg"] as const;
export type FormatoDeImagem = (typeof FORMATOS_DE_IMAGEM)[number];

export interface Imagem {
  /** Código da imagem, usado pela figura. Feito do próprio conteúdo: a mesma imagem duas vezes é guardada uma vez só. */
  id: string;
  formato: FormatoDeImagem;
  /** O arquivo da imagem, em base64 (texto), para caber no .apud. */
  dados: string;
  /** Tamanho em pixels, quando conhecido. */
  largura?: number;
  altura?: number;
  /** Nome do arquivo de onde veio, só para mostrar. */
  nome?: string;
}

// ---------------------------------------------------------------------------
// Dados do trabalho e elementos antes do texto (fase 3)

/** O tipo de trabalho escolhido no assistente. Decide o tamanho do resumo e, na APA, o modo (estudante ou profissional). */
export const TIPOS_DE_TRABALHO = ["disciplina", "estagio", "artigo", "tcc"] as const;
export type TipoDeTrabalho = (typeof TIPOS_DE_TRABALHO)[number];

/** Os dados que montam a capa, a folha de rosto e a página de título. Só o tipo e o idioma são obrigatórios. */
export interface DadosDoTrabalho {
  tipo: TipoDeTrabalho;
  /** Idioma do trabalho (muda rótulos como Sumário e Resumo). Por enquanto só "pt-BR". */
  idioma: string;
  /** Vazio: o trabalho ainda não tem título (arquivos antigos); nada sai no PDF. */
  titulo: string;
  subtitulo?: string;
  /** Nomes completos, na ordem em que saem. */
  autores: string[];
  ano?: number;
  curso?: string;
  instituicao?: string;
  /** Na APA aparece como "Professor". */
  orientador?: string;
  cidade?: string;
  disciplina?: string;
  dataDeEntrega?: Data;
  /**
   * A natureza do trabalho na folha de rosto, como a pessoa escreveu. Ausente:
   * o Apud monta a frase pelo tipo, a disciplina, o curso e a instituição.
   */
  natureza?: string;
}

/** Um resumo, num idioma, com o título nesse idioma (revistas pedem) e as palavras-chave. */
export interface Resumo {
  /** Código do idioma: "pt-BR", "en", "es", "fr"... */
  idioma: string;
  /** O título do trabalho neste idioma. Ausente: não sai. */
  titulo?: string;
  trechos: TrechoDeTexto[];
  palavrasChave: string[];
}

/** Um elemento de texto antes do texto principal, que a pessoa liga e desliga sem perder o que escreveu. */
export interface ElementoDeTexto {
  incluir: boolean;
  /** Parágrafos. */
  paragrafos: TrechoDeTexto[][];
}

export interface Epigrafe extends ElementoDeTexto {
  /** Quem escreveu a frase, como deve sair ("Clarice Lispector"). */
  autoria: string;
}

/**
 * Os elementos antes do texto, que aparecem na "Abertura do trabalho", no
 * topo do editor. A ordem no PDF é da norma, não daqui. Desligar um elemento
 * guarda o que foi escrito.
 */
export interface Abertura {
  capa: boolean;
  folhaDeRosto: boolean;
  /** Página de título da APA. */
  paginaDeTitulo: boolean;
  dedicatoria: ElementoDeTexto;
  agradecimentos: ElementoDeTexto;
  epigrafe: Epigrafe;
  /** Na ordem em que saem. Um resumo na lista sai no PDF. */
  resumos: Resumo[];
  sumario: boolean;
  /** Versão sem identificação, para avaliação cega: os nomes ficam guardados, mas não saem no PDF. */
  semIdentificacao: boolean;
}

/** O trabalho inteiro: os dados, a abertura, o texto, as referências e as imagens. */
export interface Documento {
  versao: typeof VERSAO_DO_FORMATO;
  dados: DadosDoTrabalho;
  abertura: Abertura;
  blocos: Bloco[];
  /** As referências cadastradas, na ordem do cadastro. A lista final sai na ordem da norma. */
  referencias: Referencia[];
  /** As imagens das figuras. */
  imagens: Imagem[];
}

export const ORDEM_DAS_MARCAS: readonly Marca[] = ["negrito", "italico", "sobrescrito"];

/** Junta o texto de vários trechos, sem as marcas, sem as citações e sem as notas. */
export function textoSimples(trechos: Trecho[]): string {
  return trechos.map((t) => (ehTexto(t) ? t.texto : "")).join("");
}

export function dadosVazios(): DadosDoTrabalho {
  return { tipo: "disciplina", idioma: "pt-BR", titulo: "", autores: [] };
}

/** Tudo desligado: o PDF começa direto no texto, como nas fases 1 e 2. */
export function aberturaVazia(): Abertura {
  return {
    capa: false,
    folhaDeRosto: false,
    paginaDeTitulo: false,
    dedicatoria: { incluir: false, paragrafos: [] },
    agradecimentos: { incluir: false, paragrafos: [] },
    epigrafe: { incluir: false, paragrafos: [], autoria: "" },
    resumos: [],
    sumario: false,
    semIdentificacao: false,
  };
}

export function documentoVazio(): Documento {
  return {
    versao: VERSAO_DO_FORMATO,
    dados: dadosVazios(),
    abertura: aberturaVazia(),
    blocos: [{ tipo: "paragrafo", trechos: [] }],
    referencias: [],
    imagens: [],
  };
}

// ---------------------------------------------------------------------------
// Percorrer o texto

/**
 * Cada texto do trabalho (parágrafo, título, item, célula, título e fonte de
 * figura...) na ordem de leitura, que é a ordem do PDF e do editor. Quem
 * precisa olhar todo o texto (as citações, por exemplo) usa esta função, para
 * nenhum bloco novo ficar de fora.
 */
export function textosDosBlocos(blocos: Bloco[]): Trecho[][] {
  const saida: Trecho[][] = [];
  const dosItens = (itens: ItemDeLista[]) =>
    itens.forEach((i) => {
      saida.push(i.trechos);
      if (i.subitens) dosItens(i.subitens);
    });
  const daIdentificacao = (b: Identificacao, meio?: () => void) => {
    saida.push(b.titulo);
    meio?.();
    saida.push(b.fonte);
    if (b.nota) saida.push(b.nota);
  };
  for (const b of blocos) {
    switch (b.tipo) {
      case "paragrafo":
      case "titulo":
      case "citacaoLonga":
        saida.push(b.trechos);
        break;
      case "lista":
        dosItens(b.itens);
        break;
      case "figura":
        daIdentificacao(b);
        break;
      case "tabela":
        daIdentificacao(b, () => b.linhas.forEach((linha) => linha.forEach((celula) => saida.push(celula))));
        break;
      case "quebra":
      case "referencias":
        break;
    }
  }
  return saida;
}

/** As imagens que alguma figura usa. */
export function imagensUsadas(blocos: Bloco[]): Set<string> {
  return new Set(blocos.flatMap((b) => (b.tipo === "figura" ? [b.imagem] : [])));
}
