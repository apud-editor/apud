// O motor de citações: escreve cada citação do texto na forma da norma, com as
// regras do perfil, e prepara a lista de referências.
//
// Quem monta o quê (decisão da fase 2):
//   - as chamadas no texto, nas duas normas, são montadas aqui, pelo Apud;
//   - a lista de referências é montada pelo estilo CSL (padrão aberto do
//     Zotero e do Mendeley), dentro do Typst.
// Por que não deixar o CSL montar as chamadas também: o Typst erra alguns
// casos ao usar o CSL nelas (testado em 20/11/2026):
//   1. citação narrativa: sai "Lima; Costa; Reis (2018)", e não "Lima, Costa e Reis (2018)";
//   2. várias obras: usa o mesmo separador entre autores diferentes e entre
//      anos do mesmo autor;
//   3. o desempate por iniciais (Silva, J.) abrevia o nome também na lista da
//      ABNT, que pede o nome por extenso;
//   4. a ordem alfabética põe "Ávila" depois de "Zé".
//
// Nada de norma fica escrito aqui: cada forma vem de uma regra do perfil. Se o
// perfil não tem a regra, a forma não é aplicada. Assim o mesmo código serve
// para a ABNT, para a APA e para perfis personalizados.
//
// O resultado de cada citação é uma lista de pedaços de texto (com ou sem
// itálico). O conversor para o Typst e o editor (que mostra a citação já na
// norma) escrevem os pedaços cada um do seu jeito.

import type { PerfilResolvido } from "../perfis";
import { normalizar, semAcentos } from "../perfis/texto";
import { NOME_DO_TIPO } from "../perfis/tipos-de-referencia";
import {
  ehCitacao,
  ehInstituicao,
  obrasDaCitacao,
  type Bloco,
  type Citacao,
  type Documento,
  type ItemDeLista,
  type Localizador,
  type ObraCitada,
  type Referencia,
  type Trecho,
} from "../documento/modelo";
import { paraHayagriva } from "./hayagriva";
import { anoDaReferencia, PARTICULAS, prepararReferencias, type Referencia as ReferenciaDoTypst } from "./preparar";

/** Um pedaço do texto de uma citação. */
export interface Pedaco {
  texto: string;
  italico?: boolean;
}

export type TipoDeAviso =
  | "referencia-apagada"
  | "direta-sem-pagina"
  | "sem-data"
  | "sem-titulo"
  | "sem-referencia-vazia";

/** Algo que falta numa citação ou referência. O PDF sai mesmo assim (decisão de 20/11/2026). */
export interface Aviso {
  tipo: TipoDeAviso;
  mensagem: string;
  /** A referência envolvida, quando há uma. */
  referencia?: string;
}

export interface CitacaoMontada {
  pedacos: Pedaco[];
  /** As referências que esta citação põe na lista (as que existem). */
  obras: string[];
  avisos: Aviso[];
}

export interface Motor {
  perfil: PerfilResolvido;
  /**
   * Monta uma citação. Chame na ordem do texto: algumas regras dependem de a
   * obra já ter sido citada antes (APA, quando a revista pede todos os autores
   * na primeira citação).
   */
  montar(c: Citacao): CitacaoMontada;
  /** As referências citadas no trabalho, preparadas para o Typst (pelo código). */
  referenciasDoTypst: Record<string, ReferenciaDoTypst>;
  /** As referências citadas, na ordem da primeira citação. */
  citadas: string[];
}

// ---------------------------------------------------------------------------
// Leitura do texto

/** Todas as citações do texto, na ordem em que aparecem. */
export function citacoesDoTexto(blocos: Bloco[]): Citacao[] {
  const saida: Citacao[] = [];
  const dosTrechos = (trechos: Trecho[]) => trechos.forEach((t) => ehCitacao(t) && saida.push(t.citacao));
  const dosItens = (itens: ItemDeLista[]) =>
    itens.forEach((i) => {
      dosTrechos(i.trechos);
      if (i.subitens) dosItens(i.subitens);
    });
  for (const b of blocos) {
    if (b.tipo === "paragrafo" || b.tipo === "titulo") dosTrechos(b.trechos);
    else if (b.tipo === "lista") dosItens(b.itens);
  }
  return saida;
}

