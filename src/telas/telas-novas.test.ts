// As telas da parte 5 desenhadas sem navegador (renderToStaticMarkup): conferem
// que montam e mostram o que devem. O uso de verdade (digitar, clicar) é visto
// num Chrome real fora do repositório.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { carregarPerfil } from "../../scripts/prova-lib";
import { aberturaVazia, dadosVazios, type Abertura } from "../documento/modelo";
import { escolhasDoAutor } from "../referencias/escolhas";
import AberturaDoTrabalho from "./AberturaDoTrabalho";
import Assistente from "./Assistente";
import Configuracoes, { ABAS, type AbaDasConfiguracoes } from "./Configuracoes";

const nada = () => {};
const abnt = carregarPerfil("abnt.txt").perfil;
const apa = carregarPerfil("apa.txt").perfil;

const abertura = (p: Partial<Abertura> = {}): Abertura => ({ ...aberturaVazia(), ...p });
const dados = { ...dadosVazios(), titulo: "Meu trabalho", autores: ["Maria Silva"] };

function areaDaAbertura(a: Abertura, norma: "ABNT" | "APA", d = dados) {
  return renderToStaticMarkup(
    createElement(AberturaDoTrabalho, { abertura: a, dados: d, nomeDaNorma: norma, perfil: norma === "ABNT" ? abnt : apa, aoMudar: nada, aoConfigurar: nada }),
  );
}

function configuracoes(aba: AbaDasConfiguracoes, norma: "ABNT" | "APA" = "ABNT", a = abertura()) {
  const perfil = norma === "ABNT" ? abnt : apa;
  return renderToStaticMarkup(
    createElement(Configuracoes, {
      aba,
      aoTrocarAba: nada,
      dados,
      abertura: a,
      nomeDaNorma: norma,
      perfil,
      normas: ["ABNT", "APA"],
      escolhas: escolhasDoAutor(perfil),
      aoMudarDados: nada,
      aoMudarAbertura: nada,
      aoTrocarNorma: nada,
      aoEscolher: nada,
      aoFechar: nada,
    }),
  );
}

describe("assistente de novo trabalho", () => {
  it("começa pelo passo 1: tipo e norma, sem criar nada", () => {
    const html = renderToStaticMarkup(createElement(Assistente, { aoCriar: nada, aoCancelar: nada }));
    expect(html).toContain("Que trabalho é este?");
    for (const t of ["Trabalho de disciplina", "Relatório de estágio", "Artigo", "Trabalho de conclusão de curso"]) expect(html).toContain(t);
    expect(html).toContain("ABNT");
    expect(html).toContain("APA");
    expect(html).toContain("Tipo e norma");
    expect(html).toContain("Continuar");
  });
});

describe("Configurações do trabalho", () => {
  it("tem as quatro abas, com a escolhida marcada", () => {
    const html = configuracoes("dados");
    for (const a of ABAS) expect(html).toContain(a.nome);
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/id="aba-dados"[^>]*aria-selected="true"/);
  });

  it("aba Dados: os campos do trabalho", () => {
    const html = configuracoes("dados");
    for (const c of ["Título do trabalho", "Autores", "Ano", "Cidade", "Curso", "Instituição", "Disciplina", "Data de entrega", "Natureza do trabalho"]) expect(html).toContain(c);
    expect(html).toContain("Meu trabalho");
    expect(html).toContain("Maria Silva");
  });

  it("aba Dados na APA diz que o orientador aparece como Professor", () => {
    expect(configuracoes("dados", "APA")).toContain("Professor (ou orientador)");
  });

  it("aba Elementos: na ABNT oferece capa e sumário; na APA avisa que a norma não tem", () => {
    const abnt = configuracoes("elementos");
    expect(abnt).toContain("Capa");
    expect(abnt).toContain("Sumário");
    // A ABNT não tem página de título (é da APA): só ela recebe o aviso.
    expect(abnt.match(/A ABNT não tem este elemento/g)).toHaveLength(1);
    const apa = configuracoes("elementos", "APA");
    expect(apa).toContain("A APA não tem este elemento");
    expect(apa).toContain("Versão sem identificação");
  });

  it("aba Escolhas do autor: as escolhas da norma com o padrão marcado", () => {
    const abnt = configuracoes("escolhas");
    expect(abnt).toContain("Prenomes na lista de referências");
    expect(abnt).toContain("(padrão da norma)");
    expect(configuracoes("escolhas", "APA")).toContain("Cidade da editora na lista");
  });

  it("aba Trabalho: tipo, norma e idioma", () => {
    const html = configuracoes("trabalho");
    expect(html).toContain("Tipo de trabalho");
    expect(html).toContain("Trabalho de disciplina");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("português do Brasil");
  });
});

describe("Abertura do trabalho no editor", () => {
  it("sem nada ligado, fica fechada e diz que não há nada ligado", () => {
    const html = areaDaAbertura(abertura(), "ABNT");
    expect(html).toContain("Abertura do trabalho");
    expect(html).toContain("nada ligado ainda");
    expect(html).not.toContain("Editar dados");
  });

  it("com capa, folha de rosto e sumário ligados, mostra os cartões e o que entra no PDF", () => {
    const html = areaDaAbertura(abertura({ capa: true, folhaDeRosto: true, sumario: true }), "ABNT");
    expect(html).toContain("Capa");
    expect(html).toContain("Folha de rosto");
    expect(html).toContain("Entra no PDF");
    expect(html).toContain("Montado com os títulos numerados");
    expect(html).toContain("Dedicatória");
    expect(html).toContain("Adicionar resumo");
  });

  it("avisa quando falta o título para a capa", () => {
    expect(areaDaAbertura(abertura({ capa: true }), "ABNT", { ...dados, titulo: "" })).toContain("Falta o título");
  });

  it("na APA mostra a página de título e não oferece capa nem dedicatória", () => {
    const html = areaDaAbertura(abertura({ paginaDeTitulo: true }), "APA");
    expect(html).toContain("Página de título");
    expect(html).not.toContain("Dedicatória");
    expect(html).not.toContain("Folha de rosto");
  });

  it("na APA, elemento da ABNT que já estava ligado aparece avisando que não sai", () => {
    const html = areaDaAbertura(abertura({ capa: true }), "APA");
    expect(html).toContain("A APA não tem: não sai no PDF");
  });

  it("mostra cada resumo com o idioma", () => {
    const html = areaDaAbertura(
      abertura({ resumos: [{ idioma: "pt-BR", trechos: [{ texto: "Texto." }], palavrasChave: ["a", "b"] }, { idioma: "en", trechos: [], palavrasChave: [] }] }),
      "ABNT",
    );
    expect(html).toContain("Resumo em Português");
    expect(html).toContain("Resumo em Inglês");
    expect(html).toContain("a; b");
    expect(html).toContain("Adicionar resumo em outro idioma");
  });
});
