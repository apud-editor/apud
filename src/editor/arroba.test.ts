// O "@" rápido e a citação escrita à mão, sem navegador: o que a lista mostra,
// como as setas e o Enter se comportam, e onde o editor reconhece "(Silva, 2019)".

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSchema } from "@tiptap/core";
import { Node as NoPM } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { consultaRapida, criarReconhecedor } from "../citacoes/rapida";
import type { Bloco, Referencia } from "../documento/modelo";
import { blocosDoEditor, editorDosBlocos } from "../documento/tiptap";
import { ControleDoArroba, itensDoArroba, MAXIMO_NA_LISTA } from "./arroba";
import { ControleDaBarra, extensoesDoApud } from "./extensoes";
import { ControleDoReconhecimento, reconhecidasNoDoc, transformarEmCitacao, trechoNoCursor } from "./reconhecer";

const referencias = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "testes", "prova", "referencias.json"), "utf8")) as Referencia[];
const esquema = getSchema(extensoesDoApud(new ControleDaBarra()));
const doc = (blocos: Bloco[]) => NoPM.fromJSON(esquema, editorDosBlocos(blocos));
const tecla = (key: string, extra: Partial<KeyboardEvent> = {}) => ({ key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...extra }) as KeyboardEvent;

describe("a lista do @", () => {
  it("mostra as obras que combinam e sempre as duas saídas fixas", () => {
    const itens = itensDoArroba(referencias, consultaRapida("costa"));
    expect(itens.filter((i) => i.tipo === "obra").length).toBeGreaterThan(0);
    expect(itens.slice(-2).map((i) => i.tipo)).toEqual(["janela", "cadastrar"]);
  });

  it("com muita obra, mostra algumas e diz quantas faltam (sem ser escolhível)", () => {
    const itens = itensDoArroba(referencias, consultaRapida(""));
    expect(itens.filter((i) => i.tipo === "obra")).toHaveLength(MAXIMO_NA_LISTA);
    const resto = itens.find((i) => i.tipo === "restantes");
    expect(resto).toEqual({ tipo: "restantes", quantas: referencias.length - MAXIMO_NA_LISTA });
  });

  it("sem nenhuma obra que combine, sobram só as saídas fixas", () => {
    const itens = itensDoArroba(referencias, consultaRapida("zzzzzz"));
    expect(itens.map((i) => i.tipo)).toEqual(["janela", "cadastrar"]);
  });
});

describe("as teclas da lista", () => {
  function aberto(busca: string) {
    const c = new ControleDoArroba();
    c.lerReferencias = () => referencias;
    const consulta = consultaRapida(busca);
    const itens = itensDoArroba(referencias, consulta);
    let escolhido: unknown = null;
    c.abrir({ items: itens, query: busca, command: (e: unknown) => (escolhido = e), clientRect: null } as never);
    return { c, itens, escolhido: () => escolhido };
  }

  it("Enter escolhe a primeira obra; Shift+Enter escolhe pondo o autor no texto", () => {
    const a = aberto("costa");
    expect(a.c.tecla(tecla("Enter"))).toBe(true);
    expect((a.escolhido() as { autorNoTexto: boolean }).autorNoTexto).toBe(false);
    const b = aberto("costa");
    b.c.tecla(tecla("Enter", { shiftKey: true }));
    expect((b.escolhido() as { autorNoTexto: boolean }).autorNoTexto).toBe(true);
  });

  it("o localizador depois da vírgula vai junto", () => {
    const a = aberto("costa, p. 15");
    a.c.tecla(tecla("Enter"));
    expect((a.escolhido() as { localizador: unknown }).localizador).toEqual({ tipo: "pagina", valor: "15" });
  });

  it("sem obra que combine, Enter e Tab não são tomados (Enter continua sendo quebra de parágrafo)", () => {
    const a = aberto("zzzzzz");
    expect(a.c.ler().selecionado).toBe(-1);
    expect(a.c.tecla(tecla("Enter"))).toBe(false);
    expect(a.c.tecla(tecla("Tab"))).toBe(false);
    expect(a.escolhido()).toBeNull();
  });

  it("as setas pulam a linha 'e mais N' e dão a volta", () => {
    const a = aberto("");
    const idx = a.itens.map((i) => i.tipo);
    expect(idx[MAXIMO_NA_LISTA]).toBe("restantes");
    for (let k = 0; k < MAXIMO_NA_LISTA - 1; k++) a.c.tecla(tecla("ArrowDown"));
    expect(a.c.ler().selecionado).toBe(MAXIMO_NA_LISTA - 1);
    a.c.tecla(tecla("ArrowDown"));
    expect(a.itens[a.c.ler().selecionado].tipo).toBe("janela");
    a.c.tecla(tecla("ArrowUp"));
    expect(a.c.ler().selecionado).toBe(MAXIMO_NA_LISTA - 1);
  });

  it("fechada, não toma tecla nenhuma", () => {
    const c = new ControleDoArroba();
    expect(c.tecla(tecla("Enter"))).toBe(false);
  });
});

