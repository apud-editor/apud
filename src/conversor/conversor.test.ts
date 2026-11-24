import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { carregarNorma, carregarPerfil, documentoDeProva, mapearImagens } from "../../scripts/prova-lib";
import { documentoParaTypst, escaparTexto, letraDaAlinea, MARCA_DAS_POSICOES, MARCA_DO_BLOCO, PONTUACAO_DA_LISTA } from "./typst";
import { TEXTO_DE_EXEMPLO } from "./exemplo";
import { documentoVazio, type Documento, type Marca } from "../documento/modelo";
import { somar, valorProprio } from "../modelos/herdar";

const { modelo: perfil } = carregarPerfil("abnt.txt");
const compilador = NodeCompiler.create({ fontArgs: [{ fontPaths: [join(import.meta.dirname, "..", "..", "public", "fontes")] }] });

/** Compila e devolve o PDF; falha o teste com as mensagens do Typst se não compilar. Com o documento, as imagens das figuras vão junto. */
function compilar(typst: string, doc?: Documento): Uint8Array {
  if (doc) mapearImagens(compilador, doc);
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
      ...documentoVazio(),
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
      ...documentoVazio(),
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
    const marcado = documentoParaTypst({ ...documentoVazio(), referencias: [], blocos: [] }, perfil) + `${marca("a")}${paragrafo}\n\n${marca("b")}${paragrafo}\n`;
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
    expect(paginas(compilar(documentoParaTypst({ ...documentoVazio(), referencias: [], blocos }, perfil)))).toBe(1);
    const comQuebra: Documento["blocos"] = [...blocos.slice(0, 2), { tipo: "quebra" }, blocos[2]];
    expect(paginas(compilar(documentoParaTypst({ ...documentoVazio(), referencias: [], blocos: comQuebra }, perfil)))).toBe(2);
    // Duas quebras seguidas não deixam uma página em branco.
    const duas: Documento["blocos"] = [...blocos.slice(0, 2), { tipo: "quebra" }, { tipo: "quebra" }, blocos[2]];
    expect(paginas(compilar(documentoParaTypst({ ...documentoVazio(), referencias: [], blocos: duas }, perfil)))).toBe(2);
  });
});

describe("títulos", () => {
  const typstDe = (blocos: Documento["blocos"]) =>
    documentoParaTypst({ ...documentoVazio(), referencias: [], blocos }, perfil) +
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
    const typst = documentoParaTypst({ ...documentoVazio(), referencias: [], blocos: [{ tipo: "titulo", nivel: 1, trechos: [{ texto: "1 Introdução" }] }] }, perfil);
    expect(typst).not.toContain("upper(");
    expect(typst).toContain("strong(x)");
  });

  it("título longo: a segunda linha fica sob a primeira letra do texto, não sob o número", () => {
    const longo = "palavra ".repeat(30).trim();
    const marca = `#show heading: it => { it; context [#metadata(here().position()) <fim>] }`;
    const typst = documentoParaTypst({ ...documentoVazio(), referencias: [], blocos: [{ tipo: "titulo", nivel: 3, trechos: [{ texto: `1.1.1 ${longo}` }] }] }, perfil);
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
    ...documentoVazio(),
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
    expect(paginas(compilar(documentoParaTypst(documento, perfil, { csl }), documento))).toBeGreaterThan(2);
  });
});

describe("APA na página", () => {
  const apa = carregarNorma("apa.txt");
  const doc = (blocos: Documento["blocos"]): Documento => ({ ...documentoVazio(), referencias: [], blocos });

  it("margens de 2,54 cm, espaço duplo, texto à esquerda e número no cabeçalho, alinhado à margem", () => {
    const typst = documentoParaTypst(doc([{ tipo: "paragrafo", trechos: [{ texto: "texto" }] }]), apa.modelo);
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
      apa.modelo,
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
      apa.modelo,
    );
    expect(typst).toContain("#heading(level: 4, numbering: none)[Escuta\\.]");
  });

  it("listas: números só na lista em sequência; marcadores nas outras (ABNT continua com alíneas)", () => {
    const listas = doc([
      { tipo: "lista", sequencia: true, itens: [{ trechos: [{ texto: "um" }] }, { trechos: [{ texto: "dois" }] }] },
      { tipo: "lista", sequencia: false, itens: [{ trechos: [{ texto: "três" }] }] },
    ]);
    const typst = documentoParaTypst(listas, apa.modelo);
    expect(typst).toContain("#alinea(1.27cm, [1\\.], [um])");
    expect(typst).toContain("#alinea(1.27cm, [2\\.], [dois])");
    expect(typst).toContain("#alinea(1.27cm, [•], [três])");
    expect(documentoParaTypst(listas, perfil)).toContain("#alinea(1.25cm, [a\\)], [um])");
  });

  it("o documento de prova inteiro compila em APA, com a lista no fim: espaço duplo e recuo nas linhas seguintes", () => {
    const { documento } = documentoDeProva();
    const typst = documentoParaTypst(documento, apa.modelo, { csl: apa.csl });
    expect(typst).toContain("#align(center, heading(level: 1, numbering: none, outlined: true)[Referências])");
    expect(typst).toContain("hanging-indent: 1.27cm, leading: 1.15em, spacing: 1.15em + 0 * 1.15em");
    expect(paginas(compilar(typst, documento))).toBeGreaterThan(2);
  });
});