// ---------------------------------------------------------------------------
// Regras do perfil

class Regras {
  constructor(readonly perfil: PerfilResolvido) {}

  /** O valor de uma regra, como texto, ou undefined se o perfil não tem a regra (ou ela está desligada). */
  valor(chave: string): string | undefined {
    const r = this.perfil.regras.get(chave);
    return r && r.situacao.tipo !== "desligada" ? r.texto : undefined;
  }

  tem(chave: string): boolean {
    return this.valor(chave) !== undefined;
  }

  /** Os itens de uma regra de lista, já normalizados. */
  itens(chave: string): string[] {
    const r = this.perfil.regras.get(chave);
    if (!r || r.situacao.tipo === "desligada" || r.valor.tipo !== "lista") return [];
    return r.valor.itens.map(normalizar);
  }
}

// ---------------------------------------------------------------------------

interface Obra {
  modelo: Referencia;
  typst: ReferenciaDoTypst;
}

/** Prepara o motor de citações de um trabalho. */
export function criarMotor(doc: Documento, perfil: PerfilResolvido): Motor {
  const regras = new Regras(perfil);
  const porId = new Map(doc.referencias.map((r) => [r.id, r]));

  // Só as obras citadas entram na lista, nos desempates e nas letras (2020a).
  const citadas: string[] = [];
  for (const c of citacoesDoTexto(doc.blocos)) {
    for (const o of obrasDaCitacao(c)) {
      if (porId.has(o.referencia) && !citadas.includes(o.referencia)) citadas.push(o.referencia);
    }
  }
  const referenciasDoTypst = prepararReferencias(
    Object.fromEntries(citadas.map((id) => [id, paraHayagriva(porId.get(id)!)])),
    perfil,
  );
  const obras = new Map<string, Obra>(citadas.map((id) => [id, { modelo: porId.get(id)!, typst: referenciasDoTypst[id] }]));
  const jaCitadas = new Set<string>();

  const ctx: Contexto = { regras, obras, jaCitadas };
  return {
    perfil,
    referenciasDoTypst,
    citadas,
    montar(c) {
      const montada = montarCitacao(c, ctx);
      for (const o of obrasDaCitacao(c)) jaCitadas.add(o.referencia);
      return montada;
    },
  };
}

interface Contexto {
  regras: Regras;
  obras: Map<string, Obra>;
  jaCitadas: Set<string>;
}

// ---------------------------------------------------------------------------
// Pedaços

const t = (texto: string): Pedaco => ({ texto });
const it = (texto: string): Pedaco => ({ texto, italico: true });

/** Junta pedaços vizinhos com o mesmo destaque. */
function juntar(pedacos: Pedaco[]): Pedaco[] {
  const saida: Pedaco[] = [];
  for (const p of pedacos) {
    if (!p.texto) continue;
    const ultimo = saida[saida.length - 1];
    if (ultimo && !!ultimo.italico === !!p.italico) ultimo.texto += p.texto;
    else saida.push({ ...p });
  }
  return saida;
}

/** Os pedaços como texto simples, com o itálico entre asteriscos (*assim*), como nos gabaritos. */
export function pedacosComoTexto(pedacos: Pedaco[], marcarItalico = true): string {
  return pedacos.map((p) => (p.italico && marcarItalico ? `*${p.texto}*` : p.texto)).join("");
}

// ---------------------------------------------------------------------------
// Autores

/** "João Pedro" vira "J. P."; partículas (de, da, dos) ficam de fora. */
function iniciais(prenomes: string): string {
  return prenomes
    .split(/\s+/)
    .filter((p) => p && !PARTICULAS.has(p.toLowerCase()))
    .map((p) => `${p.charAt(0).toLocaleUpperCase("pt-BR")}.`)
    .join(" ");
}

interface NomeNaChamada {
  sobrenome: string;
  prenomes: string;
  instituicao: boolean;
}

