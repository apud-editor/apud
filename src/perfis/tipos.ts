// Os "moldes" dos dados que circulam entre a leitura, a conferência e o uso dos perfis.

/** Um aviso ou erro da conferência. Erro impede o uso do perfil; aviso só informa. */
export interface Mensagem {
  gravidade: "erro" | "aviso";
  /** Número da linha no arquivo, quando o problema está numa linha. */
  linha?: number;
  /** Arquivo da linha, quando é outro (o perfil original de um personalizado). */
  arquivo?: string;
  texto: string;
}

/** Junta a linha e o texto: "linha 12: o recuo precisa estar em cm". */
export function formatarMensagem(m: Mensagem): string {
  const onde = m.linha ? `linha ${m.linha}: ` : "";
  const tipo = m.gravidade === "aviso" ? "aviso, " : "";
  return `${tipo}${onde}${m.texto}`;
}

/** O valor de uma regra, já entendido pelo programa. */
export type Valor =
  | { tipo: "medida"; numero: number; unidade: "cm" | "pt" }
  | { tipo: "quantidade"; numero: number; unidade: string }
  | { tipo: "faixa"; minimo: number; maximo: number; unidade: string }
  | { tipo: "espacamento"; numero: number }
  | { tipo: "opcao"; valor: string }
  | { tipo: "simnao"; valor: boolean }
  | { tipo: "texto"; valor: string }
  | { tipo: "lista"; itens: string[] }
  | {
      tipo: "destaque";
      maiusculas: boolean;
      negrito: boolean;
      italico: boolean;
      sublinhado: boolean;
    }
  | { tipo: "meses"; itens: string[] };

/** A situação de um valor, escrita depois da segunda barra. "Ajustável": a norma não fixa, e cada trabalho pode trocar. */
export type Situacao =
  | { tipo: "confirmada" }
  | { tipo: "ajustavel" }
  | { tipo: "escolha"; opcoes: string[] }
  | { tipo: "desligada" };

/** Uma regra pronta para uso. */
export interface Regra {
  chave: string;
  valor: Valor;
  /** O valor como está escrito no arquivo, já arrumado (ex.: "1,25 cm"). */
  texto: string;
  origem: string;
  situacao: Situacao;
  /** De onde a regra veio: arquivo e linha. */
  arquivo: string;
  linha: number;
}

/** A ficha de identificação do perfil. */
export interface Identificacao {
  /** Nome do perfil, como aparece para a pessoa: "ABNT" ou "ABNT – Universidade X". */
  perfil: string;
  /** Família de regras que o perfil segue: "ABNT" ou "APA". */
  norma: string;
  /** Versão da norma: "2025" para ABNT, "7" para APA. */
  versao: string;
  revisao: number;
  dataDaRevisao: string;
  notaDaRevisao: string;
  /** Só nos perfis personalizados: de quem este perfil herda. */
  herdaDe?: { perfil: string; versao: string; revisao: number };
}

/** Um perfil lido, conferido e (se for personalizado) já somado ao original. */
export interface PerfilResolvido {
  identificacao: Identificacao;
  /** As regras na ordem do arquivo original (a ordem do checklist). */
  regras: Map<string, Regra>;
}

/** "ABNT 2025, revisão 1" ou "ABNT – Universidade X, revisão 2". */
export function nomeCompleto(id: Identificacao): string {
  if (id.herdaDe) return `${id.perfil}, revisão ${id.revisao}`;
  return `${id.perfil} ${id.versao}, revisão ${id.revisao}`;
}
