// O gabarito do código: o código Typst que o conversor escreve para alguns
// trabalhos de teste, guardado em testes/prova/codigo/. Serve para a etapa 1
// da versão 2, que troca os perfis pelos modelos em árvore: o conversor novo
// tem de escrever o mesmo código, letra por letra. Código igual dá PDF igual.
//
// Os casos cobrem as duas normas, a abertura inteira, as marcas da prévia, os
// dois artigos de teste, as escolhas do autor e os valores de faculdade que
// mudam a página (fonte, recuo, alinhamento, posição do número...). Desde a
// etapa 2, também as exceções "só este" em parágrafos e títulos.
//
// Uso:
//   npm run codigo              confere com o gabarito e mostra o que mudou
//   npm run codigo -- --gravar  grava o código atual como gabarito. Use só
//                               quando a mudança no código for de propósito.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { documentoParaTypst, type OpcoesDoConversor } from "../src/conversor/typst";
import type { Documento, Referencia, Resumo, TipoDeTrabalho } from "../src/documento/modelo";
import { carregarNorma, documentoDeProva, documentoDoTexto, PASTA_TESTES, PASTA_PROVA } from "./prova-lib";

export const PASTA_DO_CODIGO = join(PASTA_PROVA, "codigo");

export interface CasoDeCodigo {
  /** Nome do arquivo do gabarito, sem o .typ. */
  nome: string;
  /** O que o caso cobre, em poucas palavras. */
  descricao: string;
  /** O código Typst que o conversor escreve hoje para o caso. */
  codigo: () => string;
}

/** O modelo (da pasta modelos/ ou o de exemplo) com as escolhas do caso e o CSL ajustado. */
const norma = (arquivo: string, ajustes: Record<string, string> = {}) => carregarNorma(arquivo, ajustes);

/**
 * O código como vai para o gabarito:
 *   - o estilo CSL e os dados das referências entram no código como textos
 *     longos (bytes("...")); cada um vira a sua impressão digital (SHA-256) e o
 *     tamanho: o arquivo fica legível, e qualquer letra diferente ainda aparece;
 *   - a primeira linha (um comentário com o nome e a revisão do modelo) não
 *     entra: ela mudou quando o perfil virou modelo, e não muda nada no PDF.
 */
export function paraOGabarito(codigo: string): string {
  return codigo.replace(/^\/\/ Gerado pelo Apud .*\n/, "").replace(/bytes\("((?:[^"\\]|\\.)*)"\)/g, (todo, dentro: string) =>
    dentro.length < 500 ? todo : `bytes(<sha256 ${createHash("sha256").update(dentro).digest("hex").slice(0, 32)}, ${dentro.length} caracteres>)`,
  );
}

function codigo(doc: Documento, arquivo: string, ajustes: Record<string, string> = {}, opcoes: OpcoesDoConversor = {}): string {
  const n = norma(arquivo, ajustes);
  return paraOGabarito(documentoParaTypst(doc, n.modelo, { ...opcoes, csl: n.csl }));
}

/** Um artigo de testes/artigos, com as escolhas do autor do trabalho.json dele. */
function artigo(pasta: string) {
  const dir = join(PASTA_TESTES, "artigos", pasta);
  const trabalho = JSON.parse(readFileSync(join(dir, "trabalho.json"), "utf8")) as { nome: string; tipo?: TipoDeTrabalho; norma: string; ajustes?: Record<string, string> };
  const referencias = JSON.parse(readFileSync(join(dir, "referencias.json"), "utf8")) as Referencia[];
  const { documento } = documentoDoTexto(readFileSync(join(dir, "artigo.md"), "utf8"), referencias, dir);
  if (trabalho.tipo) documento.dados.tipo = trabalho.tipo;
  return { documento, trabalho };
}

/** O documento de prova com outro tipo de trabalho, e a abertura mudada. */
function provaComo(mudar: (d: Documento) => Documento): Documento {
  return mudar(structuredClone(documentoDeProva().documento));
}

/**
 * Põe exceções "só este" (etapa 2) em blocos do documento: o n-ésimo bloco de
 * um tipo (contando de 0) recebe as exceções dadas.
 */