describe("fase 3: citação longa, notas, figuras e tabelas no PDF", () => {
  const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGP4z8DAwPAfAAcAAf9+CLHQAAAAAElFTkSuQmCC";
  const normaAbnt = carregarNorma("abnt.txt");
  const normaApa = carregarNorma("apa.txt");
  const abnt = normaAbnt.modelo;
  const apa = normaApa.modelo;
  const csl = (p: typeof abnt) => ({ csl: p === abnt ? normaAbnt.csl : normaApa.csl });
  // Com citações, o Typst pede a lista de referências no documento.
  const comLista = (d: Documento): Documento => ({ ...d, blocos: [...d.blocos, { tipo: "referencias" }] });
  const cit = { citacao: { tipo: "parenteses" as const, direta: true, obras: [{ referencia: "r", localizador: { tipo: "pagina" as const, valor: "15" } }] } };
  const referencias = [{ id: "r", tipo: "livro" as const, autores: [{ sobrenome: "Silva", prenomes: "Ana" }], titulo: "Livro", data: { ano: 2019 } }];
  const doc = (blocos: Documento["blocos"]): Documento => ({
    ...documentoVazio(),
    referencias,
    imagens: [{ id: "img", formato: "png", dados: PNG, largura: 302, altura: 151 }],
    blocos,
  });
  const longa: Documento["blocos"][number] = { tipo: "citacaoLonga", trechos: [{ texto: "Um trecho longo que termina aqui. " }, cit] };
  const figura = (extra = {}) => ({ tipo: "figura" as const, imagem: "img", titulo: [{ texto: "Fluxo" }], fonte: [{ texto: "Dados do serviço" }], ...extra });
  const tabela = (extra = {}) => ({
    tipo: "tabela" as const,
    titulo: [{ texto: "Usuários" }],
    cabecalho: 1,
    linhas: [
      [[{ texto: "Grupo" }], [{ texto: "Total" }]],
      [[{ texto: "Adultos" }], [{ texto: "12" }]],
    ],
    fonte: [{ texto: "Registro (2026)" }],
    ...extra,
  });

  it("ABNT: citação longa com recuo de 4 cm, fonte 10, espaço simples, uma linha em branco antes e depois e o ponto depois da chamada", () => {
    const typst = documentoParaTypst(comLista(doc([longa])), abnt, csl(abnt));
    expect(typst).toContain("#block(above: 0.575em + 1 * 1.725em, below: 0.575em + 1 * 1.725em, pad(left: 4cm)[");
    expect(typst).toContain("#set text(size: 10pt)");
    expect(typst).toContain("#set par(first-line-indent: 0pt, leading: 0em, spacing: 0em)");
    expect(typst).toContain(String.raw`termina aqui #cite(label("r"), form: none)\(Silva\, 2019\, p\. 15\)\.` + "\n");
    expect(() => compilar(typst)).not.toThrow();
  });

  it("APA: citação em bloco com recuo de 1,27 cm, espaço duplo, sem espaço a mais e o ponto antes da chamada", () => {
    const typst = documentoParaTypst(comLista(doc([{ tipo: "citacaoLonga", trechos: [{ texto: "Termina aqui " }, cit, { texto: "." }] }])), apa, csl(apa));
    expect(typst).toContain("#block(above: 1.15em, below: 1.15em, pad(left: 1.27cm)[");
    expect(typst).toContain("#set text(size: 12pt)");
    expect(typst).toContain("#set par(first-line-indent: 0pt, leading: 1.15em, spacing: 1.15em)");
    expect(typst).toContain(String.raw`Termina aqui\. #cite(label("r"), form: none)\(Silva\, 2019\, p\. 15\)` + "\n");
    expect(() => compilar(typst)).not.toThrow();
  });

  it("notas de rodapé: ABNT com filete de 5 cm, fonte 10, simples e linhas seguintes sob a primeira letra; APA como no Word", () => {
    const comNota = doc([{ tipo: "paragrafo", trechos: [{ texto: "Texto" }, { nota: { trechos: [{ texto: "A nota." }] } }] }]);
    const a = documentoParaTypst(comNota, abnt);
    expect(a).toContain("separator: box(height: 0.5em, line(length: 5cm, stroke: 0.5pt)), clearance: 1.15em, gap: 0em");
    expect(a).toContain("set text(size: 10pt)");
    expect(a).toContain("grid(columns: (auto, 1fr), column-gutter: 0.2em, super(n), it.note.body)");
    expect(a).toContain("Texto#footnote[A nota\\.]");
    const p = documentoParaTypst(comNota, apa);
    expect(p).toContain("separator: box(height: 0.5em, line(length: 5cm, stroke: 0.5pt))");
    expect(p).toContain("set text(size: 10pt)");
    expect(p).toContain("set par(justify: false, leading: 0em");
    expect(p).toContain("[#super(n) #it.note.body]");
    expect(() => compilar(a)).not.toThrow();
    expect(() => compilar(p)).not.toThrow();
  });

  it("ABNT: cada espécie de ilustração tem a sua contagem; a tabela, a dela", () => {
    const typst = documentoParaTypst(
      doc([figura(), figura({ especie: "grafico" }), figura({ especie: "quadro" }), figura(), tabela(), figura({ especie: "grafico" }), tabela()]),
      abnt,
    );
    // A figura leva o número numa linha própria; a tabela, no cabeçalho que se repete (IBGE, 8.3).
    const numeros = [...typst.matchAll(/(?:sticky: true\)\[|bottom: 0\.575em\)\)\[#set par\(leading: 0\.575em, spacing: 0\.575em\); )(\S+ \d+) –/g)].map((m) => m[1]);
    expect(numeros).toEqual(["Figura 1", "Gráfico 1", "Quadro 1", "Figura 2", "Tabela 1", "Gráfico 2", "Tabela 2"]);
  });

  it("APA: toda ilustração é Figura, numa contagem só; a tabela tem a dela", () => {
    const typst = documentoParaTypst(doc([figura(), figura({ especie: "grafico" }), tabela(), figura({ especie: "quadro" })]), apa);
    const numeros = [...typst.matchAll(/#strong\[(\S+ \d+)\]/g)].map((m) => m[1]);
    expect(numeros).toEqual(["Figura 1", "Figura 2", "Tabela 1", "Figura 3"]);
  });

  it("ABNT: Figura 1 – Título acima, Fonte: embaixo em fonte 10 e simples, na largura da figura", () => {
    const typst = documentoParaTypst(doc([figura({ nota: [{ texto: "Legenda da figura." }] })]), abnt);
    expect(typst).toContain("align(center, block(width: 49.9%)[");
    expect(typst).toContain("#block(above: 0pt, below: 0.575em, sticky: true)[Figura 1 – Fluxo]");
    expect(typst).toContain('#image("/imagens/0-img.png", width: 100%)');
    expect(typst).toContain(String.raw`#block(above: 0em + 0.3em, below: 0pt)[#set text(size: 10pt); #set par(leading: 0em, spacing: 0em); Fonte\: Dados do serviço]`);
    expect(typst).toContain("Legenda da figura\\.]");
    expect(() => compilar(typst, doc([figura()]))).not.toThrow();
  });

  it("a figura com largura escolhida usa a largura dela", () => {
    expect(documentoParaTypst(doc([figura({ largura: 70 })]), abnt)).toContain("block(width: 70%)");
  });

  it("100% é a largura toda do texto, mesmo numa imagem pequena (que sem escolha fica no tamanho dela)", () => {
    // A imagem do teste tem 302 px (cerca de 8 cm): sem largura escolhida, ocupa menos da metade do texto.
    expect(documentoParaTypst(doc([figura()]), abnt)).not.toContain("block(width: 100%)[");
    expect(documentoParaTypst(doc([figura({ largura: 100 })]), abnt)).toContain("block(width: 100%)[");
    expect(documentoParaTypst(doc([figura({ largura: 80 })]), abnt)).toContain("block(width: 80%)");
  });

  it("fonte própria: na ABNT, o texto do perfil; na APA, nada (a APA não pede fonte de figura própria)", () => {
    const propria = doc([figura({ fontePropria: true, fonte: [{ texto: "guardada, mas não sai" }] })]);
    const a = documentoParaTypst(propria, abnt);
    expect(a).toContain(String.raw`Fonte\: Elaborado pelo próprio autor]`);
    expect(a).not.toContain("guardada");
    const p = documentoParaTypst(propria, apa);
    expect(p).not.toContain("Nota");
    expect(p).not.toContain("guardada");
  });

  it("APA: número em negrito, título em itálico na linha de baixo e, embaixo, Nota. com a nota e a fonte", () => {
    const typst = documentoParaTypst(doc([figura({ nota: [{ texto: "Dados de 2025." }] })]), apa);
    expect(typst).toContain("#strong[Figura 1]");
    expect(typst).toContain("#emph[Fluxo]");
    expect(typst).toContain("#emph[Nota\\.] Dados de 2025\\. Dados do serviço]");
    expect(() => compilar(typst, doc([figura()]))).not.toThrow();
  });

  it("figura cuja imagem sumiu do arquivo sai com um aviso no lugar, e o PDF não quebra", () => {
    const typst = documentoParaTypst(doc([figura({ imagem: "sumiu" })]), abnt);
    expect(typst).toContain("Imagem não encontrada no arquivo");
    expect(() => compilar(typst)).not.toThrow();
  });

  it("tabela: fios no topo, embaixo do cabeçalho e no fim, sem laterais; número, título e cabeçalho que se repetem na outra página", () => {
    const typst = documentoParaTypst(doc([tabela()]), abnt);
    // A linha 0 é a do número e título; o cabeçalho da pessoa vem depois.
    expect(typst).toContain("align: (x, y) => if y < 2 { center } else if x == 0 { left } else { center },");
    expect(typst).toMatch(/table\.header\(repeat: true, \.\.if topo \{ \(table\.cell\(colspan: 2,[^\n]*Tabela 1 – Usuários/);
    expect(typst).toContain("table.hline(stroke: 0.5pt), [Grupo], [Total], table.hline(stroke: 0.5pt),),");
    // O fio do fim é a borda de baixo da última linha (um fio na borda da tabela se repetiria no pé de cada página).
    expect(typst.match(/table\.hline/g)).toHaveLength(2);
    expect(typst).toContain("stroke: (x, y) => if y == ultima { (bottom: 0.5pt) } else { none }");
    expect(typst).toContain("let ultima = 1 + if topo { 1 } else { 0 }");
    expect(typst).toContain("[Tabela 1 – Usuários]");
    expect(typst).toContain(String.raw`Fonte\: Registro \(2026\)`);
    expect(() => compilar(typst)).not.toThrow();
  });

  it("tabela sem cabeçalho: só o fio do topo e o do fim (o título ainda se repete)", () => {
    const typst = documentoParaTypst(doc([tabela({ cabecalho: 0 })]), abnt);
    expect(typst).toContain("table.header(repeat: true, ..if topo");
    expect(typst.match(/table\.hline/g)).toHaveLength(1);
    expect(typst).toContain("let ultima = 1 + if topo { 1 } else { 0 }");
    expect(() => compilar(typst)).not.toThrow();
  });

  it("APA: a tabela na largura do texto, com o corpo em espaço duplo", () => {
    const typst = documentoParaTypst(doc([tabela()]), apa);
    expect(typst).toContain("grade((auto, ..((1fr,) * 1)))");
    expect(typst).toContain("inset: (x: 0.4em, y: 0.725em)");
    expect(typst).toContain("#strong[Tabela 1]");
    expect(typst).toContain("#emph[Nota\\.] Registro \\(2026\\)");
    expect(() => compilar(typst)).not.toThrow();
  });

  it("ABNT, tabela em mais de uma página (IBGE, 8.3): indicações (continua), (continuação) e (conclusão) pela página", () => {
    const linhas = [[[{ texto: "Mês" }], [{ texto: "Total" }]], ...Array.from({ length: 120 }, (_, i) => [[{ texto: `Linha ${i + 1}` }], [{ texto: String(i) }]])];
    const typst = documentoParaTypst(doc([tabela({ linhas }), tabela()]), abnt);
    expect(typst).toContain(String.raw`if aqui == ini [\(continua\)] else if aqui == fim [\(conclusão\)] else [\(continuação\)]`);
    expect(typst).toContain("align(right,");
    // As marcas: na primeira e na última linha do corpo.
    expect(typst).toContain("[#metadata(none)<apud-tabela-1-inicio>Linha 1]");
    expect(typst).toContain("[#metadata(none)<apud-tabela-1-fim>Linha 120]");
    expect(typst).toContain("[#metadata(none)<apud-tabela-2-inicio>#metadata(none)<apud-tabela-2-fim>Adultos]");
    // Onde ficam as marcas no PDF: a tabela longa começa numa página e acaba noutra; a curta, numa só.
    const sonda = `\n#context [#metadata((locate(<apud-tabela-1-inicio>).page(), locate(<apud-tabela-1-fim>).page(), locate(<apud-tabela-2-inicio>).page(), locate(<apud-tabela-2-fim>).page()))<sonda>]`;
    const [r] = compilador.query({ mainFileContent: typst + sonda }, { selector: "<sonda>", field: "value" }) as number[][];
    expect(r[0]).toBe(1);
    expect(r[1]).toBeGreaterThanOrEqual(3);
    expect(r[2]).toBe(r[3]);
  });

  it("indicações vêm do modelo (texto e posição)", () => {
    const outro = carregarNorma("abnt.txt", { "tabelas em mais de uma página, posição das indicações": "à esquerda" }).modelo;
    expect(documentoParaTypst(doc([tabela()]), outro)).toContain("align(left, if aqui");
    // Um modelo em que só o cabeçalho se repete (como no Em branco).
    const v = valorProprio(abnt, "ilustracoes.tabela", "em mais de uma página")!;
    const sem = somar(abnt, {
      diferencas: new Map([["ilustracoes.tabela", new Map([["em mais de uma página", { ...v, valor: { tipo: "opcao" as const, valor: "só o cabeçalho se repete" }, texto: "só o cabeçalho se repete" }]])]]),
      atalhos: new Map(),
    });
    const t = documentoParaTypst(doc([tabela()]), sem);
    expect(t).not.toContain("aqui == ini");
    expect(t).toContain("table.header(repeat: true, table.hline(stroke: 0.5pt), [Grupo], [Total], table.hline(stroke: 0.5pt),),");
    expect(() => compilar(t)).not.toThrow();
  });

  it("APA: só o cabeçalho se repete, sem indicações", () => {
    const typst = documentoParaTypst(doc([tabela()]), apa);
    expect(typst).not.toContain("aqui == ini");
    expect(typst).not.toContain("apud-tabela-");
  });

  it("uma tabela longa passa para a página seguinte sem quebrar o PDF", () => {
    const linhas = [[[{ texto: "Mês" }], [{ texto: "Total" }]], ...Array.from({ length: 80 }, (_, i) => [[{ texto: `Linha ${i + 1}` }], [{ texto: String(i) }]])];
    for (const perfil of [abnt, apa]) {
      const typst = documentoParaTypst(doc([tabela({ linhas })]), perfil);
      expect(paginas(compilar(typst))).toBeGreaterThan(1);
    }
  });

  it("todos os blocos novos juntos compilam nas duas normas, também com nota no título e na lista", () => {
    const blocos: Documento["blocos"] = [
      { tipo: "titulo", nivel: 2, trechos: [{ texto: "1.1 Título" }, { nota: { trechos: [{ texto: "nota no título" }] } }] },
      { tipo: "lista", sequencia: false, itens: [{ trechos: [{ texto: "item" }, { nota: { trechos: [{ texto: "nota no item" }] } }] }] },
      longa,
      figura({ especie: "grafico", nota: [{ texto: "x" }] }),
      tabela({ titulo: [{ texto: "Com " }, { texto: "itálico", marcas: ["italico"] }, cit] }),
    ];
    for (const perfil of [abnt, apa]) {
      const d = comLista(doc(blocos));
      expect(paginas(compilar(documentoParaTypst(d, perfil, csl(perfil)), d))).toBeGreaterThan(0);
    }
  });
});

describe("fase 3, parte 4: abertura (capa, folha de rosto, página de título, resumos, sumário)", () => {
  const normaAbnt = carregarNorma("abnt.txt");
  const normaApa = carregarNorma("apa.txt");
  const abnt = normaAbnt.modelo;
  const apa = normaApa.modelo;
  const dados = {
    ...documentoVazio().dados,
    titulo: "O acolhimento",
    subtitulo: "um relato",
    autores: ["Ana Souza", "Bruno Lima"],
    orientador: "Profa. Marta",
    instituicao: "Universidade do Vale do Itajaí",
    curso: "Psicologia",
    cidade: "Itajaí",
    ano: 2026,
    disciplina: "Psicopatologia",
    dataDeEntrega: { ano: 2026, mes: 11, dia: 30 },
  };
  const blocos: Documento["blocos"] = [
    { tipo: "titulo", nivel: 1, trechos: [{ texto: "1 Introdução" }] },
    { tipo: "paragrafo", trechos: [{ texto: "Texto." }] },
    { tipo: "titulo", nivel: 2, trechos: [{ texto: "1.1 Contexto" }] },
    { tipo: "paragrafo", trechos: [{ texto: "Mais texto." }] },
  ];
  const tudo: Documento["abertura"] = {
    ...documentoVazio().abertura,
    capa: true,
    folhaDeRosto: true,
    paginaDeTitulo: true,
    dedicatoria: { incluir: true, paragrafos: [[{ texto: "À minha família." }]] },
    agradecimentos: { incluir: true, paragrafos: [[{ texto: "Obrigado a todos." }]] },
    epigrafe: { incluir: true, paragrafos: [[{ texto: "Uma frase." }]], autoria: "Rubem Alves" },
    resumos: [
      { idioma: "pt-BR", trechos: [{ texto: "Este trabalho relata." }], palavrasChave: ["acolhimento", "saúde mental"] },
      { idioma: "en", trechos: [{ texto: "This paper reports." }], palavrasChave: ["welcoming", "mental health"] },
      { idioma: "es", trechos: [{ texto: "Este trabajo relata." }], palavrasChave: ["acogida"] },
    ],
    sumario: true,
  };
  const doc = (abertura = tudo, extra: Partial<Documento> = {}): Documento => ({ ...documentoVazio(), dados, abertura, blocos, ...extra });
  /** O número da página (a contagem) e a folha (física) onde o texto começa. */
  const inicioDoTexto = (typst: string) => {
    const marcado = typst.replace(`#metadata("texto") <apud-texto>`, `#metadata("texto") <apud-texto>\n#context [#metadata((contagem: counter(page).get().first(), folha: here().page())) <inicio>]`);
    return compilador.query({ mainFileContent: marcado }, { selector: "<inicio>" })[0].value as { contagem: number; folha: number };
  };

  it("arquivo sem abertura: o código e o PDF saem como antes (nada de capa, contagem ou título repetido)", () => {
    const semAbertura = documentoParaTypst({ ...documentoVazio(), blocos }, abnt);
    expect(semAbertura).not.toContain("apud-texto");
    expect(semAbertura).toContain("foreground: context place(");
    // Com título nos dados mas nada ligado, a ABNT também não muda.
    expect(documentoParaTypst({ ...documentoVazio(), dados, blocos }, abnt)).toBe(semAbertura);
  });

  it("ABNT: cada elemento na sua folha, na ordem da norma; a capa não conta e o número só aparece no texto", () => {
    const typst = documentoParaTypst(doc(), abnt);
    // capa, folha de rosto, dedicatória, agradecimentos, epígrafe, 3 resumos, sumário: 9 folhas antes do texto.
    expect(paginas(compilar(typst))).toBe(10);
    // A folha de rosto é a 1; o texto começa na folha 10, que é a página 9.
    expect(inicioDoTexto(typst)).toEqual({ contagem: 9, folha: 10 });
    expect(typst).toContain("query(<apud-texto>)");
    const ordem = ["Universidade do Vale do Itajaí", "Trabalho apresentado à disciplina", "À minha família", "AGRADECIMENTOS", "Rubem Alves", "RESUMO", "ABSTRACT", "RESUMEN", "SUMÁRIO"].map((t) => typst.indexOf(escaparTexto(t)));
    expect(ordem.every((p, i) => p >= 0 && (i === 0 || p > ordem[i - 1]))).toBe(true);
    // A página de título é da APA: não sai na ABNT.
    expect(typst).not.toContain("30 de novembro de 2026");
  });

  it("ABNT: capa e folha de rosto com os dados certos", () => {
    const typst = documentoParaTypst(doc(), abnt);
    expect(typst).toContain(`#strong[O acolhimento]: um relato`);
    expect(typst).toContain(escaparTexto("Professor(a): Profa. Marta"));
    expect(typst).toContain("pad(left: 50%");
    // Trabalho que não é de disciplina: o rótulo é de orientador.
    expect(documentoParaTypst(doc(tudo, { dados: { ...dados, tipo: "tcc" } }), abnt)).toContain(escaparTexto("Orientador(a): Profa. Marta"));
  });

  it("ABNT: capa sem instituição começa pelo autor; só a capa ligada, o texto começa na página 1", () => {
    const so = { ...documentoVazio().abertura, capa: true };
    const typst = documentoParaTypst(doc(so, { dados: { ...dados, instituicao: undefined, curso: undefined } }), abnt);
    expect(typst).toContain("grid(rows: (auto, 1fr, auto, 2fr, auto), [Ana Souza");
    expect(inicioDoTexto(typst)).toEqual({ contagem: 1, folha: 2 });
  });

  it("ABNT: resumo em espaço simples, sem recuo, e as palavras-chave em negrito, com ponto e vírgula e ponto final", () => {
    const typst = documentoParaTypst(doc(), abnt);
    expect(typst).toContain(`#strong[${escaparTexto("Palavras-chave:")}] ${escaparTexto("acolhimento; saúde mental.")}`);
    expect(typst).toContain(`#strong[${escaparTexto("Keywords:")}] ${escaparTexto("welcoming; mental health.")}`);
    expect(typst).toContain(`#strong[${escaparTexto("Palabras clave:")}] ${escaparTexto("acogida.")}`);
    expect(typst).toContain(`set text(lang: "en")`);
    expect(typst).toContain(`first-line-indent: (amount: 0pt, all: true))\n  [${escaparTexto("Este trabalho relata.")}]`);
  });

  it("ABNT: o sumário traz os títulos do texto com a página, e os rótulos antes do texto ficam de fora", () => {
    const typst = documentoParaTypst(doc(), abnt);
    expect(typst).toContain("outline(title: none, depth: 5)");
    expect(typst).toContain(`heading(level: 1, numbering: none, outlined: false)[RESUMO]`);
    const titulos = compilador.query({ mainFileContent: typst }, { selector: "heading.where(outlined: true)" }) as { body: { text?: string } }[];
    // Só os dois títulos do texto: RESUMO, AGRADECIMENTOS e SUMÁRIO ficam de fora.
    expect(titulos).toHaveLength(2);
  });

  it("versão sem identificação: os nomes do autor e do orientador não saem; o resto, sim", () => {
    const typst = documentoParaTypst(doc({ ...tudo, semIdentificacao: true }), abnt);
    expect(typst).not.toContain("Ana Souza");
    expect(typst).not.toContain("Profa. Marta");
    expect(typst).toContain("Universidade do Vale do Itajaí");
    expect(documentoParaTypst(doc({ ...tudo, semIdentificacao: true }), apa)).not.toContain("Ana Souza");
  });

  it("APA: página de título com tudo centralizado e a data por extenso; sem capa, dedicatória nem sumário", () => {
    const typst = documentoParaTypst(doc(), apa);
    expect(typst).toContain("#strong[O acolhimento: um relato]");
    expect(typst).toContain("Ana Souza e Bruno Lima");
    expect(typst).toContain("Psicologia, Universidade do Vale do Itajaí");
    expect(typst).toContain("30 de novembro de 2026");
    for (const fora of ["À minha família", "Rubem Alves", "SUMÁRIO", "outline("]) expect(typst).not.toContain(fora);
    // página de título + 3 resumos: o texto começa na folha 5, que é a página 5 (a APA conta e mostra desde a página de título).
    expect(inicioDoTexto(typst)).toEqual({ contagem: 5, folha: 5 });
    expect(typst).not.toContain("query(<apud-texto>)");
  });

  it("APA: resumo sem recuo; palavras-chave com recuo, rótulo em itálico, vírgulas e sem ponto", () => {
    const typst = documentoParaTypst(doc(), apa);
    expect(typst).toContain(`#emph[${escaparTexto("Palavras-chave:")}] ${escaparTexto("acolhimento, saúde mental")}]`);
    expect(typst).toContain(`#emph[${escaparTexto("Keywords:")}] ${escaparTexto("welcoming, mental health")}]`);
    expect(typst).toContain(`heading(level: 1, numbering: none, outlined: false)[Abstract]`);
  });

  it("APA: o título se repete no começo do texto (menos quando o texto já começa por ele)", () => {
    expect(documentoParaTypst(doc(), apa)).toContain(`#heading(level: 1, numbering: none, outlined: false)[O acolhimento: um relato]`);
    const comTitulo = doc(tudo, { blocos: [{ tipo: "titulo", nivel: 1, trechos: [{ texto: "O acolhimento: um relato" }] }, ...blocos] });
    expect(documentoParaTypst(comTitulo, apa)).not.toContain(`outlined: false)[O acolhimento: um relato]`);
    // A ABNT não repete o título.
    expect(documentoParaTypst(doc(), abnt)).not.toContain(`outlined: false)[O acolhimento`);
  });

  it("o documento de prova sai com a abertura nas duas normas", () => {
    const { documento } = documentoDeProva();
    for (const [norma, n] of [[normaAbnt, 8], [normaApa, 4]] as const) {
      const typst = documentoParaTypst(documento, norma.modelo, { csl: norma.csl });
      compilar(typst, documento);
      expect(inicioDoTexto(typst).contagem).toBe(n);
    }
  });
});

describe("pontuação dobrada na lista de referências", () => {
  const norma = carregarNorma("abnt.txt");
  const normaApa = carregarNorma("apa.txt");
  const doc = (referencias: Documento["referencias"]): Documento => ({
    ...documentoVazio(),
    referencias,
    blocos: [
      { tipo: "paragrafo", trechos: referencias.map((r) => ({ citacao: { tipo: "parenteses" as const, obras: [{ referencia: r.id }] } })) },
      { tipo: "referencias" },
    ],
  });
  const refs: Documento["referencias"] = [
    { id: "a", tipo: "livro", autores: [{ sobrenome: "Dias", prenomes: "André" }], titulo: "O que pode São Paulo?", data: { ano: 2022 }, cidade: "Belo Horizonte", editora: "Marginália" },
    { id: "b", tipo: "livro", autores: [{ sobrenome: "Lima", prenomes: "Ana" }], titulo: "Vozes", subtitulo: "a vida pode mais!", data: { ano: 2019 }, cidade: "Natal", editora: "EDUFRN" },
  ];

  it("as regras entram só dentro da lista", () => {
    const typst = documentoParaTypst(doc(refs), norma.modelo, { csl: norma.csl });
    const i = typst.indexOf("let apud-tira-ponto");
    expect(i).toBeGreaterThan(typst.indexOf("set block(spacing:"));
    expect(i).toBeLessThan(typst.indexOf("bibliography("));
    expect(typst.match(/let apud-tira-ponto/g)).toHaveLength(1);
  });

  it("nos endereços da lista, o hífen da quebra de linha não se repete na linha de baixo", () => {
    const typst = documentoParaTypst(doc(refs), norma.modelo, { csl: norma.csl });
    const i = typst.indexOf(`show link: set text(lang: "en")`);
    expect(i).toBeGreaterThan(typst.indexOf("set block(spacing:"));
    expect(i).toBeLessThan(typst.indexOf("bibliography("));
  });

  it("nas duas normas, o PDF compila com título terminado em ? e subtítulo terminado em !", () => {
    for (const { modelo: perfil, csl } of [norma, normaApa]) {
      const d = doc(refs);
      expect(paginas(compilar(documentoParaTypst(d, perfil, { csl }), d))).toBeGreaterThan(0);
    }
  });

  it("sem o ponto depois do ? ou do !, também quando o ? está no fim do negrito ou do itálico", () => {
    // A mesma regra, aplicada a referências escritas à mão: a sonda guarda o texto de cada bloco já corrigido.
    const sonda = (corpo: string) => String.raw`#{${PONTUACAO_DA_LISTA}
  show block: it => { [#metadata(repr(it.body))<sonda>]; it }
  block[${corpo}]
}`;
    const texto = (corpo: string) => (compilador.query({ mainFileContent: sonda(corpo) }, { selector: "<sonda>", field: "value" }) as string[]).at(-1)!;
    expect(texto("Dias. *O que pode São Paulo?*. Belo Horizonte")).not.toMatch(/\[\. /);
    expect(texto("Dias. *Título*. Belo Horizonte")).toMatch(/\[\. /);
    // "!." no mesmo texto: a regra age na montagem do texto, então se confere pelo HTML.
    const html = compilador.tryHtml({ mainFileContent: `#{${PONTUACAO_DA_LISTA}\n  [Lima. _Vozes_: a vida pode mais!. Natal. Fim?.]\n}` }).result!.html();
    expect(html).toContain("a vida pode mais! Natal. Fim?</p>");
  });
});

describe("marcas da prévia (acompanhar o cursor)", () => {
  const { modelo: perfil } = carregarNorma("abnt.txt");
  const doc: Documento = {
    ...documentoVazio(),
    blocos: [
      { tipo: "titulo", nivel: 1, trechos: [{ texto: "1 Introdução" }] },
      { tipo: "paragrafo", trechos: [] },
      { tipo: "paragrafo", trechos: [{ texto: "Texto." }] },
      { tipo: "quebra" },
      { tipo: "paragrafo", trechos: [{ texto: "Outra página." }] },
    ],
  };

  it("o PDF exportado não leva marcas", () => {
    expect(documentoParaTypst(doc, perfil)).not.toContain(MARCA_DO_BLOCO);
  });

  it("na prévia, cada bloco com conteúdo ganha a marca, e o motor diz a página e a altura de cada uma", () => {
    const typst = documentoParaTypst(doc, perfil, { marcarBlocos: true });
    expect(typst).toContain(`#metadata(0) <${MARCA_DO_BLOCO}>`);
    expect(typst).not.toContain(`#metadata(1) <${MARCA_DO_BLOCO}>`); // parágrafo vazio não sai no PDF
    const [posicoes] = compilador.query({ mainFileContent: typst }, { selector: `<${MARCA_DAS_POSICOES}>`, field: "value" }) as number[][][];
    expect(posicoes.map((p) => p[0])).toEqual([0, 2, 3, 4]);
    expect(posicoes[0][1]).toBe(1);
    expect(posicoes[3][1]).toBe(2); // depois da quebra, na página 2
    expect(posicoes[0][2]).toBeGreaterThan(0);
  });

  it("as marcas não mudam a página: o mesmo número de páginas com e sem elas", () => {
    const { documento } = documentoDeProva();
    const norma = carregarNorma("abnt.txt");
    mapearImagens(compilador, documento);
    const sem = paginas(compilar(documentoParaTypst(documento, norma.modelo, { csl: norma.csl }), documento));
    const com = paginas(compilar(documentoParaTypst(documento, norma.modelo, { csl: norma.csl, marcarBlocos: true }), documento));
    expect(com).toBe(sem);
  });
});
