// Os títulos automáticos (etapa 2 da v2): numeração, maiúsculas e página nova.

import { describe, expect, it } from "vitest";
import { carregarModelo } from "../../scripts/prova-lib";
import { aplicarAjustes } from "./ajustes";
import { comecaEmPaginaNova, formaDosTitulos, numeroEscritoNoTitulo, vaiEmMaiusculas } from "./titulos";

const abnt = carregarModelo("abnt.txt");
const apa = carregarModelo("apa.txt");
const branco = carregarModelo("em-branco.txt");
const niveis = (...n: Array<1 | 2 | 3 | 4 | 5>) => n.map((nivel) => ({ nivel }));

describe("numeração", () => {
  it("a ABNT numera 1, 1.1, 1.1.1 e zera os de baixo a cada nível de cima", () => {
    expect(formaDosTitulos(abnt, niveis(1, 2, 2, 3, 1, 2), "tcc").map((f) => f.numero)).toEqual(["1", "1.1", "1.2", "1.2.1", "2", "2.1"]);
  });

  it("a APA e o Em branco não numeram", () => {
    expect(formaDosTitulos(apa, niveis(1, 2), "artigo").map((f) => f.numero)).toEqual([undefined, undefined]);
    expect(formaDosTitulos(branco, niveis(1, 2), "tcc").map((f) => f.numero)).toEqual([undefined, undefined]);
  });

  it("um título “só este: sem número” não gasta número", () => {
    const formas = formaDosTitulos(abnt, [{ nivel: 1 }, { nivel: 1, excecoes: { "numerar sozinho": "não" } }, { nivel: 1 }], "tcc");
    expect(formas.map((f) => f.numero)).toEqual(["1", undefined, "2"]);
  });

  it("um nível pulado sai com zero, como no Word, e diz qual nível faltou", () => {
    const formas = formaDosTitulos(abnt, niveis(1, 3, 2), "tcc");
    expect(formas.map((f) => f.numero)).toEqual(["1", "1.0.1", "1.1"]);
    expect(formas[1].nivelPulado).toBe(2);
    expect(formaDosTitulos(abnt, niveis(2), "tcc")[0]).toMatchObject({ numero: "0.1", nivelPulado: 1 });
  });

  it("uma escolha do trabalho desliga a numeração em tudo", () => {
    const semNumero = aplicarAjustes(abnt, { "Títulos › numerar sozinho": "não" }).modelo!;
    expect(formaDosTitulos(semNumero, niveis(1, 2), "tcc").map((f) => f.numero)).toEqual([undefined, undefined]);
  });
});

describe("página nova", () => {
  it("na ABNT, o nível 1 começa em página nova, menos em artigo", () => {
    expect(comecaEmPaginaNova(abnt, 1, "tcc")).toBe(true);
    expect(comecaEmPaginaNova(abnt, 1, "artigo")).toBe(false);
    expect(comecaEmPaginaNova(abnt, 2, "tcc")).toBe(false);
    expect(comecaEmPaginaNova(abnt, 1, "tcc", { "página nova": "não" })).toBe(false);
    expect(comecaEmPaginaNova(abnt, 1, "artigo", { "página nova": "sim" })).toBe(true);
    expect(comecaEmPaginaNova(apa, 1, "tcc")).toBe(false);
  });
});

describe("maiúsculas", () => {
  it("na ABNT, os níveis 1 e 2 vão em maiúsculas; o 3, não; um título pode desligar", () => {
    expect([1, 2, 3].map((n) => vaiEmMaiusculas(abnt, n as 1 | 2 | 3))).toEqual([true, true, false]);
    expect(vaiEmMaiusculas(abnt, 1, { "maiúsculas sozinho": "não" })).toBe(false);
    // Com o destaque sem maiúsculas, não há o que pôr em maiúsculas.
    expect(vaiEmMaiusculas(abnt, 1, { destaque: "negrito" })).toBe(false);
    expect(vaiEmMaiusculas(apa, 1)).toBe(false);
  });
});

describe("número escrito à mão", () => {
  it("só conta como número de seção partes de 1 ou 2 algarismos", () => {
    expect(numeroEscritoNoTitulo("1.1 Contexto")).toEqual({ numero: "1.1", resto: "Contexto" });
    expect(numeroEscritoNoTitulo("2. Método")).toEqual({ numero: "2.", resto: "Método" });
    expect(numeroEscritoNoTitulo("10.2.3 Algo")).toEqual({ numero: "10.2.3", resto: "Algo" });
    expect(numeroEscritoNoTitulo("1964 e o golpe")).toBeUndefined();
    expect(numeroEscritoNoTitulo("Introdução")).toBeUndefined();
    expect(numeroEscritoNoTitulo("3")).toBeUndefined();
  });
});