function comExcecoes(
  doc: Documento,
  pedidos: Array<{ tipo: "paragrafo" | "titulo"; nivel?: number; n: number; excecoes?: Record<string, string>; texto?: string }>,
): Documento {
  const d = structuredClone(doc);
  for (const p of pedidos) {
    const iguais = d.blocos.filter((b) => b.tipo === p.tipo && (p.nivel === undefined || (b.tipo === "titulo" && b.nivel === p.nivel)));
    const bloco = iguais[p.n];
    if (!bloco || (bloco.tipo !== "paragrafo" && bloco.tipo !== "titulo")) throw new Error(`não achei o bloco ${p.n} do tipo ${p.tipo}`);
    if (p.excecoes) bloco.excecoes = p.excecoes;
    // Um texto novo (um título com o número escrito à mão, por exemplo).
    if (p.texto !== undefined) bloco.trechos = [{ texto: p.texto }];
  }
  return d;
}

const resumoEmEspanhol: Resumo = {
  idioma: "es",
  titulo: "La acogida en salud mental",
  trechos: [{ texto: "Este trabajo relata una experiencia de pasantía en un servicio de salud mental." }],
  palavrasChave: ["acogida", "salud mental"],
};

export const CASOS: CasoDeCodigo[] = [
  {
    nome: "prova-abnt",
    descricao: "documento de prova em ABNT, com a abertura inteira (capa, folha de rosto, resumos, sumário...)",
    codigo: () => codigo(documentoDeProva().documento, "abnt.txt", {}, { titulo: "Documento de prova" }),
  },
  {
    nome: "prova-apa",
    descricao: "documento de prova em APA (página de título e resumos; o resto da abertura não existe na APA)",
    codigo: () => codigo(documentoDeProva().documento, "apa.txt", {}, { titulo: "Documento de prova" }),
  },
  {
    nome: "prova-abnt-previa",
    descricao: "o mesmo da prova em ABNT, como a prévia monta (com as marcas de cada bloco)",
    codigo: () => codigo(documentoDeProva().documento, "abnt.txt", {}, { titulo: "Documento de prova", marcarBlocos: true }),
  },
  {
    nome: "artigo-univali-abnt",
    descricao: "artigo da UNIVALI (ABNT), sem abertura",
    codigo: () => {
      const { documento, trabalho } = artigo("univali-abnt");
      return codigo(documento, trabalho.norma, trabalho.ajustes, { titulo: trabalho.nome });
    },
  },
  {
    nome: "artigo-revista-apa",
    descricao: "artigo da Psicologia Política (APA), com as três escolhas de revista",
    codigo: () => {
      const { documento, trabalho } = artigo("revista-apa");
      return codigo(documento, trabalho.norma, trabalho.ajustes, { titulo: trabalho.nome });
    },
  },
  {
    nome: "tcc-abnt-faculdade",
    descricao: "TCC em ABNT com resumo em espanhol e valores de faculdade trocados (fonte, recuo, alinhamento, número embaixo...)",
    codigo: () =>
      codigo(
        provaComo((d) => ({
          ...d,
          dados: { ...d.dados, tipo: "tcc" },
          abertura: { ...d.abertura, resumos: [...d.abertura.resumos, resumoEmEspanhol] },
        })),
        "abnt.txt",
        {
          "Texto › fonte": "Arial",
          "Texto › recuo da primeira linha": "1,5 cm",
          "Texto › alinhamento": "à esquerda",
          "Página › Número da página › posição": "canto inferior direito",
          "Títulos › Nível 2 › destaque": "negrito, sublinhado",
          "Ilustrações › posição": "à esquerda",
          "Ilustrações › espaço antes e depois": "0 linha",
          "Citação longa › espaço antes e depois": "2 linhas",
          "Ilustrações › Tabela › entrelinha": "1,5",
          "Ilustrações › Tabela › posição das indicações": "à esquerda",
          "Abertura › Sumário › ligação até a página": "nenhuma",
          "Abertura › Folha de rosto › rótulo do orientador": "Orientadora:",
          "Abertura › Resumo › Palavras-chave › espaço antes": "0 linha",
          "referências, prenomes": "abreviados",
          "autores, quatro ou mais": "primeiro com et al.",
        },
        { titulo: "TCC de teste" },
      ),
  },
  {
    nome: "artigo-abnt-numero-no-centro",
    descricao: "artigo da UNIVALI (ABNT) com o número da página no centro, embaixo",
    codigo: () => {
      const { documento, trabalho } = artigo("univali-abnt");
      return codigo(documento, trabalho.norma, { "Página › Número da página › posição": "centro inferior" }, { titulo: trabalho.nome });
    },
  },
  {
    nome: "artigo-apa-sem-identificacao",
    descricao: "documento de prova como artigo APA (modo profissional), sem identificação, Arial 11 e tabela em espaço simples",
    codigo: () =>
      codigo(
        provaComo((d) => ({ ...d, dados: { ...d.dados, tipo: "artigo" }, abertura: { ...d.abertura, semIdentificacao: true } })),
        "apa.txt",
        {
          "Texto › fonte e tamanho": "Arial 11 pt",
          "Ilustrações › Tabela › entrelinha": "simples",
          "Página › Número da página › distância vertical": "1,5 cm",
          "referências, prenomes": "por extenso",
        },
        { titulo: "Artigo de teste" },
      ),
  },
  {
    nome: "excecoes-abnt",
    descricao:
      "artigo da UNIVALI (ABNT) com exceções “só este” em parágrafos e títulos (sem número, sem maiúsculas, página nova mesmo em artigo), um número escrito à mão e o Parágrafo à esquerda para todos (etapa 2)",
    codigo: () => {
      const { documento, trabalho } = artigo("univali-abnt");
      const doc = comExcecoes(documento, [
        { tipo: "titulo", nivel: 1, n: 0, excecoes: { posição: "centralizado", destaque: "itálico" } },
        { tipo: "titulo", nivel: 2, n: 1, excecoes: { destaque: "negrito, sublinhado" } },
        { tipo: "paragrafo", n: 1, excecoes: { alinhamento: "centralizado", entrelinha: "simples" } },
        { tipo: "paragrafo", n: 2, excecoes: { "recuo da primeira linha": "nenhum" } },
        { tipo: "paragrafo", n: 3, excecoes: { alinhamento: "justificado" } },
        { tipo: "paragrafo", n: 4, excecoes: { alinhamento: "à direita", entrelinha: "duplo" } },
        // 2b: títulos automáticos. "Metodologia" com o número escrito à mão (sai uma vez só, o do Apud).
        { tipo: "titulo", nivel: 1, n: 1, texto: "2 Metodologia" },
        { tipo: "titulo", nivel: 1, n: 2, excecoes: { "numerar sozinho": "não" } },
        { tipo: "titulo", nivel: 2, n: 0, excecoes: { "maiúsculas sozinho": "não" } },
        { tipo: "titulo", nivel: 1, n: 3, excecoes: { "página nova": "sim" } },
      ]);
      return codigo(doc, trabalho.norma, { ...trabalho.ajustes, "Parágrafo › alinhamento": "à esquerda" }, { titulo: trabalho.nome });
    },
  },
  {
    nome: "excecoes-apa",
    descricao: "documento de prova em APA com exceções: títulos de nível 4 (um deles na mesma linha do texto), título de nível 1 à esquerda e parágrafo sem recuo (etapa 2)",
    codigo: () =>
      codigo(
        comExcecoes(documentoDeProva().documento, [
          { tipo: "titulo", nivel: 4, n: 0, excecoes: { destaque: "itálico" } },
          { tipo: "titulo", nivel: 4, n: 1, excecoes: { destaque: "sublinhado" } },
          { tipo: "titulo", nivel: 1, n: 1, excecoes: { posição: "à esquerda" } },
          { tipo: "paragrafo", n: 0, excecoes: { "recuo da primeira linha": "nenhum" } },
        ]),
        "apa.txt",
        {},
        { titulo: "Documento de prova" },
      ),
  },
  {
    nome: "exemplo-universidade",
    descricao: "documento de prova com o modelo de exemplo de uma universidade (herda da ABNT)",
    codigo: () => codigo(documentoDeProva().documento, "abnt-universidade-exemplo.txt", {}, { titulo: "Documento de prova" }),
  },
];

/** O gabarito gravado de um caso, ou undefined se ainda não foi gravado. */
export function lerCodigoGravado(nome: string): string | undefined {
  try {
    return readFileSync(join(PASTA_DO_CODIGO, `${nome}.typ`), "utf8");
  } catch {
    return undefined;
  }
}

/** A primeira linha diferente entre dois códigos, para mostrar onde mudou. */
export function primeiraDiferenca(gravado: string, atual: string): string | undefined {
  if (gravado === atual) return undefined;
  const a = gravado.split("\n");
  const b = atual.split("\n");
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      const corte = (s: string | undefined) => (s === undefined ? "(fim)" : s.length > 200 ? `${s.slice(0, 200)}…` : s);
      return `linha ${i + 1}\n  gabarito: ${corte(a[i])}\n  agora:    ${corte(b[i])}`;
    }
  }
  return "só no fim do arquivo";
}
