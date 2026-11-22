// Os textos da abertura (resumo, dedicatória, epígrafe, agradecimentos) são
// parágrafos de texto com negrito, itálico e sobrescrito. Estas funções levam
// esses parágrafos para um editorzinho e de volta, com a mesma conversão do
// editor grande. Puras, para testar sem navegador.

import { blocosDoEditor, editorDosBlocos, normalizar } from "../documento/tiptap";
import { ehTexto, type TrechoDeTexto } from "../documento/modelo";

export function paragrafosParaCampo(paragrafos: TrechoDeTexto[][]) {
  return editorDosBlocos(paragrafos.length ? paragrafos.map((trechos) => ({ tipo: "paragrafo" as const, trechos })) : [{ tipo: "paragrafo", trechos: [] }]);
}

/**
 * O que a pessoa escreveu, como parágrafos. Parágrafos vazios saem. Com
 * `unico`, tudo se junta num parágrafo só (o resumo da ABNT é um parágrafo).
 */
export function campoParaParagrafos(json: Parameters<typeof blocosDoEditor>[0], unico = false): TrechoDeTexto[][] {
  const paragrafos: TrechoDeTexto[][] = [];
  for (const bloco of blocosDoEditor(json)) {
    if (bloco.tipo !== "paragrafo") continue;
    const texto = bloco.trechos.filter(ehTexto);
    if (!texto.some((t) => t.texto.trim())) continue;
    paragrafos.push(normalizar(texto) as TrechoDeTexto[]);
  }
  if (!unico || paragrafos.length <= 1) return paragrafos;
  const junto: TrechoDeTexto[] = [];
  paragrafos.forEach((p, i) => {
    if (i) junto.push({ texto: " " });
    junto.push(...p);
  });
  return [normalizar(junto) as TrechoDeTexto[]];
}