function nomesDe(ref: Referencia): NomeNaChamada[] {
  return ref.autores.map((a) =>
    ehInstituicao(a)
      ? { sobrenome: a.instituicao.trim(), prenomes: "", instituicao: true }
      : { sobrenome: a.sobrenome.trim(), prenomes: (a.prenomes ?? "").trim(), instituicao: false },
  );
}

const anoSemLetra = (o: Obra) => anoDaReferencia(o.typst).replace(/[a-z]$/, "");

/** Identifica as pessoas autoras, para saber se duas obras são do mesmo autor. */
function chaveDosAutores(ref: Referencia): string {
  return JSON.stringify(nomesDe(ref).map((n) => `${n.sobrenome}|${n.prenomes}`.toLowerCase()));
}

/**
 * Mesmo sobrenome, pessoas diferentes: entram as iniciais.
 * ABNT, só no mesmo ano: (Silva, J., 2021; Silva, M., 2021).
 * APA, em qualquer ano: (J. P. Silva, 2019), (J. Silva, 2021).
 */
function desempateDoPrimeiroAutor(obra: Obra, ctx: Contexto): "depois" | "antes" | undefined {
  const { regras } = ctx;
  const abnt = regras.valor("citação, mesmo sobrenome e ano") === "acrescentar iniciais";
  const apa = regras.valor("citação, mesmo sobrenome") === "iniciais antes do sobrenome, em qualquer ano";
  if (!abnt && !apa) return undefined;
  const [meu] = nomesDe(obra.modelo);
  if (!meu || meu.instituicao || !meu.prenomes) return undefined;
  const conflito = [...ctx.obras.values()].some((outra) => {
    if (outra === obra) return false;
    const [dele] = nomesDe(outra.modelo);
    return (
      dele !== undefined &&
      !dele.instituicao &&
      dele.sobrenome.toLowerCase() === meu.sobrenome.toLowerCase() &&
      dele.prenomes.toLowerCase() !== meu.prenomes.toLowerCase() &&
      (apa || anoSemLetra(outra) === anoSemLetra(obra))
    );
  });
  if (!conflito) return undefined;
  return apa ? "antes" : "depois";
}

/** A partir de quantos autores a chamada usa et al. (Infinity: nunca). */
function limiteDoEtAl(regras: Regras): number {
  if (regras.tem("citação, três ou mais autores")) return 3;
  if (regras.valor("autores, quatro ou mais") === "primeiro com et al.") return 4;
  return Infinity;
}

/**
 * APA: quantos nomes escrever antes do et al. Normalmente 1; mais, quando
 * outra obra do mesmo ano ficaria igual com et al. (APA 7, 8.18):
 * (Kapoor, Bloom, Montez, et al., 2017) e (Kapoor, Bloom, Zucker, et al., 2017).
 */
function nomesAntesDoEtAl(obra: Obra, ctx: Contexto, limite: number): number {
  if (!ctx.regras.tem("citação, obras iguais com et al.")) return 1;
  const meus = nomesDe(obra.modelo).map((n) => n.sobrenome.toLowerCase());
  const parecidas = [...ctx.obras.values()]
    .filter((o) => o !== obra && anoSemLetra(o) === anoSemLetra(obra))
    .map((o) => nomesDe(o.modelo).map((n) => n.sobrenome.toLowerCase()))
    .filter((deles) => deles.length >= limite && deles[0] === meus[0] && deles.join() !== meus.join());
  let k = 1;
  while (k < meus.length && parecidas.some((deles) => deles.slice(0, k).join() === meus.slice(0, k).join())) k++;
  return k;
}

/** APA, quando a revista pede: na primeira citação de uma obra com 3 a 5 autores, entram todos os nomes. */
function todosNaPrimeira(id: string, obra: Obra, ctx: Contexto): boolean {
  if (ctx.regras.valor("citação, primeira vez com três a cinco autores") !== "todos os autores") return false;
  if (ctx.jaCitadas.has(id)) return false;
  const n = obra.modelo.autores.length;
  return n >= 3 && n <= 5;
}

