import { describe, expect, it } from "vitest";
import { destinoDoTab, paradasDoTab, type ItemDeFoco } from "./foco";

const campo: ItemDeFoco = {};
const radio = (grupo: string, marcado = false): ItemDeFoco => ({ radio: { grupo, marcado } });

describe("Tab preso na janela do @", () => {
  it("campos e botões: todos são paradas", () => {
    expect(paradasDoTab([campo, campo, campo])).toEqual([0, 1, 2]);
  });

  it("grupo de opções: o Tab para só na opção marcada", () => {
    // Indireta / Direta / Apud, com Direta marcada, depois dois campos.
    expect(paradasDoTab([radio("forma"), radio("forma", true), radio("forma"), campo, campo])).toEqual([1, 3, 4]);
  });

  it("grupo sem opção marcada: para na primeira", () => {
    expect(paradasDoTab([campo, radio("forma"), radio("forma"), campo])).toEqual([0, 1, 3]);
  });

  it("dois grupos diferentes contam separados", () => {
    expect(paradasDoTab([radio("a", true), radio("a"), radio("b"), radio("b", true)])).toEqual([0, 3]);
  });

  it("no meio da janela, o navegador segue sozinho", () => {
    expect(destinoDoTab([0, 1, 2], 1, false)).toBeNull();
    expect(destinoDoTab([0, 1, 2], 1, true)).toBeNull();
  });

  it("Tab no último volta para o primeiro; Shift+Tab no primeiro vai para o último", () => {
    expect(destinoDoTab([1, 3, 4], 4, false)).toBe(1);
    expect(destinoDoTab([1, 3, 4], 1, true)).toBe(4);
  });

  it("foco fora da janela (no texto de trás) volta para dentro", () => {
    expect(destinoDoTab([1, 3, 4], -1, false)).toBe(1);
    expect(destinoDoTab([1, 3, 4], -1, true)).toBe(4);
  });

  it("janela sem nada para focar: não mexe", () => {
    expect(destinoDoTab([], -1, false)).toBeNull();
  });
});
