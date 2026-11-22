// O documento de prova: monta as chamadas e as referências com o motor de
// citações do Apud e compara com o gabarito da norma. Usado pelo comando
// "npm run prova" e pelos testes.
//
// O texto do documento de prova está em documento-de-prova.md, com as citações
// escritas numa forma curta ([@silva2019, p. 15]); as referências estão em
// referencias.json, no formato do .apud. Aqui os dois viram um trabalho do
// Apud (o mesmo modelo que o editor grava), que passa pelo motor de citações e
// pelo conversor de verdade.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { criarMotor, citacoesDoTexto } from "../src/citacoes/motor";
import { escaparTexto, pedacosParaTypst, registrar } from "../src/conversor/typst";
import { conferirPerfis, formatarMensagem, normaDoTrabalho, type Arquivo, type NormaDoTrabalho } from "../src/perfis";
import type { PerfilResolvido } from "../src/perfis";
import type { EsquemaNorma } from "../src/perfis/esquema";
import { documentoVazio, type Bloco, type Citacao, type Documento, type ItemDeLista, type Localizador, type ObraCitada, type Referencia, type Trecho } from "../src/documento/modelo";

export const PASTA_PERFIS = join(import.meta.dirname, "..", "perfis");
export const PASTA_PROVA = join(PASTA_PERFIS, "prova");

function lerPasta(pasta: string, extensao: string): Arquivo[] {
  return readdirSync(pasta)
    .filter((n) => n.endsWith(extensao))
    .map((nome) => ({ nome, conteudo: readFileSync(join(pasta, nome), "utf8") }));
}

const estilos = () => lerPasta(join(PASTA_PERFIS, "estilos"), ".csl");

function conferido(arquivo: string) {
  const resultados = conferirPerfis(lerPasta(PASTA_PERFIS, ".txt"), estilos());
  const r = resultados.find((x) => x.arquivo === arquivo);
  if (!r?.perfil || !r.esquema) {
    const erros = r?.mensagens.map(formatarMensagem).join("\n") ?? "arquivo não encontrado";
    throw new Error(`o perfil ${arquivo} tem erros:\n${erros}`);
  }
  return r;
}

/** Lê e confere os perfis da pasta; devolve o da norma pedida. */
export function carregarPerfil(arquivo: string): { perfil: PerfilResolvido; esquema: EsquemaNorma; csl: string } {
  const r = conferido(arquivo);
  const { csl } = normaDoTrabalho(r, estilos());
  return { perfil: r.perfil!, esquema: r.esquema!, csl };
}

/** A norma com os ajustes de um trabalho (escolhas do autor). Ajuste com erro para o teste. */
export function carregarNorma(arquivo: string, ajustes: Record<string, string> = {}): NormaDoTrabalho {
  const norma = normaDoTrabalho(conferido(arquivo), estilos(), ajustes);
  if (norma.problemas.length) throw new Error(norma.problemas.map(formatarMensagem).join("\n"));
  return norma;
}

// ---------------------------------------------------------------------------
// O texto do documento de prova: da forma curta para o modelo do Apud

const CHAVE = "[\\p{L}\\p{N}_-]+";

/** "p. 15" vira página 15; "local. 7" vira outro localizador. */
function lerLocalizador(texto: string): Localizador {
  const m = texto.trim().match(/^(\S+)\s+(.+)$/);
  if (!m) return { tipo: "outro", rotulo: "", valor: texto.trim() };
  return m[1] === "p." ? { tipo: "pagina", valor: m[2] } : { tipo: "outro", rotulo: m[1], valor: m[2] };
}

function lerObra(trecho: string): ObraCitada | undefined {
  const partes = trecho.trim().match(new RegExp(`^@(${CHAVE})(?:\\s*,\\s*(.*))?$`, "u"));
  if (!partes) return undefined;
  const obra: ObraCitada = { referencia: partes[1] };
  const localizador: string[] = [];
  for (const pedaco of (partes[2] ?? "").split(/,\s*/).filter(Boolean)) {
    if (pedaco === "+grifo") obra.grifo = true;
    else if (pedaco === "+tradução") obra.traducao = true;
    else localizador.push(pedaco);
  }
  if (localizador.length) obra.localizador = lerLocalizador(localizador.join(", "));
  return obra;
}

