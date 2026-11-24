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
//   5. Versão 2 do Apud (etapa 1d): o mesmo documento; o arquivo passa a levar a
//      cópia do modelo. As versões 1 a 4 eram da versão de testes e não abrem mais.
//   6. Etapa 2 da versão 2: as exceções "só este" nos parágrafos e títulos. Um
//      arquivo da versão 5 é o mesmo documento sem exceções e abre como está.
//   7. Etapa 3 da versão 2 (parte 3a): a abertura vira uma lista de blocos, como
//      o texto (capa, folha de rosto, dedicatória, um resumo por idioma...),
//      mais os textos "guardados" (tirados da abertura sem perder o que foi
//      escrito). Um documento das versões 5 e 6, com as caixas de marcar, é
//      convertido ao abrir (arquivos/formato.ts), sem perder nada.

import type { Citacao, Data, Referencia } from "./referencias";

export * from "./referencias";

/** Versão do formato. Sobe quando o formato mudar, para os arquivos antigos serem convertidos. */
export const VERSAO_DO_FORMATO = 7;

/** A versão mais antiga do documento que este Apud lê (a primeira da versão 2). */
export const PRIMEIRA_VERSAO_DO_FORMATO = 5;

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
 * As exceções de um bloco ("só este", decisão 5 da v2): o nome da propriedade
 * e o valor como texto, como nos modelos ({ "alinhamento": "centralizado" }).
 * Valem só para este bloco, por cima do elemento (modelos/excecoes.ts). Um
 * bloco sem exceções não tem o campo.
 */
export type Excecoes = Record<string, string>;

/**
 * Um título. O número (1, 1.1, 2...) é escrito pela própria pessoa, no começo
 * do texto ("1.1 Contexto"); sem número escrito, o título sai sem número.
 */
export interface Titulo {
  tipo: "titulo";
  nivel: NivelDeTitulo;
  trechos: Trecho[];
  excecoes?: Excecoes;
}

