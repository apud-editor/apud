import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { carregarPerfil } from "../../scripts/prova-lib";
import { documentoParaTypst, escaparTexto, letraDaAlinea } from "./typst";
import { TEXTO_DE_EXEMPLO } from "./exemplo";
import type { Documento, Marca } from "../documento/modelo";

const { perfil } = carregarPerfil("abnt.txt");
const compilador = NodeCompiler.create({ fontArgs: [{ fontPaths: [join(import.meta.dirname, "..", "..", "public", "fontes")] }] });

/** Compila e devolve o PDF; falha o teste com as mensagens do Typst se não compilar. */
function compilar(typst: string): Uint8Array {
  const r = compilador.compile({ mainFileContent: typst });
  if (!r.result) {
    r.printDiagnostics();
    throw new Error("o Typst não compilou");
  }
  return compilador.pdf(r.result);
}

/** Onde cada marcador <rotulo> ficou: página e posição, em pt. */
function posicoes(typst: string, rotulo: string): Array<{ page: number; x: number; y: number }> {
  return compilador
    .query({ mainFileContent: typst }, { selector: `<${rotulo}>` })
    .map((m: { value: { page: number; x: string; y: string } }) => ({
      page: m.value.page,
      x: parseFloat(m.value.x),
      y: parseFloat(m.value.y),
    }));
}

