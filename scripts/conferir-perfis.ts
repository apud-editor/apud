// Confere todos os perfis da pasta perfis/ e mostra os erros em português.
// Uso: npm run conferir-perfis
// Termina com erro (código 1) se algum perfil tiver erro, para o GitHub avisar.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { conferirPerfis, formatarMensagem, nomeCompleto, type Arquivo } from "../src/perfis";

const PASTA = join(import.meta.dirname, "..", "perfis");

function lerPasta(pasta: string, extensao: string): Arquivo[] {
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta, { encoding: "utf8" })
    .filter((nome) => nome.endsWith(extensao))
    .sort()
    .map((nome) => ({
      nome: relative(PASTA, join(pasta, nome)).replaceAll("\\", "/"),
      conteudo: readFileSync(join(pasta, nome), "utf8"),
    }));
}

// Os perfis ficam na pasta perfis/; os exemplos de perfil personalizado, em perfis/exemplos/.
const perfis = [...lerPasta(PASTA, ".txt"), ...lerPasta(join(PASTA, "exemplos"), ".txt")];
const estilos = lerPasta(join(PASTA, "estilos"), ".csl");
let algumErro = false;

for (const resultado of conferirPerfis(perfis, estilos)) {
  const erros = resultado.mensagens.filter((m) => m.gravidade === "erro");
  const avisos = resultado.mensagens.filter((m) => m.gravidade === "aviso");
  if (erros.length) algumErro = true;

  const titulo = resultado.perfil ? nomeCompleto(resultado.perfil.identificacao) : "não pode ser usado";
  const estado = erros.length ? `✗ ${erros.length} erro(s)` : "✓ sem erros";
  console.log(`\nperfis/${resultado.arquivo} (${titulo}): ${estado}${avisos.length ? `, ${avisos.length} aviso(s)` : ""}`);
  for (const m of [...erros, ...avisos]) console.log(`  ${formatarMensagem(m)}`);
}

console.log(algumErro ? "\nHá perfis com erro. Eles não serão usados até serem corrigidos." : "\nTodos os perfis estão certos.");
process.exit(algumErro ? 1 : 0);
