// A coluna de ícones da direita e os ícones da barra, desenhados sem navegador.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Icone, type NomeDoIcone } from "../editor/icones";
import ColunaDeIcones from "./ColunaDeIcones";

const nada = () => {};
const coluna = (aberto: "previa" | "referencias" | null) =>
  renderToStaticMarkup(
    createElement(ColunaDeIcones, { aberto, aoAlternar: nada }),
  );

describe("coluna de ícones", () => {
  it("tem Prévia e Referências, cada um com nome para o leitor de tela e atalho", () => {
    const html = coluna(null);
    expect(html).toContain('aria-label="Prévia"');
    expect(html).toContain('aria-label="Referências"');
    expect(html).toContain('title="Prévia (Alt+P)"');
    expect(html).toContain('title="Referências (Alt+R)"');
    expect(html).toContain('aria-keyshortcuts="Alt+P"');
    expect(html).toContain('aria-keyshortcuts="Alt+R"');
  });

  it("marca só o painel que está aberto", () => {
    expect(coluna(null).match(/aria-pressed="true"/g)).toBeNull();
    const previa = coluna("previa");
    expect(previa.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(previa).toMatch(/aria-label="Prévia" aria-pressed="true"/);
    expect(coluna("referencias")).toMatch(
      /aria-label="Referências" aria-pressed="true"/,
    );
  });

  it("não usa texto no lugar do ícone (só o desenho e o nome para leitor de tela)", () => {
    const html = coluna(null);
    expect(html).toContain("<svg");
    expect(html).not.toMatch(/>Prévia</);
    expect(html).not.toMatch(/>Referências</);
  });
});

describe("ícones", () => {
  const nomes: NomeDoIcone[] = [
    "desfazer",
    "refazer",
    "negrito",
    "italico",
    "sobrescrito",
    "lista",
    "listaEmSequencia",
    "quebraDePagina",
    "citar",
    "tabela",
    "figura",
    "nota",
    "previa",
    "referencias",
  ];

  it.each(nomes)(
    "%s desenha algo e fica escondido dos leitores de tela",
    (nome) => {
      const html = renderToStaticMarkup(createElement(Icone, { nome }));
      expect(html).toContain('aria-hidden="true"');
      expect(html).toMatch(/<(path|rect)/);
      expect(html).toContain('stroke="currentColor"');
    },
  );
});
