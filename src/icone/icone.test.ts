import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import SeletorDeIcone from "./SeletorDeIcone";
import ControlesDaJanela from "../janela/ControlesDaJanela";
import {
  CHAVE_DO_ICONE,
  ICONES,
  ICONE_PADRAO,
  arquivoDoIcone,
  gravarIcone,
  lerIcone,
  type ArmazemDoIcone,
} from "./icone";

function armazem(
  inicial: Record<string, string> = {},
): ArmazemDoIcone & { dados: Record<string, string> } {
  const dados = { ...inicial };
  return {
    dados,
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => void (dados[k] = v),
  };
}

describe("escolha do ícone do programa", () => {
  it("o padrão é o azul cobalto, o uso prioritário do kit", () => {
    expect(ICONE_PADRAO).toBe("cobalto");
    expect(lerIcone(armazem())).toBe("cobalto");
  });

  it("são cinco opções, com nomes e ids sem repetição", () => {
    expect(ICONES).toHaveLength(5);
    expect(new Set(ICONES.map((i) => i.id)).size).toBe(5);
    expect(new Set(ICONES.map((i) => i.nome)).size).toBe(5);
  });

  it("cada opção tem a imagem na pasta public/icones", () => {
    const arquivos = readdirSync(
      new URL("../../public/icones", import.meta.url),
    );
    for (const i of ICONES)
      expect(arquivos).toContain(arquivoDoIcone(i.id).replace("/icones/", ""));
  });

  it("guarda e lê a escolha", () => {
    const a = armazem();
    expect(gravarIcone("escuro", a)).toBe(true);
    expect(a.dados[CHAVE_DO_ICONE]).toBe("escuro");
    expect(lerIcone(a)).toBe("escuro");
  });

  it("valor guardado que não faz sentido volta ao padrão", () => {
    expect(lerIcone(armazem({ [CHAVE_DO_ICONE]: "../../x" }))).toBe("cobalto");
  });

  it("sem armazenamento ou com ele recusando, não quebra", () => {
    expect(lerIcone(null)).toBe("cobalto");
    expect(gravarIcone("grafite", null)).toBe(false);
    const recusa: ArmazemDoIcone = {
      getItem: () => {
        throw new Error("não");
      },
      setItem: () => {
        throw new Error("não");
      },
    };
    expect(lerIcone(recusa)).toBe("cobalto");
    expect(gravarIcone("grafite", recusa)).toBe(false);
  });
});

describe("seletor de ícone e controles da janela", () => {
  it("o seletor mostra as cinco miniaturas, com nome para leitores de tela, e marca a escolhida", () => {
    const html = renderToStaticMarkup(
      createElement(SeletorDeIcone, {
        escolhido: "escuro",
        aoEscolher: () => {},
      }),
    );
    expect((html.match(/<button/g) ?? []).length).toBe(5);
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect(html).toContain('aria-label="Escuro: ');
    expect(html).toContain('alt=""');
  });

  it("fora do programa (navegador) não há controles de janela", () => {
    expect(renderToStaticMarkup(createElement(ControlesDaJanela))).toBe("");
  });
});
