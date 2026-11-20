import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { paraHayagriva, dataDoTypst } from "./hayagriva";
import { conferirReferencia } from "../arquivos/formato";
import { TIPOS_DE_REFERENCIA, type Referencia } from "../documento/modelo";

const PASTA = join(import.meta.dirname, "..", "..", "perfis", "prova");
const doApud = JSON.parse(readFileSync(join(PASTA, "referencias.json"), "utf8")) as Referencia[];

describe("referências do Apud para o Typst", () => {
  // As referências do documento de prova saem certas na lista (gabaritos de
  // perfis/prova). Aqui fica conferido o caminho até o Typst, campo por campo,
  // em alguns tipos.
  it("o documento de prova tem as 27 referências, dos 10 tipos", () => {
    expect(doApud).toHaveLength(27);
    expect(new Set(doApud.map((r) => r.tipo))).toEqual(new Set(TIPOS_DE_REFERENCIA));
  });

  it("cada referência passa na conferência do arquivo .apud sem mudar nada", () => {
    for (const r of doApud) expect(conferirReferencia(r)).toEqual(r);
  });

  const porId = (id: string) => paraHayagriva(doApud.find((r) => r.id === id)!);

  it("capítulo: o livro, os organizadores e a editora vão para a obra maior", () => {
    expect(porId("costa2021")).toEqual({
      type: "chapter",
      title: "O acolhimento no serviço de saúde mental",
      author: ["Costa, Helena"],
      date: 2021,
      "page-range": "9-30",
      parent: {
        type: "anthology",
        title: "Psicologia e saúde coletiva",
        subtitle: "práticas no SUS",
        editor: ["Melo, Rui", "Nunes, Sara"],
        publisher: { name: "Artmed", location: "Porto Alegre" },
      },
    });
  });

  it("artigo: revista com cidade, volume e número; DOI, endereço e acesso", () => {
    expect(porId("dias2025")).toEqual({
      type: "article",
      title: "Vínculo terapêutico na atenção psicossocial",
      author: ["Dias, Eva", "Lopes, Ivo"],
      date: "2025-03",
      "page-range": "1-15",
      "serial-number": { doi: "10.0000/pe.2025.0102" },
      url: { value: "https://doi.org/10.0000/pe.2025.0102", date: "2025-05-15" },
      parent: { type: "periodical", title: "Psicologia em Estudo", location: "Maringá", volume: 10, issue: 2 },
    });
  });

  it("instituição como autora, trabalho em evento e rede social", () => {
    expect(porId("abep2023").author).toEqual([{ name: "Associação Brasileira de Ensino de Psicologia" }]);
    expect(porId("teles2024")).toMatchObject({
      type: "article",
      event: { name: "Seminário de Políticas Públicas", number: 20, date: 2024, location: "Diamantina" },
      parent: { type: "proceedings", title: "Anais do Seminário de Políticas Públicas" },
    });
    expect(porId("prado2025")).toMatchObject({ type: "post", handle: "@juprado", genre: "Vídeo", parent: { type: "web", title: "Instagram" } });
  });

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
