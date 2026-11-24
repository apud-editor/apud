// As telas da parte 5 desenhadas sem navegador (renderToStaticMarkup): conferem
// que montam e mostram o que devem. O uso de verdade (digitar, clicar) é visto
// num Chrome real fora do repositório.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { carregarPerfil } from "../../scripts/prova-lib";
import { aberturaVazia, dadosVazios, type Abertura } from "../documento/modelo";
import { escolhasDoAutor } from "../referencias/escolhas";
import { linhasDaFonte } from "../editor/janelinha";
import AberturaEmBlocos from "./AberturaEmBlocos";
import Assistente from "./Assistente";
import Configuracoes, { ABAS, type AbaDasConfiguracoes } from "./Configuracoes";

const nada = () => {};
const abnt = carregarPerfil("abnt.txt");
const apa = carregarPerfil("apa.txt");

const abertura = (p: Partial<Abertura> = {}): Abertura => ({ ...aberturaVazia(), ...p });
const dados = { ...dadosVazios(), titulo: "Meu trabalho", autores: ["Maria Silva"] };

function areaDaAbertura(a: Abertura, norma: "ABNT" | "APA", d = dados) {
  return renderToStaticMarkup(
    createElement(AberturaEmBlocos, { abertura: a, dados: d, nomeDaNorma: norma, modelo: (norma === "ABNT" ? abnt : apa).modelo, aoMudar: nada, aoMudarDados: nada }),
  );
}

