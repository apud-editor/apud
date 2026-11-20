import { describe, expect, it } from "vitest";
import { buscarBlocos } from "./blocos";
import { paragrafosColados } from "./extensoes";

describe("colar sem formatação", () => {
  it("cada linha do Word vira um parágrafo, sem linhas vazias nem espaços sobrando", () => {
    expect(paragrafosColados("Primeiro  parágrafo\r\n\r\n\tSegundo parágrafo \r\n")).toEqual([
      "Primeiro parágrafo",
      "Segundo parágrafo",
    ]);
  });

  it("texto vazio não vira nada", () => {
    expect(paragrafosColados(" \n \n")).toEqual([]);
  });
});

describe("barra /", () => {
  it("acha blocos sem acento e sem maiúscula", () => {
    expect(buscarBlocos("titulo").map((t) => t.rotulo)).toEqual(["Título 1", "Título 2", "Título 3", "Título 4", "Título 5"]);
    expect(buscarBlocos("t3").map((t) => t.rotulo)).toEqual(["Título 3"]);
    expect(buscarBlocos("alinea").map((t) => t.rotulo)).toEqual(["Lista"]);
    expect(buscarBlocos("").length).toBe(8);
  });
});
