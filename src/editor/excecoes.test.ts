// As exceções "só este" no editor (etapa 2): vão e voltam com o TipTap sem mudar.

import { describe, expect, it } from "vitest";
import { getAttributesFromExtensions, getSchema, getSplittedAttributes, resolveExtensions } from "@tiptap/core";
import { Node as NoPM } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { ControleDaBarra, extensoesDoApud, limparExcecoes } from "./extensoes";
import { blocosDoEditor, editorDosBlocos } from "../documento/tiptap";
import type { Bloco } from "../documento/modelo";

const extensoes = extensoesDoApud(new ControleDaBarra());
const esquema = getSchema(extensoes);

describe("exceções no editor", () => {
  it("parágrafos e títulos levam as exceções e voltam iguais", () => {
    const blocos: Bloco[] = [
      { tipo: "titulo", nivel: 2, trechos: [{ texto: "Método" }], excecoes: { posição: "centralizado", destaque: "negrito" } },
      { tipo: "paragrafo", trechos: [{ texto: "Centralizado só aqui." }], excecoes: { alinhamento: "centralizado" } },
      { tipo: "paragrafo", trechos: [{ texto: "Sem exceção." }] },
      { tipo: "titulo", nivel: 1, trechos: [{ texto: "Resultados" }] },
    ];
    const doc = NoPM.fromJSON(esquema, editorDosBlocos(blocos));
    expect(blocosDoEditor(doc.toJSON())).toEqual(blocos);
  });

  it("o bloco com exceção é marcado para a tela; o sem exceção, não", () => {
    const doc = NoPM.fromJSON(esquema, editorDosBlocos([{ tipo: "paragrafo", trechos: [{ texto: "a" }], excecoes: { alinhamento: "centralizado" } }]));
    const p = doc.firstChild!;
    const [, atributos] = p.type.spec.toDOM!(p) as [string, Record<string, string>];
    expect(atributos).toHaveProperty("data-excecao");
    const semExcecao = esquema.nodes.paragraph.create();
    expect(semExcecao.type.spec.toDOM!(semExcecao)).not.toContainEqual(expect.objectContaining({ "data-excecao": "" }));
  });

  it("um bloco que muda de tipo fica só com as exceções que o elemento novo aceita", () => {
    const doc = NoPM.fromJSON(
      esquema,
      editorDosBlocos([{ tipo: "paragrafo", trechos: [{ texto: "vira título" }], excecoes: { entrelinha: "duplo", alinhamento: "centralizado" } }]),
    );
    const estado = EditorState.create({ doc, schema: esquema });
    const mudou = estado.tr.setNodeMarkup(0, esquema.nodes.heading, { level: 2, excecoes: { entrelinha: "duplo", alinhamento: "centralizado" } });
    const depois = estado.apply(mudou);
    const limpeza = limparExcecoes([mudou], depois);
    expect(limpeza).not.toBeNull();
    const final = depois.apply(limpeza!);
    expect(final.doc.firstChild!.attrs.excecoes).toBeNull();
    expect(blocosDoEditor(final.doc.toJSON())).toEqual([{ tipo: "titulo", nivel: 2, trechos: [{ texto: "vira título" }] }]);
    // Um bloco que só ganhou texto não tem o que limpar.
    expect(limparExcecoes([final.tr.insertText("!", 3)], final)).toBeNull();
  });

  it("Enter no fim do bloco não passa a exceção para o bloco novo", () => {
    const atributos = getAttributesFromExtensions(resolveExtensions(extensoes));
    expect(getSplittedAttributes(atributos, "paragraph", { excecoes: { alinhamento: "centralizado" } })).toEqual({});
    expect(getSplittedAttributes(atributos, "heading", { level: 2, excecoes: { destaque: "negrito" } })).toEqual({ level: 2 });
  });

  it("um nó com exceção vazia ou estragada vira um bloco sem exceções", () => {
    expect(blocosDoEditor({ type: "doc", content: [{ type: "paragraph", attrs: { excecoes: {} }, content: [{ type: "text", text: "a" }] }] })).toEqual([
      { tipo: "paragrafo", trechos: [{ texto: "a" }] },
    ]);
    expect(blocosDoEditor({ type: "doc", content: [{ type: "paragraph", attrs: { excecoes: "x" }, content: [{ type: "text", text: "a" }] }] })).toEqual([
      { tipo: "paragrafo", trechos: [{ texto: "a" }] },
    ]);
  });
});
