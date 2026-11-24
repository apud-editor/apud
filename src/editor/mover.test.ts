// Mudar um bloco de lugar (etapa 2d): a conta da soltura e a mudança no texto.

import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node as NoPM } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { ControleDaBarra, extensoesDoApud } from "./extensoes";
import { blocosDoEditor, editorDosBlocos } from "../documento/tiptap";
import type { Bloco } from "../documento/modelo";
import { alturaDaLinha, ficaNoMesmoLugar, indiceDepoisDeMover, lacunaAoMover, lacunaDaSoltura, MEIA_MARGEM, moverBloco, podeMover, type Faixa } from "./mover";

// Quatro blocos de 30 px, com 18 px de espaço entre eles.
const faixas: Faixa[] = [0, 1, 2, 3].map((i) => ({ topo: i * 48, base: i * 48 + 30 }));

describe("para onde o mouse leva o bloco", () => {
  it("na metade de cima de um bloco, a lacuna é a de antes dele; na de baixo, a de depois", () => {
    expect(lacunaDaSoltura(faixas, 5)).toBe(0);
    expect(lacunaDaSoltura(faixas, 14)).toBe(0);
    expect(lacunaDaSoltura(faixas, 16)).toBe(1);
    expect(lacunaDaSoltura(faixas, 48 + 5)).toBe(1);
    expect(lacunaDaSoltura(faixas, 48 + 25)).toBe(2);
    expect(lacunaDaSoltura(faixas, 3 * 48 + 25)).toBe(4);
  });

  it("acima de tudo é a lacuna 0, abaixo de tudo é a última", () => {
    expect(lacunaDaSoltura(faixas, -200)).toBe(0);
    expect(lacunaDaSoltura(faixas, 5000)).toBe(4);
  });

  it("sem blocos, a lacuna é 0 e não há onde desenhar a linha", () => {
    expect(lacunaDaSoltura([], 10)).toBe(0);
    expect(alturaDaLinha([], 0)).toBeNull();
  });

  it("soltar na lacuna de cima ou de baixo do próprio bloco não muda nada", () => {
    expect(ficaNoMesmoLugar(2, 2)).toBe(true);
    expect(ficaNoMesmoLugar(2, 3)).toBe(true);
    expect(ficaNoMesmoLugar(2, 1)).toBe(false);
    expect(ficaNoMesmoLugar(2, 4)).toBe(false);
  });

  it("a linha cobalto fica logo abaixo do bloco de cima, ou logo acima do primeiro", () => {
    expect(alturaDaLinha(faixas, 0)).toBe(0 - MEIA_MARGEM);
    expect(alturaDaLinha(faixas, 1)).toBe(30 + MEIA_MARGEM);
    expect(alturaDaLinha(faixas, 4)).toBe(3 * 48 + 30 + MEIA_MARGEM);
  });

  it("onde o bloco fica na ordem depois de solto", () => {
    expect(indiceDepoisDeMover(0, 3)).toBe(2);
    expect(indiceDepoisDeMover(3, 1)).toBe(1);
    expect(indiceDepoisDeMover(1, 4)).toBe(3);
    expect(indiceDepoisDeMover(2, 0)).toBe(0);
  });
});

