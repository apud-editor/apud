// Roda o documento de prova com os perfis ABNT e APA e compara com o gabarito.
//
// Uso:
//   npm run prova            confere e mostra só as diferenças
//   npm run prova -- --tudo  mostra também todas as chamadas e referências
//   npm run prova -- --gravar  grava a saída atual como gabarito. Use só
//                            depois de conferir que as diferenças estão certas.
//
// Também grava o PDF das chamadas e referências em perfis/prova/saida/.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { nomeCompleto } from "../src/perfis";
import { documentoParaTypst } from "../src/conversor/typst";
import { escreverArquivo } from "../src/arquivos/formato";
import {
  carregarNorma,
  carregarPerfil,
  compararComGabarito,
  documentoDeProva,
  escreverGabarito,
  gerarPdf,
  lerGabarito,
  PASTA_PROVA,
  rodarProva,
} from "./prova-lib";

const mostrarTudo = process.argv.includes("--tudo");
const gravar = process.argv.includes("--gravar");
const NORMAS = [
  { perfil: "abnt.txt", gabarito: "gabarito-abnt.txt", pdf: "prova-abnt.pdf" },
  { perfil: "apa.txt", gabarito: "gabarito-apa.txt", pdf: "prova-apa.pdf" },
];

let algumaDiferenca = false;
mkdirSync(join(PASTA_PROVA, "saida"), { recursive: true });

// O documento de prova como trabalho do Apud: dá para abrir no programa
// (copie para Documentos\Apud) e para ver a página inteira no PDF.
const { documento } = documentoDeProva();
const agora = new Date().toISOString();
writeFileSync(
  join(PASTA_PROVA, "saida", "documento-de-prova.apud"),
  escreverArquivo({
    nome: "Documento de prova",
    perfil: (({ perfil, versao, revisao }) => ({ perfil, versao, revisao }))(carregarPerfil("abnt.txt").perfil.identificacao),
    ajustes: {},
    criadoEm: agora,
    modificadoEm: agora,
    documento,
  }),
);
// A página inteira pelo conversor do Apud. A APA entra quando o conversor aplicar o perfil APA (fase 2, parte 3).
{
  const { perfil, csl } = carregarNorma("abnt.txt");
  const compilador = NodeCompiler.create({ fontArgs: [{ fontPaths: [join(import.meta.dirname, "..", "public", "fontes")] }] });
  const r = compilador.compile({ mainFileContent: documentoParaTypst(documento, perfil, { titulo: "Documento de prova", csl }) });
  if (!r.result) {
    r.printDiagnostics();
    throw new Error("o conversor não conseguiu montar o documento de prova");
  }
  writeFileSync(join(PASTA_PROVA, "saida", "documento-de-prova-abnt.pdf"), compilador.pdf(r.result));
  console.log("Documento de prova inteiro, pelo conversor: perfis/prova/saida/documento-de-prova-abnt.pdf");
}

for (const norma of NORMAS) {
  const resultado = rodarProva(norma.perfil);
  writeFileSync(join(PASTA_PROVA, "saida", norma.pdf), gerarPdf(resultado.typst));
  console.log(`\n=== ${norma.perfil} (PDF em perfis/prova/saida/${norma.pdf}) ===`);

  if (mostrarTudo || !existsSync(join(PASTA_PROVA, norma.gabarito))) {
    console.log("\n== Chamadas ==");
    for (const c of resultado.chamadas) console.log(`${c.escrita}  →  ${c.saida}`);
    console.log("\n== Referências ==");
    for (const r of resultado.referencias) console.log(r);
  }
  if (gravar) {
    const nome = nomeCompleto(carregarPerfil(norma.perfil).perfil.identificacao);
    writeFileSync(join(PASTA_PROVA, norma.gabarito), escreverGabarito(resultado, nome));
    console.log(`\n${norma.gabarito} gravado com a saída atual (${nome}).`);
    continue;
  }
  if (!existsSync(join(PASTA_PROVA, norma.gabarito))) {
    console.log(`\n(sem ${norma.gabarito} para comparar)`);
    continue;
  }
  const diferencas = compararComGabarito(resultado, lerGabarito(norma.gabarito));
  if (diferencas.length) {
    algumaDiferenca = true;
    console.log(`\n✗ ${diferencas.length} diferença(s) em relação a ${norma.gabarito}:`);
    for (const d of diferencas) console.log(`  ${d}`);
  } else {
    console.log(`\n✓ igual ao ${norma.gabarito}: ${resultado.chamadas.length} chamadas e ${resultado.referencias.length} referências.`);
  }
}

process.exit(algumaDiferenca ? 1 : 0);
