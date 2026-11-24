// A logo e o símbolo em SVG: peças separadas para a animação, acessíveis, e
// parados para quem pediu menos movimento. A conferência com os PNGs originais
// (logos-originais do kit da marca) foi feita à parte, por comparação de pixels.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Logo, Simbolo } from "./Marca";
import { LETRAS_DA_LOGO } from "./letras";

const css = readFileSync(new URL("./marca.css", import.meta.url), "utf8");
const tema = readFileSync(new URL("../tema/tema.css", import.meta.url), "utf8");

describe("logo e símbolo", () => {
  it("a logo é um SVG com nome para leitores de tela e as peças da animação", () => {
    const html = renderToStaticMarkup(createElement(Logo, { altura: 32 }));
    expect(html).toContain('viewBox="0 0 898 408"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Apud"');
    expect(html).toContain("mk-linha");
    expect(html).toContain("mk-cursor");
    expect(html).toContain(LETRAS_DA_LOGO.slice(0, 40));
  });

  it("a largura acompanha a proporção da logo (898 por 408)", () => {
    const html = renderToStaticMarkup(createElement(Logo, { altura: 408 }));
    expect(html).toContain("width:898px");
  });

  it("o símbolo no botão pode ficar mudo (o botão já tem o nome)", () => {
    const html = renderToStaticMarkup(createElement(Simbolo, { altura: 34, titulo: "" }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
    expect(html).toContain('viewBox="145 135 732 754"');
  });

  it("usa as cores do tema, nunca uma cor fixa", () => {
    for (const h of [renderToStaticMarkup(createElement(Logo, { altura: 32 })), renderToStaticMarkup(createElement(Simbolo, { altura: 34 }))]) {
      expect(h).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      expect(h).toContain('fill="currentColor"');
    }
    expect(css).toContain("var(--logo)");
    expect(css).toContain("var(--destaque)");
    expect(tema).toMatch(/--logo: #262626/);
    expect(tema).toMatch(/--logo: #ffffff/);
  });

  it("a animação para quem pediu menos movimento", () => {
    const i = css.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(i).toBeGreaterThan(0);
    expect(css.slice(i)).toContain("animation: none");
  });
});
