// Chamadas de citação: encontra as citações num texto e escreve cada uma no
// formato do Typst, seguindo as regras do perfil.
//
// Por que o Apud monta as chamadas, e não só o estilo CSL: o Typst tem três
// limitações com o CSL, testadas em 20/11/2026:
//   1. a citação narrativa sai "Lima; Costa; Reis (2018)", e não "Lima, Costa
//      e Reis (2018)";
//   2. em chamadas com várias obras, ele usa o mesmo separador entre obras de
//      autores diferentes e entre anos do mesmo autor;
//   3. o desempate por iniciais (Silva, J.) abrevia o nome também na lista de
//      referências da ABNT, que pede o nome por extenso.
// Então: na ABNT, o Apud monta a chamada inteira com as regras do perfil; na
// APA, o CSL monta os nomes (ele aplica bem as regras de et al. e desempate da
// APA) e o Apud monta o resto. Nas duas, o ano vem já escrito, com as letras
// (2020a) calculadas em preparar.ts, e o CSL cuida da lista de referências.
//
// Algumas revistas que usam APA pedem todos os autores (de 3 a 5) na primeira
// vez que a obra é citada, e et al. dali em diante. Nesse caso o Apud também
// monta os nomes na APA, mas só na primeira citação de cada obra. Para saber
// qual é a primeira, as chamadas precisam ser escritas na ordem do texto, com
// o mesmo contexto (criarContexto).

import type { PerfilResolvido } from "../perfis";
import { semAcentos } from "../perfis/texto";
import { anoDaReferencia, chaveDosAutores, type Referencia } from "./preparar";

export interface ItemDaChamada {
  chave: string;
  /** "p. 15", "local. 7"... */
  localizador?: string;
  grifo?: boolean;
  traducao?: boolean;
}

export type Chamada =
  | { tipo: "parenteses"; escrita: string; itens: ItemDaChamada[] }
  | { tipo: "narrativa"; escrita: string; chave: string; localizador?: string }
  | { tipo: "apud"; escrita: string; original: string; item: ItemDaChamada }
  | { tipo: "sem-referencia"; escrita: string; conteudo: string };

const CHAVE = "[\\p{L}\\p{N}_-]+";

function lerItem(trecho: string): ItemDaChamada | undefined {
  const partes = trecho.trim().match(new RegExp(`^@(${CHAVE})(?:\\s*,\\s*(.*))?$`, "u"));
  if (!partes) return undefined;
  const item: ItemDaChamada = { chave: partes[1] };
  const localizador: string[] = [];
  for (const pedaco of (partes[2] ?? "").split(/,\s*/).filter(Boolean)) {
    if (pedaco === "+grifo") item.grifo = true;
    else if (pedaco === "+tradução") item.traducao = true;
    else localizador.push(pedaco);
  }
  if (localizador.length) item.localizador = localizador.join(", ");
  return item;
}

/** Encontra as chamadas na ordem em que aparecem no texto. */
export function encontrarChamadas(texto: string): Chamada[] {
  const achadas: Array<{ posicao: number; chamada: Chamada }> = [];

  // Entre colchetes: [@silva2019, p. 15], [Freud, 1915 apud @costa2021], [sem referência: ...].
  const ocupado: Array<[number, number]> = [];
  for (const m of texto.matchAll(/\[([^\[\]]+)\]/g)) {
    const dentro = m[1];
    const escrita = m[0];
    let chamada: Chamada | undefined;
    const semReferencia = dentro.match(/^sem referência:\s*(.+)$/);
    const apud = dentro.match(new RegExp(`^(.+?)\\s+apud\\s+(@${CHAVE}(?:\\s*,.*)?)$`, "u"));
    if (semReferencia) {
      chamada = { tipo: "sem-referencia", escrita, conteudo: semReferencia[1].trim() };
    } else if (apud) {
      const item = lerItem(apud[2]);
      if (item) chamada = { tipo: "apud", escrita, original: apud[1].trim(), item };
    } else if (dentro.trim().startsWith("@")) {
      const itens = dentro.split(";").map(lerItem);
      if (itens.every((i): i is ItemDaChamada => i !== undefined)) chamada = { tipo: "parenteses", escrita, itens };
    }
    if (chamada) {
      achadas.push({ posicao: m.index!, chamada });
      ocupado.push([m.index!, m.index! + escrita.length]);
    }
  }

  // Narrativas: @lima2018 ou @dias2025 [p. 4], fora dos colchetes.
  for (const m of texto.matchAll(new RegExp(`(?<![\\w@])@(${CHAVE})(?: \\[([^\\[\\]]+)\\])?`, "gu"))) {
    const dentroDeColchete = ocupado.some(([ini, fim]) => m.index! >= ini && m.index! < fim);
    if (dentroDeColchete) continue;
    achadas.push({
      posicao: m.index!,
      chamada: { tipo: "narrativa", escrita: m[0], chave: m[1], localizador: m[2]?.trim() },
    });
  }

  return achadas.sort((a, b) => a.posicao - b.posicao).map((a) => a.chamada);
}

