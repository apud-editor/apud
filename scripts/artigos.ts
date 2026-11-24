// Os artigos de teste: trabalhos reais montados no Apud, para a conferência
// final de cada fase. Cada pasta de testes/artigos tem:
//   artigo.md          o texto, com as citações na forma curta do documento de prova
//   referencias.json   as fontes, no formato do .apud
//   trabalho.json      o nome, a norma ("abnt.txt" ou "apa.txt") e as escolhas do autor
//   original-*.txt     como as citações e a lista saíram no original (para comparar)
//   gabarito-*.txt     como o Apud deve montar, já conferido (os testes usam)
//
// Uso:
//   npm run artigos              monta, compara com o gabarito e mostra as diferenças do original
//   npm run artigos -- --gravar  grava a saída atual como gabarito. Use só depois
//                                de conferir as diferenças e explicá-las em diferencas.md.
//
// Grava, para cada artigo, o .apud na própria pasta (para abrir no programa) e o
// PDF em testes/artigos/saida/. Depois compara com o original e mostra cada
// diferença. O original não é gabarito (ele tem erros): as diferenças são
// explicadas em diferencas.md, na pasta do artigo.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { documentoParaTypst } from "../src/conversor/typst";
import { escreverArquivo } from "../src/arquivos/formato";
import type { Referencia } from "../src/documento/modelo";
import { carregarNorma, compararComGabarito, documentoDoTexto, lerGabarito, mapearImagens, PASTA_TESTES, rodarTrabalho } from "./prova-lib";

const PASTA = join(PASTA_TESTES, "artigos");
const SAIDA = join(PASTA, "saida");
mkdirSync(SAIDA, { recursive: true });

const gravar = process.argv.includes("--gravar");
let algumaDiferenca = false;

interface Trabalho {
  nome: string;
  arquivo: string;
  norma: string;
  original: string;
  gabarito: string;
  ajustes?: Record<string, string>;
}