/** Tira o "+direta" (citação direta) de dentro da forma curta. */
function tirarDireta(texto: string): { resto: string; direta: boolean } {
  const partes = texto.split(/\s*,\s*/);
  const resto = partes.filter((p) => p.trim() !== "+direta");
  return { resto: resto.join(", "), direta: resto.length < partes.length };
}

/**
 * Lê um parágrafo com citações na forma curta e devolve os trechos do modelo,
 * com a escrita original de cada citação (a chave do gabarito):
 *   [@chave, p. 15]  [@a; @b]  @chave  @chave [p. 4]  [@chave, p. 15, +grifo]
 *   [Autor, ano apud @chave, p. 3]  [sem referência: texto]
 * "+direta" marca a citação direta: [@chave, p. 15, +direta], @chave [+direta].
 */
export function lerTextoComCitacoes(texto: string): { trechos: Trecho[]; escritas: string[] } {
  const achadas: Array<{ inicio: number; fim: number; citacao: Citacao }> = [];
  for (const m of texto.matchAll(/\[([^\[\]]+)\]/g)) {
    const { resto: dentro, direta } = tirarDireta(m[1]);
    let citacao: Citacao | undefined;
    const semReferencia = dentro.match(/^sem referência:\s*(.+)$/);
    const apud = dentro.match(new RegExp(`^(.+?)\\s+apud\\s+(@${CHAVE}(?:\\s*,.*)?)$`, "u"));
    if (semReferencia) {
      citacao = { tipo: "sem-referencia", texto: semReferencia[1].trim() };
    } else if (apud) {
      const obra = lerObra(apud[2]);
      if (obra) citacao = { tipo: "apud", original: apud[1].trim(), obra };
    } else if (dentro.trim().startsWith("@")) {
      const obras = dentro.split(";").map(lerObra);
      if (obras.every((o): o is ObraCitada => o !== undefined)) citacao = { tipo: "parenteses", obras };
    }
    if (citacao && direta && citacao.tipo !== "sem-referencia") citacao.direta = true;
    if (citacao) achadas.push({ inicio: m.index!, fim: m.index! + m[0].length, citacao });
  }
  for (const m of texto.matchAll(new RegExp(`(?<![\\w@])@(${CHAVE})(?: \\[([^\\[\\]]+)\\])?`, "gu"))) {
    if (achadas.some((a) => m.index! >= a.inicio && m.index! < a.fim)) continue;
    const obra: ObraCitada = { referencia: m[1] };
    const { resto, direta } = tirarDireta(m[2] ?? "");
    if (resto) obra.localizador = lerLocalizador(resto);
    achadas.push({ inicio: m.index!, fim: m.index! + m[0].length, citacao: { tipo: "narrativa", obra, ...(direta && { direta }) } });
  }
  achadas.sort((a, b) => a.inicio - b.inicio);
  const trechos: Trecho[] = [];
  const escritas: string[] = [];
  let cursor = 0;
  for (const a of achadas) {
    if (a.inicio > cursor) trechos.push({ texto: texto.slice(cursor, a.inicio) });
    trechos.push({ citacao: a.citacao });
    escritas.push(texto.slice(a.inicio, a.fim));
    cursor = a.fim;
  }
  if (cursor < texto.length) trechos.push({ texto: texto.slice(cursor) });
  return { trechos, escritas };
}

/**
 * O documento de prova como trabalho do Apud. Ficam de fora, até a fase 3, o
 * que o editor ainda não tem: notas de rodapé, figuras e tabelas. A citação
 * longa entra como parágrafo comum.
 */
export function documentoDeProva(): { documento: Documento; escritas: string[] } {
  return documentoDoTexto(
    readFileSync(join(PASTA_PROVA, "documento-de-prova.md"), "utf8"),
    JSON.parse(readFileSync(join(PASTA_PROVA, "referencias.json"), "utf8")) as Referencia[],
  );
}

