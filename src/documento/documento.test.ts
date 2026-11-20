import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import type { Documento } from "./modelo";
import { documentoDoEditor, editorDoDocumento } from "./tiptap";
import { estrutura, separarNumero } from "./estrutura";

const exemplo: Documento = {
  versao: 1,
  blocos: [
    { tipo: "titulo", nivel: 1, trechos: [{ texto: "1 Introdução" }] },
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
    { tipo: "titulo", nivel: 2, trechos: [{ texto: "1.1 Contexto do estágio" }] },
    {
      tipo: "lista",
      sequencia: false,
      itens: [
        { trechos: [{ texto: "acolhimento" }] },
        { trechos: [{ texto: "grupos" }], subitens: [{ trechos: [{ texto: "terapêuticos", marcas: ["negrito", "italico"] }] }] },
      ],
    },
    { tipo: "quebra" },
    { tipo: "titulo", nivel: 1, trechos: [{ texto: "2 DESENVOLVIMENTO" }] },
    { tipo: "titulo", nivel: 2, trechos: [{ texto: "Nota sem número" }] },
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
  it("mostra os títulos como a pessoa escreveu, com o número dela", () => {
    expect(estrutura(exemplo.blocos).map((e) => e.texto)).toEqual([
      "1 Introdução",
      "1.1 Contexto do estágio",
      "2 DESENVOLVIMENTO",
      "Nota sem número",
    ]);
  });

  it("acha o número escrito no começo do título", () => {
    expect(separarNumero("1.1 Contexto")).toEqual({ numero: "1.1", resto: "Contexto" });
    expect(separarNumero("2.3.1  Método")).toEqual({ numero: "2.3.1", resto: "Método" });
    expect(separarNumero("3. Resultados")).toEqual({ numero: "3.", resto: "Resultados" });
    expect(separarNumero("Resumo")).toEqual({ numero: "", resto: "Resumo" });
    expect(separarNumero("2025 foi um ano")).toEqual({ numero: "2025", resto: "foi um ano" });
    expect(separarNumero("1.1")).toEqual({ numero: "", resto: "1.1" });
  });
});
