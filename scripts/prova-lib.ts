// Gera as chamadas e as referências do documento de prova no Typst e compara
// com o gabarito da norma. Usado pelo comando "npm run prova" e pelos testes.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { parse as lerYaml } from "yaml";
import { chamadaParaTypst, criarContexto, encontrarChamadas, escaparTypst } from "../src/citacoes/chamadas";
import { prepararReferencias, type Referencia } from "../src/citacoes/preparar";
import {
  aplicarPerfilNoCsl,
  ajustarParaTrabalho,
  conferirPerfis,
  formatarMensagem,
  type Arquivo,
  type PerfilResolvido,
} from "../src/perfis";
import type { EsquemaNorma } from "../src/perfis/esquema";

export const PASTA_PERFIS = join(import.meta.dirname, "..", "perfis");
export const PASTA_PROVA = join(PASTA_PERFIS, "prova");

function lerPasta(pasta: string, extensao: string): Arquivo[] {
  return readdirSync(pasta)
    .filter((n) => n.endsWith(extensao))
    .map((nome) => ({ nome, conteudo: readFileSync(join(pasta, nome), "utf8") }));
}

/** Lê e confere os perfis da pasta; devolve o da norma pedida. */
export function carregarPerfil(arquivo: string): { perfil: PerfilResolvido; esquema: EsquemaNorma; csl: string } {
  const estilos = lerPasta(join(PASTA_PERFIS, "estilos"), ".csl");
  const resultados = conferirPerfis(lerPasta(PASTA_PERFIS, ".txt"), estilos);
  const r = resultados.find((x) => x.arquivo === arquivo);
  if (!r?.perfil || !r.esquema) {
    const erros = r?.mensagens.map(formatarMensagem).join("\n") ?? "arquivo não encontrado";
    throw new Error(`o perfil ${arquivo} tem erros:\n${erros}`);
  }
  const nomeCsl = r.perfil.regras.get("estilo csl")!.texto;
  const csl = estilos.find((e) => e.nome === nomeCsl)!.conteudo;
  return { perfil: r.perfil, esquema: r.esquema, csl };
}

export interface ResultadoDaProva {
  /** Cada chamada do documento, como está escrita, e como saiu. */
  chamadas: Array<{ escrita: string; saida: string }>;
  referencias: string[];
  /** O código Typst montado, para gerar o PDF. */
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
 * Monta o documento de prova no Typst com o perfil (e ajustes do trabalho,
 * se houver) e devolve as chamadas e referências como saíram.
 */
export function rodarProva(arquivoDoPerfil: string, ajustes: Record<string, string> = {}): ResultadoDaProva {
  const carregado = carregarPerfil(arquivoDoPerfil);
  let perfil = carregado.perfil;
  if (Object.keys(ajustes).length) {
    const ajustado = ajustarParaTrabalho(perfil, carregado.esquema, ajustes);
    if (!ajustado.perfil) throw new Error(ajustado.mensagens.map(formatarMensagem).join("\n"));
    perfil = ajustado.perfil;
  }
  const csl = aplicarPerfilNoCsl(carregado.csl, perfil, carregado.esquema);

  const neutras = lerYaml(readFileSync(join(PASTA_PROVA, "referencias.yml"), "utf8")) as Record<string, Referencia>;
  const referencias = prepararReferencias(neutras, perfil);
  // Os comentários <!-- --> explicam a escrita das citações e não fazem parte do texto.
  const documento = readFileSync(join(PASTA_PROVA, "documento-de-prova.md"), "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const chamadas = encontrarChamadas(documento);

  const titulo = perfil.regras.get("rótulo das referências")?.texto ?? "Referências";
  // Um contexto só, para o Apud saber qual é a primeira citação de cada obra.
  const contexto = criarContexto(perfil, referencias);
  const typst = [
    `#set text(lang: "pt", region: "BR")`,
    ...chamadas.map((c, i) => `#block[C${i + 1}: ${chamadaParaTypst(c, contexto)}]`),
    `#bibliography(bytes(${JSON.stringify(JSON.stringify(referencias))}), style: bytes(${JSON.stringify(csl)}), title: [${escaparTypst(titulo)}])`,
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
    chamadas: blocos.map((b) => ({ escrita: chamadas[Number(b[1]) - 1].escrita, saida: htmlParaTexto(b[2]) })),
    referencias: itens.map((i) => htmlParaTexto(i[1])),
    typst,
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
export function lerGabarito(arquivo: string): Gabarito {
  const chamadas = new Map<string, string>();
  const referencias: string[] = [];
  let secao = "";
  for (const linha of readFileSync(join(PASTA_PROVA, arquivo), "utf8").split(/\r?\n/)) {
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
