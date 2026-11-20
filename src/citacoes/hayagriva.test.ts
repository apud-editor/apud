import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as lerYaml } from "yaml";
import { paraHayagriva, dataDoTypst } from "./hayagriva";
import { conferirReferencia } from "../arquivos/formato";
import { TIPOS_DE_REFERENCIA, type Referencia } from "../documento/modelo";

const PASTA = join(import.meta.dirname, "..", "..", "perfis", "prova");
const doApud = JSON.parse(readFileSync(join(PASTA, "referencias.json"), "utf8")) as Referencia[];
const doTypst = lerYaml(readFileSync(join(PASTA, "referencias.yml"), "utf8")) as Record<string, Record<string, unknown>>;

/** No arquivo de teste, um autor sozinho às vezes vem fora da lista; o Typst aceita as duas formas. */
function emLista(ref: Record<string, unknown>): Record<string, unknown> {
  const r = structuredClone(ref);
  for (const alvo of [r, r.parent as Record<string, unknown> | undefined]) {
    for (const papel of ["author", "editor"]) {
      if (alvo && alvo[papel] !== undefined && !Array.isArray(alvo[papel])) alvo[papel] = [alvo[papel]];
    }
  }
  return r;
}

describe("referências do Apud para o Typst", () => {
  it("o modelo do Apud guarda as 27 referências do documento de prova, dos 10 tipos", () => {
    expect(doApud.map((r) => r.id)).toEqual(Object.keys(doTypst));
    expect(new Set(doApud.map((r) => r.tipo))).toEqual(new Set(TIPOS_DE_REFERENCIA));
  });

  it("cada referência passa na conferência do arquivo .apud sem mudar nada", () => {
    for (const r of doApud) expect(conferirReferencia(r)).toEqual(r);
  });

  for (const ref of doApud) {
    it(`${ref.id} (${ref.tipo}) vira exatamente a referência que o Typst já monta certo`, () => {
      expect(paraHayagriva(ref)).toEqual(emLista(doTypst[ref.id]));
    });
  }

  it("datas: só o ano, com mês e com dia", () => {
    expect(dataDoTypst({ ano: 2019 })).toBe(2019);
    expect(dataDoTypst({ ano: 2025, mes: 3 })).toBe("2025-03");
    expect(dataDoTypst({ ano: 2024, mes: 7, dia: 3 })).toBe("2024-07-03");
  });

  it("relatório com número na série e DOI guarda os dois", () => {
    const r: Referencia = { id: "r1", tipo: "relatorio", autores: [], titulo: "T", serie: "Nota Técnica", numeroNaSerie: "7", doi: "10.1/x" };
    expect(paraHayagriva(r)["serial-number"]).toEqual({ serial: "7", doi: "10.1/x" });
  });
});
