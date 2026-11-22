// Figuras, tabelas e notas no editor, sem navegador: como entram, mudam e saem;
// a colagem da planilha; e a imagem (formato, tamanho de impressão, código).

import { getSchema } from "@tiptap/core";
import { Node as NoPM } from "@tiptap/pm/model";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import type { Bloco } from "../documento/modelo";
import { blocosDoEditor, editorDosBlocos } from "../documento/tiptap";
import { ControleDaBarra, extensoesDoApud } from "./extensoes";
import {
  apagarIlustracao,
  colarNaGrade,
  cursorNaGrade,
  gradeDoTextoColado,
  ilustracaoDoCursor,
  inserirFigura,
  inserirTabela,
  mudarIlustracao,
  tabelaDaPlanilha,
} from "./ilustracoes";
import { ALTURA_DE_IMPRESSAO_PX, LARGURA_DE_IMPRESSAO_PX, codigoDaImagem, enderecoDaImagem, formatoDaImagem, paraBase64, tamanhoParaImpressao } from "./imagens";
import { campoParaNota, inserirNota, notaParaCampo, notaSelecionada, trocarNota } from "./notas";
import { buscarBlocos } from "./blocos";

const esquema = getSchema(extensoesDoApud(new ControleDaBarra()));
const textos = (...t: string[]) => t.map((texto) => ({ texto }));
const estado = (blocos: Bloco[], cursor?: number) => {
  const e = EditorState.create({ schema: esquema, doc: NoPM.fromJSON(esquema, editorDosBlocos(blocos)) });
  return cursor === undefined ? e : e.apply(e.tr.setSelection(TextSelection.create(e.doc, cursor)));
};
const blocosDe = (e: EditorState) => blocosDoEditor(e.doc.toJSON());
const tipos = (e: EditorState) => blocosDe(e).map((b) => b.tipo);

describe("barra / com os blocos da fase 3", () => {
  it("acha citação longa, figura, tabela e nota de rodapé pelo nome e por palavras parecidas", () => {
    expect(buscarBlocos("citacao").map((t) => t.rotulo)).toEqual(["Citação longa"]);
    expect(buscarBlocos("imagem").map((t) => t.rotulo)).toEqual(["Figura"]);
    expect(buscarBlocos("excel").map((t) => t.rotulo)).toEqual(["Tabela"]);
    expect(buscarBlocos("rodape").map((t) => t.rotulo)).toEqual(["Nota de rodapé"]);
    expect(buscarBlocos("").length).toBe(14);
  });

  it("só a citação longa troca o tipo do bloco; figura, tabela e nota pedem à tela", () => {
    const porId = (id: string) => buscarBlocos("").find((t) => t.id === id)!;
    expect(porId("citacao-longa").pedir).toBeUndefined();
    expect(porId("citacao-longa").soNaBarra).toBeFalsy();
    expect(["figura", "tabela", "nota"].map((id) => porId(id).pedir)).toEqual(["imagem", "tabela", "nota"]);
  });
});

describe("inserir figura e tabela", () => {
  it("a figura entra no lugar do parágrafo vazio, com um parágrafo depois, e o cursor vai para o título", () => {
    const e = estado([{ tipo: "paragrafo", trechos: textos("antes") }, { tipo: "paragrafo", trechos: [] }], 3);
    // O cursor está no primeiro parágrafo (não vazio): a figura entra depois dele, e o parágrafo vazio fica.
    const depois = e.apply(inserirFigura(e, "img1"));
    expect(tipos(depois)).toEqual(["paragrafo", "figura", "paragrafo"]);
    expect(blocosDe(depois)[1]).toMatchObject({ tipo: "figura", imagem: "img1", titulo: [], fonte: [] });
    expect(ilustracaoDoCursor(depois)).toMatchObject({ tipo: "figura" });
  });

  it("no parágrafo vazio, a figura toma o lugar dele (o '/' foi apagado antes)", () => {
    const e = estado([{ tipo: "paragrafo", trechos: textos("antes") }, { tipo: "paragrafo", trechos: [] }]);
    const noVazio = e.apply(e.tr.setSelection(TextSelection.create(e.doc, e.doc.content.size - 1)));
    const depois = noVazio.apply(inserirFigura(noVazio, "img1"));
    // A figura era o último bloco: o Apud põe um parágrafo depois, para o cursor poder sair.
    expect(tipos(depois)).toEqual(["paragrafo", "figura", "paragrafo"]);
    expect(depois.selection.$from.parent.type.name).toBe("tituloDaIlustracao");
  });

  it("a tabela nova tem título, 3 colunas, cabeçalho e 2 linhas; o cursor vai para o título", () => {
    const e = estado([{ tipo: "paragrafo", trechos: [] }], 1);
    const depois = e.apply(inserirTabela(e));
    expect(blocosDe(depois)[0]).toEqual({
      tipo: "tabela",
      cabecalho: 1,
      linhas: [[[], [], []], [[], [], []], [[], [], []]],
      titulo: [],
      fonte: [],
    });
    expect(depois.selection.$from.parent.type.name).toBe("tituloDaIlustracao");
    expect(ilustracaoDoCursor(depois)?.tipo).toBe("tabela");
  });

  it("dentro de uma lista, a figura entra depois da lista inteira", () => {
    const e = estado([{ tipo: "lista", sequencia: false, itens: [{ trechos: textos("um") }, { trechos: textos("dois") }] }], 4);
    expect(tipos(e.apply(inserirFigura(e, "x")))).toEqual(["lista", "figura", "paragrafo"]);
  });
});

