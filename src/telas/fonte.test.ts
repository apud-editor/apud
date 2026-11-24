import { describe, expect, it } from "vitest";
import { avisoDeFonte } from "./fonte";

describe("aviso de fonte faltando", () => {
  it("Times New Roman faltando: avisa com a reserva", () => {
    expect(avisoDeFonte("Times New Roman", ["arial.ttf"], true)).toBe(
      "A Times New Roman não foi encontrada neste computador. A prévia e o PDF usam a Liberation Serif, que tem as mesmas medidas.",
    );
  });
  it("Arial faltando: avisa com a Liberation Sans", () => {
    expect(avisoDeFonte("Arial", ["times.ttf"], true)).toContain("A Arial não foi encontrada");
    expect(avisoDeFonte("arial", [], true)).toContain("Liberation Sans");
  });
  it("fonte instalada: não avisa", () => {
    expect(avisoDeFonte("Times New Roman", ["times.ttf"], true)).toBeNull();
    expect(avisoDeFonte("Arial", ["arial.ttf"], true)).toBeNull();
  });
  it("no navegador, ou fonte sem reserva própria: não avisa", () => {
    expect(avisoDeFonte("Times New Roman", [], false)).toBeNull();
    expect(avisoDeFonte("Aptos", [], true)).toBeNull();
    expect(avisoDeFonte(undefined, [], true)).toBeNull();
  });
});
