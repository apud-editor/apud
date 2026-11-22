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
    expect(buscarBlocos("").length).toBe(14);
    expect(buscarBlocos("bibliografia").map((t) => t.rotulo)).toEqual(["Lista de referências"]);
    expect(buscarBlocos("referencias").map((t) => t.rotulo)).toEqual(["Lista de referências"]);
    expect(buscarBlocos("quebra").map((t) => t.rotulo)).toEqual(["Quebra de página"]);
    expect(buscarBlocos("pagina").map((t) => t.rotulo)).toEqual(["Quebra de página"]);
  });
});

describe("citações no editor", () => {
  it("o editor aceita a citação em parágrafos, títulos e listas, e o bloco da lista de referências, sem mudar nada", async () => {
    const { getSchema } = await import("@tiptap/core");
    const { Node: NoPM } = await import("@tiptap/pm/model");
    const { ControleDaBarra, extensoesDoApud } = await import("./extensoes");
    const { blocosDoEditor, editorDosBlocos } = await import("../documento/tiptap");
    const esquema = getSchema(extensoesDoApud(new ControleDaBarra()));
    const citacao = { tipo: "parenteses" as const, direta: true, obras: [{ referencia: "r1", localizador: { tipo: "pagina" as const, valor: "15" } }] };
    const blocos = [
      { tipo: "paragrafo" as const, trechos: [{ texto: "antes " }, { citacao }, { texto: " depois", marcas: ["italico" as const] }] },
      { tipo: "titulo" as const, nivel: 2 as const, trechos: [{ citacao }] },
      { tipo: "lista" as const, sequencia: false, itens: [{ trechos: [{ citacao }], subitens: [{ trechos: [{ texto: "b " }, { citacao }] }] }] },
      { tipo: "referencias" as const },
    ];
    // fromJSON confere o conteúdo contra o esquema do editor: um nó que ele não aceitasse daria erro aqui.
    const no = NoPM.fromJSON(esquema, editorDosBlocos(blocos));
    no.check();
    expect(blocosDoEditor(no.toJSON())).toEqual(blocos);
  });
});

describe("blocos da fase 3 no editor", () => {
  it("o editor aceita citação longa, nota, figura e tabela, e devolve tudo igual", async () => {
    const { getSchema } = await import("@tiptap/core");
    const { Node: NoPM } = await import("@tiptap/pm/model");
    const { ControleDaBarra, extensoesDoApud } = await import("./extensoes");
    const { blocosDoEditor, editorDosBlocos } = await import("../documento/tiptap");
    const esquema = getSchema(extensoesDoApud(new ControleDaBarra()));
    const citacao = { tipo: "narrativa" as const, obra: { referencia: "r1" } };
    const nota = { nota: { trechos: [{ texto: "Texto da " }, { texto: "nota", marcas: ["italico" as const] }] } };
    const blocos = [
      { tipo: "paragrafo" as const, trechos: [{ texto: "antes" }, nota, { texto: " depois" }] },
      { tipo: "citacaoLonga" as const, trechos: [{ texto: "trecho longo " }, { citacao }, nota] },
      {
        tipo: "figura" as const,
        imagem: "abc",
        especie: "quadro" as const,
        largura: 50,
        titulo: [{ texto: "Título " }, { texto: "em itálico", marcas: ["italico" as const] }],
        fonte: [{ citacao }],
        fontePropria: true as const,
        nota: [{ texto: "Legenda." }],
      },
      {
        tipo: "tabela" as const,
        titulo: [{ texto: "Tabela" }],
        cabecalho: 1,
        linhas: [
          [[{ texto: "A" }], [{ texto: "B" }]],
          [[{ texto: "1" }, { citacao }], []],
        ],
        fonte: [{ texto: "IBGE" }],
      },
      { tipo: "lista" as const, sequencia: false, itens: [{ trechos: [{ texto: "item" }, nota] }] },
      { tipo: "titulo" as const, nivel: 1 as const, trechos: [{ texto: "1 Título" }, nota] },
    ];
    // fromJSON + check conferem o conteúdo contra o esquema do editor: um nó que ele não aceitasse daria erro aqui.
    const no = NoPM.fromJSON(esquema, editorDosBlocos(blocos));
    no.check();
    expect(blocosDoEditor(no.toJSON())).toEqual(blocos);
  });

  it("a grade da tabela não entra solta no texto, fora do bloco Tabela", async () => {
    const { getSchema } = await import("@tiptap/core");
    const { Node: NoPM } = await import("@tiptap/pm/model");
    const { ControleDaBarra, extensoesDoApud } = await import("./extensoes");
    const esquema = getSchema(extensoesDoApud(new ControleDaBarra()));
    const solta = {
      type: "doc",
      content: [{ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph" }] }] }] }],
    };
    expect(() => NoPM.fromJSON(esquema, solta).check()).toThrow();
  });
});
