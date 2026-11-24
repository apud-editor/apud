// A janelinha do ⚙ e o quadro de valores da barra (etapa 2c da v2): a conta, sem navegador.

import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node as NoPM } from "@tiptap/pm/model";
import { carregarModelo } from "../../scripts/prova-lib";
import { editorDosBlocos } from "../documento/tiptap";
import type { Bloco } from "../documento/modelo";
import { ControleDaBarra, extensoesDoApud } from "./extensoes";
import {
  FONTES_DO_TRABALHO,
  alternarDestaque,
  blocoAjustavel,
  escreverSoEste,
  escreverTodos,
  excecoesDoBloco,
  linhasDaFonte,
  linhasDaJanelinha,
  nomeDoBloco,
  origemDaJanelinha,
  quadroDosValores,
  type BlocoAjustavel,
} from "./janelinha";

const abnt = carregarModelo("abnt.txt");
const apa = carregarModelo("apa.txt");

const paragrafo = (excecoes?: BlocoAjustavel["excecoes"]): BlocoAjustavel => ({ elemento: "paragrafo", tipo: "parágrafo", excecoes });
const citacao = (excecoes?: BlocoAjustavel["excecoes"]): BlocoAjustavel => ({ elemento: "citacaoLonga", tipo: "citação longa", excecoes });
const titulo = (nivel: 1 | 2 | 3, excecoes?: BlocoAjustavel["excecoes"]): BlocoAjustavel => ({ elemento: `titulos.nivel${nivel}`, tipo: "título", nivel, excecoes });

const linha = (linhas: ReturnType<typeof linhasDaJanelinha>, rotulo: string) => linhas.find((l) => l.rotulo === rotulo)!;
const ativas = (l: { opcoes: Array<{ rotulo: string; ativa: boolean }> }) => l.opcoes.filter((o) => o.ativa).map((o) => o.rotulo);

describe("o bloco do cursor", () => {
  const esquema = getSchema(extensoesDoApud(new ControleDaBarra()));
  const doc = (blocos: Bloco[]) => NoPM.fromJSON(esquema, editorDosBlocos(blocos));

  it("parágrafo e título têm janelinha, com a exceção que o bloco leva", () => {
    const d = doc([
      { tipo: "paragrafo", trechos: [{ texto: "a" }], excecoes: { alinhamento: "centralizado" } },
      { tipo: "titulo", nivel: 2, trechos: [{ texto: "b" }] },
      { tipo: "quebra" },
    ]);
    expect(blocoAjustavel(d.child(0))).toEqual({ elemento: "paragrafo", tipo: "parágrafo", excecoes: { alinhamento: "centralizado" } });
    expect(blocoAjustavel(d.child(1))).toEqual({ elemento: "titulos.nivel2", tipo: "título", nivel: 2, excecoes: undefined });
    expect(nomeDoBloco(blocoAjustavel(d.child(0))!)).toBe("Parágrafo");
    expect(nomeDoBloco(blocoAjustavel(d.child(1))!)).toBe("Título 2");
  });

  it("a citação longa também tem, com as exceções dela; os outros blocos ainda não", () => {
    const d = doc([{ tipo: "quebra" }, { tipo: "citacaoLonga", trechos: [{ texto: "x" }], excecoes: { tamanho: "11 pt" } }]);
    expect(blocoAjustavel(d.child(0))).toBeNull();
    expect(blocoAjustavel(d.child(1))).toEqual({ elemento: "citacaoLonga", tipo: "citação longa", excecoes: { tamanho: "11 pt" } });
    expect(nomeDoBloco(blocoAjustavel(d.child(1))!)).toBe("Citação longa");
    expect(blocoAjustavel(undefined)).toBeNull();
  });
});

describe("o destaque como interruptores", () => {
  it("liga e desliga cada parte, sempre na mesma ordem", () => {
    expect(alternarDestaque("negrito", "itálico", true)).toBe("negrito, itálico");
    expect(alternarDestaque("itálico, negrito", "sublinhado", true)).toBe("negrito, itálico, sublinhado");
    expect(alternarDestaque("maiúsculas, negrito", "negrito", false)).toBe("maiúsculas");
    expect(alternarDestaque("negrito", "negrito", false)).toBe("normal");
    expect(alternarDestaque("normal", "maiúsculas", true)).toBe("maiúsculas");
  });
});

