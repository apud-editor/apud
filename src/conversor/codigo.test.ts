// O conversor escreve o mesmo código Typst que o gabarito (perfis/prova/codigo).
// Na etapa 1 da versão 2, os perfis viram modelos em árvore, e o PDF não pode
// mudar: código igual, letra por letra, dá PDF igual. Ver scripts/codigo-lib.ts.

import { describe, expect, it } from "vitest";
import { CASOS, lerCodigoGravado, primeiraDiferenca } from "../../scripts/codigo-lib";

describe("gabarito do código Typst", () => {
  for (const caso of CASOS) {
    it(`${caso.nome}: ${caso.descricao}`, () => {
      const gravado = lerCodigoGravado(caso.nome);
      expect(gravado, `falta perfis/prova/codigo/${caso.nome}.typ (npm run codigo -- --gravar)`).toBeDefined();
      expect(primeiraDiferenca(gravado!, caso.codigo())).toBeUndefined();
    });
  }
});