describe("opções da figura e da tabela", () => {
  const figura: Bloco = { tipo: "figura", imagem: "img1", titulo: textos("Fluxo"), fonte: textos("Autor") };

  it("muda espécie, largura e 'elaborado pelo autor' e volta igual pelo modelo", () => {
    const e = estado([figura]);
    const pos = 0;
    const depois = e.apply(mudarIlustracao(e, pos, { especie: "grafico", largura: 60, fontePropria: true })!);
    expect(blocosDe(depois)[0]).toMatchObject({ tipo: "figura", especie: "grafico", largura: 60, fontePropria: true, fonte: textos("Autor") });
    // Voltar a "Figura" e ao tamanho natural tira as duas marcas do modelo.
    const volta = depois.apply(mudarIlustracao(depois, pos, { especie: null, largura: null, fontePropria: false })!);
    expect(blocosDe(volta)[0]).toEqual(figura);
  });

  it("trocar a imagem muda só o código", () => {
    const e = estado([figura]);
    const depois = e.apply(mudarIlustracao(e, 0, { imagem: "img2" })!);
    expect(blocosDe(depois)[0]).toEqual({ ...figura, imagem: "img2" });
  });

  it("não muda o que não é figura nem tabela", () => {
    const e = estado([{ tipo: "paragrafo", trechos: textos("a") }]);
    expect(mudarIlustracao(e, 0, { largura: 50 })).toBeNull();
    expect(apagarIlustracao(e, 0)).toBeNull();
  });

  it("apagar tira o bloco inteiro; se era o único, sobra um parágrafo vazio", () => {
    const e = estado([{ tipo: "paragrafo", trechos: textos("a") }, figura]);
    const pos = e.doc.child(0).nodeSize;
    expect(tipos(e.apply(apagarIlustracao(e, pos)!))).toEqual(["paragrafo"]);
    const so = estado([figura]);
    expect(blocosDe(so.apply(apagarIlustracao(so, 0)!))).toEqual([{ tipo: "paragrafo", trechos: [] }]);
  });

  it("o cursor em qualquer parte da figura acha a figura; fora dela, não", () => {
    const e = estado([{ tipo: "paragrafo", trechos: textos("a") }, figura], 1);
    expect(ilustracaoDoCursor(e)).toBeNull();
    const dentro = e.apply(e.tr.setSelection(TextSelection.create(e.doc, e.doc.child(0).nodeSize + 3)));
    expect(ilustracaoDoCursor(dentro)).toMatchObject({ tipo: "figura", pos: e.doc.child(0).nodeSize });
  });
});

