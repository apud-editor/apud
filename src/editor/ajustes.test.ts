// A janelinha do ⚙ e o quadro da barra, desenhados sem navegador (etapa 2c da v2).

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { carregarModelo } from "../../scripts/prova-lib";
import { JanelinhaDoBloco, QuadroDosValores } from "./Ajustes";
import { excecoesDoBloco, linhasDaJanelinha, nomeDoBloco, origemDaJanelinha, type BlocoAjustavel } from "./janelinha";

const abnt = carregarModelo("abnt.txt");
const nada = () => {};

function janelinha(bloco: BlocoAjustavel, aplicarA: "todos" | "este", extra: { avisos?: string[]; erro?: string | null } = {}) {
  return renderToStaticMarkup(
    createElement(JanelinhaDoBloco, {
      nome: nomeDoBloco(bloco),
      origem: origemDaJanelinha(abnt, bloco, aplicarA),
      linhas: linhasDaJanelinha(abnt, "disciplina", bloco, aplicarA),
      aplicarA,
      excecoes: excecoesDoBloco(bloco),
      avisos: extra.avisos ?? [],
      erro: extra.erro ?? null,
      aoMudarAplicarA: nada,
      aoEscolher: nada,
      aoVoltar: nada,
      aoFechar: nada,
    }),
  );
}

const paragrafo: BlocoAjustavel = { elemento: "paragrafo", tipo: "parágrafo" };
const titulo: BlocoAjustavel = { elemento: "titulos.nivel1", tipo: "título", nivel: 1 };

describe("a janelinha do parágrafo", () => {
  const html = janelinha(paragrafo, "todos");

  it("é uma janela com nome, de onde vem e o aviso de que vale no PDF", () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Ajustes do Parágrafo"');
    expect(html).toContain("Do modelo ABNT");
    expect(html).toContain("Vale no PDF. Veja o efeito na Prévia.");
  });

  it("escolhe entre “Todos os iguais” e “Só este”, e diz qual está valendo", () => {
    expect(html).toMatch(/<button[^>]*class="on"[^>]*aria-pressed="true"[^>]*>Todos os iguais<\/button>/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Só este<\/button>/);
  });

  it("mostra espaçamento, alinhamento e recuo, com o valor do modelo marcado", () => {
    expect(html).toContain("Espaçamento entre linhas");
    expect(html).toMatch(/aria-pressed="true"[^>]*>1,5<\/button>/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Justificado<\/button>/);
    expect(html).toContain("Recuo da primeira linha");
  });

  it("não oferece “Voltar ao do modelo” sem exceção, e o painel completo ainda está apagado", () => {
    expect(html).not.toContain("Voltar ao do modelo");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Mais opções…<\/button>/);
  });
});

describe("a janelinha do título", () => {
  const html = janelinha(titulo, "todos");

  it("tem interruptores para destaque, número, maiúsculas e página nova", () => {
    for (const rotulo of ["Negrito", "Itálico", "Sublinhado", "Numerar sozinho", "Maiúsculas sozinho", "Começar em página nova"]) expect(html).toContain(rotulo);
    expect(html).toMatch(/role="switch"[^>]*aria-checked="true"[^>]*>(?:<span>)?Numerar sozinho/);
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"[^>]*>(?:<span>)?Itálico/);
  });
});

describe("a janelinha de um bloco com exceção", () => {
  const bloco: BlocoAjustavel = { ...titulo, excecoes: { posição: "centralizado" } };

  it("em “só este”, marca a linha e oferece “Voltar ao do modelo”", () => {
    const html = janelinha(bloco, "este");
    expect(html).toContain("Só neste título: posição.");
    expect(html).toContain("só neste");
    expect(html).toContain("Voltar ao do modelo");
  });

  it("em “todos”, mostra o valor do modelo e não marca a linha", () => {
    const html = janelinha(bloco, "todos");
    expect(html).not.toContain("só neste</span>");
    expect(html).toContain("Voltar ao do modelo");
  });
});

describe("avisos e erros", () => {
  it("o aviso de sair da norma aparece na janelinha", () => {
    const html = janelinha(paragrafo, "este", { avisos: ["A ABNT pede “1,5”. Com “duplo”, o trabalho sai da norma neste ponto."] });
    expect(html).toContain('role="status"');
    expect(html).toContain("A ABNT pede");
  });

  it("um erro aparece como alerta", () => {
    expect(janelinha(paragrafo, "todos", { erro: "não deu" })).toContain('role="alert"');
  });
});

describe("o quadro da barra", () => {
  const html = renderToStaticMarkup(createElement(QuadroDosValores, { texto: "No PDF: Times New Roman · 12 · esp. 1,5 · Justificado", aoAbrir: nada }));

  it("mostra os valores e diz que abre os ajustes, com o atalho", () => {
    expect(html).toContain("No PDF: Times New Roman · 12 · esp. 1,5 · Justificado");
    expect(html).toContain("Abrir os ajustes");
    expect(html).toContain('aria-keyshortcuts="Alt+F"');
    expect(html).toContain('title="Abre os ajustes deste elemento (Alt+F)"');
  });
});