const paginas = (pdf: Uint8Array) => (Buffer.from(pdf).toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

describe("conversor para o Typst", () => {
  it("o texto de exemplo compila e ocupa 4 páginas", () => {
    expect(paginas(compilar(documentoParaTypst(TEXTO_DE_EXEMPLO, perfil)))).toBe(4);
  });

  it("nenhum sinal do teclado, com ou sem marcas, quebra o código", () => {
    const sinais = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~ ação — “aspas” 50% e/ou #1 *a* _b_ $x$ <c> @d \\ // /* ";
    const combinacoes: Marca[][] = [[], ["negrito"], ["italico"], ["sobrescrito"], ["negrito", "italico", "sobrescrito"]];
    const doc: Documento = {
      versao: 2,
      referencias: [],
      blocos: combinacoes.flatMap((marcas) => [
        { tipo: "titulo" as const, nivel: 2 as const, trechos: [{ texto: sinais, marcas }] },
        { tipo: "paragrafo" as const, trechos: [{ texto: "antes " }, { texto: sinais, marcas }, { texto: " depois" }] },
        { tipo: "lista" as const, sequencia: true, itens: [{ trechos: [{ texto: sinais, marcas }], subitens: [{ trechos: [{ texto: sinais }] }] }] },
      ]),
    };
    expect(() => compilar(documentoParaTypst(doc, perfil))).not.toThrow();
  });

  it("parágrafos e títulos vazios não viram nada", () => {
    const doc: Documento = {
      versao: 2,
      referencias: [],
      blocos: [
        { tipo: "paragrafo", trechos: [] },
        { tipo: "titulo", nivel: 1, trechos: [{ texto: "  " }] },
        { tipo: "paragrafo", trechos: [{ texto: "texto" }] },
        { tipo: "paragrafo", trechos: [] },
      ],
    };
    const typst = documentoParaTypst(doc, perfil);
    expect(typst).not.toContain("#heading");
    expect(typst.trim().endsWith("texto")).toBe(true);
  });

  it("usa as medidas do perfil: margens, número da página e entrelinhas", () => {
    const typst = documentoParaTypst(TEXTO_DE_EXEMPLO, perfil);
    expect(typst).toContain("margin: (left: 3cm, top: 3cm, right: 2cm, bottom: 2cm)");
    expect(typst).toContain("place(top + right, dx: -2cm, dy: 2cm");
    expect(typst).toContain('font: ("Times New Roman", "Liberation Serif"), size: 12pt');
    expect(typst).toContain("first-line-indent: (amount: 1.25cm, all: true)");
  });

  it("entrelinha 1,5 como no Word: 20,7 pt entre as linhas, em Times 12", () => {
    const paragrafo = "palavra ".repeat(200);
    const marca = (n: string) => `#context [#metadata(here().position()) <${n}>]`;
    const marcado = documentoParaTypst({ versao: 2, referencias: [], blocos: [] }, perfil) + `${marca("a")}${paragrafo}\n\n${marca("b")}${paragrafo}\n`;
    // Do começo de um parágrafo ao começo do seguinte: um número inteiro de linhas de 20,7 pt.
    const [a, b] = [posicoes(marcado, "a")[0], posicoes(marcado, "b")[0]];
    const linhas = (b.y - a.y) / 20.7;
    expect(a.page).toBe(b.page);
    expect(Math.round(linhas)).toBeGreaterThan(3);
    expect(Math.abs(linhas - Math.round(linhas))).toBeLessThan(0.01);
  });

  it("a página nova só acontece onde a pessoa pôs a quebra de página", () => {
    const blocos: Documento["blocos"] = [
      { tipo: "titulo", nivel: 1, trechos: [{ texto: "1 Um" }] },
      { tipo: "paragrafo", trechos: [{ texto: "texto" }] },
      { tipo: "titulo", nivel: 1, trechos: [{ texto: "2 Dois" }] },
    ];
    expect(paginas(compilar(documentoParaTypst({ versao: 2, referencias: [], blocos }, perfil)))).toBe(1);
    const comQuebra: Documento["blocos"] = [...blocos.slice(0, 2), { tipo: "quebra" }, blocos[2]];
    expect(paginas(compilar(documentoParaTypst({ versao: 2, referencias: [], blocos: comQuebra }, perfil)))).toBe(2);
    // Duas quebras seguidas não deixam uma página em branco.
    const duas: Documento["blocos"] = [...blocos.slice(0, 2), { tipo: "quebra" }, { tipo: "quebra" }, blocos[2]];
    expect(paginas(compilar(documentoParaTypst({ versao: 2, referencias: [], blocos: duas }, perfil)))).toBe(2);
  });
});

describe("títulos", () => {
  const typstDe = (blocos: Documento["blocos"]) =>
    documentoParaTypst({ versao: 2, referencias: [], blocos }, perfil) +
    `#context [#metadata(query(heading).map(h => (if h.numbering == none { "" } else { numbering(h.numbering, 1) }, h.body.fields().at("text", default: repr(h.body))))) <t>]\n`;

  it("o número é o que a pessoa escreveu; sem número escrito, sai sem número", () => {
    const typst = typstDe([
      { tipo: "titulo", nivel: 1, trechos: [{ texto: "Resumo" }] },
      { tipo: "titulo", nivel: 1, trechos: [{ texto: "1 Introdução" }] },
      { tipo: "titulo", nivel: 2, trechos: [{ texto: "3.2 Fora de ordem" }] },
    ]);
    const r = compilador.query({ mainFileContent: typst }, { selector: "<t>" })[0].value as Array<[string, string]>;
    expect(r.map((x) => x[0])).toEqual(["", "1", "3.2"]);
    expect(r[1][1]).toContain("Introdução");
    expect(r[1][1]).not.toContain("1 ");
  });

  it("as letras saem como a pessoa escreveu (o Apud não põe em maiúsculas)", () => {
    const typst = documentoParaTypst({ versao: 2, referencias: [], blocos: [{ tipo: "titulo", nivel: 1, trechos: [{ texto: "1 Introdução" }] }] }, perfil);
    expect(typst).not.toContain("upper(");
    expect(typst).toContain("strong(x)");
  });

  it("título longo: a segunda linha fica sob a primeira letra do texto, não sob o número", () => {
    const longo = "palavra ".repeat(30).trim();
    const marca = `#show heading: it => { it; context [#metadata(here().position()) <fim>] }`;
    const typst = documentoParaTypst({ versao: 2, referencias: [], blocos: [{ tipo: "titulo", nivel: 3, trechos: [{ texto: `1.1.1 ${longo}` }] }] }, perfil);
    expect(() => compilar(typst + marca)).not.toThrow();
    expect(typst).toContain('numbering: (..n) => "1.1.1"');
  });
});

describe("pedaços do conversor", () => {
  it("escapa os sinais do Typst, mas deixa as aspas virarem aspas curvas", () => {
    expect(escaparTexto("#a *b* @c")).toBe("\\#a \\*b\\* \\@c");
    expect(escaparTexto('"citação"')).toBe('"citação"');
  });

  it("alíneas de a) até z) e depois aa)", () => {
    expect([0, 1, 25, 26, 27].map(letraDaAlinea)).toEqual(["a", "b", "z", "aa", "ab"]);
  });
});
