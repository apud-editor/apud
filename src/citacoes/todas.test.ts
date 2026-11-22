// As citações do trabalho montadas de uma vez: a ordem, o que depende de outras
// citações, e os avisos (na citação e no texto), nas duas normas.

import { describe, expect, it } from "vitest";
import { carregarNorma, documentoDeProva } from "../../scripts/prova-lib";
import { documentoVazio, type Bloco, type Citacao, type Documento, type Referencia } from "../documento/modelo";
import { citacoesDoTexto } from "./motor";
import { avisosDoTexto, montarTodas, previaDaCitacao, textoDaCitacao } from "./todas";

const livro = (id: string, autores: string[], ano: number, titulo = `Obra ${id}`): Referencia => ({
  id,
  tipo: "livro",
  autores: autores.map((a) => {
    const [sobrenome, prenomes] = a.split(",").map((s) => s.trim());
    return prenomes ? { sobrenome, prenomes } : { sobrenome };
  }),
  titulo,
  data: { ano },
  editora: "Vozes",
  cidade: "Petrópolis",
});
const par = (id: string, pagina?: string): Citacao => ({
  tipo: "parenteses",
  obras: [{ referencia: id, ...(pagina ? { localizador: { tipo: "pagina" as const, valor: pagina } } : {}) }],
});
const narr = (id: string): Citacao => ({ tipo: "narrativa", obra: { referencia: id } });
const paragrafo = (...citacoes: Citacao[]): Bloco => ({ tipo: "paragrafo", trechos: citacoes.flatMap((citacao) => [{ texto: " e " }, { citacao }]) });
const doc = (blocos: Bloco[], referencias: Referencia[]): Documento => ({ ...documentoVazio(), referencias, blocos });
const textos = (norma: string, d: Documento, ajustes: Record<string, string> = {}) =>
  montarTodas(d, carregarNorma(norma, ajustes).perfil).map(textoDaCitacao);

describe("todas as citações do texto, na ordem", () => {
  const refs = [livro("a", ["Souza, Eva"], 2020, "Alfa"), livro("b", ["Souza, Eva"], 2020, "Beta"), livro("lima", ["Lima, Ana", "Costa, Bruno", "Reis, Carla"], 2018)];

  it("devolve uma por citação, na ordem do texto (parágrafos, títulos e listas)", () => {
    const d = doc(
      [
        { tipo: "titulo", nivel: 1, trechos: [{ citacao: par("a") }] },
        paragrafo(narr("lima")),
        { tipo: "lista", sequencia: false, itens: [{ trechos: [{ citacao: par("b") }], subitens: [{ trechos: [{ citacao: par("lima") }] }] }] },
      ],
      refs,
    );
    expect(citacoesDoTexto(d.blocos)).toHaveLength(4);
    expect(textos("abnt.txt", d)).toEqual(["(Souza, 2020a)", "Lima, Costa e Reis (2018)", "(Souza, 2020b)", "(Lima; Costa; Reis, 2018)"]);
    expect(textos("apa.txt", d)).toEqual(["(Souza, 2020a)", "Lima et al. (2018)", "(Souza, 2020b)", "(Lima et al., 2018)"]);
  });

  it("as letras 2020a e 2020b só aparecem quando as duas obras são citadas, e acompanham o texto todo", () => {
    expect(textos("abnt.txt", doc([paragrafo(par("a"))], refs))).toEqual(["(Souza, 2020)"]);
    // Citar a obra B depois muda a primeira citação: por isso o texto é montado todo de uma vez.
    expect(textos("abnt.txt", doc([paragrafo(par("a")), paragrafo(par("b"))], refs))).toEqual(["(Souza, 2020a)", "(Souza, 2020b)"]);
  });

  it("depende da ordem: na APA, a escolha “todos os autores na primeira vez” vale só para a primeira citação", () => {
    const d = doc([paragrafo(narr("lima"), narr("lima"))], refs);
    expect(textos("apa.txt", d)).toEqual(["Lima et al. (2018)", "Lima et al. (2018)"]);
    expect(textos("apa.txt", d, { "citação, primeira vez com três a cinco autores": "todos os autores" })).toEqual([
      "Lima, Costa e Reis (2018)",
      "Lima et al. (2018)",
    ]);
  });

  it("mudar a norma ou uma escolha do autor muda todas as citações", () => {
    const d = doc([paragrafo(par("lima", "4"))], refs);
    expect(textos("abnt.txt", d)).toEqual(["(Lima; Costa; Reis, 2018, p. 4)"]);
    expect(textos("apa.txt", d)).toEqual(["(Lima et al., 2018, p. 4)"]);
    expect(textos("abnt.txt", d, { "autores, quatro ou mais": "primeiro com et al." })).toEqual(["(Lima; Costa; Reis, 2018, p. 4)"]);
  });

  it("o documento de prova: 30 citações montadas, sem erro, nas duas normas", () => {
    const { documento } = documentoDeProva();
    for (const norma of ["abnt.txt", "apa.txt"]) {
      const todas = montarTodas(documento, carregarNorma(norma).perfil);
      expect(todas).toHaveLength(30);
      for (const m of todas) expect(textoDaCitacao(m).length).toBeGreaterThan(2);
    }
  });
});

