// Confere os modelos da pasta modelos/ (e os exemplos) e mostra os problemas
// em português, com o número da linha. Uso: npm run conferir-modelos

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { conferirModelos, type Arquivo } from "../src/modelos/conferir";
import { formatarMensagem } from "../src/perfis/tipos";

const PASTA = join(import.meta.dirname, "..", "modelos");

const lerPasta = (pasta: string, prefixo = ""): Arquivo[] =>
  readdirSync(pasta)
    .filter((n) => n.endsWith(".txt"))
    .map((nome) => ({ nome: prefixo + nome, conteudo: readFileSync(join(pasta, nome), "utf8") }));

let exemplos: Arquivo[] = [];
try {
  exemplos = lerPasta(join(PASTA, "exemplos"), "exemplos/");
} catch {
  // A pasta de exemplos é opcional.
}

let comErro = false;
for (const r of conferirModelos([...lerPasta(PASTA), ...exemplos])) {
  const nome = r.resolvido ? `${r.arquivo} (${r.resolvido.cadeia.map((c) => `${c.nome}, revisão ${c.revisao}`).join(" › ")})` : r.arquivo;
  const erros = r.mensagens.filter((m) => m.gravidade === "erro");
  if (erros.length || !r.resolvido) comErro = true;
  console.log(`\n${nome}: ${erros.length ? `✗ ${erros.length} erro(s)` : "✓ sem erros"}`);
  for (const m of r.mensagens) console.log(`  ${formatarMensagem(m)}`);
}
console.log(comErro ? "\nHá modelos com erros." : "\nTodos os modelos estão certos.");
process.exit(comErro ? 1 : 0);