describe("colar da planilha", () => {
  it("lê colunas por tabulação e linhas por quebra de linha, e ignora a quebra final do Excel", () => {
    expect(gradeDoTextoColado("Ano\tTotal\r\n2020\t10\r\n2021\t12\r\n")).toEqual([
      ["Ano", "Total"],
      ["2020", "10"],
      ["2021", "12"],
    ]);
  });

  it("célula entre aspas pode ter quebra de linha, tabulação e aspas; vira uma linha só", () => {
    expect(gradeDoTextoColado('"a\nb"\t"disse ""oi"""\tc\n1\t2\t3')).toEqual([
      ["a b", 'disse "oi"', "c"],
      ["1", "2", "3"],
    ]);
  });

  it("linhas mais curtas são completadas com células vazias", () => {
    expect(gradeDoTextoColado("a\tb\tc\nd")).toEqual([
      ["a", "b", "c"],
      ["d", "", ""],
    ]);
  });

  it("um valor só (uma célula) não é planilha: a colagem normal cuida", () => {
    expect(gradeDoTextoColado("só um valor")).toBeNull();
    expect(gradeDoTextoColado("um valor\r\n")).toBeNull();
    expect(gradeDoTextoColado("")).toBeNull();
  });

  const tabela: Bloco = {
    tipo: "tabela",
    cabecalho: 1,
    linhas: [
      [textos("A"), textos("B")],
      [textos("1"), textos("2")],
    ],
    titulo: textos("Dados"),
    fonte: textos("Autor"),
  };
  /** O cursor no começo do texto da célula (linha, coluna). */
  const naCelula = (linha: number, coluna: number) => {
    const e = estado([tabela]);
    let achada = -1;
    let l = -1;
    let c = -1;
    e.doc.descendants((no, pos) => {
      if (no.type.name === "tableRow") {
        l++;
        c = -1;
      } else if (no.type.name === "tableCell" || no.type.name === "tableHeader") {
        c++;
        if (l === linha && c === coluna) achada = pos + 2;
      }
      return true;
    });
    return e.apply(e.tr.setSelection(TextSelection.create(e.doc, achada)));
  };

  it("dentro da tabela, preenche a grade a partir da célula do cursor, sobrescrevendo", () => {
    const e = naCelula(0, 0);
    expect(cursorNaGrade(e)).toBe(true);
    const depois = e.apply(colarNaGrade(e, [["x", "y"], ["z", "w"]])!);
    const t = blocosDe(depois)[0];
    expect(t).toMatchObject({ tipo: "tabela", cabecalho: 1, titulo: textos("Dados"), fonte: textos("Autor") });
    expect((t as { linhas: unknown }).linhas).toEqual([
      [textos("x"), textos("y")],
      [textos("z"), textos("w")],
    ]);
  });

  it("se a planilha é maior que a grade, cria as linhas e colunas que faltam (o cabeçalho continua cabeçalho)", () => {
    const e = naCelula(1, 1);
    const depois = e.apply(colarNaGrade(e, [["a", "b", "c"], ["d", "e", "f"]])!);
    const t = blocosDe(depois)[0] as { linhas: unknown[][]; cabecalho: number };
    expect(t.cabecalho).toBe(1);
    expect(t.linhas).toEqual([
      [textos("A"), textos("B"), [], []],
      [textos("1"), textos("a"), textos("b"), textos("c")],
      [[], textos("d"), textos("e"), textos("f")],
    ]);
    expect(t.linhas.every((l) => l.length === t.linhas[0].length)).toBe(true);
  });

  it("fora de uma tabela, a colagem da grade não faz nada", () => {
    const e = estado([{ tipo: "paragrafo", trechos: textos("a") }], 1);
    expect(cursorNaGrade(e)).toBe(false);
    expect(colarNaGrade(e, [["a", "b"]])).toBeNull();
  });

  it("planilha colada num parágrafo vazio vira uma tabela com a primeira linha de cabeçalho", () => {
    const e = estado([{ tipo: "paragrafo", trechos: [] }], 1);
    const depois = e.apply(tabelaDaPlanilha(e, [["Ano", "Total"], ["2020", ""]])!);
    expect(blocosDe(depois)[0]).toMatchObject({ tipo: "tabela", cabecalho: 1, linhas: [[textos("Ano"), textos("Total")], [textos("2020"), []]] });
  });

  it("planilha colada num parágrafo com texto não vira tabela sozinha", () => {
    const e = estado([{ tipo: "paragrafo", trechos: textos("texto") }], 3);
    expect(tabelaDaPlanilha(e, [["a", "b"]])).toBeNull();
  });
});