/** Obra sem autor (ou lei, na APA): o título, na forma da norma. */
function tituloNaChamada(obra: Obra, ctx: Contexto): Pedaco[] {
  const { regras } = ctx;
  const { modelo } = obra;
  const tipo = normalizar(NOME_DO_TIPO[modelo.tipo]);
  // ABNT: primeira palavra do título e [...], já preparado em preparar.ts.
  const doTypst = obra.typst.title as string | { value: string; short?: string };
  if (typeof doTypst !== "string" && doTypst.short) return [t(doTypst.short)];
  const titulo = modelo.titulo.trim();
  if (modelo.tipo === "lei" && regras.tem("citação, lei")) return [t(titulo)];
  if (regras.itens("citação, obra sem autor, título em itálico").includes(tipo)) return [it(titulo)];
  if (regras.itens("citação, obra sem autor, título entre aspas").includes(tipo)) return [t(`“${titulo}”`)];
  return [t(titulo)];
}

/**
 * Os nomes de uma obra na chamada.
 * Entre parênteses: (Lima; Costa; Reis) na ABNT, (Lima & Costa) na APA.
 * Narrativa: Lima, Costa e Reis.
 */
function nomesDaChamada(id: string, obra: Obra, forma: "parenteses" | "narrativa", ctx: Contexto): Pedaco[] {
  const { regras } = ctx;
  // APA: a lei entra pelo título, mesmo com autor (Brasil).
  if (obra.modelo.autores.length === 0 || (obra.modelo.tipo === "lei" && regras.tem("citação, lei"))) {
    return tituloNaChamada(obra, ctx);
  }

  const caixaAlta = regras.valor("citação, autor na chamada") === "maiúsculas";
  const autores = nomesDe(obra.modelo);
  const nomes = autores.map((a) => (caixaAlta ? a.sobrenome.toLocaleUpperCase("pt-BR") : a.sobrenome));
  const desempate = desempateDoPrimeiroAutor(obra, ctx);
  if (desempate === "antes") nomes[0] = `${iniciais(autores[0].prenomes)} ${nomes[0]}`;
  if (desempate === "depois") nomes[0] = `${nomes[0]}, ${iniciais(autores[0].prenomes)}`;

  const limite = limiteDoEtAl(regras);
  if (nomes.length >= limite && !todosNaPrimeira(id, obra, ctx)) {
    const k = nomesAntesDoEtAl(obra, ctx, limite);
    if (k < nomes.length) {
      const italico = regras.valor("referências, em itálico")?.includes("et al.");
      const etAl = italico ? it("et al.") : t("et al.");
      return k === 1 ? [t(`${nomes[0]} `), etAl] : [t(`${nomes.slice(0, k).join(", ")}, `), etAl];
    }
  }
  if (nomes.length === 1) return [t(nomes[0])];

  if (forma === "parenteses") {
    // APA: (Lima & Costa, 2020); com três ou mais nomes, vírgula também antes do &.
    const ultimo = regras.valor("citação, dois autores entre parênteses");
    if (ultimo) {
      const antes = nomes.length >= 3 ? "," : "";
      return [t(`${nomes.slice(0, -1).join(", ")}${antes} ${ultimo} ${nomes[nomes.length - 1]}`)];
    }
    // ABNT: (Lima; Costa; Reis, 2018).
    const separador = regras.valor("citação, separador entre autores") === "vírgula" ? ", " : "; ";
    return [t(nomes.join(separador))];
  }
  const separador = regras.valor("citação narrativa, separador entre autores") === "ponto e vírgula" ? "; " : ", ";
  const antesDoUltimo = regras.valor("citação narrativa, antes do último autor") ?? "e";
  return [t(`${nomes.slice(0, -1).join(separador)} ${antesDoUltimo} ${nomes[nomes.length - 1]}`)];
}

// ---------------------------------------------------------------------------
// Ano, página e expressões