/** Sem marcas, acentos e caixa, para achar a mesma obra nas duas listas. */
const chave = (r: string) =>
  r
    .replace(/\*/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(" ");

const compilador = NodeCompiler.create({ fontArgs: [{ fontPaths: [join(import.meta.dirname, "..", "public", "fontes")] }] });

for (const pasta of readdirSync(PASTA, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== "saida")) {
  const dir = join(PASTA, pasta.name);
  const trabalho = JSON.parse(readFileSync(join(dir, "trabalho.json"), "utf8")) as Trabalho;
  const referencias = JSON.parse(readFileSync(join(dir, "referencias.json"), "utf8")) as Referencia[];
  const lido = documentoDoTexto(readFileSync(join(dir, "artigo.md"), "utf8"), referencias);
  const norma = carregarNorma(trabalho.norma, trabalho.ajustes ?? {});
  const { identificacao: id } = norma.perfil;

  // O .apud, para abrir no programa (copie para Documentos\Apud).
  const agora = "2026-11-20T00:00:00.000Z";
  writeFileSync(
    join(dir, trabalho.arquivo),
    escreverArquivo({
      nome: trabalho.nome,
      // A cópia do modelo, sem as escolhas (elas ficam em ajustes).
      modelo: carregarNorma(trabalho.norma).modelo,
      ajustes: trabalho.ajustes ? { [id.perfil]: trabalho.ajustes } : {},
      criadoEm: agora,
      modificadoEm: agora,
      documento: lido.documento,
    }),
  );

  // O PDF inteiro, pelo conversor do Apud.
  const pdf = join(SAIDA, `${pasta.name}.pdf`);
  mapearImagens(compilador, lido.documento);
  const r = compilador.compile({ mainFileContent: documentoParaTypst(lido.documento, norma.modelo, { titulo: trabalho.nome, csl: norma.csl }) });
  if (!r.result) {
    r.printDiagnostics();
    throw new Error(`o conversor não conseguiu montar ${pasta.name}`);
  }
  writeFileSync(pdf, compilador.pdf(r.result));

  // As chamadas e a lista como o Apud monta, e a comparação com o original.
  const resultado = rodarTrabalho(lido, norma);
  const linhas: string[] = [`# ${trabalho.nome}: como o Apud monta (${id.perfil} ${id.versao}, revisão ${id.revisao})`, "", "== Chamadas =="];
  const vistas = new Set<string>();
  for (const c of resultado.chamadas) if (!vistas.has(c.escrita) && vistas.add(c.escrita)) linhas.push(`${c.escrita}  →  ${c.saida}`);
  linhas.push("", "== Referências ==", ...resultado.referencias, "", "== Avisos do motor ==", ...new Set(resultado.avisos), "");
  writeFileSync(join(SAIDA, `${pasta.name}.txt`), linhas.join("\n"));
  if (gravar) writeFileSync(join(dir, trabalho.gabarito), linhas.join("\n"));

  console.log(`\n=== ${trabalho.nome} ===`);
  console.log(`.apud: testes/artigos/${pasta.name}/${trabalho.arquivo}`);
  console.log(`PDF:   testes/artigos/saida/${pasta.name}.pdf`);
  console.log(`${vistas.size} chamadas diferentes, ${resultado.referencias.length} referências, ${new Set(resultado.avisos).size} avisos`);
  if (existsSync(join(dir, trabalho.gabarito))) {
    const diferencas = compararComGabarito(resultado, lerGabarito(trabalho.gabarito, dir)).filter((d, i, todas) => todas.indexOf(d) === i);
    if (diferencas.length) {
      algumaDiferenca = true;
      console.log(`\n✗ ${diferencas.length} diferença(s) em relação a ${trabalho.gabarito}:`);
      for (const d of diferencas) console.log(`  ${d}`);
    } else console.log(`✓ igual ao ${trabalho.gabarito}`);
  }
  if (!existsSync(join(dir, trabalho.original))) continue;

  const original = lerGabarito(trabalho.original, dir);
  console.log(`\n-- Chamadas diferentes do original --`);
  for (const c of resultado.chamadas.filter((c, i, todas) => todas.findIndex((x) => x.escrita === c.escrita) === i)) {
    const antes = original.chamadas.get(c.escrita);
    if (antes !== c.saida) console.log(`${c.escrita}\n    original: ${antes ?? "(não está)"}\n    Apud:     ${c.saida}`);
  }
  console.log(`\n-- Referências diferentes do original --`);
  const doOriginal = new Map(original.referencias.map((x, i) => [chave(x), { texto: x, posicao: i + 1 }]));
  const doApud = new Map(resultado.referencias.map((x, i) => [chave(x), { texto: x, posicao: i + 1 }]));
  for (const [k, a] of doApud) {
    const o = doOriginal.get(k);
    if (!o) console.log(`só no Apud: ${a.texto}`);
    else if (o.texto !== a.texto) console.log(`${a.posicao}.\n    original: ${o.texto}\n    Apud:     ${a.texto}`);
  }
  for (const [k, o] of doOriginal) if (!doApud.has(k)) console.log(`só no original: ${o.texto}`);
  const ordemOriginal = [...doOriginal.keys()].filter((k) => doApud.has(k));
  const ordemApud = [...doApud.keys()].filter((k) => doOriginal.has(k));
  ordemApud.forEach((k, i) => {
    if (ordemOriginal[i] !== k) console.log(`ordem: na posição ${i + 1}, o Apud põe "${doApud.get(k)!.texto.slice(0, 40)}…" e o original "${doOriginal.get(ordemOriginal[i])!.texto.slice(0, 40)}…"`);
  });
  console.log(`\n-- Avisos do motor --`);
  for (const a of new Set(resultado.avisos)) console.log(a);
}

process.exit(algumaDiferenca ? 1 : 0);