describe("as linhas do parágrafo", () => {
  it("mostram o que a ABNT pede: 1,5, justificado, com recuo", () => {
    const linhas = linhasDaJanelinha(abnt, "disciplina", paragrafo(), "todos");
    expect(linhas.map((l) => l.rotulo)).toEqual(["Espaçamento entre linhas", "Alinhamento", "Recuo da primeira linha", "Fonte do trabalho", "Tamanho da letra"]);
    expect(ativas(linhas[0])).toEqual(["1,5"]);
    expect(ativas(linhas[1])).toEqual(["Justificado"]);
    expect(ativas(linhas[2])).toEqual(["Sim"]);
  });

  it("na APA: espaço duplo, à esquerda", () => {
    const linhas = linhasDaJanelinha(apa, "disciplina", paragrafo(), "todos");
    expect(ativas(linhas[0])).toEqual(["2"]);
    expect(ativas(linhas[1])).toEqual(["Esquerda"]);
  });

  it("cada botão diz o que escreve", () => {
    const linhas = linhasDaJanelinha(abnt, "disciplina", paragrafo(), "todos");
    expect(linhas[0].opcoes.map((o) => o.escrita)).toEqual([[["entrelinha", "simples"]], [["entrelinha", "1,5"]], [["entrelinha", "duplo"]]]);
    expect(linhas[2].opcoes.map((o) => o.escrita)).toEqual([[["recuo da primeira linha", "como no texto"]], [["recuo da primeira linha", "nenhum"]]]);
  });

  it("em “só este” mostra a exceção do bloco; em “todos”, o valor do elemento", () => {
    const bloco = paragrafo({ alinhamento: "centralizado" });
    const este = linhasDaJanelinha(abnt, "disciplina", bloco, "este");
    const todos = linhasDaJanelinha(abnt, "disciplina", bloco, "todos");
    expect(ativas(linha(este, "Alinhamento"))).toEqual(["Centro"]);
    expect(linha(este, "Alinhamento").deExcecao).toBe(true);
    expect(linha(este, "Espaçamento entre linhas").deExcecao).toBe(false);
    expect(ativas(linha(todos, "Alinhamento"))).toEqual(["Justificado"]);
  });
});

describe("as linhas da citação longa", () => {
  it("na ABNT: 10 pt, simples, recuo de 4 cm, justificada, uma linha antes e depois", () => {
    const linhas = linhasDaJanelinha(abnt, "disciplina", citacao(), "todos");
    expect(linhas.map((l) => l.rotulo)).toEqual(["Tamanho da letra", "Espaçamento entre linhas", "Recuo à esquerda", "Alinhamento", "Espaço antes e depois"]);
    expect(linhas.map((l) => ativas(l))).toEqual([["10"], ["1"], ["4 cm"], ["Justificado"], ["1 linha"]]);
  });

  it("na APA: o tamanho do texto, espaço duplo, recuo de 1,27 cm", () => {
    const linhas = linhasDaJanelinha(apa, "disciplina", citacao(), "todos");
    expect(ativas(linha(linhas, "Tamanho da letra"))).toEqual(["12"]);
    expect(ativas(linha(linhas, "Espaçamento entre linhas"))).toEqual(["2"]);
    expect(ativas(linha(linhas, "Recuo à esquerda"))).toEqual(["1,27 cm"]);
  });

  it("“espaço antes e depois” escreve as duas propriedades de uma vez", () => {
    const linhas = linhasDaJanelinha(abnt, "disciplina", citacao(), "todos");
    expect(linha(linhas, "Espaço antes e depois").opcoes[1].escrita).toEqual([
      ["espaço antes", "1 linha"],
      ["espaço depois", "1 linha"],
    ]);
  });

  it("a exceção de uma citação vale só nela, e o alto da janelinha diz isso", () => {
    const bloco = citacao({ tamanho: "11 pt", "recuo à esquerda": "2 cm" });
    const linhas = linhasDaJanelinha(abnt, "disciplina", bloco, "este");
    expect(ativas(linha(linhas, "Tamanho da letra"))).toEqual(["11"]);
    expect(linha(linhas, "Tamanho da letra").deExcecao).toBe(true);
    expect(linha(linhas, "Alinhamento").deExcecao).toBe(false);
    expect(origemDaJanelinha(abnt, bloco, "este")).toBe("Só nesta citação longa: tamanho, recuo à esquerda. O resto vem do modelo.");
    const r = escreverSoEste(abnt, citacao(), [["alinhamento", "à esquerda"]]);
    expect(r).toEqual({ ok: true, excecoes: { alinhamento: "à esquerda" }, avisos: [] });
  });

  it("a fonte e o tamanho do trabalho aparecem só no parágrafo", () => {
    expect(linhasDaJanelinha(abnt, "disciplina", citacao(), "todos").some((l) => l.doTrabalho)).toBe(false);
    expect(linhasDaJanelinha(abnt, "disciplina", paragrafo(), "todos").filter((l) => l.doTrabalho).map((l) => l.rotulo)).toEqual(["Fonte do trabalho", "Tamanho da letra"]);
  });
});

