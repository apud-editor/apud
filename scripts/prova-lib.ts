// O documento de prova: monta as chamadas e as referências com o motor de
// citações do Apud e compara com o gabarito da norma. Usado pelo comando
// "npm run prova" e pelos testes.
//
// O texto do documento de prova está em documento-de-prova.md, com as citações
// escritas numa forma curta ([@silva2019, p. 15]); as referências estão em
// referencias.json, no formato do .apud. Aqui os dois viram um trabalho do
// Apud (o mesmo modelo que o editor grava), que passa pelo motor de citações e
// pelo conversor de verdade.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { criarMotor, citacoesDoTexto } from "../src/citacoes/motor";
import { escaparTexto, pedacosParaTypst, PONTUACAO_DA_LISTA, registrar } from "../src/conversor/typst";
import { arquivosDasImagens } from "../src/conversor/elementos";
import { formatarMensagem, type PerfilResolvido } from "../src/perfis";
import type { EsquemaNorma } from "../src/perfis/esquema";
import { conferirModelos, type Arquivo } from "../src/modelos/conferir";
import { valorEfetivo } from "../src/modelos/herdar";
import { normaDoTrabalho, type NormaDoTrabalho } from "../src/modelos/norma";
import { esquemaDeCitacoes } from "../src/modelos/ponte";
import type { ModeloResolvido } from "../src/modelos/tipos";
import {
  documentoVazio,
  type Bloco,
  type Citacao,
  type Documento,
  type Imagem,
  type ItemDeLista,
  type Localizador,
  type ObraCitada,
  type Referencia,
  type Trecho,
} from "../src/documento/modelo";

export const PASTA_TESTES = join(import.meta.dirname, "..", "testes");
export const PASTA_PROVA = join(PASTA_TESTES, "prova");

function lerPasta(pasta: string, extensao: string): Arquivo[] {
  return readdirSync(pasta)
    .filter((n) => n.endsWith(extensao))
    .map((nome) => ({ nome, conteudo: readFileSync(join(pasta, nome), "utf8") }));
}

export const PASTA_MODELOS = join(import.meta.dirname, "..", "modelos");

const estilos = () => lerPasta(join(PASTA_MODELOS, "estilos"), ".csl");

/**
 * Lê e confere os modelos da pasta modelos/ (e os exemplos); devolve o modelo
 * do arquivo pedido ("abnt.txt", "apa.txt" ou o exemplo da universidade).
 */
export function carregarModelo(arquivo: string): ModeloResolvido {
  const exemplos = lerPasta(join(PASTA_MODELOS, "exemplos"), ".txt");
  const resultados = conferirModelos([...lerPasta(PASTA_MODELOS, ".txt"), ...exemplos]);
  const r = resultados.find((x) => x.arquivo === arquivo);
  if (!r?.resolvido) {
    const erros = r?.mensagens.map(formatarMensagem).join("\n") ?? "arquivo não encontrado";
    throw new Error(`o modelo ${arquivo} tem erros:\n${erros}`);
  }
  return r.resolvido;
}

/** O modelo, as regras de citação (na forma que o motor lê), o esquema do CSL e o CSL ajustado. */
export function carregarPerfil(arquivo: string): { modelo: ModeloResolvido; perfil: PerfilResolvido; esquema: EsquemaNorma; csl: string } {
  const { modelo, perfil, csl } = carregarNorma(arquivo);
  return { modelo, perfil, esquema: esquemaDeCitacoes(modelo)!, csl };
}