describe("reconhecer a citação escrita à mão no texto", () => {
  const reconhecer = criarReconhecedor(referencias);

  it("acha o trecho com as posições certas, mesmo depois de uma citação já feita no parágrafo", () => {
    const d = doc([
      {
        tipo: "paragrafo",
        trechos: [
          { texto: "Como visto " },
          { citacao: { tipo: "parenteses", obras: [{ referencia: "costa2021" }] } },
          { texto: " e em (Silva, 2019), a regra vale." },
        ],
      },
    ]);
    const achadas = reconhecidasNoDoc(d, reconhecer);
    expect(achadas).toHaveLength(1);
    expect(d.textBetween(achadas[0].de, achadas[0].ate)).toBe("(Silva, 2019)");
    expect(achadas[0].citacao).toEqual({ tipo: "parenteses", obras: [{ referencia: "silva2019" }] });
  });

  it("não procura em títulos", () => {
    const d = doc([{ tipo: "titulo", nivel: 1, trechos: [{ texto: "Sobre (Silva, 2019)" }] }]);
    expect(reconhecidasNoDoc(d, reconhecer)).toEqual([]);
  });

  it("transformar troca o texto pela citação e o cursor fica depois dela", () => {
    const e = EditorState.create({ schema: esquema, doc: doc([{ tipo: "paragrafo", trechos: [{ texto: "Veja (Silva, 2019)" }] }]) });
    const [t] = reconhecidasNoDoc(e.doc, reconhecer);
    const novo = e.apply(transformarEmCitacao(e, t));
    expect(blocosDoEditor(novo.doc.toJSON())).toEqual([
      { tipo: "paragrafo", trechos: [{ texto: "Veja " }, { citacao: { tipo: "parenteses", obras: [{ referencia: "silva2019" }] } }] },
    ]);
    expect(novo.selection.from).toBe(t.de + 1);
  });

  it("o aviso vale com o cursor dentro do trecho ou logo no fim, e some se a pessoa pediu para ignorar", () => {
    const d = doc([{ tipo: "paragrafo", trechos: [{ texto: "Veja (Silva, 2019) agora" }] }]);
    const trechos = reconhecidasNoDoc(d, reconhecer);
    const { de, ate } = trechos[0];
    expect(trechoNoCursor(trechos, ate, [])).not.toBeNull();
    expect(trechoNoCursor(trechos, de + 3, [])).not.toBeNull();
    expect(trechoNoCursor(trechos, ate + 3, [])).toBeNull();
    expect(trechoNoCursor(trechos, ate, [{ de, ate }])).toBeNull();
  });

  it("o reconhecedor só é refeito quando a lista de obras muda", () => {
    const c = new ControleDoReconhecimento();
    let lista = referencias;
    c.lerReferencias = () => lista;
    const a = c.reconhecedor();
    expect(c.reconhecedor()).toBe(a);
    lista = [...referencias];
    expect(c.reconhecedor()).not.toBe(a);
  });
});