describe("mover para cima e para baixo", () => {
  it("sobe e desce um lugar de cada vez", () => {
    expect(lacunaAoMover(2, 4, "cima")).toBe(1);
    expect(lacunaAoMover(2, 4, "baixo")).toBe(4);
    expect(indiceDepoisDeMover(2, lacunaAoMover(2, 4, "cima")!)).toBe(1);
    expect(indiceDepoisDeMover(2, lacunaAoMover(2, 4, "baixo")!)).toBe(3);
  });

  it("o primeiro não sobe e o último não desce", () => {
    expect(lacunaAoMover(0, 4, "cima")).toBeNull();
    expect(lacunaAoMover(3, 4, "baixo")).toBeNull();
    expect(lacunaAoMover(0, 1, "baixo")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// A mudança no texto

const esquema = getSchema(extensoesDoApud(new ControleDaBarra()));

const texto = (t: string): Bloco => ({ tipo: "paragrafo", trechos: [{ texto: t }] });
const titulo = (nivel: 1 | 2 | 3, t: string, excecoes?: Record<string, string>): Bloco => ({ tipo: "titulo", nivel, trechos: [{ texto: t }], ...(excecoes ? { excecoes } : {}) });

function estadoCom(blocos: Bloco[]): EditorState {
  return EditorState.create({ doc: NoPM.fromJSON(esquema, editorDosBlocos(blocos)), schema: esquema });
}
const ordem = (estado: EditorState) =>
  blocosDoEditor(estado.doc.toJSON()).map((b) => (b.tipo === "paragrafo" || b.tipo === "titulo" ? b.trechos.map((t) => ("texto" in t ? t.texto : "")).join("") : b.tipo));

describe("mover o bloco no texto", () => {
  const base = [titulo(1, "Introdução"), texto("a"), titulo(1, "Método"), texto("b"), texto("c")];

  it("leva o bloco para a lacuna, para cima e para baixo", () => {
    const e = estadoCom(base);
    expect(ordem(e.apply(moverBloco(e, 4, 1)!))).toEqual(["Introdução", "c", "a", "Método", "b"]);
    expect(ordem(e.apply(moverBloco(e, 1, 4)!))).toEqual(["Introdução", "Método", "b", "a", "c"]);
    expect(ordem(e.apply(moverBloco(e, 0, 5)!))).toEqual(["a", "Método", "b", "c", "Introdução"]);
    expect(ordem(e.apply(moverBloco(e, 3, 0)!))).toEqual(["b", "Introdução", "a", "Método", "c"]);
  });

  it("cada bloco anda sozinho: mover um título não leva o texto de baixo", () => {
    const e = estadoCom(base);
    expect(ordem(e.apply(moverBloco(e, 2, 0)!))).toEqual(["Método", "Introdução", "a", "b", "c"]);
  });

  it("o bloco leva junto o que tem: nível, exceções e texto", () => {
    const e = estadoCom([texto("a"), titulo(2, "Só este", { "numerar sozinho": "não" }), texto("b")]);
    const depois = e.apply(moverBloco(e, 1, 3)!);
    expect(blocosDoEditor(depois.doc.toJSON())).toEqual([texto("a"), texto("b"), titulo(2, "Só este", { "numerar sozinho": "não" })]);
  });

  it("soltar no mesmo lugar não faz mudança nenhuma", () => {
    const e = estadoCom(base);
    expect(moverBloco(e, 2, 2)).toBeNull();
    expect(moverBloco(e, 2, 3)).toBeNull();
  });

  it("índice fora do texto não faz nada", () => {
    const e = estadoCom(base);
    expect(moverBloco(e, -1, 2)).toBeNull();
    expect(moverBloco(e, 9, 2)).toBeNull();
    expect(moverBloco(e, 1, 6)).toBeNull();
    expect(moverBloco(e, 1, -1)).toBeNull();
  });

  it("é uma mudança só: o Ctrl+Z (o passo de volta) deixa tudo como estava", () => {
    const e = estadoCom(base);
    const tr = moverBloco(e, 4, 1)!;
    expect(tr.steps.length).toBeGreaterThan(0);
    // Desfazer = aplicar os passos ao contrário.
    let doc = tr.doc;
    for (let i = tr.steps.length - 1; i >= 0; i--) doc = tr.steps[i].invert(tr.docs[i]).apply(doc).doc!;
    expect(doc.eq(e.doc)).toBe(true);
  });

  it("o cursor vai para dentro do bloco movido", () => {
    const e = estadoCom(base);
    const depois = e.apply(moverBloco(e, 4, 1)!);
    expect(depois.selection.$from.index(0)).toBe(1);
    const depoisParaBaixo = e.apply(moverBloco(e, 1, 4)!);
    expect(depoisParaBaixo.selection.$from.index(0)).toBe(3);
  });

  it("figura, lista e tabela também andam inteiras", () => {
    const e = estadoCom([
      texto("a"),
      { tipo: "lista", sequencia: false, itens: [{ trechos: [{ texto: "um" }] }, { trechos: [{ texto: "dois" }] }] } as Bloco,
      { tipo: "figura", imagem: "f1", titulo: [{ texto: "Gráfico" }], fonte: [{ texto: "Autor" }] } as Bloco,
      texto("b"),
    ]);
    const depois = e.apply(moverBloco(e, 2, 0)!);
    expect(blocosDoEditor(depois.doc.toJSON()).map((b) => b.tipo)).toEqual(["figura", "paragrafo", "lista", "paragrafo"]);
    const lista = blocosDoEditor(depois.doc.toJSON())[2];
    expect(lista.tipo === "lista" && lista.itens.length).toBe(2);
  });

  it("a lista de Referências não se move, mas os outros blocos podem passar por ela", () => {
    const e = estadoCom([texto("a"), texto("b"), { tipo: "referencias" }]);
    expect(podeMover(e.doc.child(2))).toBe(false);
    expect(podeMover(e.doc.child(0))).toBe(true);
    expect(moverBloco(e, 2, 0)).toBeNull();
    expect(ordem(e.apply(moverBloco(e, 0, 3)!))).toEqual(["b", "referencias", "a"]);
  });
});