describe("avisos na citação", () => {
  const refs = [livro("s", ["Silva, Ana"], 2019), { ...livro("semdata", ["Dias, Eva"], 2000), data: undefined } as Referencia];
  const montar = (norma: string, c: Citacao, referencias = refs) =>
    previaDaCitacao([], referencias, carregarNorma(norma).perfil, c);
  const tipos = (norma: string, c: Citacao, referencias = refs) => montar(norma, c, referencias).avisos.map((a) => a.tipo);

  it("referência apagada: o texto diz isso e o aviso explica", () => {
    const m = montar("abnt.txt", par("sumiu"));
    expect(textoDaCitacao(m)).toBe("(referência apagada)");
    expect(m.avisos.map((a) => a.tipo)).toEqual(["referencia-apagada"]);
    expect(m.avisos[0].mensagem).toMatch(/não existe mais/);
  });

  it("citação direta sem página", () => {
    expect(tipos("abnt.txt", { tipo: "parenteses", direta: true, obras: [{ referencia: "s" }] })).toEqual(["direta-sem-pagina"]);
    expect(tipos("abnt.txt", { tipo: "parenteses", direta: true, obras: [{ referencia: "s", localizador: { tipo: "pagina", valor: "3" } }] })).toEqual([]);
    expect(tipos("abnt.txt", par("s"))).toEqual([]);
  });

  it("obra sem data na ABNT (e só na ABNT)", () => {
    expect(tipos("abnt.txt", par("semdata"))).toEqual(["sem-data"]);
    expect(tipos("apa.txt", par("semdata"))).toEqual([]);
  });

  it("fala sem referência vazia", () => {
    expect(tipos("abnt.txt", { tipo: "sem-referencia", texto: " " })).toEqual(["sem-referencia-vazia"]);
  });
});

describe("avisos no texto: a lista de referências", () => {
  const lista: Bloco = { tipo: "referencias" };
  const comCitacao = paragrafo(par("a"));

  it("há citações e falta a lista", () => {
    expect(avisosDoTexto([comCitacao]).map((a) => a.tipo)).toEqual(["sem-lista"]);
  });
  it("a lista aparece mais de uma vez", () => {
    const avisos = avisosDoTexto([comCitacao, lista, lista]);
    expect(avisos.map((a) => a.tipo)).toEqual(["lista-repetida"]);
    expect(avisos[0].mensagem).toContain("2 vezes");
  });
  it("tudo certo: uma lista só, ou sem citações, ou só falas sem referência", () => {
    expect(avisosDoTexto([comCitacao, lista])).toEqual([]);
    expect(avisosDoTexto([{ tipo: "paragrafo", trechos: [{ texto: "oi" }] }])).toEqual([]);
    expect(avisosDoTexto([paragrafo({ tipo: "sem-referencia", texto: "Usuária A" })])).toEqual([]);
  });
  it("citação de obra dentro de lista conta; lista de referências de sobra sem citações também avisa", () => {
    expect(avisosDoTexto([{ tipo: "lista", sequencia: false, itens: [{ trechos: [{ citacao: par("a") }] }] }]).map((a) => a.tipo)).toEqual(["sem-lista"]);
    expect(avisosDoTexto([lista, lista]).map((a) => a.tipo)).toEqual(["lista-repetida"]);
  });
});
