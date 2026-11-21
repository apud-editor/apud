import { describe, expect, it } from "vitest";
import type { Referencia } from "../documento/modelo";
import { acharPorDoi, enderecoDoDoi, normalizarDoi } from "./doi";

describe("normalizarDoi: o DOI colado de qualquer jeito vira o código limpo", () => {
  it("aceita o código puro e o deixa em minúsculas", () => {
    expect(normalizarDoi("10.1037/0033-295x.84.2.191")).toBe("10.1037/0033-295x.84.2.191");
    expect(normalizarDoi("10.1590/S0102-311X2019000100001")).toBe("10.1590/s0102-311x2019000100001");
  });

  it("tira https://doi.org/, http://dx.doi.org/ e doi.org/", () => {
    expect(normalizarDoi("https://doi.org/10.1037/ABC.123")).toBe("10.1037/abc.123");
    expect(normalizarDoi("HTTPS://DOI.ORG/10.1037/abc.123")).toBe("10.1037/abc.123");
    expect(normalizarDoi("http://dx.doi.org/10.1037/abc.123")).toBe("10.1037/abc.123");
    expect(normalizarDoi("doi.org/10.1037/abc.123")).toBe("10.1037/abc.123");
  });

  it("tira o 'doi:' (com ou sem espaço, qualquer caixa) e um 'DOI ' escrito por extenso", () => {
    expect(normalizarDoi("doi:10.1037/abc.123")).toBe("10.1037/abc.123");
    expect(normalizarDoi("DOI: 10.1037/abc.123")).toBe("10.1037/abc.123");
    expect(normalizarDoi("doi 10.1037/abc.123")).toBe("10.1037/abc.123");
  });

  it("tira espaços e quebras de linha das pontas", () => {
    expect(normalizarDoi("  \n 10.1037/abc.123 \t")).toBe("10.1037/abc.123");
    expect(normalizarDoi("  https://doi.org/10.1037/abc.123  ")).toBe("10.1037/abc.123");
  });

  it("tira a pontuação da frase que ficou no fim", () => {
    expect(normalizarDoi("10.1037/abc.123.")).toBe("10.1037/abc.123");
    expect(normalizarDoi("https://doi.org/10.1037/abc.123,")).toBe("10.1037/abc.123");
    expect(normalizarDoi("10.1037/abc.123;")).toBe("10.1037/abc.123");
  });

  it("desfaz a codificação do endereço copiado do navegador", () => {
    expect(normalizarDoi("https://doi.org/10.1037%2Fabc.123")).toBe("10.1037/abc.123");
    expect(normalizarDoi("https://doi.org/10.1002/(SICI)1097-0258(19980815%2F30)17:15%2F16%3C1661::AID-SIM968%3E3.0.CO;2-2")).toBe(
      "10.1002/(sici)1097-0258(19980815/30)17:15/16<1661::aid-sim968>3.0.co;2-2",
    );
  });

  it("mantém parênteses, dois-pontos e ponto e vírgula do meio do DOI", () => {
    expect(normalizarDoi("10.1016/S0140-6736(20)30183-5")).toBe("10.1016/s0140-6736(20)30183-5");
  });

  it("aceita o registrante com subdivisão (10.1000.10/...)", () => {
    expect(normalizarDoi("10.1000.10/abc")).toBe("10.1000.10/abc");
  });

  it("recusa o que não é um DOI", () => {
    for (const ruim of ["", "   ", "abc", "10.1037", "10.1037/", "10.12/abc", "11.1037/abc", "https://exemplo.com/artigo", "10.1037/abc def", "doi:", "%E0%A4%A"]) {
      expect(normalizarDoi(ruim), ruim).toBeNull();
    }
    expect(normalizarDoi(undefined)).toBeNull();
    expect(normalizarDoi(null)).toBeNull();
  });

  it("não quebra com '%' que não é código", () => {
    expect(normalizarDoi("10.1037/abc%zz")).toBe("10.1037/abc%zz");
  });

  it("normalizar duas vezes dá o mesmo resultado", () => {
    const uma = normalizarDoi("https://doi.org/10.1037/ABC.123.");
    expect(normalizarDoi(uma)).toBe(uma);
  });
});

describe("enderecoDoDoi", () => {
  it("é o link do doi.org", () => {
    expect(enderecoDoDoi("10.1037/abc.123")).toBe("https://doi.org/10.1037/abc.123");
  });
});

describe("acharPorDoi: fonte repetida", () => {
  const ref = (id: string, doi?: string): Referencia => ({ id, tipo: "artigo", autores: [], titulo: id, ...(doi && { doi }) });
  const fontes = [ref("a"), ref("b", "https://doi.org/10.1037/ABC.123"), ref("c", "10.5555/outro")];

  it("acha pelo código, mesmo que a fonte guarde o DOI em outra forma", () => {
    expect(acharPorDoi(fontes, "10.1037/abc.123")?.id).toBe("b");
    expect(acharPorDoi(fontes, "DOI:10.1037/ABC.123")?.id).toBe("b");
    expect(acharPorDoi(fontes, "10.5555/OUTRO")?.id).toBe("c");
  });

  it("não acha o que não está, nem com DOI inválido", () => {
    expect(acharPorDoi(fontes, "10.9999/nada")).toBeUndefined();
    expect(acharPorDoi(fontes, "isso não é doi")).toBeUndefined();
    expect(acharPorDoi([], "10.1037/abc.123")).toBeUndefined();
  });

  it("fontes sem DOI nunca batem", () => {
    expect(acharPorDoi([ref("a")], "10.1037/abc.123")).toBeUndefined();
  });
});