export interface Paragrafo {
  tipo: "paragrafo";
  trechos: Trecho[];
  excecoes?: Excecoes;
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

// ---------------------------------------------------------------------------
// A abertura: os blocos antes do texto (versão 7)

/**
 * Os blocos da abertura, na ordem em que ficam no editor e saem no PDF
 * (NBR 14724: capa, folha de rosto, dedicatória, agradecimentos, epígrafe,
 * resumos, sumário; a página de título é da APA e vem no lugar da capa).
 * A ordem é fixa: os blocos da abertura não se arrastam (decisão 16).
 */
export const ORDEM_DA_ABERTURA = ["capa", "folhaDeRosto", "paginaDeTitulo", "dedicatoria", "agradecimentos", "epigrafe", "resumo", "sumario"] as const;
export type TipoDaAbertura = (typeof ORDEM_DA_ABERTURA)[number];

/** Os blocos montados pelo Apud com os dados do trabalho (as peças) ou com os títulos do texto (o sumário). */
export const FOLHAS_MONTADAS = ["capa", "folhaDeRosto", "paginaDeTitulo", "sumario"] as const;
export type TipoDeFolhaMontada = (typeof FOLHAS_MONTADAS)[number];

/** Capa, folha de rosto, página de título ou sumário: só o lugar; o conteúdo vem dos dados e do texto. */
export interface FolhaMontada {
  tipo: TipoDeFolhaMontada;
}

/** Dedicatória ou agradecimentos: parágrafos da pessoa. */
export interface TextoDaAbertura {
  tipo: "dedicatoria" | "agradecimentos";
  paragrafos: TrechoDeTexto[][];
}

export interface Epigrafe {
  tipo: "epigrafe";
  paragrafos: TrechoDeTexto[][];
  /** Quem escreveu a frase, como deve sair ("Clarice Lispector"). */
  autoria: string;
}

/** Um resumo, num idioma, com o título nesse idioma (revistas pedem) e as palavras-chave. */
export interface Resumo {
  tipo: "resumo";
  /** Código do idioma: "pt-BR", "en", "es", "fr"... */
  idioma: string;
  /** O título do trabalho neste idioma. Ausente: não sai. */
  titulo?: string;
  /** Um parágrafo só (NBR 6028: parágrafo único). */
  trechos: TrechoDeTexto[];
  palavrasChave: string[];
}

export type BlocoDaAbertura = FolhaMontada | TextoDaAbertura | Epigrafe | Resumo;
/** Os blocos da abertura que têm texto da pessoa (os que podem ficar guardados). */
export type TextoGuardavel = TextoDaAbertura | Epigrafe | Resumo;

/**
 * Os elementos antes do texto, no alto do editor (versão 7). Ligar é ter o
 * bloco na lista; "Tirar da abertura" leva o texto escrito para os guardados,
 * e "Adicionar à abertura" o traz de volta (decisão do Francisco, 24/11/2026).
 * Se o modelo não tem um elemento (a APA não tem capa), o bloco fica no
 * trabalho mas não sai no PDF.
 */
export interface Abertura {
  /** Na ordem de ORDEM_DA_ABERTURA; os resumos na ordem em que saem. */
  blocos: BlocoDaAbertura[];
  /** O que foi tirado da abertura com texto: no máximo um de cada tipo, e um resumo por idioma. */
  guardados: TextoGuardavel[];
  /** Versão sem identificação, para avaliação cega: os nomes ficam guardados, mas não saem no PDF. */
  semIdentificacao: boolean;
}

/** O trabalho inteiro: os dados, a abertura, o texto, as referências e as imagens. */
export interface Documento {
  /** Ao abrir, um documento das versões 5 e 6 passa a ser da 7 (a abertura é convertida em blocos). */
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

/** Nenhum bloco: o PDF começa direto no texto, como nas fases 1 e 2. */
export function aberturaVazia(): Abertura {
  return { blocos: [], guardados: [], semIdentificacao: false };
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

// ---------------------------------------------------------------------------
// A abertura em blocos

const posicaoNaOrdem = (tipo: TipoDaAbertura) => ORDEM_DA_ABERTURA.indexOf(tipo);

export const ehFolhaMontada = (b: BlocoDaAbertura): b is FolhaMontada => (FOLHAS_MONTADAS as readonly string[]).includes(b.tipo);

/** Os blocos na ordem da norma; os resumos ficam na ordem em que estavam. */
export function ordenarAbertura<T extends BlocoDaAbertura>(blocos: T[]): T[] {
  return blocos
    .map((b, i) => ({ b, i }))
    .sort((x, y) => posicaoNaOrdem(x.b.tipo) - posicaoNaOrdem(y.b.tipo) || x.i - y.i)
    .map((x) => x.b);
}

/** Se o bloco tem algo escrito pela pessoa (o que não pode se perder). */
export function temTextoNaAbertura(b: BlocoDaAbertura): boolean {
  const algum = (ts: TrechoDeTexto[]) => ts.some((t) => t.texto.trim());
  switch (b.tipo) {
    case "dedicatoria":
    case "agradecimentos":
      return b.paragrafos.some(algum);
    case "epigrafe":
      return b.paragrafos.some(algum) || !!b.autoria.trim();
    case "resumo":
      return algum(b.trechos) || b.palavrasChave.some((p) => p.trim()) || !!b.titulo?.trim();
    default:
      return false;
  }
}

/** Mesmo lugar nos guardados: o mesmo tipo e, no resumo, o mesmo idioma. */
const mesmoLugar = (a: BlocoDaAbertura, b: BlocoDaAbertura) => a.tipo === b.tipo && (a.tipo !== "resumo" || (b as Resumo).idioma === a.idioma);

/** O bloco vazio de cada tipo, como entra com "Adicionar à abertura". */
export function blocoVazioDaAbertura(tipo: TipoDaAbertura, idioma = "pt-BR"): BlocoDaAbertura {
  switch (tipo) {
    case "dedicatoria":
    case "agradecimentos":
      return { tipo, paragrafos: [] };
    case "epigrafe":
      return { tipo, paragrafos: [], autoria: "" };
    case "resumo":
      return { tipo, idioma, trechos: [], palavrasChave: [] };
    default:
      return { tipo };
  }
}

/**
 * Tira um bloco da abertura. Se ele tem texto, o texto vai para os guardados
 * (no lugar de um guardado do mesmo tipo e idioma, se houver).
 */
export function tirarDaAbertura(abertura: Abertura, indice: number): Abertura {
  const bloco = abertura.blocos[indice];
  if (!bloco) return abertura;
  const blocos = abertura.blocos.filter((_, i) => i !== indice);
  const guardados = temTextoNaAbertura(bloco)
    ? [...abertura.guardados.filter((g) => !mesmoLugar(g, bloco)), structuredClone(bloco) as TextoGuardavel]
    : abertura.guardados;
  return { ...abertura, blocos, guardados };
}

/**
 * Põe um bloco na abertura, no lugar da norma. Se há um guardado desse tipo
 * (e idioma, no resumo), ele volta com o texto e sai dos guardados. Um tipo que
 * só pode haver um (capa, dedicatória...) e já está na abertura não entra de novo.
 */
export function adicionarAAbertura(abertura: Abertura, tipo: TipoDaAbertura, idioma?: string): Abertura {
  if (tipo !== "resumo" && abertura.blocos.some((b) => b.tipo === tipo)) return abertura;
  const vazio = blocoVazioDaAbertura(tipo, idioma);
  const guardado = abertura.guardados.find((g) => mesmoLugar(g, vazio));
  const bloco = guardado ? structuredClone(guardado) : vazio;
  const depois = abertura.blocos.findIndex((b) => posicaoNaOrdem(b.tipo) > posicaoNaOrdem(tipo));
  const blocos = [...abertura.blocos];
  blocos.splice(depois === -1 ? blocos.length : depois, 0, bloco);
  return { ...abertura, blocos, guardados: guardado ? abertura.guardados.filter((g) => g !== guardado) : abertura.guardados };
}
