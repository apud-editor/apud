// A norma de um trabalho (versão 2, etapa 1c): o modelo com as escolhas do
// trabalho por cima, as regras de citação para o motor e o estilo CSL.

import { describe, expect, it } from "vitest";
import { carregarModelo, carregarNorma } from "../../scripts/prova-lib";
import { aplicarAjustes } from "./ajustes";
import { modeloEmbutido, normaEmbutida, normasEmbutidas, perfilEmbutido } from "./embutidos";
import { valorEfetivo } from "./herdar";
import { nomeDoModelo } from "./norma";

const texto = (m: ReturnType<typeof carregarModelo>, el: string, prop: string) => valorEfetivo(m, el, prop)?.texto;

describe("escolhas do trabalho por cima do modelo", () => {
  const abnt = carregarModelo("abnt.txt");
  const apa = carregarModelo("apa.txt");

  it("uma regra ajustável muda só neste trabalho, com a mesma situação", () => {
    const { modelo, mensagens } = aplicarAjustes(abnt, { "família da fonte": "Arial", "título nível 2, destaque": "negrito, sublinhado" });
    expect(mensagens).toEqual([]);
    expect(valorEfetivo(modelo!, "paragrafo", "fonte")).toMatchObject({ texto: "Arial", origem: "configurações do trabalho", de: "este trabalho", situacao: { tipo: "faculdade" } });
    expect(texto(modelo!, "titulos.nivel2", "destaque")).toBe("negrito, sublinhado");
    // O modelo de entrada não muda.
    expect(texto(abnt, "paragrafo", "fonte")).toBe("Times New Roman");
  });

  it("uma escolha de citação vai para Citações e referências, e a ponte a entrega ao motor", () => {
    const norma = carregarNorma("abnt.txt", { "referências, prenomes": "abreviados" });
    expect(norma.perfil.regras.get("referências, prenomes")?.texto).toBe("abreviados");
    expect(norma.csl).not.toBe(carregarNorma("abnt.txt").csl);
  });

  it("na APA, a fonte é escolhida em par (fonte e tamanho)", () => {
    const { modelo } = aplicarAjustes(apa, { fonte: "Arial 11 pt" });
    expect(texto(modelo!, "texto", "fonte")).toBe("Arial");
    expect(texto(modelo!, "pagina.numero", "tamanho")).toBe("11 pt");
    expect(modelo!.atalhos.get("texto")?.get("fonte e tamanho")?.texto).toBe("Arial 11 pt");
    expect(aplicarAjustes(apa, { fonte: "Arial 12 pt" }).mensagens.map((m) => m.texto)).toEqual([
      "“fonte”: escolha uma das opções: “Times New Roman 12 pt”, “Arial 11 pt”, “Calibri 11 pt”, “Georgia 11 pt” e “Aptos 12 pt”.",
    ]);
  });

  it("recusa regra fixa, regra que não existe e valor fora do tipo, e aí não aplica nada", () => {
    const r = aplicarAjustes(abnt, { entrelinhas: "duplo", "regra inventada": "x", "recuo de parágrafo": "muito", "família da fonte": "Arial" });
    expect(r.modelo).toBeUndefined();
    expect(r.mensagens.map((m) => m.texto)).toEqual([
      "“entrelinhas”: essa regra é fixa na norma e não pode ser trocada nas configurações do trabalho.",
      "“regra inventada”: essa regra não existe no modelo.",
      expect.stringMatching(/^“recuo de parágrafo”: .*precisa ser/),
    ]);
  });

  it("na APA, a fonte sozinha não se troca: só o par fonte e tamanho", () => {
    expect(aplicarAjustes(apa, { "família da fonte": "Arial" }).mensagens.map((m) => m.texto)).toEqual([
      "“família da fonte”: essa regra é fixa na norma e não pode ser trocada nas configurações do trabalho.",
    ]);
  });
});

describe("modelos que vêm no programa", () => {
  it("as normas são ABNT e APA (o Em branco ainda não aparece)", () => {
    expect(normasEmbutidas().sort()).toEqual(["ABNT", "APA"]);
  });

  it("a norma embutida tem o modelo, as regras de citação e o CSL; escolhas com erro voltam como problemas", () => {
    const n = normaEmbutida("ABNT", { "referências, prenomes": "abreviados" });
    expect(n.problemas).toEqual([]);
    expect(nomeDoModelo(n.modelo)).toBe("ABNT 2025, revisão 10");
    expect(n.perfil.identificacao).toMatchObject({ perfil: "ABNT", norma: "ABNT", versao: "2025", revisao: 10 });
    expect(n.csl).toContain("<style");
    const errada = normaEmbutida("APA", { "referências, prenomes": "talvez" });
    expect(errada.problemas).toHaveLength(1);
    expect(errada.perfil.regras.get("referências, prenomes")?.texto).toBe("iniciais");
    expect(perfilEmbutido("APA").regras.get("citação, rótulo de várias páginas")?.texto).toBe("pp.");
    expect(() => modeloEmbutido("Vancouver")).toThrow("o Apud não tem o modelo Vancouver");
  });
});
