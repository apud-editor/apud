// Prepara as referências para o Typst conforme o perfil da norma.
//
// O CSL (formato de estilos do Zotero) não tem campos para algumas regras da
// ABNT, como o subtítulo sem destaque e a data incerta. Aqui o Apud arruma os
// dados antes de chamar o estilo. Cada ajuste só acontece se o perfil tiver a
// regra correspondente, então o mesmo código serve para ABNT e APA.
//
// Este é o primeiro pedaço do motor de citações. A etapa do motor vai
// completá-lo (cadastro de referências, DOI, ISBN etc.).

import type { PerfilResolvido } from "../perfis";
import { semAcentos } from "../perfis/texto";

/** Uma referência no formato que o Typst lê (hayagriva), com os campos extras do Apud. */
export type Referencia = Record<string, unknown>;

/** Artigos e palavras de uma sílaba que, no início do título, vão junto com a palavra seguinte. */
const PALAVRAS_QUE_VAO_JUNTO = new Set([
  "o", "a", "os", "as", "um", "uma", "uns", "umas",
  "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
  "por", "com", "sem", "sob", "e", "que", "se", "ao", "aos", "à", "às",
]);

/** As palavras que formam a "primeira palavra" do título na ABNT (com o artigo, se houver). */
export function primeirasPalavras(titulo: string): { inicio: string; resto: string } {
  const palavras = titulo.trim().split(/\s+/);
  let n = 1;
  while (n < palavras.length && PALAVRAS_QUE_VAO_JUNTO.has(palavras[n - 1].toLowerCase())) n++;
  return { inicio: palavras.slice(0, n).join(" "), resto: palavras.slice(n).join(" ") };
}

const temRegra = (perfil: PerfilResolvido, chave: string) => {
  const r = perfil.regras.get(chave);
  return r !== undefined && r.situacao.tipo !== "desligada";
};

function primeiraMaiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase("pt-BR") + texto.slice(1);
}

/** "[201-?]" vira o ano 2010, só para ordenar a lista. */
function anoDaDataIncerta(texto: string): number | undefined {
  const digitos = texto.match(/\d[\d-]{3}/)?.[0];
  return digitos ? Number(digitos.replace(/-/g, "0")) : undefined;
}

function temAutor(ref: Referencia): boolean {
  return ref.author !== undefined || ref.editor !== undefined;
}

function prepararUma(original: Referencia, perfil: PerfilResolvido): Referencia {
  const ref: Referencia = structuredClone(original);
  const pai = (ref.parent ?? undefined) as Referencia | undefined;
  const subtituloSemDestaque = temRegra(perfil, "referências, destaque do subtítulo");
  const tituloComMaiusculaSoNoInicio = temRegra(perfil, "referências, título da obra");

  // Obra sem autor (ABNT): entra pelo título, com a primeira palavra em
  // maiúsculas, e a chamada usa a primeira palavra e [...].
  if (!temAutor(ref) && temRegra(perfil, "citação, obra sem autor")) {
    const completo = ref.subtitle ? `${ref.title}: ${ref.subtitle}` : String(ref.title);
    delete ref.subtitle;
    const { inicio, resto } = primeirasPalavras(completo);
    ref.title = {
      value: [inicio.toLocaleUpperCase("pt-BR"), resto].filter(Boolean).join(" "),
      short: `${inicio} [...]`,
    };
  }

  // Subtítulo: na ABNT vai para "genre" (sem destaque); nas outras normas,
  // junta ao título depois de dois-pontos.
  for (const alvo of [ref, pai]) {
    if (!alvo || alvo.subtitle === undefined) continue;
    if (subtituloSemDestaque) {
      alvo.genre = alvo.subtitle;
    } else {
      const sub = tituloComMaiusculaSoNoInicio ? primeiraMaiuscula(String(alvo.subtitle)) : alvo.subtitle;
      alvo.title = `${alvo.title}: ${sub}`;
    }
    delete alvo.subtitle;
  }

  // Data incerta: na ABNT sai como escrita ([201-?]); na APA, sem data (s.d.).
  if (ref["uncertain-date"] !== undefined) {
    const escrita = String(ref["uncertain-date"]);
    delete ref["uncertain-date"];
    if (temRegra(perfil, "referências, data provável")) {
      ref["call-number"] = escrita;
      const ano = anoDaDataIncerta(escrita);
      if (ano) ref.date = ano;
    }
  }

  // Número eletrônico do artigo sem página.
  if (ref["e-number"] !== undefined) {
    ref["serial-number"] = { ...((ref["serial-number"] as object) ?? {}), serial: String(ref["e-number"]) };
    delete ref["e-number"];
  }

  // Cidade da revista.
  if (pai?.location !== undefined) {
    pai.publisher = { ...((pai.publisher as object) ?? {}), location: pai.location };
    delete pai.location;
  }

  // APA: com DOI, o endereço não aparece.
  if (tituloComMaiusculaSoNoInicio) {
    const doi = (ref["serial-number"] as Record<string, unknown> | undefined)?.doi;
    if (doi) delete ref.url;
  }

  return ref;
}

