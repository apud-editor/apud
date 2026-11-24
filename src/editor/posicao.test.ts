import { describe, expect, it } from "vitest";
import { ondeFica } from "./posicao";

describe("onde a janelinha do cursor fica", () => {
  const p = { x: 300, y: 200, acima: 180 };
  it("cabendo, fica embaixo da linha", () => {
    expect(ondeFica(p, 380, 150, 1280, 900)).toEqual({ x: 300, y: 200 });
  });
  it("perto do fim da janela, sobe para cima da linha", () => {
    expect(ondeFica({ x: 300, y: 850, acima: 830 }, 380, 150, 1280, 900)).toEqual({ x: 300, y: 680 });
  });
  it("perto da lateral, volta para dentro da tela", () => {
    expect(ondeFica({ ...p, x: 1200 }, 380, 150, 1280, 900).x).toBe(1280 - 380 - 8);
  });
  it("nunca sai por cima", () => {
    expect(ondeFica({ x: 10, y: 20, acima: 10 }, 380, 2000, 1280, 900).y).toBe(8);
  });
});
