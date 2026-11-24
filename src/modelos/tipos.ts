// Os "moldes" dos modelos da versão 2: a árvore de elementos, as propriedades
// de cada elemento e os valores que um modelo dá a elas.
//
// Um modelo (Em branco, ABNT, APA, ou o de uma faculdade) é uma lista de
// valores por elemento ("Títulos › Nível 1: destaque = negrito"). O Em branco é
// a raiz e dá um valor a tudo o que o Apud aplica; os outros modelos guardam só
// o que muda em relação ao modelo de onde vêm.
//
// Duas heranças se somam:
//   - entre modelos: o Em branco, por cima a ABNT, por cima a faculdade
//     (e, a partir da etapa 1c, as escolhas do trabalho);
//   - entre elementos: o Nível 2 segue Títulos, que segue Texto, até alguém
//     mudar (valorEfetivo, em herdar.ts).

import type { Situacao, Valor } from "../perfis/tipos";
import type { TipoValor } from "../perfis/valores";

export type { Mensagem, Situacao, Valor } from "../perfis/tipos";

/**
 * Os grupos de uma propriedade (decisão 3 da v2), mais um quarto, só de registro:
 *   - aparência: fonte, tamanho, entrelinha, alinhamento, recuos, destaque, espaço em volta;
 *   - montagem: as partes e a ordem delas (rótulos, separadores, campos da capa);
 *   - opções: comportamentos prontos (título na mesma linha, ponto final da citação longa);
 *   - norma: o que a norma diz e o Apud ainda não aplica sozinho (extensão do
 *     resumo, pontuação das alíneas). Fica guardado, sem efeito no PDF, com o
 *     nome que a regra tinha no perfil da versão 1.
 */
export type Grupo = "aparência" | "montagem" | "opções" | "norma" | "citações";

export interface DefinicaoDePropriedade {
  nome: string;
  tipo: TipoValor;
  grupo: Grupo;
  /**
   * Opção que já tem lugar na árvore mas ainda não tem efeito (numeração,
   * maiúsculas e página nova dos títulos, que chegam na etapa 2; frente e verso).
   */
  reservada?: boolean;
}

/**
 * Um atalho escreve várias propriedades do mesmo elemento numa linha só:
 * "margens: 2,54 cm" (as quatro margens), "fonte e tamanho: Arial 11 pt".
 * Uma "escolha" escrita num atalho continua sendo uma escolha de pares.
 */
export interface DefinicaoDeAtalho {
  nome: string;
  tipo: TipoValor;
  /** As propriedades e os valores (como texto) que o atalho escreve. */
  expandir(valor: Valor, texto: string): Array<[propriedade: string, texto: string]>;
}

export interface DefinicaoDeElemento {
  /** Identificador estável, usado nos arquivos .apud: "titulos.nivel1". */
  id: string;
  /** Nome para a pessoa: "Nível 1". */
  nome: string;
  /** O elemento de cima, de quem este herda o que não disser. Só o Texto não tem. */
  pai?: string;
  /** O que o elemento é, em uma frase. */
  descricao: string;
  /** Elemento guardado para depois (errata, apêndice): existe na árvore, ainda não sai no PDF. */
  reservado?: boolean;
  /**
   * As propriedades que o elemento declara. Um elemento pode dar valor às
   * propriedades que ele declara e às que os elementos de cima declaram.
   */
  propriedades: DefinicaoDePropriedade[];
  atalhos?: DefinicaoDeAtalho[];
}

/** Um valor dado por um modelo a uma propriedade de um elemento. */
export interface ValorNoModelo {
  valor: Valor;
  /** O valor como texto, já arrumado ("1,25 cm"). */
  texto: string;
  /** A norma de origem, como no perfil: "NBR 14724:2024 (UFV 2026)". */
  origem: string;
  situacao: Situacao;
  /** O comentário que vinha logo acima da linha (a decisão por trás do valor). */
  nota?: string;
  /** O nome do modelo que deu este valor ("ABNT", "Em branco"). */
  de: string;
  /** Quando o valor veio de um atalho: o nome do atalho ("margens"). */
  atalho?: string;
  /** Onde a linha está, para as mensagens. */
  arquivo?: string;
  linha?: number;
}

/** Os valores de um modelo, por elemento e por propriedade. */
export type ValoresPorElemento = Map<string, Map<string, ValorNoModelo>>;

export interface IdentificacaoDoModelo {
  /** Identificador estável, tirado do nome: "Em branco" → "em-branco". */
  id: string;
  /** Nome para a pessoa: "ABNT", "Em branco", "ABNT – Universidade X". */
  nome: string;
  /** Versão da norma ("2025", "7"), quando o modelo segue uma. */
  versao?: string;
  revisao: number;
  dataDaRevisao: string;
  notaDaRevisao: string;
  /** De quem este modelo herda. Só o Em branco (a raiz) não herda de ninguém. */
  herdaDe?: { nome: string; versao?: string; revisao: number };
}

/** Um modelo lido e conferido: só os valores que ele mesmo escreve. */
export interface Modelo {
  identificacao: IdentificacaoDoModelo;
  /** Os valores que este modelo dá (as diferenças em relação ao modelo de onde vem). */
  diferencas: ValoresPorElemento;
  /** Os atalhos escritos neste modelo, como estão no arquivo (para mostrar e para as escolhas). */
  atalhos: ValoresPorElemento;
  /** O comentário acima de cada seção (elemento), quando há. */
  notasDosElementos: Map<string, string>;
}

/** Um modelo já somado aos de cima: o que o Apud usa para montar o PDF. */
export interface ModeloResolvido {
  identificacao: IdentificacaoDoModelo;
  /** Os modelos da raiz até este: Em branco, ABNT, faculdade... */
  cadeia: IdentificacaoDoModelo[];
  /** Todos os valores, já juntos (cada um diz de que modelo veio). */
  valores: ValoresPorElemento;
  /** Os atalhos que continuam valendo (nenhuma das propriedades deles foi mudada depois). */
  atalhos: ValoresPorElemento;
}
