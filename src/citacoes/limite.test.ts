// O aviso de citação curta que passou do limite: o que a norma pede em cada
// perfil, onde o Apud procura o trecho entre aspas, e o que não avisa.

import { describe, expect, it } from "vitest";
import { carregarNorma } from "../../scripts/prova-lib";
import { documentoVazio, type Bloco, type Citacao, type Referencia, type Trecho } from "../documento/modelo";
import { avisoDeLimite, limiteDoPerfil, passagemDaCitacao, CARACTERES_POR_LINHA } from "./limite";
import { montarTodas } from "./todas";

const direta = (id = "a", pagina = "7"): Citacao => ({
  tipo: "parenteses",
  direta: true,
  obras: [{ referencia: id, localizador: { tipo: "pagina", valor: pagina } }],
});
const t = (texto: string): Trecho => ({ texto });
const palavras = (n: number) => Array.from({ length: n }, (_, i) => `palavra${i}`).join(" ");
const abnt = () => carregarNorma("abnt.txt").perfil;
const apa = () => carregarNorma("apa.txt").perfil;

describe("o limite de cada norma", () => {
  it("ABNT conta linhas (3) e APA conta palavras (40)", () => {
    expect(limiteDoPerfil(abnt())).toEqual({ tipo: "linhas", ate: 3 });
    expect(limiteDoPerfil(apa())).toEqual({ tipo: "palavras", apartirDe: 40 });
  });
});

describe("o trecho entre aspas ao lado da citação", () => {
  it("acha o trecho antes da citação, com aspas curvas ou retas, e com o ponto dentro das aspas", () => {
    expect(passagemDaCitacao([t("Ele disse “um dois três” "), { citacao: direta() }], 1)).toBe("um dois três");
    expect(passagemDaCitacao([t('Ele disse "um dois" '), { citacao: direta() }], 1)).toBe("um dois");
    expect(passagemDaCitacao([t("Ele disse “fim.” "), { citacao: direta() }], 1)).toBe("fim.");
  });

  it("na citação narrativa, procura depois da citação (Autor (2020): “...”)", () => {
    const narrativa: Citacao = { tipo: "narrativa", direta: true, obra: { referencia: "a" } };
    expect(passagemDaCitacao([t("Segundo "), { citacao: narrativa }, t(', “texto citado” e mais')], 1)).toBe("texto citado");
  });

  it("sem aspas, não vê trecho (a citação indireta e a longa não têm aspas)", () => {
    expect(passagemDaCitacao([t("Ele resumiu o capítulo "), { citacao: direta() }], 1)).toBeNull();
    expect(passagemDaCitacao([t("texto"), { citacao: direta() }], 1)).toBeNull();
  });

  it("não atravessa outra citação nem nota", () => {
    expect(passagemDaCitacao([t("“trecho antigo” "), { citacao: direta("b") }, t(" e depois "), { citacao: direta() }], 3)).toBeNull();
  });
});

describe("avisos de limite", () => {
  const trechosCom = (n: number): Trecho[] => [t(`“${palavras(n)}” `), { citacao: direta() }];

  it("APA: 40 palavras ou mais avisa; 39 não", () => {
    const limite = limiteDoPerfil(apa())!;
    expect(avisoDeLimite(trechosCom(39), 1, limite)).toBeNull();
    const aviso = avisoDeLimite(trechosCom(40), 1, limite)!;
    expect(aviso.tipo).toBe("citacao-curta-longa");
    expect(aviso.mensagem).toContain("40 palavras");
    expect(aviso.mensagem).toContain("Citação longa");
  });

  it("ABNT: acima de 3 linhas (estimadas) avisa e diz quantas; até 3, não", () => {
    const limite = limiteDoPerfil(abnt())!;
    const cabe = "x".repeat(3 * CARACTERES_POR_LINHA - 2);
    expect(avisoDeLimite([t(`“${cabe}” `), { citacao: direta() }], 1, limite)).toBeNull();
    const longo = "x".repeat(5 * CARACTERES_POR_LINHA - 4);
    const aviso = avisoDeLimite([t(`“${longo}” `), { citacao: direta() }], 1, limite)!;
    expect(aviso.mensagem).toContain("cerca de 5 linhas");
    expect(aviso.mensagem).toContain("acima de 3 linhas");
  });

  it("citação que não é direta não avisa, mesmo com aspas", () => {
    const indireta: Citacao = { tipo: "parenteses", obras: [{ referencia: "a" }] };
    expect(avisoDeLimite([t(`“${palavras(80)}” `), { citacao: indireta }], 1, limiteDoPerfil(apa())!)).toBeNull();
  });
});

describe("no texto todo (o que o editor mostra)", () => {
  const ref: Referencia = {
    id: "a",
    tipo: "livro",
    autores: [{ sobrenome: "Souza", prenomes: "Eva" }],
    titulo: "Alfa",
    data: { ano: 2020 },
    editora: "Vozes",
    cidade: "Petrópolis",
  };
  const doc = (blocos: Bloco[]) => ({ ...documentoVazio(), referencias: [ref], blocos });
  const longa: Bloco = { tipo: "paragrafo", trechos: [t(`“${palavras(60)}” `), { citacao: direta() }] };

  it("o aviso vai na citação certa e mais nada muda no texto da citação", () => {
    const curta: Bloco = { tipo: "paragrafo", trechos: [t("“pouco texto” "), { citacao: direta() }] };
    const m = montarTodas(doc([curta, longa]), apa());
    expect(m).toHaveLength(2);
    expect(m[0].avisos.map((a) => a.tipo)).not.toContain("citacao-curta-longa");
    expect(m[1].avisos.map((a) => a.tipo)).toContain("citacao-curta-longa");
    // O texto da citação é o mesmo de antes do aviso.
    expect(m[1].pedacos.map((p) => p.texto).join("")).toBe(montarTodas(doc([longa]), apa())[0].pedacos.map((p) => p.texto).join(""));
  });

  it("citação dentro do bloco Citação longa não avisa (já é longa)", () => {
    const bloco: Bloco = { tipo: "citacaoLonga", trechos: [t(palavras(80) + " "), { citacao: direta() }] };
    const m = montarTodas(doc([bloco]), apa());
    expect(m[0].avisos.map((a) => a.tipo)).not.toContain("citacao-curta-longa");
  });
});