/** "2019", "2020a", "[201-?]", ou o marcador de obra sem data do perfil. */
function anoDaChamada(obra: Obra, regras: Regras): string {
  return anoDaReferencia(obra.typst) || regras.valor("citação, sem data, marcador") || "";
}

/** "p. 15", "pp. 4–5" (APA), "local. 7". */
function localizadorComoTexto(l: Localizador, regras: Regras): string {
  if (l.tipo === "outro") return `${l.rotulo.trim()} ${l.valor.trim()}`.trim();
  const valor = l.valor.trim();
  const intervalo = /^\s*[\w.]+\s*[-–—]\s*[\w.]+\s*$/u.test(valor);
  const rotulo = (intervalo && regras.valor("citação, rótulo de várias páginas")) || regras.valor("citação, rótulo da página") || "";
  const traco = regras.valor("citação, traço entre páginas");
  const pagina = intervalo && traco ? valor.replace(/\s*[-–—]\s*/u, traco) : valor;
  return `${rotulo} ${pagina}`.trim();
}

/** O que vem depois do ano: "p. 15, grifo nosso". */
function complemento(o: ObraCitada, regras: Regras): string {
  const partes: Array<string | undefined> = [o.localizador ? localizadorComoTexto(o.localizador, regras) : undefined];
  // Na ABNT o destaque vai na chamada (grifo nosso). Na APA vai dentro da
  // citação, logo depois do trecho destacado: quem põe lá é o conversor.
  const naChamada = (regras.valor("citação, destaque seu, onde") ?? "na chamada") === "na chamada";
  if (o.grifo && naChamada) partes.push(regras.valor("citação, destaque seu"));
  if (o.traducao) partes.push(regras.valor("citação, tradução sua"));
  return partes.filter(Boolean).join(", ");
}

function anoEComplemento(o: ObraCitada, obra: Obra, regras: Regras): string {
  const extra = complemento(o, regras);
  return [anoDaChamada(obra, regras), extra].filter(Boolean).join(", ");
}

// ---------------------------------------------------------------------------
// Avisos

function avisosDaObra(o: ObraCitada, direta: boolean | undefined, ctx: Contexto): Aviso[] {
  const obra = ctx.obras.get(o.referencia);
  if (!obra) {
    return [
      {
        tipo: "referencia-apagada",
        referencia: o.referencia,
        mensagem: "esta citação aponta para uma referência que não existe mais. Escolha a obra de novo ou apague a citação.",
      },
    ];
  }
  const avisos: Aviso[] = [];
  const nome = obra.modelo.autores.length ? nomesDe(obra.modelo)[0].sobrenome : obra.modelo.titulo || "sem título";
  if (direta && ctx.regras.tem("citação direta sem página") && !o.localizador?.valor.trim()) {
    avisos.push({
      tipo: "direta-sem-pagina",
      referencia: o.referencia,
      mensagem: `a citação direta de ${nome} está sem página. A norma pede a página (ou outro localizador, como local. 7).`,
    });
  }
  if (!anoDaReferencia(obra.typst) && ctx.regras.tem("referências, data provável")) {
    avisos.push({
      tipo: "sem-data",
      referencia: o.referencia,
      mensagem: `a obra de ${nome} está sem data. A ABNT não aceita obra sem data: escreva a data provável, como [2019?] ou [201-?].`,
    });
  }
  if (!obra.modelo.titulo.trim()) {
    avisos.push({ tipo: "sem-titulo", referencia: o.referencia, mensagem: `a obra de ${nome} está sem título.` });
  }
  return avisos;
}

// ---------------------------------------------------------------------------
// Montagem

const APAGADA = "referência apagada";

/** Texto para ordenar as obras: sobrenomes (ou título) e ano, sem acentos. */
function ordem(o: ObraCitada, ctx: Contexto): string {
  const obra = ctx.obras.get(o.referencia);
  if (!obra) return "￿";
  const nomes = nomesDe(obra.modelo).map((n) => n.sobrenome).join(" ") || obra.modelo.titulo;
  return `${semAcentos(nomes.toLowerCase())} ${anoDaChamada(obra, ctx.regras)}`;
}

