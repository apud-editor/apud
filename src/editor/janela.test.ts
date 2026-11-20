// A janela da citação desenhada sem navegador: confere que monta, mostra o que
// o protótipo mostra e só oferece o que cada forma de citação usa.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { carregarNorma } from "../../scripts/prova-lib";
import { previaDaCitacao } from "../citacoes/todas";
import type { Citacao, Referencia } from "../documento/modelo";
import type { EstadoDaJanela } from "./citacoes";
import JanelaDeCitacao from "./JanelaDeCitacao";

const livro = (id: string, sobrenome: string, titulo: string, ano = 2019): Referencia => ({
  id,
  tipo: "livro",
  autores: [{ sobrenome, prenomes: "Ana" }],
  titulo,
  data: { ano },
  editora: "Vozes",
  cidade: "Petrópolis",
});
const refs = [livro("silva", "Silva", "Psicologia clínica"), livro("souza", "Souza", "O diário de campo", 2021)];
const perfil = carregarNorma("abnt.txt").perfil;
const nada = () => {};

const aberta = (parcial: Partial<EstadoDaJanela> = {}): EstadoDaJanela => ({
  aberta: true,
  chave: 1,
  modo: "inserir",
  origem: "arroba",
  de: 1,
  ate: 2,
  citacao: null,
  ...parcial,
});

function janela(estado: EstadoDaJanela, referencias = refs) {
  return renderToStaticMarkup(
    createElement(JanelaDeCitacao, {
      estado,
      referencias,
      previa: (c: Citacao) => previaDaCitacao([], referencias, perfil, c),
      aoConfirmar: nada,
      aoRemover: nada,
      aoFechar: nada,
      aoEscreverArroba: nada,
      aoCadastrar: nada,
    }),
  );
}

describe("janela da citação na tela", () => {
  it("citação nova: busca, fontes, página, indireta/direta, autor no texto e + outra obra", () => {
    const html = janela(aberta());
    expect(html).toContain("Citar");
    expect(html).toContain("Buscar por autor ou título");
    expect(html).toContain("Silva");
    expect(html).toContain("Psicologia clínica");
    expect(html).toContain("Página, ex.: 15 ou 4-5");
    expect(html).toContain("Indireta");
    expect(html).toContain("Direta");
    expect(html).toContain("Autor no texto");
    expect(html).toContain("+ outra obra");
    expect(html).toContain("Grifo meu");
    expect(html).toContain("Tradução minha");
    expect(html).toContain("Citação de citação (apud)");
    expect(html).toContain("Fala sem referência");
    expect(html).toContain("Inserir citação");
    // Ainda sem obra: a janela explica em vez de mostrar uma citação vazia.
    expect(html).toContain("Escolha a obra para ver como fica na norma.");
    expect(html).not.toContain("Remover citação");
  });

  it("aberta pelo @, deixa escrever só o @; aberta pelo botão, não", () => {
    expect(janela(aberta())).toContain("Escrever só o @");
    expect(janela(aberta({ origem: "botao" }))).not.toContain("Escrever só o @");
  });

  it("editar mostra como a citação fica na norma, o aviso do que falta e o botão de remover", () => {
    const direta: Citacao = { tipo: "parenteses", direta: true, obras: [{ referencia: "silva" }] };
    const html = janela(aberta({ modo: "editar", origem: "clique", citacao: direta }));
    expect(html).toContain("Editar citação");
    expect(html).toContain("Salvar citação");
    expect(html).toContain("Remover citação");
    expect(html).toContain("(Silva, 2019)");
    expect(html).toContain("Atenção: a citação direta de Silva está sem página");
  });

  it("citação com página completa não tem aviso", () => {
    const c: Citacao = { tipo: "parenteses", direta: true, obras: [{ referencia: "silva", localizador: { tipo: "pagina", valor: "15" } }] };
    const html = janela(aberta({ modo: "editar", origem: "clique", citacao: c }));
    expect(html).toContain("(Silva, 2019, p. 15)");
    expect(html).not.toContain("Atenção");
  });

  it("citação de uma referência apagada pede para escolher a obra de novo", () => {
    const html = janela(aberta({ modo: "editar", origem: "clique", citacao: { tipo: "parenteses", obras: [{ referencia: "sumiu" }] } }));
    expect(html).toContain("Referência apagada. Escolha a obra de novo.");
  });

  it("apud pede a obra original; fala pede quem fala e não pede obra", () => {
    const apud = janela(aberta({ modo: "editar", citacao: { tipo: "apud", original: "Freud, 1915", obra: { referencia: "souza" } } }));
    expect(apud).toContain("Obra original (a que você não leu)");
    expect(apud).toContain("Obra que você leu");
    // O apud sai em itálico, como a ABNT pede (o motor marca; a janela respeita).
    expect(apud).toContain("<span>(Freud, 1915 </span><i>apud</i><span> Souza, 2021)</span>");
    const fala = janela(aberta({ modo: "editar", citacao: { tipo: "sem-referencia", texto: "Usuária A" } }));
    expect(fala).toContain("Quem fala");
    expect(fala).toContain("(Usuária A)");
    expect(fala).not.toContain("Buscar por autor ou título");
    expect(fala).not.toContain("Indireta");
  });

  it("várias obras: uma linha por obra, com Tirar, e autor no texto desligado", () => {
    const c: Citacao = { tipo: "parenteses", obras: [{ referencia: "silva" }, { referencia: "souza" }] };
    const html = janela(aberta({ modo: "editar", citacao: c }));
    expect(html).toContain("Obras citadas");
    expect(html.match(/>Tirar</g)).toHaveLength(2);
    expect(html).toContain("Só com uma obra.");
  });

  it("sem nenhuma referência cadastrada, leva para o cadastro", () => {
    const html = janela(aberta(), []);
    expect(html).toContain("Você ainda não cadastrou nenhuma referência.");
    expect(html).toContain("Cadastrar uma referência");
  });
});
