// O "só este" e o "todos os iguais" (etapa 2 da v2).

import { describe, expect, it } from "vitest";
import { carregarModelo } from "../../scripts/prova-lib";
import { aplicarAjustes } from "./ajustes";
import {
  chaveDaEscolha,
  conferirExcecoes,
  deOndeVemNoBloco,
  descreverProcedencia,
  elementoDoBloco,
  mudarSoEste,
  mudarTodos,
  propriedadesComExcecao,
  tirarExcecao,
  valorNoBloco,
} from "./excecoes";

const abnt = carregarModelo("abnt.txt");
const apa = carregarModelo("apa.txt");

describe("o elemento de cada bloco", () => {
  it("parágrafo e título aceitam exceções; os outros blocos, ainda não", () => {
    expect(elementoDoBloco({ tipo: "paragrafo", trechos: [] })).toBe("paragrafo");
    expect(elementoDoBloco({ tipo: "titulo", nivel: 3, trechos: [] })).toBe("titulos.nivel3");
    expect(elementoDoBloco({ tipo: "quebra" })).toBeUndefined();
    expect(elementoDoBloco({ tipo: "citacaoLonga", trechos: [] })).toBeUndefined();
    expect(propriedadesComExcecao("paragrafo")).toEqual(["entrelinha", "alinhamento", "recuo da primeira linha"]);
    expect(propriedadesComExcecao("titulos.nivel2")).toEqual(["destaque", "posição"]);
    expect(propriedadesComExcecao("listas")).toEqual([]);
  });
});

describe("conferir as exceções que vêm do arquivo", () => {
  it("lê pelo tipo e escreve do jeito do Apud", () => {
    expect(conferirExcecoes("paragrafo", { Alinhamento: "Centralizado", entrelinha: "1.5" })).toEqual({
      ok: true,
      excecoes: { alinhamento: "centralizado", entrelinha: "1,5" },
    });
    expect(conferirExcecoes("titulos.nivel1", { destaque: "itálico, negrito" })).toEqual({ ok: true, excecoes: { destaque: "negrito, itálico" } });
    expect(conferirExcecoes("paragrafo", {})).toEqual({ ok: true });
  });

  it("recusa propriedade que não pode ser exceção, valor fora do tipo e lixo", () => {
    expect(conferirExcecoes("paragrafo", { fonte: "Arial" })).toEqual({ ok: false, erro: "“fonte” não pode ser uma exceção de Parágrafo" });
    expect(conferirExcecoes("paragrafo", { alinhamento: "torto" })).toMatchObject({ ok: false });
    expect(conferirExcecoes("titulos.nivel1", { destaque: 3 })).toEqual({ ok: false, erro: "a exceção “destaque” está estragada" });
    expect(conferirExcecoes("paragrafo", ["alinhamento"])).toEqual({ ok: false, erro: "as exceções do bloco estão estragadas" });
  });
});

describe("a herança: exceção do bloco, senão o elemento, senão o de cima", () => {
  it("sem exceção, vale o elemento ou o de cima", () => {
    expect(valorNoBloco(abnt, "paragrafo", "alinhamento")?.texto).toBe("justificado");
    expect(deOndeVemNoBloco(abnt, "paragrafo", "alinhamento")).toEqual({ tipo: "elemento", elemento: "texto", de: "ABNT" });
    expect(valorNoBloco(abnt, "titulos.nivel1", "destaque")?.texto).toBe("maiúsculas, negrito");
    expect(deOndeVemNoBloco(abnt, "titulos.nivel1", "destaque")).toEqual({ tipo: "elemento", elemento: "titulos.nivel1", de: "ABNT" });
  });

  it("com exceção, vale a do bloco, que diz de onde vem", () => {
    const ex = { alinhamento: "centralizado" };
    expect(valorNoBloco(abnt, "paragrafo", "alinhamento", ex)).toMatchObject({ texto: "centralizado", origem: "só este", de: "este bloco" });
    expect(valorNoBloco(abnt, "paragrafo", "entrelinha", ex)?.texto).toBe("1,5");
    expect(deOndeVemNoBloco(abnt, "paragrafo", "alinhamento", ex)).toEqual({ tipo: "bloco" });
  });

  it("um recuo “como no texto” na exceção vira o recuo do Texto", () => {
    expect(valorNoBloco(abnt, "paragrafo", "recuo da primeira linha", { "recuo da primeira linha": "como no texto" })?.texto).toBe("1,25 cm");
  });

  it("a escolha do trabalho fica entre o modelo e a exceção", () => {
    const { modelo } = aplicarAjustes(abnt, { "Parágrafo › alinhamento": "à esquerda" });
    expect(valorNoBloco(modelo!, "paragrafo", "alinhamento")?.texto).toBe("à esquerda");
    expect(deOndeVemNoBloco(modelo!, "paragrafo", "alinhamento")).toEqual({ tipo: "elemento", elemento: "paragrafo", de: "este trabalho" });
    expect(valorNoBloco(modelo!, "paragrafo", "alinhamento", { alinhamento: "centralizado" })?.texto).toBe("centralizado");
  });

  it("em palavras, para a janelinha", () => {
    expect(descreverProcedencia({ tipo: "bloco" }, "título")).toBe("Só neste título");
    expect(descreverProcedencia({ tipo: "elemento", elemento: "texto", de: "ABNT" }, "parágrafo")).toBe("Do modelo ABNT (Texto)");
    expect(descreverProcedencia({ tipo: "elemento", elemento: "paragrafo", de: "este trabalho" }, "parágrafo")).toBe("Deste trabalho (Parágrafo)");
  });
});