describe("a fonte e o tamanho do trabalho", () => {
  it("as quatro fontes mais usadas, e o tamanho de 10 a 14", () => {
    const [fonte, tamanho] = linhasDaFonte(abnt);
    expect(fonte.opcoes.map((o) => o.rotulo)).toEqual([...FONTES_DO_TRABALHO]);
    expect(tamanho.opcoes.map((o) => o.rotulo)).toEqual(["10", "11", "12", "13", "14"]);
    expect(ativas(fonte)).toEqual(["Times New Roman"]);
    expect(ativas(tamanho)).toEqual(["12"]);
    expect([...fonte.opcoes, ...tamanho.opcoes].every((o) => o.todosEm === "texto")).toBe(true);
  });

  it("na ABNT, a fonte e o tamanho são escritos cada um sozinho", () => {
    const [fonte, tamanho] = linhasDaFonte(abnt);
    expect(fonte.opcoes[2].escrita).toEqual([["fonte", "Calibri"]]);
    expect(tamanho.opcoes[0].escrita).toEqual([["tamanho", "10 pt"]]);
  });

  it("na APA, trocar a fonte leva o tamanho que a APA pede para ela; trocar o tamanho mantém a fonte", () => {
    const [fonte, tamanho] = linhasDaFonte(apa);
    expect(fonte.opcoes.map((o) => o.escrita)).toEqual([
      [["fonte e tamanho", "Times New Roman 12 pt"]],
      [["fonte e tamanho", "Arial 11 pt"]],
      [["fonte e tamanho", "Calibri 11 pt"]],
      [["fonte e tamanho", "Georgia 11 pt"]],
    ]);
    expect(tamanho.opcoes[1].escrita).toEqual([["fonte e tamanho", "Times New Roman 11 pt"]]);
  });

  it("escrever “todos” muda o trabalho todo, com aviso quando sai da norma", () => {
    const calibri = escreverTodos(abnt, {}, "texto", [["fonte", "Calibri"]]);
    expect(calibri.ok && calibri.ajustes).toEqual({ "Texto › fonte": "Calibri" });
    // A ABNT não fixa a fonte: sem aviso. O tamanho 12 ela fixa: trocar avisa.
    expect(calibri.ok && calibri.avisos).toEqual([]);
    const onze = escreverTodos(abnt, {}, "texto", [["tamanho", "11 pt"]]);
    expect(onze.ok && onze.ajustes).toEqual({ "Texto › tamanho": "11 pt" });
    expect(onze.ok && onze.avisos.length).toBe(1);
    const par = escreverTodos(apa, {}, "texto", [["fonte e tamanho", "Georgia 11 pt"]]);
    expect(par.ok && par.ajustes).toEqual({ "Texto › fonte e tamanho": "Georgia 11 pt" });
    expect(par.ok && par.avisos).toEqual([]);
    const fora = escreverTodos(apa, {}, "texto", [["fonte e tamanho", "Georgia 14 pt"]]);
    expect(fora.ok && fora.avisos).toEqual(["A APA oferece “Times New Roman 12 pt”, “Arial 11 pt”, “Calibri 11 pt”, “Georgia 11 pt” e “Aptos 12 pt”. Com “Georgia 14 pt”, o trabalho sai da norma neste ponto."]);
  });
});