/** O ano como sai na chamada e na lista: "2019", "[201-?]", ou vazio se não há data. */
export function anoDaReferencia(ref: Referencia): string {
  if (ref["call-number"] !== undefined) return String(ref["call-number"]);
  const ano = String(ref.date ?? "").match(/^\d{4}/)?.[0];
  return ano ?? "";
}

/** Identifica as pessoas autoras de uma obra, para saber se duas obras são do mesmo autor. */
export function chaveDosAutores(ref: Referencia): string {
  const autores = ([] as unknown[]).concat(ref.author ?? ref.editor ?? []);
  return JSON.stringify(autores.map((a) => (typeof a === "string" ? a : (a as { name: string }).name).toLowerCase()));
}

function tituloParaOrdenar(ref: Referencia): string {
  const t = ref.title as string | { value: string };
  return (typeof t === "string" ? t : t.value).toLowerCase();
}

/**
 * Mesmo autor e mesmo ano: letras depois do ano (2020a, 2020b), na ordem dos
 * títulos. O Apud calcula as letras e passa o ano já escrito para o estilo
 * CSL, no campo call-number, para a chamada e a lista usarem as mesmas letras.
 */
function marcarLetras(referencias: Record<string, Referencia>) {
  const grupos = new Map<string, Referencia[]>();
  for (const ref of Object.values(referencias)) {
    const ano = anoDaReferencia(ref);
    if (!ano) continue;
    const chave = `${chaveDosAutores(ref)}|${ano}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), ref]);
  }
  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue;
    grupo.sort((a, b) => tituloParaOrdenar(a).localeCompare(tituloParaOrdenar(b), "pt-BR"));
    grupo.forEach((ref, i) => {
      ref["call-number"] = `${anoDaReferencia(ref)}${String.fromCharCode(97 + i)}`;
    });
  }
}

/**
 * Chave de ordem alfabética sem acentos, que o estilo CSL usa para ordenar a
 * lista (campo note). Sem ela, o Typst põe "Ávila" depois de "Zé".
 * Ordem: sobrenomes e prenomes (por extenso na ABNT, iniciais na APA), ano e título.
 */
function chaveDeOrdem(ref: Referencia, perfil: PerfilResolvido): string {
  const comIniciais = perfil.regras.get("referências, prenomes")?.texto !== "por extenso";
  const autores = ([] as unknown[]).concat(ref.author ?? ref.editor ?? []).map((a) => {
    if (typeof a !== "string") return (a as { name: string }).name;
    const [sobrenome, prenomes = ""] = a.split(",").map((p) => p.trim());
    const dados = comIniciais ? prenomes.split(/\s+/).map((p) => p.charAt(0)).join(" ") : prenomes;
    return `${sobrenome} ${dados}`;
  });
  // Na APA, leis entram na lista pelo título, e não pelo autor (Brasil).
  const lei = ref.type === "legislation" && temRegra(perfil, "referências, título da obra");
  const partes = autores.length && !lei ? autores : [tituloParaOrdenar(ref)];
  partes.push(anoDaReferencia(ref) || "0000", tituloParaOrdenar(ref));
  // O separador \u0001 vem antes de qualquer letra: "Silva, J." fica antes de "Silva, J. P.".
  return semAcentos(partes.join("\u0001").toLowerCase());
}

/** Prepara todas as referências citadas no trabalho. */
export function prepararReferencias(
  referencias: Record<string, Referencia>,
  perfil: PerfilResolvido,
): Record<string, Referencia> {
  const preparadas = Object.fromEntries(
    Object.entries(referencias).map(([chave, ref]) => [chave, prepararUma(ref, perfil)]),
  );
  if (temRegra(perfil, "citação, mesmo autor e ano")) marcarLetras(preparadas);
  for (const ref of Object.values(preparadas)) ref.note = chaveDeOrdem(ref, perfil);
  return preparadas;
}
