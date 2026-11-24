import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import SeletorDeTema from "./SeletorDeTema";
import {
  CHAVE_DO_TEMA,
  TEMA_PADRAO,
  aplicarTema,
  gravarEscolhaDeTema,
  lerEscolhaDeTema,
  temaAplicado,
  type ArmazemDoTema,
} from "./tema";

function armazem(inicial: Record<string, string> = {}): ArmazemDoTema & { dados: Record<string, string> } {
  const dados = { ...inicial };
  return {
    dados,
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => {
      dados[k] = v;
    },
  };
}

describe("escolha de tema", () => {
  it("o padrão é Sistema", () => {
    expect(TEMA_PADRAO).toBe("sistema");
    expect(lerEscolhaDeTema(armazem())).toBe("sistema");
    expect(lerEscolhaDeTema(null)).toBe("sistema");
  });

  it("lê e guarda a escolha, só neste computador (chave própria)", () => {
    const a = armazem();
    expect(gravarEscolhaDeTema("escuro", a)).toBe(true);
    expect(a.dados[CHAVE_DO_TEMA]).toBe("escuro");
    expect(lerEscolhaDeTema(a)).toBe("escuro");
    gravarEscolhaDeTema("claro", a);
    expect(lerEscolhaDeTema(a)).toBe("claro");
  });

  it("valor guardado que não faz sentido volta ao padrão", () => {
    expect(lerEscolhaDeTema(armazem({ [CHAVE_DO_TEMA]: "roxo" }))).toBe("sistema");
    expect(lerEscolhaDeTema(armazem({ [CHAVE_DO_TEMA]: "" }))).toBe("sistema");
  });

  it("se o computador recusar guardar, não quebra", () => {
    const recusa: ArmazemDoTema = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(gravarEscolhaDeTema("escuro", recusa)).toBe(false);
    expect(gravarEscolhaDeTema("escuro", null)).toBe(false);
    expect(lerEscolhaDeTema(recusa)).toBe("sistema");
  });

  it("Sistema acompanha o Windows; Claro e Escuro ignoram", () => {
    expect(temaAplicado("sistema", true)).toBe("escuro");
    expect(temaAplicado("sistema", false)).toBe("claro");
    expect(temaAplicado("claro", true)).toBe("claro");
    expect(temaAplicado("escuro", false)).toBe("escuro");
  });

  it("o tema vai para o atributo data-tema da página", () => {
    const atributos: Record<string, string> = {};
    aplicarTema("escuro", { setAttribute: (n, v) => (atributos[n] = v) });
    expect(atributos["data-tema"]).toBe("escuro");
  });
});

describe("seletor de tema (tela)", () => {
  const desenhar = (escolha: "claro" | "escuro" | "sistema") =>
    renderToStaticMarkup(createElement(SeletorDeTema, { escolha, aoEscolher: () => {} }));

  it("mostra as três opções com a escolhida marcada", () => {
    const html = desenhar("sistema");
    expect(html).toContain("Claro");
    expect(html).toContain("Escuro");
    expect(html).toContain("Sistema");
    expect(html).toMatch(/aria-pressed="true"[^>]*>Sistema</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Claro</);
    expect(html).toContain('aria-label="Tema do programa"');
  });
});

describe("CSS: cores só nas variáveis dos temas", () => {
  const app = readFileSync("src/App.css", "utf-8");
  const tema = readFileSync("src/tema/tema.css", "utf-8");

  it("App.css não tem cor solta: tudo vem de var(--nome)", () => {
    expect(app.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(app.match(/rgba?\(/g) ?? []).toEqual([]);
  });

  it("todas as variáveis usadas existem nos dois temas", () => {
    const usadas = new Set([...app.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]));
    const claro = tema.slice(tema.indexOf(':root[data-tema="claro"]'), tema.indexOf(':root[data-tema="escuro"]'));
    const escuro = tema.slice(tema.indexOf(':root[data-tema="escuro"]'));
    for (const v of usadas) {
      expect(claro, `${v} no claro`).toContain(`${v}:`);
      expect(escuro, `${v} no escuro`).toContain(`${v}:`);
    }
  });

  it("a Prévia fica branca nos dois temas", () => {
    expect(tema.match(/--papel: #ffffff;/g)?.length).toBe(2);
  });

  it("não usa mais a fonte Inter nem pede nada à internet", () => {
    expect(app).not.toMatch(/Inter/);
    expect(tema + app).not.toMatch(/https?:\/\//);
    expect(tema).toContain('font-family: "Open Sans"');
  });
});
