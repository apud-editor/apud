// O trabalho de teste do Apud: um TCC em ABNT com todos os elementos que o
// Apud tem, para testar cada etapa no programa (pedido do Francisco, 24/11/2026).
//
//   npm run trabalho-de-teste
//
// Grava testes/trabalho-de-teste/saida/Trabalho de teste do Apud.apud, que se
// abre no Apud (no Windows: copie para Documentos\Apud). O texto está em
// testes/trabalho-de-teste/trabalho.md; as obras são as do documento de prova.
// Quando o formato do .apud ou os modelos mudarem, rode de novo.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { escreverArquivo, lerArquivo, type Trabalho } from "../src/arquivos/formato";
import type { Bloco, Documento, Marca, Referencia, Trecho } from "../src/documento/modelo";
import { conferirExcecoes, elementoDoBloco } from "../src/modelos/excecoes";
import { carregarModelo, documentoDoTexto, PASTA_PROVA, PASTA_TESTES } from "./prova-lib";

export const PASTA_DO_TRABALHO = join(PASTA_TESTES, "trabalho-de-teste");
export const NOME_DO_TRABALHO = "Trabalho de teste do Apud";

/** **negrito**, *itálico* e ^sobrescrito^ num trecho de texto viram trechos com marcas. */
function comMarcas(t: Trecho): Trecho[] {
  if (!("texto" in t)) return [t];
  const partes: Trecho[] = [];
  let resto = t.texto;
  const marca = /\*\*([^*]+)\*\*|\*([^*]+)\*|\^([^^\s]+)\^/;
  for (let m = resto.match(marca); m; m = resto.match(marca)) {
    if (m.index) partes.push({ ...t, texto: resto.slice(0, m.index) });
    const nova: Marca = m[1] ? "negrito" : m[2] ? "italico" : "sobrescrito";
    partes.push({ texto: m[1] ?? m[2] ?? m[3], marcas: [...new Set([...(t.marcas ?? []), nova])] });
    resto = resto.slice(m.index! + m[0].length);
  }
  if (resto) partes.push({ ...t, texto: resto });
  return partes;
}

/** "{só este: alinhamento = centralizado; entrelinha = simples}" no fim do texto vira exceções do bloco. */
function tirarExcecoes(b: Bloco): Bloco {
  if (b.tipo !== "paragrafo" && b.tipo !== "titulo" && b.tipo !== "citacaoLonga") return b;
  const ultimo = b.trechos[b.trechos.length - 1];
  const m = ultimo && "texto" in ultimo ? ultimo.texto.match(/\s*\{só este:([^}]*)\}\s*$/) : null;
  if (!m) return b;
  const pedidas = Object.fromEntries(m[1].split(";").map((p) => p.split("=").map((x) => x.trim()) as [string, string]));
  const elemento = elementoDoBloco(b)!;
  const c = conferirExcecoes(elemento, pedidas);
  if (!c.ok) throw new Error(`exceção errada em “${JSON.stringify(b.trechos[0])}”: ${c.erro}`);
  const texto = (ultimo as { texto: string }).texto.slice(0, m.index);
  const trechos = [...b.trechos.slice(0, -1), ...(texto ? [{ ...ultimo, texto }] : [])];
  return { ...b, trechos, ...(c.excecoes ? { excecoes: c.excecoes } : {}) };
}

/** A tabela de várias páginas: uma linha por semana do estágio. */
function tabelaLonga(): Bloco {
  const t = (texto: string) => [{ texto }];
  const linhas = [[t("Semana"), t("Período"), t("Acolhimentos"), t("Encaminhamentos")]];
  for (let s = 1; s <= 40; s++) {
    const inicio = new Date(Date.UTC(2026, 2, 2 + (s - 1) * 7));
    const fim = new Date(inicio.getTime() + 4 * 86400000);
    const data = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    linhas.push([t(String(s)), t(`${data(inicio)} a ${data(fim)}`), t(String(6 + ((s * 7) % 9))), t(String(1 + ((s * 5) % 4)))]);
  }
  return { tipo: "tabela", linhas, cabecalho: 1, titulo: t("Acolhimentos e encaminhamentos por semana de estágio"), fonte: t("Registro do serviço (2026)") };
}

/** O documento do trabalho de teste. */
export function documentoDeTeste(): Documento {
  const referencias = JSON.parse(readFileSync(join(PASTA_PROVA, "referencias.json"), "utf8")) as Referencia[];
  const { documento } = documentoDoTexto(readFileSync(join(PASTA_DO_TRABALHO, "trabalho.md"), "utf8"), referencias, PASTA_DO_TRABALHO);
  const { dados, abertura } = JSON.parse(readFileSync(join(PASTA_DO_TRABALHO, "abertura.json"), "utf8")) as Pick<Documento, "dados" | "abertura">;
  const blocos = documento.blocos.map((b): Bloco => {
    if (b.tipo === "paragrafo" && b.trechos.length === 1 && "texto" in b.trechos[0] && b.trechos[0].texto === "[[tabela longa]]") return tabelaLonga();
    const sem = tirarExcecoes(b);
    if (sem.tipo === "paragrafo" || sem.tipo === "titulo") return { ...sem, trechos: sem.trechos.flatMap(comMarcas) };
    if (sem.tipo === "lista") return { ...sem, itens: sem.itens.map((i) => ({ ...i, trechos: i.trechos.flatMap(comMarcas) })) };
    return sem;
  });
  return { ...documento, dados, abertura, blocos };
}

/** O trabalho inteiro, com a cópia do modelo ABNT que vem no Apud. */
export function trabalhoDeTeste(): Trabalho {
  return {
    nome: NOME_DO_TRABALHO,
    modelo: carregarModelo("abnt.txt"),
    ajustes: {},
    criadoEm: "2026-11-24T12:00:00.000Z",
    modificadoEm: "2026-11-24T12:00:00.000Z",
    documento: documentoDeTeste(),
  };
}

if (process.argv[1]?.endsWith("trabalho-de-teste.ts")) {
  const texto = escreverArquivo(trabalhoDeTeste());
  // Confere que o Apud abre o arquivo antes de gravar.
  const lido = lerArquivo(texto);
  if (!lido.ok) throw new Error(`o Apud não abriria o trabalho de teste: ${lido.erro}`);
  const saida = join(PASTA_DO_TRABALHO, "saida");
  mkdirSync(saida, { recursive: true });
  const arquivo = join(saida, `${NOME_DO_TRABALHO}.apud`);
  writeFileSync(arquivo, texto);
  const blocos = lido.trabalho.documento.blocos;
  console.log(`✓ ${arquivo}`);
  console.log(`  ${blocos.length} blocos, ${lido.trabalho.documento.referencias.length} obras, ${lido.trabalho.documento.imagens.length} imagens.`);
}
