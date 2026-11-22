// Peças do conversor para os blocos da fase 3 que não dependem do Typst:
// o ponto final da citação longa, os arquivos das imagens e a largura
// padrão de uma figura. Ficam separadas para serem testadas sozinhas.

import {
  ehCitacao,
  ehTexto,
  imagensUsadas,
  type Documento,
  type FormatoDeImagem,
  type Imagem,
  type Trecho,
  type TrechoDeTexto,
} from "../documento/modelo";

/**
 * Onde fica o ponto final de uma citação longa que termina com a chamada:
 *   - "depois" (ABNT): ... semana seguinte (Silva, 2019, p. 15).
 *   - "antes" (APA):   ... semana seguinte. (Silva, 2019, p. 15)
 * A pessoa pode ter escrito de um jeito ou de outro: vale a norma (decisão de
 * 21/11/2026). Trocar de norma não pede para reescrever nada. Só o ponto
 * final simples muda de lugar; reticências, "?" e "!" ficam como estão, e
 * uma citação longa que não termina com a chamada fica igual.
 */
export function pontoDaCitacaoLonga(trechos: Trecho[], onde: "antes" | "depois" | undefined): Trecho[] {
  if (!onde) return trechos;
  // A última chamada, com só pontuação ou espaço depois dela.
  let c = -1;
  for (let i = trechos.length - 1; i >= 0; i--) {
    const t = trechos[i];
    if (ehCitacao(t)) {
      c = i;
      break;
    }
    if (!ehTexto(t) || !/^[\s.]*$/.test(t.texto)) return trechos;
  }
  if (c <= 0) return trechos;
  const depois = trechos.slice(c + 1);
  const textoDepois = depois.map((t) => (ehTexto(t) ? t.texto : "")).join("").trim();
  // O último texto antes da chamada (com letras, não só espaço).
  const comLetras = (t: Trecho): t is TrechoDeTexto => ehTexto(t) && t.texto.trim() !== "";
  let a = c - 1;
  while (a >= 0 && !comLetras(trechos[a])) a--;
  // Entre ele e a chamada, só espaço (nada de outra citação ou nota).
  if (a < 0 || trechos.slice(a + 1, c).some((t) => !ehTexto(t))) return trechos;
  const anterior = trechos[a] as TrechoDeTexto;
  const semEspaco = anterior.texto.trimEnd();
  const espaco = anterior.texto.slice(semEspaco.length) + trechos.slice(a + 1, c).map((t) => (t as TrechoDeTexto).texto).join("");
  // O espaço fica todo no texto anterior; os trechos só de espaço saem.
  const saida: Trecho[] = [...trechos.slice(0, a), { ...anterior }, trechos[c]];
  const novoAnterior = saida[a] as TrechoDeTexto;
  novoAnterior.texto = semEspaco + espaco;

  if (onde === "depois") {
    // "seguinte. (Silva...)" → "seguinte (Silva...)." (e também "seguinte. (Silva...).")
    if ((textoDepois !== "" && textoDepois !== ".") || !/[^.]\.$/.test(semEspaco)) return trechos;
    novoAnterior.texto = semEspaco.slice(0, -1) + (espaco || " ");
    saida.push({ texto: "." });
    return saida;
  }
  // "seguinte (Silva...)." → "seguinte. (Silva...)"
  if (textoDepois !== ".") return trechos;
  if (!/[.?!…]$/.test(semEspaco)) novoAnterior.texto = `${semEspaco}.${espaco || " "}`;
  return saida;
}

const EXTENSOES: Record<FormatoDeImagem, string> = { png: "png", jpeg: "jpg", gif: "gif", webp: "webp", svg: "svg" };

/** O nome da imagem dentro do Typst: a posição na lista, o código (sem sinais) e a extensão. */
export function caminhoDaImagem(imagem: Imagem, i: number): string {
  return `/imagens/${i}-${imagem.id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 40)}.${EXTENSOES[imagem.formato]}`;
}

/** Os caminhos das imagens, pelo código. */
export function caminhosDasImagens(doc: Documento): Map<string, string> {
  return new Map(doc.imagens.map((im, i) => [im.id, caminhoDaImagem(im, i)]));
}

/** Um arquivo que o motor Typst precisa receber junto com o código: as imagens das figuras. */
export interface ArquivoDoTypst {
  caminho: string;
  dados: Uint8Array;
}

/** As imagens que as figuras usam, prontas para o motor Typst. */
export function arquivosDasImagens(doc: Documento): ArquivoDoTypst[] {
  const usadas = imagensUsadas(doc.blocos);
  return doc.imagens.flatMap((im, i) => (usadas.has(im.id) ? [{ caminho: caminhoDaImagem(im, i), dados: deBase64(im.dados) }] : []));
}

export function deBase64(dados: string): Uint8Array {
  const binario = atob(dados);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/**
 * A largura de uma figura sem largura escolhida, em porcentagem da largura do
 * texto: o tamanho natural da imagem (como no Word, a 96 pontos por
 * polegada), sem passar da largura do texto. Sem o tamanho, a largura toda.
 */
export function larguraPadrao(imagem: Imagem | undefined, larguraDoTextoCm: number): number {
  if (!imagem?.largura || larguraDoTextoCm <= 0) return 100;
  const cm = (imagem.largura / 96) * 2.54;
  return Math.max(10, Math.min(100, Math.round((cm / larguraDoTextoCm) * 1000) / 10));
}