function configuracoes(aba: AbaDasConfiguracoes, norma: "ABNT" | "APA" = "ABNT", a = abertura()) {
  const { modelo, perfil } = norma === "ABNT" ? abnt : apa;
  return renderToStaticMarkup(
    createElement(Configuracoes, {
      aba,
      aoTrocarAba: nada,
      dados,
      abertura: a,
      nomeDaNorma: norma,
      modelo,
      normas: ["ABNT", "APA"],
      escolhas: escolhasDoAutor(perfil),
      aoMudarDados: nada,
      aoMudarAbertura: nada,
      aoTrocarNorma: nada,
      aoEscolher: nada,
      lerLinhasDaFonte: () => linhasDaFonte(modelo),
      aoMudarFonte: () => ({ ok: true as const, avisos: [] }),
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
  it("tem as três abas (os elementos foram para a Abertura), com a escolhida marcada", () => {
    const html = configuracoes("dados");
    for (const a of ABAS) expect(html).toContain(a.nome);
    expect(ABAS.map((a) => a.id)).toEqual(["trabalho", "dados", "escolhas"]);
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

  it("aba Escolhas do autor: as escolhas da norma com o padrão marcado", () => {
    const abnt = configuracoes("escolhas");
    expect(abnt).toContain("Prenomes na lista de referências");
    expect(abnt).toContain("(padrão da norma)");
    expect(configuracoes("escolhas", "APA")).toContain("Cidade da editora na lista");
  });

  it("aba Trabalho: tipo, norma, versão sem identificação e idioma", () => {
    const html = configuracoes("trabalho");
    expect(html).toContain("Versão sem identificação");
    expect(configuracoes("trabalho", "ABNT", abertura({ semIdentificacao: true }))).toMatch(/checked=""[^>]*\/?><span>Versão sem identificação/);
    expect(html).toContain("Tipo de trabalho");
    expect(html).toContain("Trabalho de disciplina");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("português do Brasil");
  });

  it("aba Trabalho: fonte e tamanho do trabalho, com o valor da norma marcado (3b)", () => {
    const html = configuracoes("trabalho");
    expect(html).toContain("<legend>Fonte e tamanho</legend>");
    expect(html).toMatch(/aria-label="Fonte do trabalho".*aria-pressed="true"[^>]*>Times New Roman<\/button>/s);
    expect(html).toMatch(/aria-label="Tamanho da letra".*aria-pressed="true"[^>]*>12<\/button>/s);
    for (const f of ["Arial", "Calibri", "Georgia"]) expect(html).toContain(`>${f}</button>`);
    expect(html).toContain("como a ABNT pede");
  });
});

describe("Abertura em blocos no editor", () => {
  it("sem blocos: o divisor Abertura, o botão de adicionar e o divisor Texto", () => {
    const html = areaDaAbertura(abertura(), "ABNT");
    expect(html).toContain("Abertura");
    expect(html).toContain("Adicionar à abertura");
    expect(html).toContain("Nada antes do texto");
    expect(html).toContain(">Texto<");
    expect(html).not.toContain("ab-bloco");
  });

  it("capa e folha de rosto mostram as peças em faixas, com os dados do trabalho", () => {
    const html = areaDaAbertura(abertura({ blocos: [{ tipo: "capa" }, { tipo: "folhaDeRosto" }, { tipo: "sumario" }] }), "ABNT", {
      ...dados,
      instituicao: "Universidade do Vale do Itajaí",
      cidade: "Itajaí",
      ano: 2026,
    });
    expect(html).toContain('data-etiqueta="Capa"');
    expect(html).toContain('data-etiqueta="Folha de rosto"');
    expect(html).toContain('data-etiqueta="Sumário"');
    for (const f of ["Topo", "Meio", "Pé"]) expect(html).toContain(`>${f}<`);
    expect(html).toContain("Universidade do Vale do Itajaí");
    expect(html).toContain("Maria Silva");
    expect(html).toContain("Meu trabalho");
    expect(html).toContain("2026");
    // A peça vazia convida a preencher.
    expect(html).toContain("clique para preencher");
    expect(html).toContain("Montado pelo Apud com os títulos do texto");
    expect(html).not.toContain("alca");
  });

  it("na APA, a capa que já estava no trabalho fica apagada e avisa que não sai no PDF", () => {
    const html = areaDaAbertura(abertura({ blocos: [{ tipo: "capa" }, { tipo: "paginaDeTitulo" }] }), "APA");
    expect(html).toContain("A APA não tem a capa: fica guardada no trabalho, mas não sai no PDF.");
    expect(html).toContain("fora-da-norma");
    expect(html).toContain('data-etiqueta="Página de título"');
  });

  it("cada resumo com o idioma na etiqueta, as palavras-chave e o título no idioma estrangeiro", () => {
    const html = areaDaAbertura(
      abertura({
        blocos: [
          { tipo: "resumo", idioma: "pt-BR", trechos: [{ texto: "Texto." }], palavrasChave: ["a", "b"] },
          { tipo: "resumo", idioma: "en", titulo: "Title", trechos: [], palavrasChave: [] },
        ],
      }),
      "ABNT",
    );
    expect(html).toContain('data-etiqueta="Resumo (Português)"');
    expect(html).toContain('data-etiqueta="Resumo (Inglês)"');
    expect(html).toContain('value="a; b"');
    expect(html).toContain('value="Title"');
    expect(html).toContain("Keywords");
    // O resumo em português não pede título (é o do trabalho); o vazio avisa que não sai.
    expect(html.match(/Título neste idioma/g)).toHaveLength(1);
    expect(html).toContain("Vazio: só sai no PDF depois de ter texto.");
  });

  it("a epígrafe tem a linha de quem escreveu", () => {
    const html = areaDaAbertura(abertura({ blocos: [{ tipo: "epigrafe", paragrafos: [], autoria: "Rubem Alves" }] }), "ABNT");
    expect(html).toContain("Quem escreveu");
    expect(html).toContain('value="Rubem Alves"');
  });

  it("na versão sem identificação, o autor aparece com o aviso de que não sai no PDF", () => {
    const html = areaDaAbertura(abertura({ blocos: [{ tipo: "capa" }], semIdentificacao: true }), "ABNT");
    expect(html).toContain("não sai no PDF: versão sem identificação");
  });
});