/** A norma com as escolhas de um trabalho (escolhas do autor). Escolha com erro para o teste. */
export function carregarNorma(arquivo: string, ajustes: Record<string, string> = {}): NormaDoTrabalho {
  const norma = normaDoTrabalho(carregarModelo(arquivo), estilos(), ajustes);
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
 * O documento de prova como trabalho do Apud, com a citação longa, a nota de
 * rodapé, a figura e a tabela (fase 3, parte 2) e os dados do trabalho e a
 * abertura (capa, folha de rosto, página de título, resumos, sumário...) de
 * abertura.json (fase 3, parte 4).
 */
export function documentoDeProva(): { documento: Documento; escritas: string[] } {
  const r = documentoDoTexto(
    readFileSync(join(PASTA_PROVA, "documento-de-prova.md"), "utf8"),
    JSON.parse(readFileSync(join(PASTA_PROVA, "referencias.json"), "utf8")) as Referencia[],
    PASTA_PROVA,
  );
  const { dados, abertura } = JSON.parse(readFileSync(join(PASTA_PROVA, "abertura.json"), "utf8")) as Pick<Documento, "dados" | "abertura">;
  return { ...r, documento: { ...r.documento, dados, abertura } };
}

/** Uma imagem do disco no formato do .apud: o código vem do conteúdo, e a largura e a altura do cabeçalho do PNG. */
export function imagemDoDisco(caminho: string, nome: string): Imagem {
  const dados = readFileSync(caminho);
  const formato = nome.endsWith(".png") ? "png" : nome.match(/\.jpe?g$/) ? "jpeg" : nome.endsWith(".svg") ? "svg" : nome.endsWith(".gif") ? "gif" : "webp";
  const png = formato === "png" && dados.length > 24 ? { largura: dados.readUInt32BE(16), altura: dados.readUInt32BE(20) } : {};
  return { id: createHash("sha256").update(dados).digest("hex").slice(0, 16), formato, dados: dados.toString("base64"), ...png, nome };
}

/**
 * Entrega as imagens das figuras ao compilador do Typst (em node). O motor
 * procura cada imagem na pasta de trabalho do compilador (raiz).
 */
export function mapearImagens(compilador: NodeCompiler, doc: Documento, raiz = process.cwd()) {
  for (const a of arquivosDasImagens(doc)) compilador.mapShadow(join(raiz, a.caminho), Buffer.from(a.dados));
}

/**
 * Um texto na forma curta (como o documento de prova) e as referências viram
 * um trabalho do Apud. Figuras pedem a pasta onde estão as imagens.
 *   ^[texto]                          nota de rodapé
 *   ::: citação-longa ... :::         citação longa
 *   ::: figura                        com "título:", "imagem:", "fonte:" e, se quiser,
 *                                     "nota:", "largura:" (60%) e "espécie:" (gráfico, quadro)
 *   ::: tabela                        com "título:", "dados:" (| a | b | ; | c | d |, a
 *                                     primeira linha é o cabeçalho), "fonte:" e "nota:"
 *   ::: quebra / :::                  quebra de página posta pela pessoa
 *   1. item                           lista em sequência (a lista com "- " não é)
 * A fonte "Elaborado pelo próprio autor" vira a caixa "fonte própria".
 */
export function documentoDoTexto(
  textoCompleto: string,
  referencias: Referencia[],
  pastaDasImagens?: string,
): { documento: Documento; escritas: string[] } {
  const md = textoCompleto.replace(/<!--[\s\S]*?-->/g, "").replace(/^\s*---\n[\s\S]*?\n---\n/, "");
  const blocos: Bloco[] = [];
  const imagens: Imagem[] = [];
  const escritas: string[] = [];
  const citacoes = (s: string): Trecho[] => {
    const r = lerTextoComCitacoes(s);
    escritas.push(...r.escritas);
    return r.trechos;
  };
  // As notas ^[...] viram trechos de nota; o resto passa pelas citações.
  const texto = (s: string): Trecho[] => {
    const trechos: Trecho[] = [];
    let cursor = 0;
    const limpo = s.trim();
    for (const m of limpo.matchAll(/\^\[([^\]]*)\]/g)) {
      trechos.push(...citacoes(limpo.slice(cursor, m.index)));
      trechos.push({ nota: { trechos: [{ texto: m[1].trim() }] } });
      cursor = m.index! + m[0].length;
    }
    trechos.push(...citacoes(limpo.slice(cursor)));
    return trechos.filter((t) => !("texto" in t) || t.texto);
  };
  const campos = (linhas: string[]) =>
    Object.fromEntries(linhas.map((l) => l.match(/^([^:]+):\s*(.*)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1].trim(), m[2].trim()]));
  const identificacao = (c: Record<string, string>) => {
    const propria = /^elaborad[ao] pel[ao] próprio autor/i.test(c["fonte"] ?? "");
    return {
      titulo: texto(c["título"] ?? ""),
      fonte: propria ? [] : texto(c["fonte"] ?? ""),
      ...(propria ? { fontePropria: true as const } : {}),
      ...(c["nota"] ? { nota: texto(c["nota"]) } : {}),
    };
  };
  let paragrafo: string[] = [];
  let lista: ItemDeLista[] | null = null;
  let sequencia = false;
  let bloco: { tipo: string; linhas: string[] } | null = null;
  const fechar = () => {
    if (paragrafo.length) blocos.push({ tipo: "paragrafo", trechos: texto(paragrafo.join(" ")) });
    if (lista) blocos.push({ tipo: "lista", sequencia, itens: lista });
    paragrafo = [];
    lista = null;
  };
  const fecharBloco = (b: { tipo: string; linhas: string[] }) => {
    if (b.tipo === "citação-longa") blocos.push({ tipo: "citacaoLonga", trechos: texto(b.linhas.join(" ")) });
    if (b.tipo === "referências") blocos.push({ tipo: "referencias" });
    if (b.tipo === "quebra") blocos.push({ tipo: "quebra" });
    if (b.tipo === "figura") {
      const c = campos(b.linhas);
      if (!pastaDasImagens) throw new Error("a figura precisa da pasta das imagens");
      const imagem = imagemDoDisco(join(pastaDasImagens, c["imagem"]), c["imagem"]);
      if (!imagens.some((i) => i.id === imagem.id)) imagens.push(imagem);
      const especie = c["espécie"] === "gráfico" ? "grafico" : c["espécie"] === "quadro" ? "quadro" : undefined;
      const largura = c["largura"] ? parseFloat(c["largura"]) : undefined;
      blocos.push({ tipo: "figura", imagem: imagem.id, ...(especie ? { especie } : {}), ...(largura ? { largura } : {}), ...identificacao(c) });
    }
    if (b.tipo === "tabela") {
      const c = campos(b.linhas);
      const linhas = (c["dados"] ?? "")
        .split(";")
        .map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((x) => texto(x.trim())))
        .filter((l) => l.length);
      blocos.push({ tipo: "tabela", linhas, cabecalho: 1, ...identificacao(c) });
    }
  };
  for (const linha of md.split("\n")) {
    if (bloco) {
      if (linha.trim() === ":::") {
        fecharBloco(bloco);
        bloco = null;
      } else bloco.linhas.push(linha.trim());
      continue;
    }
    const abertura = linha.match(/^:::\s*(\S+)/);
    const titulo = linha.match(/^(#{1,5})\s+(.*)$/);
    const item = linha.match(/^(\s*)(-|\d+\.)\s+(.*)$/);
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
      if (!lista) sequencia = item[2] !== "-";
      lista ??= [];
      const novo: ItemDeLista = { trechos: texto(item[3]) };
      if (item[1].length >= 2 && lista.length) (lista[lista.length - 1].subitens ??= []).push(novo);
      else lista.push(novo);
    } else if (!linha.trim()) {
      fechar();
    } else {
      paragrafo.push(linha.trim());
    }
  }
  fechar();
  return { documento: { ...documentoVazio(), blocos, referencias, imagens }, escritas };
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
 * Typst, com o modelo (e as escolhas do trabalho, se houver), e devolve como saíram.
 */
export function rodarProva(arquivoDoPerfil: string, ajustes: Record<string, string> = {}): ResultadoDaProva {
  return rodarTrabalho(documentoDeProva(), carregarNorma(arquivoDoPerfil, ajustes));
}

/** O mesmo que rodarProva, para qualquer trabalho (os artigos de teste, por exemplo). */
export function rodarTrabalho({ documento, escritas }: { documento: Documento; escritas: string[] }, norma: NormaDoTrabalho): ResultadoDaProva & { avisos: string[] } {
  const { perfil, csl, modelo } = norma;
  const motor = criarMotor(documento, perfil);
  const titulo = valorEfetivo(modelo, "referencias", "título")?.texto ?? "Referências";
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
    `#{`,
    PONTUACAO_DA_LISTA,
    `  bibliography(bytes(${JSON.stringify(JSON.stringify(motor.referenciasDoTypst))}), style: bytes(${JSON.stringify(csl)}), title: [${escaparTexto(titulo)}])`,
    `}`,
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
    referencias: itens.map((i) => htmlParaTexto(semPontoDobradoNoHtml(i[1]))),
    typst,
    avisos,
  };
}

/**
 * No HTML (de onde sai o gabarito), cada referência é um item de lista, e a regra
 * do Typst que tira o ponto depois de "?" ou "!" no fim do negrito ou do itálico
 * só alcança o PDF (lá cada referência é um bloco). Aqui se faz o mesmo no texto,
 * para o gabarito mostrar o que sai no PDF. O caso no mesmo texto ("mais!. Natal")
 * o Typst já corrige nos dois.
 */
export function semPontoDobradoNoHtml(html: string): string {
  return html.replace(/([?!])(<\/(?:strong|em)>)\./g, "$1$2");
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
