import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { documentoVazio, imagensUsadas, textoSimples, textosDosBlocos, type Bloco, type Citacao } from "./modelo";
import {
  blocosDoEditor,
  editorDosBlocos,
  NO_DA_CITACAO,
  NO_DA_FIGURA,
  NO_DA_FONTE_DA_ILUSTRACAO,
  NO_DA_NOTA,
  NO_DA_NOTA_DA_ILUSTRACAO,
  NO_DA_TABELA,
  NO_DO_TITULO_DA_ILUSTRACAO,
} from "./tiptap";
import { citacoesDoTexto } from "../citacoes/motor";
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
    { tipo: "referencias" },
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
      "",
    ]);
    expect(estrutura(exemplo.blocos).at(-1)).toMatchObject({ referencias: true, nivel: 1 });
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

// ---------------------------------------------------------------------------
// Fase 3: citação longa, nota de rodapé, figura e tabela

const nota = (texto: string) => ({ nota: { trechos: [{ texto }, { texto: " em itálico", marcas: ["italico" as const] }] } });

const BLOCOS_DA_FASE_3: Bloco[] = [
  {
    tipo: "paragrafo",
    trechos: [{ texto: "O acolhimento" }, nota("Ver o manual do serviço."), { texto: " começa na porta" }, nota("Segunda nota."), { texto: "." }],
  },
  {
    tipo: "citacaoLonga",
    trechos: [
      { texto: "A supervisão de estágio não se limita à correção de tarefas: ela cria um espaço " },
      { texto: "para nomear", marcas: ["italico"] },
      { texto: " o que se viu " },
      { citacao: cParenteses },
      { texto: "." },
    ],
  },
  {
    tipo: "figura",
    imagem: "img-a1b2",
    especie: "grafico",
    largura: 60,
    titulo: [{ texto: "Atendimentos por mês em " }, { texto: "2025", marcas: ["negrito"] }],
    fonte: [{ citacao: cNarrativa }, { texto: ", adaptado" }],
    nota: [{ texto: "Dados do serviço." }],
  },
  { tipo: "figura", imagem: "img-c3d4", titulo: [{ texto: "Fluxo do atendimento" }], fonte: [], fontePropria: true },
  {
    tipo: "figura",
    imagem: "img-c3d4",
    titulo: [{ texto: "Fonte guardada mesmo sendo própria" }],
    fonte: [{ texto: "Silva (2019)" }],
    fontePropria: true,
  },
  {
    tipo: "tabela",
    titulo: [{ texto: "Usuários atendidos" }],
    cabecalho: 1,
    linhas: [
      [[{ texto: "Grupo" }], [{ texto: "Total" }]],
      [[{ texto: "Adultos", marcas: ["italico"] }], [{ texto: "12" }]],
      [[{ texto: "Idosos " }, { citacao: cApud }], []],
    ],
    fonte: [{ citacao: cSemReferencia }],
  },
  {
    tipo: "tabela",
    titulo: [],
    cabecalho: 2,
    linhas: [
      [[{ texto: "a" }], [{ texto: "b" }], [{ texto: "c" }]],
      [[{ texto: "d" }], [{ texto: "e" }], [{ texto: "f" }]],
      [[{ texto: "g" }], [], []],
    ],
    fonte: [{ texto: "IBGE" }],
    nota: [{ texto: "Nota da tabela." }],
  },
  { tipo: "tabela", titulo: [{ texto: "Sem cabeçalho" }], cabecalho: 0, linhas: [[[{ texto: "só" }]]], fonte: [] },
  { tipo: "paragrafo", trechos: [] },
];

