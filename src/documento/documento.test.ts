import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import type { Documento } from "./modelo";
import { documentoDoEditor, editorDoDocumento } from "./tiptap";
import { estrutura } from "./estrutura";

const exemplo: Documento = {
  versao: 1,
  blocos: [
    { tipo: "titulo", nivel: 1, trechos: [{ texto: "Introdução" }] },
    {
      tipo: "paragrafo",
      trechos: [
        { texto: "O conceito de " },
        { texto: "setting", marcas: ["italico"] },
        { texto: " aparece no século XX" },
        { texto: "1", marcas: ["sobrescrito"] },
        { texto: "." },
      ],
    },
    { tipo: "titulo", nivel: 2, trechos: [{ texto: "Contexto do estágio" }] },
    {
      tipo: "lista",
      sequencia: false,
      itens: [
        { trechos: [{ texto: "acolhimento" }] },
        { trechos: [{ texto: "grupos" }], subitens: [{ trechos: [{ texto: "terapêuticos", marcas: ["negrito", "italico"] }] }] },
      ],
    },
    { tipo: "titulo", nivel: 1, trechos: [{ texto: "Desenvolvimento" }] },
    { tipo: "titulo", nivel: 2, trechos: [{ texto: "Nota sem número" }], numerado: false },
    { tipo: "lista", sequencia: true, itens: [{ trechos: [{ texto: "primeiro passo" }] }] },
    { tipo: "paragrafo", trechos: [] },
  ],
};

describe("conversão entre o Apud e o editor", () => {
  it("ida e volta não muda nada", () => {
    expect(documentoDoEditor(editorDoDocumento(exemplo))).toEqual(exemplo);
  });

  it("marcas sempre na mesma ordem e trechos vizinhos iguais juntos", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "a", marks: [{ type: "italic" }, { type: "bold" }] },
            { type: "text", text: "b", marks: [{ type: "bold" }, { type: "italic" }] },
            { type: "text", text: "c" },
          ],
        },
      ],
    };
    expect(documentoDoEditor(json).blocos).toEqual([
      { tipo: "paragrafo", trechos: [{ texto: "ab", marcas: ["negrito", "italico"] }, { texto: "c" }] },
    ]);
  });

  it("nunca perde texto de algo que o modelo não conhece", () => {
    const json: JSONContent = {
      type: "doc",
      content: [{ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "citação" }] }] }],
    };
    expect(documentoDoEditor(json).blocos).toEqual([{ tipo: "paragrafo", trechos: [{ texto: "citação" }] }]);
  });

  it("item de lista com dois parágrafos vira um só, sem perder texto", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "um" }] },
                { type: "paragraph", content: [{ type: "text", text: "dois" }] },
              ],
            },
          ],
        },
      ],
    };
    expect(documentoDoEditor(json).blocos).toEqual([
      { tipo: "lista", sequencia: false, itens: [{ trechos: [{ texto: "um dois" }] }] },
    ]);
  });

  it("documento vazio vira um parágrafo vazio", () => {
    expect(documentoDoEditor({ type: "doc" }).blocos).toEqual([{ tipo: "paragrafo", trechos: [] }]);
  });
});

describe("estrutura", () => {
  it("numera os títulos como a ABNT", () => {
    expect(estrutura(exemplo.blocos).map((e) => `${e.numero} ${e.texto}`)).toEqual([
      "1 Introdução",
      "1.1 Contexto do estágio",
      "2 Desenvolvimento",
      " Nota sem número",
    ]);
  });

  it("título sem número não conta na numeração dos seguintes", () => {
    const blocos: Documento["blocos"] = [
      { tipo: "titulo", nivel: 1, trechos: [{ texto: "Resumo" }], numerado: false },
      { tipo: "titulo", nivel: 1, trechos: [{ texto: "Introdução" }] },
      { tipo: "titulo", nivel: 2, trechos: [{ texto: "Sem" }], numerado: false },
      { tipo: "titulo", nivel: 2, trechos: [{ texto: "Contexto" }] },
    ];
    expect(estrutura(blocos).map((e) => e.numero)).toEqual(["", "1", "", "1.1"]);
  });

  it("mostra 0 no nível que foi pulado", () => {
    const blocos: Documento["blocos"] = [
      { tipo: "titulo", nivel: 1, trechos: [{ texto: "A" }] },
      { tipo: "titulo", nivel: 3, trechos: [{ texto: "B" }] },
    ];
    expect(estrutura(blocos).map((e) => e.numero)).toEqual(["1", "1.0.1"]);
  });

  it("sem numeração, quando a norma não numera", () => {
    expect(estrutura(exemplo.blocos, false).every((e) => e.numero === "")).toBe(true);
  });
});