/** Um texto na forma curta (como o documento de prova) e as referências viram um trabalho do Apud. */
export function documentoDoTexto(textoCompleto: string, referencias: Referencia[]): { documento: Documento; escritas: string[] } {
  const md = textoCompleto.replace(/<!--[\s\S]*?-->/g, "").replace(/^\s*---\n[\s\S]*?\n---\n/, "");
  const blocos: Bloco[] = [];
  const escritas: string[] = [];
  const texto = (s: string) => {
    const r = lerTextoComCitacoes(s.replace(/\^\[[^\]]*\]/g, "").trim());
    escritas.push(...r.escritas);
    return r.trechos;
  };
  let paragrafo: string[] = [];
  let lista: ItemDeLista[] | null = null;
  let bloco: { tipo: string; linhas: string[] } | null = null;
  const fechar = () => {
    if (paragrafo.length) blocos.push({ tipo: "paragrafo", trechos: texto(paragrafo.join(" ")) });
    if (lista) blocos.push({ tipo: "lista", sequencia: false, itens: lista });
    paragrafo = [];
    lista = null;
  };
  for (const linha of md.split("\n")) {
    if (bloco) {
      if (linha.trim() === ":::") {
        if (bloco.tipo === "citação-longa") blocos.push({ tipo: "paragrafo", trechos: texto(bloco.linhas.join(" ")) });
        if (bloco.tipo === "referências") blocos.push({ tipo: "referencias" });
        bloco = null;
      } else bloco.linhas.push(linha.trim());
      continue;
    }
    const abertura = linha.match(/^:::\s*(\S+)/);
    const titulo = linha.match(/^(#{1,5})\s+(.*)$/);
    const item = linha.match(/^(\s*)-\s+(.*)$/);
    if (abertura) {
      fechar();
      bloco = { tipo: abertura[1], linhas: [] };
    } else if (titulo) {
      fechar();
      blocos.push({ tipo: "titulo", nivel: titulo[1].length as 1 | 2 | 3 | 4 | 5, trechos: texto(titulo[2]) });
    } else if (item) {
      if (paragrafo.length) {
        blocos.push({ tipo: "paragrafo", trechos: texto(paragrafo.join(" ")) });
        paragrafo = [];
      }
      lista ??= [];
      const novo: ItemDeLista = { trechos: texto(item[2]) };
      if (item[1].length >= 2 && lista.length) (lista[lista.length - 1].subitens ??= []).push(novo);
      else lista.push(novo);
    } else if (!linha.trim()) {
      fechar();
    } else {
      paragrafo.push(linha.trim());
    }
  }
  fechar();
  return { documento: { ...documentoVazio(), blocos, referencias }, escritas };
}

// ---------------------------------------------------------------------------

export interface ResultadoDaProva {
  /** Cada chamada do documento, como está escrita, e como saiu. */
  chamadas: Array<{ escrita: string; saida: string }>;
  referencias: string[];
  /** O código Typst das chamadas e da lista, para gerar o PDF. */
  typst: string;
}

/** HTML do Typst para texto com marcas: **negrito**, *itálico*, __sublinhado__. */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<strong>([\s\S]*?)<\/strong>/g, "**$1**")
    .replace(/<em>([\s\S]*?)<\/em>/g, "*$1*")
    .replace(/<span style="text-decoration: underline">([\s\S]*?)<\/span>/g, "__$1__")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Monta as chamadas e a lista do documento de prova com o motor do Apud, no
 * Typst, com o perfil (e ajustes do trabalho, se houver), e devolve como saíram.
 */
export function rodarProva(arquivoDoPerfil: string, ajustes: Record<string, string> = {}): ResultadoDaProva {
  return rodarTrabalho(documentoDeProva(), carregarNorma(arquivoDoPerfil, ajustes));
}

/** O mesmo que rodarProva, para qualquer trabalho (os artigos de teste, por exemplo). */
export function rodarTrabalho({ documento, escritas }: { documento: Documento; escritas: string[] }, norma: NormaDoTrabalho): ResultadoDaProva & { avisos: string[] } {
  const { perfil, csl } = norma;
  const motor = criarMotor(documento, perfil);
  const titulo = perfil.regras.get("rótulo das referências")?.texto ?? "Referências";
  // Na ordem do texto, para o motor saber qual é a primeira citação de cada obra.
  const avisos: string[] = [];
  const chamadas = citacoesDoTexto(documento.blocos).map((c, i) => {
    const m = motor.montar(c);
    for (const a of m.avisos) avisos.push(`${escritas[i]}: ${a.mensagem}`);
    return `#block[C${i + 1}: ${m.obras.map(registrar).join("")}${pedacosParaTypst(m.pedacos)}]`;
  });
  const typst = [
    `#set text(lang: "pt", region: "BR")`,
    ...chamadas,
    `#bibliography(bytes(${JSON.stringify(JSON.stringify(motor.referenciasDoTypst))}), style: bytes(${JSON.stringify(csl)}), title: [${escaparTexto(titulo)}])`,
  ].join("\n");

  const compilador = NodeCompiler.create({ workspace: PASTA_PROVA });
  const saida = compilador.tryHtml({ mainFileContent: typst });
  if (!saida.result) {
    saida.printDiagnostics();
    throw new Error("o Typst não conseguiu montar o documento de prova");
  }
  const html = saida.result.html();
  const blocos = [...html.matchAll(/<(?:div|p)>C(\d+): ([\s\S]*?)<\/(?:div|p)>/g)];
  const itens = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)];
  return {
    chamadas: blocos.map((b) => ({ escrita: escritas[Number(b[1]) - 1], saida: htmlParaTexto(b[2]) })),
    referencias: itens.map((i) => htmlParaTexto(i[1])),
    typst,
    avisos,
  };
}

