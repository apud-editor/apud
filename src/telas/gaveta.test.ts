// A gaveta desenhada sem navegador (renderToStaticMarkup): confere que a tela
// monta, mostra o que deve e só pede o que cada tipo usa.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { carregarPerfil } from "../../scripts/prova-lib";
import type { Bloco, Referencia } from "../documento/modelo";
import { escolhasDoAutor } from "../referencias/escolhas";
import { camposDoTipo, DESCRICAO_DOS_TIPOS, NOME_DO_TIPO_NA_TELA, TIPOS_NO_FORMULARIO } from "../referencias/formulario";
import FormularioDeReferencia from "./FormularioDeReferencia";
import Gaveta from "./Gaveta";

const livro = (id: string, sobrenome: string, titulo: string): Referencia => ({ id, tipo: "livro", autores: [{ sobrenome }], titulo, data: { ano: 2019 } });
const nada = () => {};
const texto: Bloco[] = [{ tipo: "paragrafo", trechos: [{ citacao: { tipo: "parenteses", obras: [{ referencia: "a" }, { referencia: "a" }] } }] }];

function gaveta(referencias: Referencia[], norma = "abnt.txt") {
  const escolhas = escolhasDoAutor(carregarPerfil(norma).perfil);
  return renderToStaticMarkup(
    createElement(Gaveta, {
      referencias,
      escolhas,
      nomeDaNorma: norma === "abnt.txt" ? "ABNT" : "APA",
      lerBlocos: () => texto,
      mudancas: new EventTarget(),
      aoSalvar: nada,
      aoApagar: nada,
      aoEscolher: nada,
      aoFechar: nada,
    }),
  );
}

describe("gaveta de referências", () => {
  it("sem fontes, explica como começar; com fontes, mostra o resumo e quantas vezes cada uma é citada", () => {
    expect(gaveta([])).toContain("Nenhuma fonte ainda");
    const html = gaveta([livro("b", "Souza", "O diário de campo"), livro("a", "Silva", "Psicologia clínica")]);
    expect(html).toContain("2 fontes");
    expect(html).toContain("citada 2 vezes");
    expect(html).toContain("ainda não citada");
    // Ordem alfabética: Silva antes de Souza.
    expect(html.indexOf("Silva")).toBeLessThan(html.indexOf("Souza"));
    expect(html).toContain("Adicionar à mão");
    expect(html).toContain("Buscar por autor ou título");
  });

  it("mostra as escolhas do autor da norma, com o padrão marcado", () => {
    const abnt = gaveta([]);
    expect(abnt).toContain("Escolhas do autor");
    expect(abnt).toContain("Prenomes na lista de referências");
    expect(abnt).toContain("Por extenso");
    expect(abnt).toContain("(padrão da norma)");
    const apa = gaveta([], "apa.txt");
    expect(apa).toContain("Cidade da editora na lista");
    expect(apa).not.toContain("Destaque do título na lista");
  });
});

describe("formulário na tela", () => {
  const html = (tipo: (typeof TIPOS_NO_FORMULARIO)[number]) => {
    const base: Referencia = { id: "x", tipo, autores: [], titulo: "T" };
    return renderToStaticMarkup(createElement(FormularioDeReferencia, { base, existentes: [], aoSalvar: nada, aoCancelar: nada }));
  };

  for (const tipo of TIPOS_NO_FORMULARIO) {
    it(`${NOME_DO_TIPO_NA_TELA[tipo]}: mostra os campos do tipo e não o DOI`, () => {
      const pagina = html(tipo);
      for (const c of camposDoTipo(tipo)) expect(pagina, c.rotulo).toContain(c.rotulo);
      expect(pagina).toContain(DESCRICAO_DOS_TIPOS[tipo].rotuloDosAutores);
      expect(pagina).toContain("Data de acesso");
      expect(pagina).toContain("Ou data incerta");
      expect(pagina).not.toContain("DOI");
      expect(pagina.includes("Total de folhas")).toBe(tipo === "tese");
      expect(pagina.includes("Organizadores")).toBe(tipo === "capitulo" || tipo === "evento");
    });
  }

  it("a lista de tipos tem os 10, os mais comuns primeiro", () => {
    const pagina = html("livro");
    const posicoes = TIPOS_NO_FORMULARIO.map((t) => pagina.indexOf(`>${NOME_DO_TIPO_NA_TELA[t]}<`));
    expect(posicoes.every((p) => p > 0)).toBe(true);
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  });
});
