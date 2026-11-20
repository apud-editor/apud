// "Escolhas do autor": as regras de situação "escolha" que mexem em citações e
// referências. O perfil traz as opções e o padrão; o trabalho guarda só o que
// a pessoa trocou, em ajustes[norma] (no .apud). Funções puras, sem tela.
//
// O Apud não escreve regra de norma aqui: os nomes curtos e as explicações são
// só texto da tela. As opções e o padrão vêm sempre do perfil.

import type { AjustesDoTrabalho } from "../arquivos/formato";
import { normalizar } from "../perfis/texto";
import type { PerfilResolvido } from "../perfis/tipos";

/** As regras cuja chave começa assim mexem em citações, referências ou autores. */
const COMECOS_DAS_CHAVES = ["citação", "referências", "autores"];

/** Nome curto e explicação de cada regra, em português simples. Regra sem texto aqui aparece com o nome do perfil. */
const TEXTOS: Record<string, { nome: string; explicacao: string }> = {
  "citação, destaque seu": {
    nome: "Aviso de grifo seu na citação",
    explicacao: "Como a citação avisa que o destaque no trecho é seu: (SILVA, 2019, p. 15, grifo nosso).",
  },
  "citação, tradução sua": {
    nome: "Aviso de tradução sua na citação",
    explicacao: "Como a citação avisa que a tradução do trecho é sua: (SILVA, 2019, p. 15, tradução nossa).",
  },
  "autores, quatro ou mais": {
    nome: "Obras com quatro ou mais autores",
    explicacao: "Citar todos os autores ou só o primeiro, com et al. Vale para as citações e para a lista de referências.",
  },
  "referências, prenomes": {
    nome: "Prenomes na lista de referências",
    explicacao: "Se os prenomes dos autores saem por extenso ou abreviados na lista.",
  },
  "referências, destaque do título": {
    nome: "Destaque do título na lista",
    explicacao: "Como o título da obra se destaca na lista de referências.",
  },
  "citação, primeira vez com três a cinco autores": {
    nome: "Primeira citação com três a cinco autores",
    explicacao: "A APA 7 cita só o primeiro autor com et al. Algumas revistas pedem todos os autores na primeira vez.",
  },
  "referências, cidade da editora": {
    nome: "Cidade da editora na lista",
    explicacao: "A APA 7 não mostra a cidade da editora. Algumas revistas pedem.",
  },
};

export interface EscolhaDoAutor {
  /** A chave da regra no perfil, como o .apud guarda. */
  chave: string;
  nome: string;
  explicacao: string;
  opcoes: string[];
  /** A opção do perfil. */
  padrao: string;
  /** A opção que vale hoje neste trabalho (o padrão, se a pessoa não trocou). */
  atual: string;
}

/** A primeira letra em maiúscula, para a opção aparecer como "Por extenso". */
export const comInicialMaiuscula = (s: string) => s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1);

/**
 * As escolhas do autor de uma norma. Recebe o perfil sem ajustes (o padrão) e
 * os ajustes do trabalho para essa norma. Um ajuste que não é uma das opções
 * (arquivo editado à mão) é ignorado: vale o padrão.
 */
export function escolhasDoAutor(base: PerfilResolvido, ajustes: Record<string, string> = {}): EscolhaDoAutor[] {
  const dados = new Map(Object.entries(ajustes).map(([k, v]) => [normalizar(k), v]));
  const saida: EscolhaDoAutor[] = [];
  for (const regra of base.regras.values()) {
    if (regra.situacao.tipo !== "escolha") continue;
    if (!COMECOS_DAS_CHAVES.some((c) => regra.chave.startsWith(c))) continue;
    const opcoes = regra.situacao.opcoes;
    const ajustado = dados.get(regra.chave);
    const texto = TEXTOS[regra.chave];
    saida.push({
      chave: regra.chave,
      nome: texto?.nome ?? comInicialMaiuscula(regra.chave),
      explicacao: texto?.explicacao ?? "",
      opcoes,
      padrao: regra.texto,
      atual: ajustado !== undefined && opcoes.includes(ajustado) ? ajustado : regra.texto,
    });
  }
  return saida;
}

/**
 * Os ajustes do trabalho depois de uma escolha. Escolher o padrão tira o
 * ajuste (o trabalho guarda só o que difere do perfil). Não muda o objeto
 * recebido, e as escolhas das outras normas ficam como estavam.
 */
export function ajustesComEscolha(ajustes: AjustesDoTrabalho, norma: string, chave: string, valor: string, padrao: string): AjustesDoTrabalho {
  const daNorma = { ...(ajustes[norma] ?? {}) };
  for (const k of Object.keys(daNorma)) if (normalizar(k) === chave) delete daNorma[k];
  if (valor !== padrao) daNorma[chave] = valor;
  const saida = { ...ajustes };
  if (Object.keys(daNorma).length) saida[norma] = daNorma;
  else delete saida[norma];
  return saida;
}
