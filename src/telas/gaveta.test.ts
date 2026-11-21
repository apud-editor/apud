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

describe("busca pelo DOI na gaveta", () => {
  it("o campo do DOI fica no topo, antes das fontes e de 'Adicionar à mão', com o botão Buscar", () => {
    const html = gaveta([]);
    expect(html).toContain("Buscar pelo DOI");
    expect(html).toContain("Cole o DOI aqui");
    expect(html).toContain(">Buscar<");
    expect(html).toContain("https://doi.org/");
    expect(html.indexOf("Buscar pelo DOI")).toBeLessThan(html.indexOf("Fontes cadastradas"));
    expect(html.indexOf("Buscar pelo DOI")).toBeLessThan(html.indexOf("Adicionar à mão"));
    // Parada, a busca não mostra erro, "buscando" nem fonte repetida.
    expect(html).not.toContain("Buscando no Crossref");
    expect(html).not.toContain("role=\"alert\"");
    expect(html).not.toContain("Cancelar");
  });

  it("o campo tem rótulo ligado e não corrige a digitação", () => {
    const html = gaveta([]);
    expect(html).toMatch(/<label[^>]*for="doi-da-fonte"[^>]*>Buscar pelo DOI<\/label>/);
    expect(html).toMatch(/<input[^>]*id="doi-da-fonte"/);
    // (O gerador de HTML do React escreve esses dois atributos com maiúscula no meio.)
    expect(html).toContain('autoComplete="off"');
    expect(html).toContain('spellCheck="false"');
  });

  it("aparece nas duas normas, e os resumos continuam: o DOI não atrapalha a lista", () => {
    for (const norma of ["abnt.txt", "apa.txt"]) {
      const html = gaveta([livro("a", "Silva", "Psicologia clínica")], norma);
      expect(html).toContain("Buscar pelo DOI");
      expect(html).toContain("Psicologia clínica");
    }
  });
});

describe("formulário que veio do DOI", () => {
  const base: Referencia = {
    id: "novo",
    tipo: "artigo",
    autores: [{ sobrenome: "Lima", prenomes: "Ana" }],
    titulo: "Supervisão no estágio",
    doi: "10.1234/rpa.2018.0012",
    publicacao: { titulo: "Revista de Psicologia Aplicada" },
  };
  const abrir = (origemDoi?: { avisos: string[] }) =>
    renderToStaticMarkup(createElement(FormularioDeReferencia, { base, origemDoi, existentes: [], aoSalvar: nada, aoCancelar: nada }));

  it("diz que os dados vieram do Crossref, que a pessoa deve conferir e que nada foi salvo ainda", () => {
    const html = abrir({ avisos: [] });
    expect(html).toContain("Conferir a fonte do DOI");
    expect(html).toContain("vieram do Crossref");
    expect(html).toContain("só entra no trabalho quando você clicar em “Salvar fonte”");
    expect(html).toContain("ficou em branco");
    expect(html).toContain("Salvar fonte");
    expect(html).toContain("Cancelar");
  });

  it("mostra cada aviso, e o formulário vem preenchido", () => {
    const html = abrir({ avisos: ["O título veio todo em maiúsculas.", "Um autor veio só com um nome."] });
    expect(html).toContain("O título veio todo em maiúsculas.");
    expect(html).toContain("Um autor veio só com um nome.");
    expect(html).toContain('value="Supervisão no estágio"');
    expect(html).toContain('value="Lima"');
    expect(html).toContain('value="Revista de Psicologia Aplicada"');
  });

  it("sem avisos, não desenha uma lista vazia", () => {
    expect(abrir({ avisos: [] })).not.toContain("<ul");
  });

  it("mostra o DOI que fica guardado com a fonte", () => {
    expect(abrir({ avisos: [] })).toContain("10.1234/rpa.2018.0012");
  });

  it("fonte editada à mão (sem DOI trazido) não mostra o aviso do Crossref", () => {
    const html = abrir(undefined);
    expect(html).toContain("Editar fonte");
    expect(html).not.toContain("Crossref");
    expect(html).not.toContain("Conferir a fonte do DOI");
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
      expect(pagina.includes("Organizadores d")).toBe(tipo === "capitulo" || tipo === "evento");
      // Só o livro tem a caixa "são os organizadores"; todos têm as notas.
      expect(pagina.includes('type="checkbox"')).toBe(tipo === "livro");
      expect(pagina).toContain("Notas (tradução, publicação original…)");
    });
  }

  it("a lista de tipos tem os 10, os mais comuns primeiro", () => {
    const pagina = html("livro");
    const posicoes = TIPOS_NO_FORMULARIO.map((t) => pagina.indexOf(`>${NOME_DO_TIPO_NA_TELA[t]}<`));
    expect(posicoes.every((p) => p > 0)).toBe(true);
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  });
});
