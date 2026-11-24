// Confere (ou grava) o gabarito do código Typst. Ver scripts/codigo-lib.ts.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CASOS, lerCodigoGravado, PASTA_DO_CODIGO, primeiraDiferenca } from "./codigo-lib";

const gravar = process.argv.includes("--gravar");
let algumaDiferenca = false;
mkdirSync(PASTA_DO_CODIGO, { recursive: true });

for (const caso of CASOS) {
  const atual = caso.codigo();
  if (gravar) {
    writeFileSync(join(PASTA_DO_CODIGO, `${caso.nome}.typ`), atual);
    console.log(`gravado: ${caso.nome}.typ (${caso.descricao})`);
    continue;
  }
  const gravado = lerCodigoGravado(caso.nome);
  if (gravado === undefined) {
    algumaDiferenca = true;
    console.log(`✗ ${caso.nome}: ainda não há gabarito (rode com --gravar)`);
    continue;
  }
  const diferenca = primeiraDiferenca(gravado, atual);
  if (diferenca) {
    algumaDiferenca = true;
    console.log(`✗ ${caso.nome}: o código mudou, ${diferenca}`);
  } else {
    console.log(`✓ ${caso.nome}: igual ao gabarito`);
  }
}

process.exit(algumaDiferenca ? 1 : 0);