describe("fase 3: blocos novos entre o Apud e o editor", () => {
  it("ida e volta de cada bloco novo não muda nada", () => {
    expect(blocosDoEditor(editorDosBlocos(BLOCOS_DA_FASE_3))).toEqual(BLOCOS_DA_FASE_3);
  });

  it("cada bloco novo, sozinho, também vai e volta igual", () => {
    for (const b of BLOCOS_DA_FASE_3) expect(blocosDoEditor(editorDosBlocos([b]))).toEqual([b]);
  });

  it("a nota de rodapé é um nó no ponto do número, com o texto da nota dentro", () => {
    const json = editorDosBlocos([BLOCOS_DA_FASE_3[0]]);
    expect(json.content![0].content![1]).toEqual({ type: NO_DA_NOTA, attrs: { dados: nota("Ver o manual do serviço.").nota } });
  });

  it("figura e tabela têm as partes na ordem do PDF: título, imagem ou grade, fonte e nota", () => {
    const [figura, tabela] = editorDosBlocos([BLOCOS_DA_FASE_3[2], BLOCOS_DA_FASE_3[5]]).content!;
    expect(figura.content!.map((c) => c.type)).toEqual([NO_DO_TITULO_DA_ILUSTRACAO, NO_DA_FONTE_DA_ILUSTRACAO, NO_DA_NOTA_DA_ILUSTRACAO]);
    expect(figura.attrs).toEqual({ imagem: "img-a1b2", especie: "grafico", largura: 60, fontePropria: false });
    expect(tabela.content!.map((c) => c.type)).toEqual([NO_DO_TITULO_DA_ILUSTRACAO, "table", NO_DA_FONTE_DA_ILUSTRACAO, NO_DA_NOTA_DA_ILUSTRACAO]);
    const linhas = tabela.content![1].content!;
    expect(linhas.map((l) => l.content!.map((c) => c.type))).toEqual([
      ["tableHeader", "tableHeader"],
      ["tableCell", "tableCell"],
      ["tableCell", "tableCell"],
    ]);
  });

  it("a grade sai sempre retangular, sem perder texto de células juntadas nem de linhas mais curtas", () => {
    const celula = (tipo: string, texto: string, colspan = 1): JSONContent => ({
      type: tipo,
      attrs: { colspan },
      content: [{ type: "paragraph", content: texto ? [{ type: "text", text: texto }] : [] }],
    });
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: NO_DA_TABELA,
          attrs: { fontePropria: false },
          content: [
            { type: NO_DO_TITULO_DA_ILUSTRACAO },
            {
              type: "table",
              content: [
                { type: "tableRow", content: [celula("tableHeader", "Ano", 2), celula("tableHeader", "Total")] },
                { type: "tableRow", content: [celula("tableHeader", "x"), celula("tableCell", "y")] },
                { type: "tableRow", content: [] },
                { type: "tableRow", content: [celula("tableCell", "só uma")] },
              ],
            },
            { type: NO_DA_FONTE_DA_ILUSTRACAO },
            { type: NO_DA_NOTA_DA_ILUSTRACAO },
          ],
        },
      ],
    };
    expect(blocosDoEditor(json)).toEqual([
      {
        tipo: "tabela",
        titulo: [],
        fonte: [],
        cabecalho: 1,
        linhas: [
          [[{ texto: "Ano" }], [], [{ texto: "Total" }]],
          [[{ texto: "x" }], [{ texto: "y" }], []],
          [[{ texto: "só uma" }], [], []],
        ],
      },
    ]);
  });

  it("uma célula com dois parágrafos vira um texto só, sem perder nada", () => {
    const json: JSONContent = {
      type: "doc",
      content: [
        {
          type: NO_DA_TABELA,
          content: [
            {
              type: "table",
              content: [
                {
                  type: "tableRow",
                  content: [
                    {
                      type: "tableCell",
                      content: [
                        { type: "paragraph", content: [{ type: "text", text: "um" }] },
                        { type: "paragraph", content: [{ type: "text", text: "dois" }] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(blocosDoEditor(json)).toEqual([{ tipo: "tabela", titulo: [], fonte: [], cabecalho: 0, linhas: [[[{ texto: "um dois" }]]] }]);
  });

  it("largura inválida e espécie desconhecida não são guardadas (valem o padrão)", () => {
    const json: JSONContent = {
      type: "doc",
      content: [{ type: NO_DA_FIGURA, attrs: { imagem: "i", especie: "mapa", largura: 5 } }],
    };
    expect(blocosDoEditor(json)).toEqual([{ tipo: "figura", imagem: "i", titulo: [], fonte: [] }]);
  });

  it("largura de 100% é guardada: é a largura toda do texto, diferente de não escolher (tamanho da imagem)", () => {
    const figura = (largura: number | null): JSONContent => ({ type: "doc", content: [{ type: NO_DA_FIGURA, attrs: { imagem: "i", largura } }] });
    expect(blocosDoEditor(figura(100))).toEqual([{ tipo: "figura", imagem: "i", largura: 100, titulo: [], fonte: [] }]);
    expect(blocosDoEditor(figura(null))).toEqual([{ tipo: "figura", imagem: "i", titulo: [], fonte: [] }]);
  });

  it("o texto simples ignora as notas", () => {
    expect(textoSimples([{ texto: "a" }, nota("nota"), { texto: "b" }])).toBe("ab");
  });

  it("percorre todo o texto na ordem de leitura, inclusive figuras e tabelas", () => {
    const citacoes = citacoesDoTexto(BLOCOS_DA_FASE_3);
    expect(citacoes).toEqual([cParenteses, cNarrativa, cApud, cSemReferencia]);
    expect(textosDosBlocos([BLOCOS_DA_FASE_3[6]]).map(textoSimples)).toEqual(["", "a", "b", "c", "d", "e", "f", "g", "", "", "IBGE", "Nota da tabela."]);
  });

  it("as imagens usadas são as das figuras", () => {
    expect([...imagensUsadas(BLOCOS_DA_FASE_3)]).toEqual(["img-a1b2", "img-c3d4"]);
  });

  it("um documento vazio tem a abertura sem blocos e os dados sem título", () => {
    const d = documentoVazio();
    expect(d.versao).toBe(7);
    expect(d.dados).toEqual({ tipo: "disciplina", idioma: "pt-BR", titulo: "", autores: [] });
    expect(d.abertura).toEqual({ blocos: [], guardados: [], semIdentificacao: false });
    expect(d.imagens).toEqual([]);
  });
});
