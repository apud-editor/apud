// Primeira passada sobre o arquivo do perfil: separa a ficha de identificação
// das regras e confere a escrita de cada linha. Ainda não confere os valores.

import type { Mensagem } from "./tipos";
import { normalizar } from "./texto";

/** Os campos da ficha de identificação, que não levam origem nem situação. */
export const CAMPOS_DA_FICHA = [
  "perfil",
  "versão",
  "revisão",
  "data da revisão",
  "nota da revisão",
  "herda de",
] as const;

export type CampoDaFicha = (typeof CAMPOS_DA_FICHA)[number];

export interface LinhaDeRegra {
  /** Nome da regra arrumado (minúsculas, sem espaços sobrando), para comparar. */
  chave: string;
  /** Nome da regra como a pessoa escreveu, para as mensagens. */
  nomeEscrito: string;
  valor: string;
  origem: string;
  situacao?: string;
  linha: number;
  /** Título de seção (== ... ==) acima da regra. */
  secao?: string;
}

export interface ArquivoLido {
  ficha: Map<CampoDaFicha, { valor: string; linha: number }>;
  regras: LinhaDeRegra[];
  mensagens: Mensagem[];
}

const PALAVRAS_DE_SITUACAO = /^(faculdade|desligada|escolha\s*:)/i;

export function lerArquivo(conteudo: string): ArquivoLido {
  const ficha: ArquivoLido["ficha"] = new Map();
  const regras: LinhaDeRegra[] = [];
  const mensagens: Mensagem[] = [];
  const erro = (linha: number, texto: string) => mensagens.push({ gravidade: "erro", linha, texto });

  if (conteudo.includes("�")) {
    mensagens.push({
      gravidade: "erro",
      texto:
        "o arquivo não está salvo em UTF-8, e os acentos ficaram ilegíveis. " +
        "No Bloco de Notas, use Arquivo > Salvar como e escolha a codificação UTF-8.",
    });
  }

  let secaoAtual: string | undefined;
  const linhas = conteudo.replace(/^﻿/, "").split(/\r?\n/);

  linhas.forEach((bruta, indice) => {
    const numero = indice + 1;
    const linha = bruta.trim();
    if (linha === "" || linha.startsWith("#")) return;

    if (linha.startsWith("==")) {
      const titulo = linha.match(/^==\s*(.+?)\s*==$/);
      if (!titulo) {
        erro(numero, "o título de seção precisa começar e terminar com ==, como “== ABNT: citações ==”.");
        return;
      }
      secaoAtual = titulo[1];
      return;
    }

    // O dois-pontos do nome da regra vem antes da primeira barra; o de
    // "NBR 14724:2024", que fica depois da barra, não conta.
    const doisPontos = linha.indexOf(":");
    const barra = linha.indexOf("|");
    if (doisPontos < 0 || (barra >= 0 && doisPontos > barra)) {
      erro(
        numero,
        "falta o sinal de dois-pontos entre o nome da regra e o valor. Exemplo: “margens, esquerda: 3 cm”.",
      );
      return;
    }
    const nomeEscrito = linha.slice(0, doisPontos).trim().replace(/\s+/g, " ");
    const resto = linha.slice(doisPontos + 1);
    if (!nomeEscrito) {
      erro(numero, "falta o nome da regra antes dos dois-pontos.");
      return;
    }
    const chave = normalizar(nomeEscrito);

    // Campos da ficha de identificação: "revisão: 2".
    if ((CAMPOS_DA_FICHA as readonly string[]).includes(chave)) {
      const campo = chave as CampoDaFicha;
      if (resto.includes("|")) {
        erro(numero, `o campo “${nomeEscrito}” é da ficha de identificação e não leva barra | nem origem.`);
        return;
      }
      if (ficha.has(campo)) {
        erro(numero, `o campo “${nomeEscrito}” já apareceu na linha ${ficha.get(campo)!.linha}.`);
        return;
      }
      ficha.set(campo, { valor: resto.trim(), linha: numero });
      return;
    }

    // Regras: "nome: valor | origem | situação".
    const partes = resto.split("|").map((p) => p.trim());
    if (partes.length > 3) {
      erro(
        numero,
        "há barras | demais. Use no máximo duas: uma antes da norma de origem e outra antes da situação.",
      );
      return;
    }
    const [valor, origem = "", situacao] = partes;
    if (!valor) {
      erro(numero, `a regra “${nomeEscrito}” está sem valor.`);
      return;
    }
    if (partes.length === 1) {
      erro(
        numero,
        `falta a norma de origem. Depois do valor, escreva uma barra e a norma, como: “${nomeEscrito}: ${valor} | NBR 14724:2024”.`,
      );
      return;
    }
    if (partes.length === 2 && PALAVRAS_DE_SITUACAO.test(origem)) {
      erro(
        numero,
        `falta a norma de origem antes da situação. Escreva assim: “${nomeEscrito}: ${valor} | (norma) | ${origem}”.`,
      );
      return;
    }
    if (!origem) {
      erro(numero, "depois da primeira barra | falta a norma de origem.");
      return;
    }
    if (partes.length === 3 && !situacao) {
      erro(numero, "depois da segunda barra | falta a situação (faculdade, escolha: ... ou desligada).");
      return;
    }

    regras.push({ chave, nomeEscrito, valor, origem, situacao, linha: numero, secao: secaoAtual });
  });

  return { ficha, regras, mensagens };
}