// ---------------------------------------------------------------------------
// Escrita no formato do Typst

/**
 * Protege a pontuação para o Typst não interpretar nada: sem isso, "[...]"
 * vira reticências, "-?" vira hífen invisível e um ";" logo depois de um
 * comando some. O Typst aceita a barra antes de qualquer pontuação.
 */
export function escaparTypst(texto: string): string {
  return texto.replace(/[!-/:-@[-`{-~]/g, (c) => `\\${c}`);
}

/** Atalho: pontuação e texto que o Apud escreve na chamada. */
const T = escaparTypst;

export interface Contexto {
  perfil: PerfilResolvido;
  /** As referências citadas no trabalho, já preparadas (preparar.ts). */
  referencias: Record<string, Referencia>;
  /** As obras já citadas antes da chamada atual. chamadaParaTypst atualiza. */
  jaCitadas: Set<string>;
}

/** O contexto de um trabalho: escreva as chamadas na ordem do texto com ele. */
export function criarContexto(perfil: PerfilResolvido, referencias: Record<string, Referencia>): Contexto {
  return { perfil, referencias, jaCitadas: new Set() };
}

const valorDe = (perfil: PerfilResolvido, chave: string): string | undefined => {
  const r = perfil.regras.get(chave);
  return r && r.situacao.tipo !== "desligada" ? r.texto : undefined;
};

/** Na ABNT o Apud monta os nomes; na APA eles vêm do CSL. */
const nomesPeloApud = (perfil: PerfilResolvido) => valorDe(perfil, "citação, autor na chamada") !== undefined;

function referencia(ctx: Contexto, chave: string): Referencia {
  const ref = ctx.referencias[chave];
  if (!ref) throw new Error(`a referência “${chave}” não existe`);
  return ref;
}

/** Ano da chamada: "2019", "2020a", "[201-?]" ou "s.d." (sem data). */
function ano(ref: Referencia): string {
  return anoDaReferencia(ref) || "s.d.";
}

/** Localizador e expressões depois do ano: "p. 15, grifo nosso". */
function complemento(item: ItemDaChamada, perfil: PerfilResolvido): string {
  const partes = [item.localizador];
  // Na ABNT o destaque vai na chamada (grifo nosso). Na APA vai dentro da
  // citação, depois do trecho destacado; quem põe lá é o conversor do texto.
  const destaqueNaChamada = (valorDe(perfil, "citação, destaque seu, onde") ?? "na chamada") === "na chamada";
  if (item.grifo && destaqueNaChamada) partes.push(valorDe(perfil, "citação, destaque seu"));
  if (item.traducao) partes.push(valorDe(perfil, "citação, tradução sua"));
  return partes.filter(Boolean).join(", ");
}

interface Autor {
  sobrenome: string;
  prenomes: string;
}

function autoresDe(ref: Referencia): Autor[] {
  return ([] as unknown[]).concat(ref.author ?? ref.editor ?? []).map((a) => {
    if (typeof a !== "string") return { sobrenome: String((a as { name: string }).name), prenomes: "" };
    const [sobrenome, prenomes = ""] = a.split(",").map((p) => p.trim());
    return { sobrenome, prenomes };
  });
}

/**
 * APA, quando a revista pede: na primeira citação de uma obra com 3 a 5
 * autores, entram todos os nomes. (Monzelli, Navarro, & Cagnin, 2023)
 */
function todosNaPrimeira(chave: string, ctx: Contexto): boolean {
  if (valorDe(ctx.perfil, "citação, primeira vez com três a cinco autores") !== "todos os autores") return false;
  if (ctx.jaCitadas.has(chave)) return false;
  const n = autoresDe(referencia(ctx, chave)).length;
  return n >= 3 && n <= 5;
}

/** "João Pedro" vira "J. P." */
function iniciais(prenomes: string): string {
  return prenomes
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => `${p.charAt(0)}.`)
    .join(" ");
}

/**
 * ABNT, mesmo sobrenome e mesmo ano, pessoas diferentes: entram as iniciais.
 * (Silva, J., 2021; Silva, M., 2021)
 */
function precisaDeIniciais(ref: Referencia, ctx: Contexto): boolean {
  const meus = autoresDe(ref);
  if (meus.length === 0) return false;
  const anoBase = anoDaReferencia(ref).replace(/[a-z]$/, "");
  return Object.values(ctx.referencias).some((outra) => {
    if (outra === ref) return false;
    const deles = autoresDe(outra);
    return (
      deles.length > 0 &&
      deles[0].sobrenome.toLowerCase() === meus[0].sobrenome.toLowerCase() &&
      deles[0].prenomes.toLowerCase() !== meus[0].prenomes.toLowerCase() &&
      anoDaReferencia(outra).replace(/[a-z]$/, "") === anoBase
    );
  });
}

/**
 * Os nomes da chamada montados pelo Apud.
 * Entre parênteses: "Lima; Costa; Reis". Narrativa: "Lima, Costa e Reis".
 */
export function nomesDaChamada(
  ref: Referencia,
  forma: "parenteses" | "narrativa",
  ctx: Contexto,
  todos = false,
): string {
  const { perfil } = ctx;
  const autores = autoresDe(ref);
  if (autores.length === 0) {
    const titulo = ref.title as string | { value: string; short?: string };
    return escaparTypst(typeof titulo === "string" ? titulo : (titulo.short ?? titulo.value));
  }

  const caixaAlta = valorDe(perfil, "citação, autor na chamada") === "maiúsculas";
  const formatar = (n: string) => escaparTypst(caixaAlta ? n.toLocaleUpperCase("pt-BR") : n);
  const nomes = autores.map((a) => formatar(a.sobrenome));
  if (nomesPeloApud(perfil) && precisaDeIniciais(ref, ctx)) nomes[0] += T(`, ${iniciais(autores[0].prenomes)}`);

  // A partir de quantos autores entra o et al.
  let limite = Infinity;
  if (valorDe(perfil, "autores, quatro ou mais") === "primeiro com et al.") limite = 4;
  if (valorDe(perfil, "citação, três ou mais autores")) limite = 3;
  if (nomes.length >= limite && !todos) {
    const italico = valorDe(perfil, "referências, em itálico")?.includes("et al.");
    return `${nomes[0]} ${italico ? `_${T("et al.")}_` : T("et al.")}`;
  }
  if (nomes.length === 1) return nomes[0];

  if (forma === "parenteses") {
    // ABNT: (Lima; Costa; Reis, 2018). APA: (Lima & Costa, 2020).
    // Com três ou mais nomes, a APA põe vírgula também antes do &.
    const ultimo = valorDe(perfil, "citação, dois autores entre parênteses");
    if (ultimo) {
      const antes = nomes.length >= 3 ? T(",") : "";
      return `${nomes.slice(0, -1).join(T(", "))}${antes} ${T(ultimo)} ${nomes[nomes.length - 1]}`;
    }
    const separador = valorDe(perfil, "citação, separador entre autores") === "vírgula" ? ", " : "; ";
    return nomes.join(T(separador));
  }
  const separador = valorDe(perfil, "citação narrativa, separador entre autores") === "ponto e vírgula" ? "; " : ", ";
  const antesDoUltimo = valorDe(perfil, "citação narrativa, antes do último autor") ?? "e";
  return `${nomes.slice(0, -1).join(T(separador))} ${T(antesDoUltimo)} ${nomes[nomes.length - 1]}`;
}

/**
 * Se os nomes desta obra são escritos pelo Apud (texto) ou pelo CSL (#cite).
 * ABNT: sempre pelo Apud. APA: pelo CSL, menos na primeira citação com todos os autores.
 */
const nomesComoTexto = (item: ItemDaChamada, ctx: Contexto) =>
  nomesPeloApud(ctx.perfil) || todosNaPrimeira(item.chave, ctx);

/** Os nomes de uma obra numa chamada entre parênteses: do Apud (ABNT) ou do CSL (APA). */
function nomesEntreParenteses(item: ItemDaChamada, ctx: Contexto): string {
  if (nomesComoTexto(item, ctx)) {
    return nomesDaChamada(referencia(ctx, item.chave), "parenteses", ctx, todosNaPrimeira(item.chave, ctx));
  }
  return `#cite(<${item.chave}>, form: "author")`;
}

/** "2002, p. 3": o ano e o que vem depois dele. */
function anoEComplemento(item: ItemDaChamada, ctx: Contexto): string {
  const extra = complemento(item, ctx.perfil);
  return `${T(ano(referencia(ctx, item.chave)))}${extra ? T(`, ${extra}`) : ""}`;
}

/** Marca invisível que põe a obra na lista de referências. */
const registrar = (chave: string) => `#cite(<${chave}>, form: none)`;

/** Texto para ordenar as obras: sobrenomes e ano, sem acentos. */
function ordem(item: ItemDaChamada, ctx: Contexto): string {
  const ref = referencia(ctx, item.chave);
  const titulo = ref.title as string | { value: string };
  const nomes =
    autoresDe(ref).map((a) => a.sobrenome).join(" ") || (typeof titulo === "string" ? titulo : titulo.value);
  return `${semAcentos(nomes.toLowerCase())} ${ano(ref)}`;
}

/**
 * Chamada entre parênteses, com uma ou várias obras.
 * Várias obras: em ordem alfabética, separadas por ponto e vírgula; anos do
 * mesmo autor separados por vírgula: (Lima; Costa; Reis, 2018; Rudio, 2002, 2003).
 */
function entreParenteses(itens: ItemDaChamada[], ctx: Contexto): string {
  // APA com uma obra só: o CSL monta tudo, inclusive os desempates.
  if (!nomesComoTexto(itens[0], ctx) && itens.length === 1) {
    const extra = complemento(itens[0], ctx.perfil);
    return extra
      ? `#cite(<${itens[0].chave}>, supplement: [${T(extra)}])`
      : `#cite(<${itens[0].chave}>)`;
  }
  const ordenados = [...itens].sort((a, b) => ordem(a, ctx).localeCompare(ordem(b, ctx), "pt-BR"));
  const grupos: ItemDaChamada[][] = [];
  for (const item of ordenados) {
    const anterior = grupos[grupos.length - 1];
    const ref = referencia(ctx, item.chave);
    const mesmoAutor =
      anterior !== undefined &&
      autoresDe(ref).length > 0 &&
      chaveDosAutores(referencia(ctx, anterior[0].chave)) === chaveDosAutores(ref);
    if (mesmoAutor) anterior.push(item);
    else grupos.push([item]);
  }
  const partes = grupos.map((grupo) => {
    const anos = grupo.map((i) => anoEComplemento(i, ctx)).join(T(", "));
    // As marcas não podem encostar em outro #cite, senão o Typst junta os dois.
    // Nomes em texto (ABNT, ou a primeira citação com todos os autores na
    // APA): todas antes dos nomes. Nomes do CSL: a primeira obra já entra na
    // lista pelo #cite dos nomes; as outras, no fim do grupo.
    if (nomesComoTexto(grupo[0], ctx)) {
      const marcas = grupo.map((i) => registrar(i.chave)).join("");
      return `${marcas}${nomesEntreParenteses(grupo[0], ctx)}${T(", ")}${anos}`;
    }
    const marcas = grupo.slice(1).map((i) => registrar(i.chave)).join("");
    return `${nomesEntreParenteses(grupo[0], ctx)}${T(", ")}${anos}${marcas}`;
  });
  return `${T("(")}${partes.join(T("; "))}${T(")")}`;
}

/**
 * Escreve uma chamada no formato do Typst. Chame na ordem do texto, sempre
 * com o mesmo contexto: ele guarda quais obras já foram citadas.
 */
export function chamadaParaTypst(chamada: Chamada, ctx: Contexto): string {
  const escrita = escreverChamada(chamada, ctx);
  for (const chave of chavesDa(chamada)) ctx.jaCitadas.add(chave);
  return escrita;
}

function chavesDa(chamada: Chamada): string[] {
  switch (chamada.tipo) {
    case "parenteses":
      return chamada.itens.map((i) => i.chave);
    case "narrativa":
      return [chamada.chave];
    case "apud":
      return [chamada.item.chave];
    case "sem-referencia":
      return [];
  }
}

function escreverChamada(chamada: Chamada, ctx: Contexto): string {
  const { perfil } = ctx;
  switch (chamada.tipo) {
    case "parenteses":
      return entreParenteses(chamada.itens, ctx);

    case "narrativa": {
      // Lima, Costa e Reis (2018, p. 4)
      const ref = referencia(ctx, chamada.chave);
      const extra = chamada.localizador ? `, ${chamada.localizador}` : "";
      const nomes = nomesDaChamada(ref, "narrativa", ctx, todosNaPrimeira(chamada.chave, ctx));
      return `${registrar(chamada.chave)}${nomes} ${T(`(${ano(ref)}${extra})`)}`;
    }

    case "apud": {
      // ABNT: (Freud, 1915 apud Costa, 2021, p. 12). APA: (Freud, 1915, como citado em Costa, 2021).
      const expressao = valorDe(perfil, "citação de citação, expressão") ?? "apud";
      const italico = valorDe(perfil, "citação de citação, destaque") === "itálico";
      const virgula = valorDe(perfil, "citação de citação, vírgula antes") === "sim" ? "," : "";
      const termo = italico ? `_${T(expressao)}_` : T(expressao);
      const marca = nomesComoTexto(chamada.item, ctx) ? registrar(chamada.item.chave) : "";
      return (
        `${marca}${T(`(${chamada.original}${virgula}`)} ${termo} ` +
        `${nomesEntreParenteses(chamada.item, ctx)}${T(", ")}${anoEComplemento(chamada.item, ctx)}${T(")")}`
      );
    }

    case "sem-referencia":
      return T(`(${chamada.conteudo})`);
  }
}
