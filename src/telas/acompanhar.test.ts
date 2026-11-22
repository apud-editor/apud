import { describe, expect, it } from "vitest";
import { alturaNaPrevia, lugarDoBloco, rolagemPara, type PosicaoDoBloco } from "./acompanhar";

const posicoes: PosicaoDoBloco[] = [
  [0, 1, 85],
  [1, 1, 300],
  [3, 2, 90],
  [6, 3, 120],
];

describe("prévia acompanhando o cursor", () => {
  it("acha a página e a altura do bloco do cursor", () => {
    expect(lugarDoBloco(posicoes, 0)).toEqual({ pagina: 1, y: 85 });
    expect(lugarDoBloco(posicoes, 3)).toEqual({ pagina: 2, y: 90 });
    expect(lugarDoBloco(posicoes, 6)).toEqual({ pagina: 3, y: 120 });
  });
  it("bloco sem marca (parágrafo vazio) fica onde está o último marcado antes dele", () => {
    expect(lugarDoBloco(posicoes, 2)).toEqual({ pagina: 1, y: 300 });
    expect(lugarDoBloco(posicoes, 10)).toEqual({ pagina: 3, y: 120 });
  });
  it("sem marcas, não acompanha", () => {
    expect(lugarDoBloco([], 3)).toBeNull();
  });
  it("antes do primeiro bloco marcado, vai para o primeiro", () => {
    expect(lugarDoBloco([[2, 4, 70]], 0)).toEqual({ pagina: 4, y: 70 });
  });
  it("soma as páginas de cima e os espaços entre elas", () => {
    expect(alturaNaPrevia([842, 842, 842], 16, 1, 85)).toBe(85);
    expect(alturaNaPrevia([842, 842, 842], 16, 3, 120)).toBe(842 + 16 + 842 + 16 + 120);
  });
  it("só rola quando o ponto não está à vista, e o põe a um terço da altura", () => {
    expect(rolagemPara(500, 300, 600)).toBeNull();
    expect(rolagemPara(1500, 300, 600)).toBe(1300);
    expect(rolagemPara(100, 900, 600)).toBe(0);
  });
});
