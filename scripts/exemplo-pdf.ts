// Gera o PDF de um texto de exemplo com o modelo ABNT, para conferir a
// paginação. Uso: npm run exemplo-pdf  (o PDF fica em testes/prova/saida/)

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { carregarPerfil, PASTA_PROVA } from "./prova-lib";
import { documentoParaTypst } from "../src/conversor/typst";
import { TEXTO_DE_EXEMPLO } from "../src/conversor/exemplo";

const { modelo } = carregarPerfil("abnt.txt");
const typst = documentoParaTypst(TEXTO_DE_EXEMPLO, modelo, { titulo: "Texto de exemplo" });
const compilador = NodeCompiler.create({ fontArgs: [{ fontPaths: [join(import.meta.dirname, "..", "public", "fontes")] }] });
const r = compilador.compile({ mainFileContent: typst });
if (!r.result) {
  r.printDiagnostics();
  process.exit(1);
}
const saida = join(PASTA_PROVA, "saida");
mkdirSync(saida, { recursive: true });
writeFileSync(join(saida, "exemplo-abnt.typ"), typst);
writeFileSync(join(saida, "exemplo-abnt.pdf"), compilador.pdf(r.result));
console.log(`PDF gerado: ${join(saida, "exemplo-abnt.pdf")}`);
