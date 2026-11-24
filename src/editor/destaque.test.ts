// Quais blocos aparecem em destaque (etapa 2d): o do cursor, os da seleção.

import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { Node as NoPM } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { ControleDaBarra, extensoesDoApud } from "./extensoes";
import { editorDosBlocos } from "../documento/tiptap";
import type { Bloco } from "../documento/modelo";
import { blocosDaSelecao } from "./destaque";

const esquema = getSchema(extensoesDoApud(new ControleDaBarra()));
const p = (t: string): Bloco => ({ tipo: "paragrafo", trechos: [{ texto: t }] });
const estado = () => EditorState.create({ doc: NoPM.fromJSON(esquema, editorDosBlocos([p("um"), p("dois"), p("três")])), schema: esquema });

describe("os blocos em destaque", () => {
  it("o cursor destaca o bloco em que está", () => {
    const e = estado();
    expect(blocosDaSelecao(e.apply(e.tr.setSelection(TextSelection.create(e.doc, 2))))).toEqual([0]);
    expect(blocosDaSelecao(e.apply(e.tr.setSelection(TextSelection.create(e.doc, 8))))).toEqual([1]);
  });

  it("uma seleção destaca todos os blocos que ela cobre", () => {
    const e = estado();
    expect(blocosDaSelecao(e.apply(e.tr.setSelection(TextSelection.create(e.doc, 2, 9))))).toEqual([0, 1]);
    expect(blocosDaSelecao(e.apply(e.tr.setSelection(TextSelection.create(e.doc, 2, 15))))).toEqual([0, 1, 2]);
  });
});