/** Gera o PDF do documento de prova (só chamadas e referências). */
export function gerarPdf(typst: string): Uint8Array {
  const compilador = NodeCompiler.create({ workspace: PASTA_PROVA });
  const r = compilador.compile({ mainFileContent: typst.replace(/#block\[C(\d+): /g, "#block[*$1.* ") });
  if (!r.result) throw new Error("o Typst não conseguiu gerar o PDF");
  return compilador.pdf(r.result);
}

// ---------------------------------------------------------------------------
// Gabarito

export interface Gabarito {
  chamadas: Map<string, string>;
  referencias: string[];
}

/** Escreve o gabarito a partir de um resultado conferido. */
export function escreverGabarito(resultado: ResultadoDaProva, nomeDoPerfil: string): string {
  const vistas = new Set<string>();
  const chamadas = resultado.chamadas.filter((c) => !vistas.has(c.escrita) && vistas.add(c.escrita));
  return [
    `# Gabarito do documento de prova: ${nomeDoPerfil}`,
    "#",
    "# Como cada chamada do documento de prova deve sair, e a lista de referências",
    "# completa, na ordem. O comando “npm run prova” compara a saída com este arquivo.",
    "# Negrito entre ** **, itálico entre * *, sublinhado entre __ __.",
    "# Só mude este arquivo depois de conferir a mudança contra a norma.",
    "",
    "== Chamadas ==",
    ...chamadas.map((c) => `${c.escrita}  →  ${c.saida}`),
    "",
    "== Referências ==",
    ...resultado.referencias,
    "",
  ].join("\n");
}

/** Lê o gabarito: "escrita  →  saída" para chamadas e uma referência por linha. */
export function lerGabarito(arquivo: string, pasta = PASTA_PROVA): Gabarito {
  const chamadas = new Map<string, string>();
  const referencias: string[] = [];
  let secao = "";
  for (const linha of readFileSync(join(pasta, arquivo), "utf8").split(/\r?\n/)) {
    const t = linha.trim();
    if (!t || t.startsWith("#")) continue;
    if (t.startsWith("==")) {
      secao = t;
      continue;
    }
    if (secao.includes("Chamadas")) {
      const [escrita, saida] = t.split(/\s+→\s+/);
      chamadas.set(escrita.trim(), saida.trim());
    } else if (secao.includes("Referências")) {
      referencias.push(t);
    }
  }
  return { chamadas, referencias };
}

/** Compara o resultado com o gabarito; devolve as diferenças em português. */
export function compararComGabarito(resultado: ResultadoDaProva, gabarito: Gabarito): string[] {
  const diferencas: string[] = [];
  const vistas = new Set<string>();
  for (const { escrita, saida } of resultado.chamadas) {
    vistas.add(escrita);
    const esperado = gabarito.chamadas.get(escrita);
    if (esperado === undefined) diferencas.push(`chamada fora do gabarito: ${escrita} saiu ${saida}`);
    else if (esperado !== saida) diferencas.push(`chamada ${escrita}\n    esperado: ${esperado}\n    saiu:     ${saida}`);
  }
  for (const escrita of gabarito.chamadas.keys()) {
    if (!vistas.has(escrita)) diferencas.push(`chamada do gabarito que não está no documento: ${escrita}`);
  }
  const n = Math.max(resultado.referencias.length, gabarito.referencias.length);
  for (let i = 0; i < n; i++) {
    const esperado = gabarito.referencias[i];
    const saiu = resultado.referencias[i];
    if (esperado !== saiu) {
      diferencas.push(`referência ${i + 1}\n    esperado: ${esperado ?? "(nenhuma)"}\n    saiu:     ${saiu ?? "(nenhuma)"}`);
    }
  }
  return diferencas;
}
