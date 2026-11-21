// O DOI: como a pessoa cola e como o Apud guarda.
//
// A pessoa cola o DOI de muitos jeitos ("10.1037/abc", "doi:10.1037/abc",
// "https://doi.org/10.1037/ABC", com espaço no começo ou um ponto no fim). O
// Apud guarda sempre a mesma forma: só o código, em minúsculas
// ("10.1037/abc"). Minúsculas porque o DOI não diferencia maiúsculas de
// minúsculas: assim "10.1037/ABC" e "10.1037/abc" são vistos como o mesmo, e a
// busca por fonte repetida funciona. Quem escreve o endereço na lista
// (https://doi.org/...) é o motor, na norma.
//
// Funções puras, sem tela e sem rede.

import type { Referencia } from "../documento/modelo";

/** Só o código: "10." + o número do registrante (4 a 9 dígitos) + "/" + o resto, sem espaços. */
const FORMA_DO_DOI = /^10\.\d{4,9}(?:\.\d+)*\/\S+$/;

/** Os começos que a pessoa pode ter colado junto com o código. */
const PREFIXOS = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi\.org\/|doi:\s*|doi\s+)/i;

/**
 * O DOI na forma do Apud, ou null quando o texto não parece um DOI.
 * Tira espaços, "doi:", "https://doi.org/" e a pontuação que sobra no fim.
 */
export function normalizarDoi(texto: string | undefined | null): string | null {
  if (!texto) return null;
  let t = texto.trim();
  // Tira o endereço ou o "doi:" do começo (pode haver mais de um se a pessoa colou duas vezes).
  for (let i = 0; i < 3 && PREFIXOS.test(t); i++) t = t.replace(PREFIXOS, "").trim();
  // Endereço copiado do navegador vem com caracteres codificados ("%2F" no lugar de "/").
  if (/%[0-9a-f]{2}/i.test(t)) {
    try {
      t = decodeURIComponent(t);
    } catch {
      // Texto com "%" que não é código: segue como está, e a conferência abaixo decide.
    }
  }
  // Ponto, vírgula ou ponto e vírgula no fim vêm da frase onde o DOI estava.
  t = t.replace(/[.,;]+$/, "").toLowerCase();
  return FORMA_DO_DOI.test(t) ? t : null;
}

/** O DOI como link, para a pessoa abrir. */
export const enderecoDoDoi = (doi: string) => `https://doi.org/${doi}`;

/** A fonte do trabalho que já tem esse DOI (qualquer forma de escrever), ou undefined. */
export function acharPorDoi(referencias: readonly Referencia[], doi: string): Referencia | undefined {
  const procurado = normalizarDoi(doi);
  if (!procurado) return undefined;
  return referencias.find((r) => normalizarDoi(r.doi) === procurado);
}
