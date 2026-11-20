import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { textoSimples, type Bloco, type Citacao } from "./modelo";
import { blocosDoEditor, editorDosBlocos, NO_DA_CITACAO } from "./tiptap";
import { estrutura, separarNumero } from "./estrutura";

const cParenteses: Citacao = {
  tipo: "parenteses",
  direta: true,
  obras: [
    { referencia: "r1", localizador: { tipo: "pagina", valor: "15" }, grifo: true },
    { referencia: "r2", localizador: { tipo: "outro", rotulo: "local.", valor: "7" }, traducao: true },
  ],
};
const cNarrativa: Citacao = { tipo: "narrativa", obra: { referencia: "r1" } };
const cApud: Citacao = { tipo: "apud", original: "Freud, 1915", obra: { referencia: "r2", localizador: { tipo: "pagina", valor: "12" } } };
const cSemReferencia: Citacao = { tipo: "sem-referencia", texto: "Usuária A" };

const exemplo: { blocos: Bloco[] } = {
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
    {
      tipo: "paragrafo",
      trechos: [
        { citacao: cNarrativa },
        { texto: " afirma que o acolhimento " },
        { texto: "começa antes", marcas: ["italico"] },
        { texto: " " },
        { citacao: cParenteses },
        { citacao: cApud },
        { texto: ". Uma usuária disse: “aqui ninguém me apressou” " },
        { citacao: cSemReferencia },
        { texto: "." },
      ],
    },
    { tipo: "titulo", nivel: 3, trechos: [{ citacao: cNarrativa }, { texto: " e a clínica" }] },
    { tipo: "lista", sequencia: false, itens: [{ trechos: [{ texto: "segundo " }, { citacao: cNarrativa }] }] },
    { tipo: "paragrafo", trechos: [] },
  ],
};

describe("conversão entre o Apud e o editor", () => {
  it("ida e volta não muda nada", () => {
    expect(blocosDoEditor(editorDosBlocos(exemplo.blocos))).toEqual(exemplo.blocos);
  });

  it("citações viram um nó próprio do editor, com os dados como estão no modelo", () => {
    const json = editorDosBlocos([{ tipo: "paragrafo", trechos: [{ texto: "a " }, { citacao: cApud }, { texto: " b" }] }]);
    expect(json.content![0].content).toEqual([
      { type: "text", text: "a " },
      { type: NO_DA_CITACAO, attrs: { dados: cApud } },
      { type: "text", text: " b" },
    ]);
  });

  it("duas citações vizinhas continuam separadas, e o texto em volta não se junta por cima delas", () => {
    const blocos: Bloco[] = [
      { tipo: "paragrafo", trechos: [{ texto: "x" }, { citacao: cNarrativa }, { citacao: cNarrativa }, { texto: "y" }] },
    ];
    expect(blocosDoEditor(editorDosBlocos(blocos))).toEqual(blocos);
  });

  it("uma citação dentro de algo que o modelo não conhece também não se perde", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [{ type: "text", text: "trecho " }, { type: NO_DA_CITACAO, attrs: { dados: cParenteses } }] }],
        },
      ],
    };
    expect(blocosDoEditor(json)).toEqual([{ tipo: "paragrafo", trechos: [{ texto: "trecho " }, { citacao: cParenteses }] }]);
  });

  it("o texto simples de um título ignora as citações", () => {
    expect(textoSimples([{ citacao: cNarrativa }, { texto: " e a clínica" }])).toBe(" e a clínica");
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
    expect(blocosDoEditor(json)).toEqual([
      { tipo: "paragrafo", trechos: [{ texto: "ab", marcas: ["negrito", "italico"] }, { texto: "c" }] },
    ]);
  });

  it("nunca perde texto de algo que o modelo não conhece", () => {
    const json: JSONContent = {
      type: "doc",
      content: [{ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "citação" }] }] }],
    };
    expect(blocosDoEditor(json)).toEqual([{ tipo: "paragrafo", trechos: [{ texto: "citação" }] }]);
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
    expect(blocosDoEditor(json)).toEqual([
      { tipo: "lista", sequencia: false, itens: [{ trechos: [{ texto: "um dois" }] }] },
    ]);
  });

  it("documento vazio vira um parágrafo vazio", () => {
    expect(blocosDoEditor({ type: "doc" })).toEqual([{ tipo: "paragrafo", trechos: [] }]);
  });
});

describe("estrutura", () => {
  it("mostra os títulos como a pessoa escreveu, com o número dela", () => {
    expect(estrutura(exemplo.blocos).map((e) => e.texto)).toEqual([
      "1 Introdução",
      "1.1 Contexto do estágio",
      "2 DESENVOLVIMENTO",
      "Nota sem número",
      "e a clínica",
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