/**
 * Entre parênteses, com uma ou várias obras. Várias obras: em ordem
 * alfabética, separadas por ponto e vírgula; anos do mesmo autor separados por
 * vírgula: (Lima; Costa; Reis, 2018; Rudio, 2002, 2003).
 */
function entreParenteses(obras: ObraCitada[], ctx: Contexto): Pedaco[] {
  const ordenadas = [...obras].sort((a, b) => ordem(a, ctx).localeCompare(ordem(b, ctx), "pt-BR"));
  const grupos: ObraCitada[][] = [];
  for (const o of ordenadas) {
    const anterior = grupos[grupos.length - 1];
    const obra = ctx.obras.get(o.referencia);
    const daAnterior = anterior && ctx.obras.get(anterior[0].referencia);
    const mesmoAutor =
      obra !== undefined &&
      daAnterior !== undefined &&
      obra.modelo.autores.length > 0 &&
      chaveDosAutores(daAnterior.modelo) === chaveDosAutores(obra.modelo);
    if (mesmoAutor) anterior.push(o);
    else grupos.push([o]);
  }
  const partes = grupos.map((grupo): Pedaco[] => {
    const primeira = ctx.obras.get(grupo[0].referencia);
    if (!primeira) return [t(APAGADA)];
    const anos = grupo.map((o) => anoEComplemento(o, ctx.obras.get(o.referencia)!, ctx.regras)).join(", ");
    return [...nomesDaChamada(grupo[0].referencia, primeira, "parenteses", ctx), t(`, ${anos}`)];
  });
  return [t("("), ...partes.flatMap((p, i) => (i ? [t("; "), ...p] : p)), t(")")];
}

function montarCitacao(c: Citacao, ctx: Contexto): CitacaoMontada {
  const { regras } = ctx;
  const avisos = obrasDaCitacao(c).flatMap((o) => avisosDaObra(o, c.tipo === "sem-referencia" ? false : c.direta, ctx));
  const obras = obrasDaCitacao(c)
    .map((o) => o.referencia)
    .filter((id) => ctx.obras.has(id));
  let pedacos: Pedaco[];

  switch (c.tipo) {
    case "parenteses":
      pedacos = entreParenteses(c.obras, ctx);
      break;

    case "narrativa": {
      // Lima, Costa e Reis (2018, p. 4)
      const obra = ctx.obras.get(c.obra.referencia);
      pedacos = obra
        ? [...nomesDaChamada(c.obra.referencia, obra, "narrativa", ctx), t(` (${anoEComplemento(c.obra, obra, regras)})`)]
        : [t(`(${APAGADA})`)];
      break;
    }

    case "apud": {
      // ABNT: (Freud, 1915 apud Costa, 2021, p. 12). APA: (Freud, 1915, como citado em Costa, 2021).
      const obra = ctx.obras.get(c.obra.referencia);
      const expressao = regras.valor("citação de citação, expressão") ?? "apud";
      const termo = regras.valor("citação de citação, destaque") === "itálico" ? it(expressao) : t(expressao);
      const virgula = regras.valor("citação de citação, vírgula antes") === "sim" ? "," : "";
      const lida = obra
        ? [...nomesDaChamada(c.obra.referencia, obra, "parenteses", ctx), t(`, ${anoEComplemento(c.obra, obra, regras)}`)]
        : [t(APAGADA)];
      pedacos = [t(`(${c.original.trim()}${virgula} `), termo, t(" "), ...lida, t(")")];
      break;
    }

    case "sem-referencia":
      if (!c.texto.trim()) {
        avisos.push({ tipo: "sem-referencia-vazia", mensagem: "a fala sem referência está sem o nome de quem fala." });
      }
      pedacos = [t(`(${c.texto.trim()})`)];
      break;
  }
  return { pedacos: juntar(pedacos), obras, avisos };
}

/** As citações que levam grifo (destaque seu), para o conversor pôr a expressão no lugar certo. */
export function temGrifo(c: Citacao): boolean {
  return obrasDaCitacao(c).some((o) => o.grifo);
}
