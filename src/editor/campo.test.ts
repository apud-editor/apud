import { describe, expect, it } from "vitest";
import type { TrechoDeTexto } from "../documento/modelo";
import { campoParaParagrafos, paragrafosParaCampo } from "./campo";

const ida = (p: TrechoDeTexto[][], unico = false) => campoParaParagrafos(paragrafosParaCampo(p), unico);

describe("campo de texto da abertura", () => {
  it("ida e volta mantém negrito, itálico e sobrescrito", () => {
    const p: TrechoDeTexto[][] = [[{ texto: "Um " }, { texto: "forte", marcas: ["negrito"] }, { texto: " e " }, { texto: "m2", marcas: ["italico", "sobrescrito"] }], [{ texto: "Outro parágrafo." }]];
    expect(ida(p)).toEqual(p);
  });

  it("campo vazio não vira parágrafo", () => {
    expect(ida([])).toEqual([]);
    expect(ida([[{ texto: "  " }]])).toEqual([]);
  });

  it("com 'unico', os parágrafos se juntam num só", () => {
    expect(ida([[{ texto: "Um." }], [{ texto: "Dois.", marcas: ["negrito"] }]], true)).toEqual([[{ texto: "Um. " }, { texto: "Dois.", marcas: ["negrito"] }]]);
  });
});