describe("só este", () => {
  it("põe a exceção e avisa quando o valor fixo da norma muda", () => {
    expect(mudarSoEste(abnt, "paragrafo", undefined, "alinhamento", "centralizado")).toEqual({ ok: true, resultado: { alinhamento: "centralizado" } });
    const r = mudarSoEste(abnt, "paragrafo", { alinhamento: "centralizado" }, "entrelinha", "1");
    expect(r).toEqual({
      ok: true,
      resultado: { alinhamento: "centralizado", entrelinha: "simples" },
      aviso: "A ABNT pede “1,5” (NBR 14724:2024 (UFV 2026)). Com “simples”, o trabalho sai da norma neste ponto.",
    });
  });

  it("um valor igual ao do elemento tira a exceção, em vez de guardar uma que não muda nada", () => {
    expect(mudarSoEste(abnt, "paragrafo", { alinhamento: "centralizado" }, "alinhamento", "justificado")).toEqual({ ok: true, resultado: undefined });
    expect(mudarSoEste(abnt, "titulos.nivel1", { destaque: "negrito", posição: "centralizado" }, "destaque", "negrito, maiúsculas")).toEqual({
      ok: true,
      resultado: { posição: "centralizado" },
    });
  });

  it("recusa o que não pode ser exceção e o valor fora do tipo", () => {
    expect(mudarSoEste(abnt, "paragrafo", undefined, "fonte", "Arial")).toEqual({
      ok: false,
      erro: "Só este: dá para mudar “entrelinha”, “alinhamento” e “recuo da primeira linha”.",
    });
    expect(mudarSoEste(abnt, "listas", undefined, "alinhamento", "centralizado")).toEqual({ ok: false, erro: "Listas ainda não aceita “só este”." });
    expect(mudarSoEste(abnt, "paragrafo", undefined, "alinhamento", "torto")).toMatchObject({ ok: false });
  });

  it("voltar ao do modelo tira só a exceção pedida", () => {
    expect(tirarExcecao({ alinhamento: "centralizado", entrelinha: "duplo" }, "Alinhamento")).toEqual({ entrelinha: "duplo" });
    expect(tirarExcecao({ alinhamento: "centralizado" }, "alinhamento")).toBeUndefined();
    expect(tirarExcecao(undefined, "alinhamento")).toBeUndefined();
  });
});

describe("todos os iguais", () => {
  it("vai para as escolhas do trabalho pelo caminho do elemento", () => {
    expect(chaveDaEscolha("paragrafo", "alinhamento")).toBe("Parágrafo › alinhamento");
    expect(chaveDaEscolha("titulos.nivel2", "destaque")).toBe("Títulos › Nível 2 › destaque");
    const r = mudarTodos(abnt, { "referências, prenomes": "abreviados" }, "titulos.nivel2", "destaque", "negrito");
    expect(r).toEqual({ ok: true, resultado: { "referências, prenomes": "abreviados", "Títulos › Nível 2 › destaque": "negrito" } });
    // E o trabalho passa a usar a escolha.
    expect(valorNoBloco(aplicarAjustes(abnt, (r as { resultado: Record<string, string> }).resultado).modelo!, "titulos.nivel2", "destaque")?.texto).toBe("negrito");
  });

  it("avisa ao mudar um valor fixo pela norma, e o valor do modelo apaga a escolha", () => {
    expect(mudarTodos(apa, {}, "paragrafo", "entrelinha", "1,5")).toEqual({
      ok: true,
      resultado: { "Parágrafo › entrelinha": "1,5" },
      aviso: expect.stringMatching(/^A APA pede “duplo”/),
    });
    expect(mudarTodos(apa, { "Parágrafo › entrelinha": "1,5" }, "paragrafo", "entrelinha", "duplo")).toEqual({ ok: true, resultado: {} });
  });

  it("o Em branco não é norma: mudar um valor dele não tem aviso", () => {
    const branco = carregarModelo("em-branco.txt");
    expect(mudarTodos(branco, {}, "paragrafo", "entrelinha", "duplo")).toEqual({ ok: true, resultado: { "Parágrafo › entrelinha": "duplo" } });
  });
});
