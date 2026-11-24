// Os títulos automáticos no editor (etapa 2): número em cinza, linha de página
// nova e os números escritos à mão que saem do texto.

import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node as NoPM } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { carregarModelo } from "../../scripts/prova-lib";
import { blocosDoEditor, editorDosBlocos } from "../documento/tiptap";
import type { Bloco } from "../documento/modelo";
import { ControleDaBarra, extensoesDoApud } from "./extensoes";
import { tirarNumerosEscritos, tirarPaginaNova, titulosDoEditor, TitulosDoTrabalho } from "./titulos";

const abnt = carregarModelo("abnt.txt");
const apa = carregarModelo("apa.txt");
const esquema = getSchema(extensoesDoApud(new ControleDaBarra()));
const estado = (blocos: Bloco[]) => EditorState.create({ doc: NoPM.fromJSON(esquema, editorDosBlocos(blocos)), schema: esquema });
const titulo = (nivel: 1 | 2 | 3, texto: string, excecoes?: Record<string, string>): Bloco => ({ tipo: "titulo", nivel, trechos: texto ? [{ texto }] : [], ...(excecoes ? { excecoes } : {}) });

describe("títulos no editor", () => {
  it("a mesma conta do PDF: números, página nova e sem a linha depois de uma quebra posta à mão", () => {
    const e = estado([titulo(1, "Introdução"), { tipo: "paragrafo", trechos: [{ texto: "a" }] }, titulo(2, "Contexto"), titulo(1, ""), { tipo: "quebra" }, titulo(1, "Método")]);
    const t = titulosDoEditor(e.doc, abnt, "tcc");
    // O título vazio não conta (não sai no PDF).
    expect(t.map((x) => x.forma.numero)).toEqual(["1", "1.1", "2"]);
    expect(t.map((x) => x.forma.paginaNova)).toEqual([true, false, true]);
    expect(t.map((x) => x.depoisDeQuebra)).toEqual([false, false, true]);
    expect(titulosDoEditor(e.doc, abnt, "artigo").map((x) => x.forma.paginaNova)).toEqual([false, false, false]);
  });

  it("com a numeração automática, o número escrito à mão sai do texto numa mudança só; sem ela, fica", () => {
    const e = estado([titulo(1, "1 Introdução"), titulo(2, "1.1 Contexto"), titulo(1, "1964 e o golpe"), titulo(1, "2 Fica", { "numerar sozinho": "não" })]);
    const tr = tirarNumerosEscritos(e, abnt)!;
    expect(tr.steps.length).toBe(2);
    expect(blocosDoEditor(e.apply(tr).doc.toJSON()).map((b) => (b.tipo === "titulo" ? (b.trechos[0] as { texto: string }).texto : ""))).toEqual([
      "Introdução",
      "Contexto",
      "1964 e o golpe",
      "2 Fica",
    ]);
    expect(tirarNumerosEscritos(e, apa)).toBeNull();
    expect(tirarNumerosEscritos(e.apply(tr), abnt)).toBeNull();
  });

  it("Delete na linha de página nova tira a página nova só daquele título", () => {
    const e = estado([titulo(1, "Introdução"), titulo(1, "Método")]);
    const pos = titulosDoEditor(e.doc, abnt, "tcc")[1].pos;
    const depois = e.apply(tirarPaginaNova(e, pos, abnt)!);
    expect(blocosDoEditor(depois.doc.toJSON())[1]).toEqual(titulo(1, "Método", { "página nova": "não" }));
    expect(titulosDoEditor(depois.doc, abnt, "tcc").map((x) => x.forma.paginaNova)).toEqual([true, false]);
    // Num parágrafo, não faz nada.
    expect(tirarPaginaNova(estado([{ tipo: "paragrafo", trechos: [{ texto: "a" }] }]), 0, abnt)).toBeNull();
  });

  it("o controle avisa quando o modelo ou o tipo mudam, e dá os números para a Estrutura", () => {
    const c = new TitulosDoTrabalho();
    let avisos = 0;
    c.ouvir(() => avisos++);
    c.mudar(abnt, "tcc");
    c.mudar(abnt, "tcc");
    c.mudar(abnt, "artigo");
    expect(avisos).toBe(2);
    expect(c.numera(1)).toBe(true);
    const formas = c.formasDosBlocos([titulo(1, "A"), { tipo: "paragrafo", trechos: [] }, titulo(2, "B"), titulo(2, "")]);
    expect([...formas].map(([i, f]) => [i, f.numero])).toEqual([
      [0, "1"],
      [2, "1.1"],
    ]);
  });
});