describe("nota de rodapé", () => {
  const nota = { trechos: [{ texto: "Veja " }, { texto: "isto", marcas: ["italico" as const] }] };

  it("entra no ponto do cursor, troca o texto e sai", () => {
    const e = estado([{ tipo: "paragrafo", trechos: textos("antes depois") }], 7);
    const com = e.apply(inserirNota(e, 7, 7, nota));
    expect(blocosDe(com)[0]).toEqual({ tipo: "paragrafo", trechos: [...textos("antes "), { nota }, ...textos("depois")] });
    const trocada = com.apply(trocarNota(com, 7, { trechos: textos("Outra") })!);
    expect(blocosDe(trocada)[0]).toMatchObject({ trechos: [...textos("antes "), { nota: { trechos: textos("Outra") } }, ...textos("depois")] });
    const sem = trocada.apply(trocarNota(trocada, 7, null)!);
    expect(blocosDe(sem)[0]).toEqual({ tipo: "paragrafo", trechos: textos("antes depois") });
  });

  it("trocarNota não mexe no que não é nota", () => {
    expect(trocarNota(estado([{ tipo: "paragrafo", trechos: textos("a") }]), 0, null)).toBeNull();
  });

  it("a nota selecionada (clique ou setas) é encontrada para a janela abrir", () => {
    const e = estado([{ tipo: "paragrafo", trechos: [...textos("a"), { nota }] }]);
    expect(notaSelecionada(e)).toBeNull();
    const sel = e.apply(e.tr.setSelection(NodeSelection.create(e.doc, 2)));
    expect(notaSelecionada(sel)).toEqual({ pos: 2, nota });
  });

  it("o campo da janela leva e traz a nota com negrito, itálico e sobrescrito", () => {
    const completa = { trechos: [{ texto: "a", marcas: ["negrito" as const] }, { texto: "b", marcas: ["italico" as const] }, { texto: "2", marcas: ["sobrescrito" as const] }] };
    expect(campoParaNota(notaParaCampo(completa))).toEqual(completa);
    expect(campoParaNota(notaParaCampo(null))).toBeNull();
  });

  it("nota em branco não vale; parágrafos colados se juntam num só", () => {
    expect(campoParaNota({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "   " }] }] })).toBeNull();
    const dois = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "um" }] },
        { type: "paragraph", content: [{ type: "text", text: "dois" }] },
      ],
    };
    expect(campoParaNota(dois)).toEqual({ trechos: textos("um dois") });
  });
});

describe("imagens", () => {
  it("o formato vem do tipo que o navegador informa ou, se faltar, da extensão", () => {
    expect(formatoDaImagem("image/png", "x")).toBe("png");
    expect(formatoDaImagem("image/jpeg", "x")).toBe("jpeg");
    expect(formatoDaImagem("", "Foto.JPG")).toBe("jpeg");
    expect(formatoDaImagem("", "desenho.svg")).toBe("svg");
    expect(formatoDaImagem("application/pdf", "relatorio.pdf")).toBeNull();
    expect(formatoDaImagem("", "sem-extensao")).toBeNull();
  });

  it("foto grande é reduzida ao tamanho de impressão, mantendo a proporção; imagem pequena fica como está", () => {
    expect(tamanhoParaImpressao(800, 600)).toBeNull();
    expect(tamanhoParaImpressao(LARGURA_DE_IMPRESSAO_PX, 1000)).toBeNull();
    // 4032 x 3024 (foto de celular): a largura manda.
    const r = tamanhoParaImpressao(4032, 3024)!;
    expect(r.largura).toBe(LARGURA_DE_IMPRESSAO_PX);
    expect(Math.abs(r.altura / r.largura - 3024 / 4032)).toBeLessThan(0.001);
    // Muito alta e estreita: a altura manda.
    const alta = tamanhoParaImpressao(1500, 6000)!;
    expect(alta.altura).toBe(ALTURA_DE_IMPRESSAO_PX);
    expect(alta.largura).toBeLessThan(1500);
    expect(tamanhoParaImpressao(0, 0)).toBeNull();
  });

  it("o código é o mesmo do que o script de prova usa (SHA-256, 16 dígitos), e o base64 aguenta arquivo grande", async () => {
    const bytes = new TextEncoder().encode("abc");
    expect(await codigoDaImagem(bytes)).toBe(createHash("sha256").update("abc").digest("hex").slice(0, 16));
    const grande = new Uint8Array(300_000).map((_, i) => i % 251);
    expect(paraBase64(grande)).toBe(Buffer.from(grande).toString("base64"));
    expect(enderecoDaImagem({ id: "x", formato: "svg", dados: "AAAA" })).toBe("data:image/svg+xml;base64,AAAA");
  });
});
