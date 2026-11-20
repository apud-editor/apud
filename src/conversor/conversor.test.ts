import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { carregarNorma, carregarPerfil, documentoDeProva } from "../../scripts/prova-lib";
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
      versao: 3,
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
      versao: 3,
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
    const marcado = documentoParaTypst({ versao: 3, referencias: [], blocos: [] }, perfil) + `${marca("a")}${paragrafo}\n\n${marca("b")}${paragrafo}\n`;
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
    expect(paginas(compilar(documentoParaTypst({ versao: 3, referencias: [], blocos }, perfil)))).toBe(1);
    const comQuebra: Documento["blocos"] = [...blocos.slice(0, 2), { tipo: "quebra" }, blocos[2]];
    expect(paginas(compilar(documentoParaTypst({ versao: 3, referencias: [], blocos: comQuebra }, perfil)))).toBe(2);
    // Duas quebras seguidas não deixam uma página em branco.
    const duas: Documento["blocos"] = [...blocos.slice(0, 2), { tipo: "quebra" }, { tipo: "quebra" }, blocos[2]];
    expect(paginas(compilar(documentoParaTypst({ versao: 3, referencias: [], blocos: duas }, perfil)))).toBe(2);
  });
});

describe("títulos", () => {
  const typstDe = (blocos: Documento["blocos"]) =>
    documentoParaTypst({ versao: 3, referencias: [], blocos }, perfil) +
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
    const typst = documentoParaTypst({ versao: 3, referencias: [], blocos: [{ tipo: "titulo", nivel: 1, trechos: [{ texto: "1 Introdução" }] }] }, perfil);
    expect(typst).not.toContain("upper(");
    expect(typst).toContain("strong(x)");
  });

  it("título longo: a segunda linha fica sob a primeira letra do texto, não sob o número", () => {
    const longo = "palavra ".repeat(30).trim();
    const marca = `#show heading: it => { it; context [#metadata(here().position()) <fim>] }`;
    const typst = documentoParaTypst({ versao: 3, referencias: [], blocos: [{ tipo: "titulo", nivel: 3, trechos: [{ texto: `1.1.1 ${longo}` }] }] }, perfil);
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

describe("citações e lista de referências no PDF", () => {
  const { csl } = carregarNorma("abnt.txt");
  const comCitacao: Documento = {
    versao: 3,
    referencias: [
      { id: "s", tipo: "livro", autores: [{ sobrenome: "Silva", prenomes: "João" }], titulo: "Psicologia clínica", data: { ano: 2019 } },
      { id: "nao", tipo: "livro", autores: [{ sobrenome: "Nunca", prenomes: "Citado" }], titulo: "Fora da lista", data: { ano: 2000 } },
    ],
    blocos: [
      {
        tipo: "paragrafo",
        trechos: [{ texto: "O acolhimento vem antes " }, { citacao: { tipo: "parenteses", obras: [{ referencia: "s", localizador: { tipo: "pagina", valor: "15" } }] } }, { texto: "." }],
      },
      { tipo: "referencias" },
    ],
  };

  it("a citação sai na norma, e a lista sai onde está o bloco, com o título do perfil", () => {
    const typst = documentoParaTypst(comCitacao, perfil, { csl });
    // (sem as barras que protegem a pontuação no Typst)
    expect(typst.replace(/\\/g, "")).toContain('#cite(label("s"), form: none)(Silva, 2019, p. 15)');
    expect(typst).toContain("#align(center, heading(level: 1, numbering: none, outlined: true)[REFERÊNCIAS])");
    expect(() => compilar(typst)).not.toThrow();
  });

  it("só as obras citadas vão para a lista", () => {
    const typst = documentoParaTypst(comCitacao, perfil, { csl });
    expect(typst).toContain("Psicologia clínica");
    expect(typst).not.toContain("Fora da lista");
  });

  it("sem citações, o bloco da lista não mostra nada (nem precisa do estilo CSL)", () => {
    const typst = documentoParaTypst({ ...comCitacao, blocos: [{ tipo: "paragrafo", trechos: [{ texto: "texto" }] }, { tipo: "referencias" }] }, perfil);
    expect(typst).not.toContain("REFERÊNCIAS");
  });

  it("sem o bloco, a lista não sai: tudo o que está no PDF tem um lugar no editor", () => {
    const typst = documentoParaTypst({ ...comCitacao, blocos: comCitacao.blocos.slice(0, 1) }, perfil, { csl });
    expect(typst).not.toContain("REFERÊNCIAS");
    expect(typst).not.toContain("bibliography(");
  });

  it("a lista sai no lugar do bloco, mesmo antes de outros textos", () => {
    const blocos = [comCitacao.blocos[0], { tipo: "referencias" as const }, { tipo: "titulo" as const, nivel: 1 as const, trechos: [{ texto: "APÊNDICE A" }] }];
    const typst = documentoParaTypst({ ...comCitacao, blocos }, perfil, { csl });
    expect(typst.indexOf("bibliography(")).toBeLessThan(typst.indexOf("APÊNDICE A"));
  });

  it("com citações e sem o estilo CSL, avisa em vez de sair sem a lista", () => {
    expect(() => documentoParaTypst(comCitacao, perfil)).toThrow("falta o estilo CSL");
  });

  it("o documento de prova inteiro compila em ABNT", () => {
    const { documento } = documentoDeProva();
    expect(paginas(compilar(documentoParaTypst(documento, perfil, { csl })))).toBeGreaterThan(2);
  });
});

describe("APA na página", () => {
  const apa = carregarNorma("apa.txt");
  const doc = (blocos: Documento["blocos"]): Documento => ({ versao: 3, referencias: [], blocos });

  it("margens de 2,54 cm, espaço duplo, texto à esquerda e número no cabeçalho, alinhado à margem", () => {
    const typst = documentoParaTypst(doc([{ tipo: "paragrafo", trechos: [{ texto: "texto" }] }]), apa.perfil);
    expect(typst).toContain("margin: (left: 2.54cm, top: 2.54cm, right: 2.54cm, bottom: 2.54cm)");
    expect(typst).toContain("place(top + right, dx: -2.54cm, dy: 1.27cm");
    expect(typst).toContain("#set par(justify: false, leading: 1.15em, spacing: 1.15em, first-line-indent: (amount: 1.27cm, all: true))");
  });

  it("nível 1 centralizado; níveis 4 e 5 com recuo, na mesma linha do texto e com ponto", () => {
    const typst = documentoParaTypst(
      doc([
        { tipo: "titulo", nivel: 1, trechos: [{ texto: "Método" }] },
        { tipo: "titulo", nivel: 4, trechos: [{ texto: "Escuta inicial" }] },
        { tipo: "paragrafo", trechos: [{ texto: "Nos primeiros contatos." }] },
        { tipo: "titulo", nivel: 5, trechos: [{ texto: "Já com ponto?" }] },
        { tipo: "paragrafo", trechos: [{ texto: "Texto." }] },
      ]),
      apa.perfil,
    );
    expect(typst).toContain("if n == 1 { align(center, x) }");
    expect(typst).toContain("#destaque-do-titulo(4, [Escuta inicial\\.]) Nos primeiros contatos\\.");
    expect(typst).toContain("#destaque-do-titulo(5, [Já com ponto\\?]) Texto\\.");
    expect(() => compilar(typst)).not.toThrow();
  });

  it("título de nível 4 seguido de outro título fica sozinho, com o ponto", () => {
    const typst = documentoParaTypst(
      doc([
        { tipo: "titulo", nivel: 4, trechos: [{ texto: "Escuta" }] },
        { tipo: "titulo", nivel: 5, trechos: [{ texto: "Primeiros" }] },
      ]),
      apa.perfil,
    );
    expect(typst).toContain("#heading(level: 4, numbering: none)[Escuta\\.]");
  });

  it("listas: números só na lista em sequência; marcadores nas outras (ABNT continua com alíneas)", () => {
    const listas = doc([
      { tipo: "lista", sequencia: true, itens: [{ trechos: [{ texto: "um" }] }, { trechos: [{ texto: "dois" }] }] },
      { tipo: "lista", sequencia: false, itens: [{ trechos: [{ texto: "três" }] }] },
    ]);
    const typst = documentoParaTypst(listas, apa.perfil);
    expect(typst).toContain("#alinea(1.27cm, [1\\.], [um])");
    expect(typst).toContain("#alinea(1.27cm, [2\\.], [dois])");
    expect(typst).toContain("#alinea(1.27cm, [•], [três])");
    expect(documentoParaTypst(listas, perfil)).toContain("#alinea(1.25cm, [a\\)], [um])");
  });

  it("o documento de prova inteiro compila em APA, com a lista no fim: espaço duplo e recuo nas linhas seguintes", () => {
    const { documento } = documentoDeProva();
    const typst = documentoParaTypst(documento, apa.perfil, { csl: apa.csl });
    expect(typst).toContain("#align(center, heading(level: 1, numbering: none, outlined: true)[Referências])");
    expect(typst).toContain("hanging-indent: 1.27cm, leading: 1.15em, spacing: 1.15em + 0 * 1.15em");
    expect(paginas(compilar(typst))).toBeGreaterThan(2);
  });
});