describe("as linhas do título", () => {
  it("o Título 1 da ABNT: negrito, maiúsculas, numerado, página nova", () => {
    const linhas = linhasDaJanelinha(abnt, "disciplina", titulo(1), "todos");
    expect(linhas.map((l) => l.rotulo)).toEqual(["Negrito", "Itálico", "Sublinhado", "Posição", "Numerar sozinho", "Maiúsculas sozinho", "Começar em página nova"]);
    expect(linhas.filter((l) => l.forma === "chave" && ativas(l).length).map((l) => l.rotulo)).toEqual(["Negrito", "Numerar sozinho", "Maiúsculas sozinho", "Começar em página nova"]);
    expect(ativas(linha(linhas, "Posição"))).toEqual(["Esquerda"]);
  });

  it("num artigo, o Título 1 da ABNT não começa em página nova", () => {
    const linhas = linhasDaJanelinha(abnt, "artigo", titulo(1), "todos");
    expect(ativas(linha(linhas, "Começar em página nova"))).toEqual([]);
  });

  it("uma chave escreve o contrário do que vale", () => {
    const linhas = linhasDaJanelinha(abnt, "disciplina", titulo(1), "todos");
    expect(linha(linhas, "Negrito").opcoes[0].escrita).toEqual([["destaque", "maiúsculas"]]);
    expect(linha(linhas, "Itálico").opcoes[0].escrita).toEqual([["destaque", "maiúsculas, negrito, itálico"]]);
    expect(linha(linhas, "Numerar sozinho").opcoes[0].escrita).toEqual([["numerar sozinho", "não"]]);
    expect(linha(linhas, "Começar em página nova").opcoes[0].escrita).toEqual([["página nova", "não"]]);
  });

  it("ligar as maiúsculas onde o destaque não as tem também as põe no destaque", () => {
    const linhas = linhasDaJanelinha(apa, "disciplina", titulo(1), "todos");
    expect(linha(linhas, "Maiúsculas sozinho").opcoes[0].ativa).toBe(false);
    expect(linha(linhas, "Maiúsculas sozinho").opcoes[0].escrita).toEqual([
      ["maiúsculas sozinho", "sim"],
      ["destaque", "maiúsculas, negrito"],
    ]);
  });

  it("desligar as maiúsculas só desliga a opção", () => {
    const linhas = linhasDaJanelinha(abnt, "disciplina", titulo(1), "todos");
    expect(linha(linhas, "Maiúsculas sozinho").opcoes[0].escrita).toEqual([["maiúsculas sozinho", "não"]]);
  });

  it("a exceção de um título marca só a linha dela", () => {
    const bloco = titulo(2, { "numerar sozinho": "não" });
    const linhas = linhasDaJanelinha(abnt, "disciplina", bloco, "este");
    expect(linha(linhas, "Numerar sozinho").deExcecao).toBe(true);
    expect(ativas(linha(linhas, "Numerar sozinho"))).toEqual([]);
    expect(linha(linhas, "Negrito").deExcecao).toBe(false);
    expect(excecoesDoBloco(bloco)).toEqual(["numerar sozinho"]);
  });
});

describe("escrever “só este”", () => {
  it("põe a exceção no bloco", () => {
    const r = escreverSoEste(abnt, paragrafo(), [["alinhamento", "centralizado"]]);
    expect(r).toEqual({ ok: true, excecoes: { alinhamento: "centralizado" }, avisos: [] });
  });

  it("avisa quando o valor sai do que a norma fixa", () => {
    const r = escreverSoEste(abnt, paragrafo(), [["entrelinha", "duplo"]]);
    expect(r).toEqual({ ok: true, excecoes: { entrelinha: "duplo" }, avisos: [expect.stringContaining("A ABNT pede “1,5”")] });
  });

  it("um valor igual ao do modelo tira a exceção que havia", () => {
    const r = escreverSoEste(abnt, paragrafo({ alinhamento: "centralizado" }), [["alinhamento", "justificado"]]);
    expect(r).toEqual({ ok: true, excecoes: undefined, avisos: [] });
  });

  it("ligar as maiúsculas na APA escreve as duas exceções", () => {
    const linhas = linhasDaJanelinha(apa, "disciplina", titulo(1), "este");
    const r = escreverSoEste(apa, titulo(1), linha(linhas, "Maiúsculas sozinho").opcoes[0].escrita);
    expect(r).toMatchObject({ ok: true, excecoes: { "maiúsculas sozinho": "sim", destaque: "maiúsculas, negrito" } });
  });

  it("um valor que o elemento não aceita volta com a explicação", () => {
    const r = escreverSoEste(abnt, paragrafo(), [["fonte", "Arial"]]);
    expect(r.ok).toBe(false);
  });
});

