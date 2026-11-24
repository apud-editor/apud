// Primeira passada sobre o arquivo de um modelo: separa a ficha, as seções
// (uma por elemento) e as linhas de valor, e guarda os comentários que vêm
// logo acima de cada linha (a decisão por trás do valor). Ainda não confere
// se os elementos, as propriedades e os valores existem.
//
// O arquivo é parecido com os perfis da versão 1:
//
//   modelo: ABNT
//   herda de: Em branco, revisão 1
//   versão: 2025
//   revisão: 10
//   data da revisão: 24/11/2026
//   nota da revisão: o que mudou
//
//   == Títulos › Nível 1 ==
//   # A NBR 6024 manda diferenciar os níveis, mas não diz como.
//   destaque: maiúsculas, negrito | NBR 6024:2012 (UFSCar) | faculdade

import { normalizar } from "../perfis/texto";
import type { Mensagem } from "./tipos";

export const CAMPOS_DA_FICHA = ["modelo", "herda de", "versão", "revisão", "data da revisão", "nota da revisão"] as const;
export type CampoDaFicha = (typeof CAMPOS_DA_FICHA)[number];

export interface LinhaDeValor {
  /** O nome da propriedade como a pessoa escreveu. */
  nome: string;
  valor: string;
  origem: string;
  situacao?: string;
  linha: number;
  /** Os comentários (#) logo acima da linha, sem linha em branco no meio. */
  nota?: string;
}

export interface SecaoLida {
  /** O caminho do elemento como está escrito: "Títulos › Nível 1". */
  caminho: string;
  linha: number;
  nota?: string;
  valores: LinhaDeValor[];
}

export interface ModeloLido {
  ficha: Map<CampoDaFicha, { valor: string; linha: number }>;
  secoes: SecaoLida[];
  mensagens: Mensagem[];
}

const PALAVRAS_DE_SITUACAO = /^(faculdade|desligada|escolha\s*:)/i;

export function lerModelo(conteudo: string): ModeloLido {
  const ficha: ModeloLido["ficha"] = new Map();
  const secoes: SecaoLida[] = [];
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

  let comentarios: string[] = [];
  const pegarComentarios = () => {
    const nota = comentarios.length ? comentarios.join(" ") : undefined;
    comentarios = [];
    return nota;
  };

  const linhas = conteudo.replace(/^﻿/, "").split(/\r?\n/);
  linhas.forEach((bruta, indice) => {
    const numero = indice + 1;
    const linha = bruta.trim();
    if (linha === "") {
      // Uma linha em branco separa o comentário do que vem depois: ele fica solto.
      comentarios = [];
      return;
    }
    if (linha.startsWith("#")) {
      const texto = linha.replace(/^#+\s?/, "").trim();
      // Linhas de enfeite (# ====) não são comentário.
      if (texto && !/^[=\-_*#\s]+$/.test(texto)) comentarios.push(texto);
      return;
    }

    if (linha.startsWith("==")) {
      const titulo = linha.match(/^==\s*(.+?)\s*==$/);
      if (!titulo) {
        erro(numero, "o título de seção precisa começar e terminar com ==, como “== Títulos › Nível 1 ==”.");
        comentarios = [];
        return;
      }
      secoes.push({ caminho: titulo[1], linha: numero, nota: pegarComentarios(), valores: [] });
      return;
    }

    // O dois-pontos do nome vem antes da primeira barra; o de "NBR 14724:2024", depois.
    const doisPontos = linha.indexOf(":");
    const barra = linha.indexOf("|");
    if (doisPontos < 0 || (barra >= 0 && doisPontos > barra)) {
      erro(numero, "falta o sinal de dois-pontos entre o nome e o valor. Exemplo: “recuo à esquerda: 4 cm”.");
      comentarios = [];
      return;
    }
    const nome = linha.slice(0, doisPontos).trim().replace(/\s+/g, " ");
    const resto = linha.slice(doisPontos + 1);
    if (!nome) {
      erro(numero, "falta o nome antes dos dois-pontos.");
      comentarios = [];
      return;
    }
    const chave = normalizar(nome);

    // A ficha vem antes da primeira seção.
    if ((CAMPOS_DA_FICHA as readonly string[]).includes(chave) && secoes.length === 0) {
      const campo = chave as CampoDaFicha;
      comentarios = [];
      if (resto.includes("|")) {
        erro(numero, `o campo “${nome}” é da ficha do modelo e não leva barra | nem origem.`);
        return;
      }
      if (ficha.has(campo)) {
        erro(numero, `o campo “${nome}” já apareceu na linha ${ficha.get(campo)!.linha}.`);
        return;
      }
      ficha.set(campo, { valor: resto.trim(), linha: numero });
      return;
    }

    const secao = secoes[secoes.length - 1];
    if (!secao) {
      erro(numero, `a linha “${nome}” está antes da primeira seção. Comece cada elemento com o nome dele entre ==, como “== Texto ==”.`);
      comentarios = [];
      return;
    }

    // Valores: "nome: valor | origem | situação".
    const partes = resto.split("|").map((p) => p.trim());
    const nota = pegarComentarios();
    if (partes.length > 3) {
      erro(numero, "há barras | demais. Use no máximo duas: uma antes da norma de origem e outra antes da situação.");
      return;
    }
    const [valor, origem = "", situacao] = partes;
    if (!valor) {
      erro(numero, `“${nome}” está sem valor.`);
      return;
    }
    if (partes.length === 1) {
      erro(numero, `falta a origem. Depois do valor, escreva uma barra e de onde ele vem, como: “${nome}: ${valor} | NBR 14724:2024”.`);
      return;
    }
    if (partes.length === 2 && PALAVRAS_DE_SITUACAO.test(origem)) {
      erro(numero, `falta a origem antes da situação. Escreva assim: “${nome}: ${valor} | (norma) | ${origem}”.`);
      return;
    }
    if (!origem) {
      erro(numero, "depois da primeira barra | falta a origem.");
      return;
    }
    if (partes.length === 3 && !situacao) {
      erro(numero, "depois da segunda barra | falta a situação (faculdade, escolha: ... ou desligada).");
      return;
    }
    secao.valores.push({ nome, valor, origem, situacao, linha: numero, ...(nota ? { nota } : {}) });
  });

  return { ficha, secoes, mensagens };
}
