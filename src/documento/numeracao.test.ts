import { describe, expect, it } from "vitest";
import { avisosDeNumeracao, type EntradaDaEstrutura } from "./estrutura";

const t = (texto: string, indice: number, nivel: 1 | 2 | 3 = 1): EntradaDaEstrutura => ({ indice, nivel, texto });
const avisos = (...textos: string[]) => avisosDeNumeracao(textos.map((x, i) => t(x, i)));

describe("avisos de número de título fora de ordem", () => {
  it("sequência certa não avisa", () => {
    expect(avisos("1 Introdução", "1.1 Contexto", "1.2 Objetivo", "1.2.1 Geral", "2 Método", "2.1 Participantes", "3 Resultados").size).toBe(0);
  });
  it("título sem número é ignorado", () => {
    expect(avisos("RESUMO", "1 Introdução", "Considerações", "2 Método").size).toBe(0);
  });
  it("aceita o ponto depois do número", () => {
    expect(avisos("1. Introdução", "2. Método").size).toBe(0);
  });
  it("número que pula avisa e diz o que viria", () => {
    const a = avisos("1 Introdução", "3 Método");
    expect(a.get(1)).toBe("O número 3 está fora de ordem: depois do 1 viria 2 ou 1.1.");
  });
  it("número repetido avisa", () => {
    expect(avisos("1 A", "2 B", "2 C").get(2)).toContain("fora de ordem");
  });
  it("subtítulo que pula nível avisa", () => {
    expect(avisos("1 A", "1.1.1 B").get(1)).toContain("fora de ordem");
  });
  it("o primeiro numerado deve ser o 1", () => {
    expect(avisos("2 Introdução").get(0)).toBe("O primeiro título numerado deveria ser o 1, e não o 2.");
  });
  it("um engano gera um aviso só: a conferência segue do número escrito", () => {
    const a = avisos("1 A", "3 B", "4 C", "5 D");
    expect([...a.keys()]).toEqual([1]);
  });
  it("a lista de referências não conta", () => {
    expect(avisosDeNumeracao([t("1 A", 0), { indice: 1, nivel: 1, texto: "", referencias: true }, t("2 B", 2)]).size).toBe(0);
  });
});
