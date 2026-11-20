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
    expect(buscarBlocos("").length).toBe(9);
    expect(buscarBlocos("quebra").map((t) => t.rotulo)).toEqual(["Quebra de página"]);
    expect(buscarBlocos("pagina").map((t) => t.rotulo)).toEqual(["Quebra de página"]);
  });
});

describe("citações no editor", () => {
  it("o editor aceita a citação em parágrafos, títulos e listas, e devolve os dados sem mudar nada", async () => {
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
    ];
    // fromJSON confere o conteúdo contra o esquema do editor: um nó que ele não aceitasse daria erro aqui.
    const no = NoPM.fromJSON(esquema, editorDosBlocos(blocos));
    no.check();
    expect(blocosDoEditor(no.toJSON())).toEqual(blocos);
  });
});