describe("escrever “todos os iguais”", () => {
  it("vai para as escolhas do trabalho, com o nome do elemento", () => {
    const r = escreverTodos(abnt, {}, "titulos.nivel2", [["posição", "centralizado"]]);
    expect(r).toEqual({ ok: true, ajustes: { "Títulos › Nível 2 › posição": "centralizado" }, avisos: [] });
  });

  it("um valor igual ao do modelo apaga a escolha", () => {
    const r = escreverTodos(abnt, { "Parágrafo › alinhamento": "centralizado" }, "paragrafo", [["alinhamento", "justificado"]]);
    expect(r).toEqual({ ok: true, ajustes: {}, avisos: [] });
  });

  it("avisa quando sai do que a norma fixa", () => {
    const r = escreverTodos(abnt, {}, "paragrafo", [["entrelinha", "duplo"]]);
    expect(r).toMatchObject({ ok: true, ajustes: { "Parágrafo › entrelinha": "duplo" } });
    expect(r.ok && r.avisos[0]).toContain("A ABNT pede “1,5”");
  });

  it("escreve mais de uma propriedade de uma vez (as maiúsculas)", () => {
    const r = escreverTodos(apa, {}, "titulos.nivel1", [
      ["maiúsculas sozinho", "sim"],
      ["destaque", "maiúsculas, negrito"],
    ]);
    expect(r).toMatchObject({ ok: true, ajustes: { "Títulos › Nível 1 › maiúsculas sozinho": "sim", "Títulos › Nível 1 › destaque": "maiúsculas, negrito" } });
  });

  it("uma propriedade que o elemento não tem volta com erro", () => {
    expect(escreverTodos(abnt, {}, "paragrafo", [["posição", "centralizado"]]).ok).toBe(false);
  });
});

describe("de onde vem o que vale", () => {
  it("sem exceção, diz o modelo", () => {
    expect(origemDaJanelinha(abnt, paragrafo(), "todos")).toMatch(/^Do modelo ABNT/);
  });

  it("com exceção, em “só este”, diz o que é só deste bloco", () => {
    expect(origemDaJanelinha(abnt, titulo(1, { posição: "centralizado" }), "este")).toBe("Só neste título: posição. O resto vem do modelo.");
    expect(origemDaJanelinha(abnt, titulo(1, { posição: "centralizado" }), "todos")).toMatch(/^Do modelo ABNT/);
  });
});

describe("o quadro de valores da barra", () => {
  it("parágrafo", () => {
    expect(quadroDosValores(abnt, "disciplina", paragrafo())).toBe("No PDF: Times New Roman · 12 · esp. 1,5 · Justificado");
    expect(quadroDosValores(apa, "disciplina", paragrafo())).toBe("No PDF: Times New Roman · 12 · esp. duplo · À esquerda");
  });

  it("título: destaque, número e página nova do jeito que saem no PDF", () => {
    expect(quadroDosValores(abnt, "disciplina", titulo(1))).toBe("No PDF: Título 1 · negrito, maiúsculas · numerado · página nova");
    expect(quadroDosValores(abnt, "artigo", titulo(1))).toBe("No PDF: Título 1 · negrito, maiúsculas · numerado");
    expect(quadroDosValores(apa, "disciplina", titulo(2))).toBe("No PDF: Título 2 · negrito · sem número");
  });

  it("segue a exceção do bloco", () => {
    expect(quadroDosValores(abnt, "disciplina", paragrafo({ alinhamento: "centralizado", entrelinha: "duplo" }))).toBe(
      "No PDF: Times New Roman · 12 · esp. duplo · Centralizado",
    );
    expect(quadroDosValores(abnt, "disciplina", titulo(1, { "numerar sozinho": "não", "página nova": "não" }))).toBe(
      "No PDF: Título 1 · negrito, maiúsculas · sem número",
    );
  });

  it("citação longa: tamanho, espaçamento e recuo", () => {
    expect(quadroDosValores(abnt, "disciplina", citacao())).toBe("No PDF: Citação longa · 10 pt · esp. simples · recuo 4 cm");
    expect(quadroDosValores(abnt, "disciplina", citacao({ "recuo à esquerda": "0 cm", tamanho: "12 pt" }))).toBe("No PDF: Citação longa · 12 pt · esp. simples · sem recuo");
  });

  it("outros blocos não têm quadro", () => {
    expect(quadroDosValores(abnt, "disciplina", null)).toBeNull();
  });
});
