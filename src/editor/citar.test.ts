// A citação dentro do editor, sem navegador: onde o "@" abre a janela, como a
// citação entra, troca e sai, a que citação cada texto da norma pertence, e o
// que a colagem guarda.

import { getSchema } from "@tiptap/core";
import { Node as NoPM } from "@tiptap/pm/model";
import { EditorState, NodeSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { carregarNorma } from "../../scripts/prova-lib";
import { montarTodas } from "../citacoes/todas";
import { formularioNovo, formularioParaCitacao, obraVazia } from "../citacoes/janela";
import { documentoVazio, type Bloco, type Citacao, type Referencia } from "../documento/modelo";
import { blocosDoEditor, editorDosBlocos } from "../documento/tiptap";
import { CitacoesNoTexto, ControleDaJanela, distribuirCitacoes } from "./citacoes";
import { citacaoSelecionada, citacoesDoEditor, colagemDoApud, escreverArroba, inserirCitacao, podeAbrirAqui, trocarCitacao } from "./citar";
import { ControleDaBarra, extensoesDoApud } from "./extensoes";

const extensoes = extensoesDoApud(new ControleDaBarra());
const esquema = getSchema(extensoes);

const par = (id: string, pagina?: string): Citacao => ({
  tipo: "parenteses",
  obras: [{ referencia: id, ...(pagina ? { localizador: { tipo: "pagina" as const, valor: pagina } } : {}) }],
});
const estado = (blocos: Bloco[]) => EditorState.create({ schema: esquema, doc: NoPM.fromJSON(esquema, editorDosBlocos(blocos)) });
const textos = (...t: string[]) => t.map((texto) => ({ texto }));

describe("@ só abre a janela no começo ou depois de um espaço", () => {
  const e = estado([{ tipo: "paragrafo", trechos: [...textos("ana@x e "), { citacao: par("a") }, ...textos("fim")] }]);
  // Posições: 1 = começo do parágrafo; o texto "ana@x e " ocupa 1..9; a citação 9..10; "fim" 10..13.
  it("no começo do parágrafo e depois de espaço, sim", () => {
    expect(podeAbrirAqui(e.doc, 1)).toBe(true);
    expect(podeAbrirAqui(e.doc, 9)).toBe(true);
  });
  it("no meio de uma palavra (e-mail) e logo depois de uma citação, não", () => {
    expect(podeAbrirAqui(e.doc, 5)).toBe(false);
    expect(podeAbrirAqui(e.doc, 10)).toBe(false);
  });
  it("o editor tem a extensão do @ e o texto de apoio fala dele", () => {
    expect(extensoes.map((x) => x.name)).toContain("arrobaRapido");
  });
});

describe("entrar, trocar e sair da citação", () => {
  const base: Bloco[] = [{ tipo: "paragrafo", trechos: textos("Segundo @ou ") }];

  it("a citação nova entra no lugar do @ (nada de @ sobra) e o cursor vai para depois dela", () => {
    const e = estado([{ tipo: "paragrafo", trechos: textos("Veja ") }]);
    const f = formularioNovo();
    f.obras = [{ ...obraVazia(), referencia: "silva", valor: "15" }];
    const r = formularioParaCitacao(f);
    if (!r.ok) throw new Error("janela recusou");
    const fim = e.doc.content.size - 1; // depois de "Veja "
    const tr = inserirCitacao(e, fim, fim, r.citacao);
    const novo = e.apply(tr);
    expect(blocosDoEditor(novo.doc.toJSON())).toEqual([{ tipo: "paragrafo", trechos: [{ texto: "Veja " }, { citacao: r.citacao }] }]);
    expect(novo.selection.from).toBe(fim + 1);
  });

  it("o que a janela monta é aceito pelo editor, em parágrafo, título e lista", () => {
    const formas: Citacao[] = [
      par("a", "3"),
      { tipo: "narrativa", direta: true, obra: { referencia: "a", grifo: true } },
      { tipo: "apud", original: "Freud, 1915", obra: { referencia: "a" } },
      { tipo: "sem-referencia", texto: "Usuária A" },
    ];
    for (const c of formas) {
      const e = estado([
        { tipo: "paragrafo", trechos: textos("x ") },
        { tipo: "titulo", nivel: 2, trechos: textos("T ") },
        { tipo: "lista", sequencia: false, itens: [{ trechos: textos("i ") }] },
      ]);
      // Uma citação em cada bloco de texto: o esquema do editor confere o conteúdo.
      let atual = e;
      const lugares: number[] = [];
      atual.doc.descendants((no, pos) => {
        if (no.isTextblock) lugares.push(pos + no.nodeSize - 1);
      });
      for (const l of lugares.reverse()) atual = atual.apply(inserirCitacao(atual, l, l, c));
      atual.doc.check();
      expect(citacoesDoEditor(atual.doc).map((x) => x.no.attrs.dados)).toEqual([c, c, c]);
      // E volta para o modelo do Apud sem perder nada.
      const blocos = blocosDoEditor(atual.doc.toJSON());
      expect(JSON.stringify(blocos)).toContain(JSON.stringify(c));
    }
  });

  it("editar troca os dados da citação e deixa o resto do texto como está", () => {
    const e = estado([{ tipo: "paragrafo", trechos: [...textos("a "), { citacao: par("a", "1") }, ...textos(" b")] }]);
    const { pos } = citacoesDoEditor(e.doc)[0];
    const tr = trocarCitacao(e, pos, par("a", "99"));
    expect(blocosDoEditor(e.apply(tr!).doc.toJSON())).toEqual([
      { tipo: "paragrafo", trechos: [...textos("a "), { citacao: par("a", "99") }, ...textos(" b")] },
    ]);
  });

  it("remover apaga só a citação", () => {
    const e = estado([{ tipo: "paragrafo", trechos: [...textos("a"), { citacao: par("a") }, ...textos("b")] }]);
    const { pos } = citacoesDoEditor(e.doc)[0];
    const novo = e.apply(trocarCitacao(e, pos, null)!);
    expect(blocosDoEditor(novo.doc.toJSON())).toEqual([{ tipo: "paragrafo", trechos: textos("ab") }]);
  });

  it("trocar onde não há citação não faz nada", () => {
    const e = estado(base);
    expect(trocarCitacao(e, 1, par("a"))).toBeNull();
  });

  it("“Escrever só o @” põe o sinal no texto", () => {
    const e = estado([{ tipo: "paragrafo", trechos: textos("oi ") }]);
    const fim = e.doc.content.size - 1;
    expect(blocosDoEditor(e.apply(escreverArroba(e, fim, fim)).doc.toJSON())).toEqual([{ tipo: "paragrafo", trechos: textos("oi @") }]);
  });

  it("citação selecionada (clique ou setas): Enter abre a janela de editar", () => {
    const e = estado([{ tipo: "paragrafo", trechos: [...textos("a "), { citacao: par("a") }] }]);
    const { pos } = citacoesDoEditor(e.doc)[0];
    const sel = e.apply(e.tr.setSelection(NodeSelection.create(e.doc, pos)));
    expect(citacaoSelecionada(sel)).toEqual({ pos, citacao: par("a") });
    expect(citacaoSelecionada(e)).toBeNull();
  });
});

describe("o texto de cada citação na norma, no editor", () => {
  const refs: Referencia[] = [
    { id: "a", tipo: "livro", autores: [{ sobrenome: "Souza", prenomes: "Eva" }], titulo: "Alfa", data: { ano: 2020 }, editora: "V", cidade: "P" },
    { id: "b", tipo: "livro", autores: [{ sobrenome: "Souza", prenomes: "Eva" }], titulo: "Beta", data: { ano: 2020 }, editora: "V", cidade: "P" },
  ];
  const texto: Bloco[] = [
    { tipo: "paragrafo", trechos: [{ citacao: par("a", "5") }, ...textos(" e "), { citacao: par("b") }] },
    { tipo: "paragrafo", trechos: [{ citacao: par("sumiu") }] },
  ];
  const calcular = (norma: string) => (blocos: Bloco[]) => montarTodas({ ...documentoVazio(), blocos, referencias: refs }, carregarNorma(norma).perfil);

  it("cada peça do editor recebe o texto da sua citação, na ordem do texto", () => {
    const e = estado(texto);
    const feito = distribuirCitacoes(e.doc, calcular("abnt.txt"))!;
    expect(feito.pares.map(([, m]) => m.pedacos.map((p) => p.texto).join(""))).toEqual(["(Souza, 2020a, p. 5)", "(Souza, 2020b)", "(referência apagada)"]);
    expect(feito.pares.map(([, m]) => m.avisos.map((a) => a.tipo))).toEqual([[], [], ["referencia-apagada"]]);
    // Falta a lista de referências: o aviso do texto vem junto.
    expect(feito.avisos.map((a) => a.tipo)).toEqual(["sem-lista"]);
  });

  it("a mesma citação escrita nas duas normas muda de texto quando a norma muda", () => {
    const e = estado([{ tipo: "paragrafo", trechos: [{ citacao: par("a", "4-5") }] }]);
    const abnt = distribuirCitacoes(e.doc, calcular("abnt.txt"))!.pares[0][1].pedacos.map((p) => p.texto).join("");
    const apa = distribuirCitacoes(e.doc, calcular("apa.txt"))!.pares[0][1].pedacos.map((p) => p.texto).join("");
    expect([abnt, apa]).toEqual(["(Souza, 2020, p. 4-5)", "(Souza, 2020, pp. 4–5)"]);
  });

  it("se as contagens não baterem, não distribui (o editor mostra a forma simples)", () => {
    expect(distribuirCitacoes(estado(texto).doc, () => [])).toBeNull();
  });

  it("o guardador refaz depois da pausa e avisa a tela; antes disso o nó novo não tem texto", async () => {
    const e = estado(texto);
    const guarda = new CitacoesNoTexto(calcular("apa.txt"));
    guarda.ligar({ state: e });
    const no = citacoesDoEditor(e.doc)[0].no;
    expect(guarda.textoDe(no)).toBeUndefined();
    let avisado = 0;
    guarda.ouvir(() => avisado++);
    guarda.agendar(5);
    guarda.agendar(5); // pedidos seguidos viram um só
    await new Promise((r) => setTimeout(r, 40));
    expect(avisado).toBe(1);
    expect(guarda.textoDe(no)?.pedacos.map((p) => p.texto).join("")).toBe("(Souza, 2020a, p. 5)");
    expect(guarda.avisosDoTexto.map((a) => a.tipo)).toEqual(["sem-lista"]);
    // Um erro no motor não derruba nada: o texto antigo continua.
    const quebrado = new CitacoesNoTexto(() => {
      throw new Error("falhou");
    });
    quebrado.ligar({ state: e });
    expect(() => quebrado.recalcular()).not.toThrow();
  });

  it("o nó que não mudou guarda o texto enquanto a pessoa digita em outro lugar", () => {
    const e = estado(texto);
    const guarda = new CitacoesNoTexto(calcular("abnt.txt"));
    guarda.ligar({ state: e });
    guarda.recalcular();
    const antes = citacoesDoEditor(e.doc)[0].no;
    const depois = e.apply(e.tr.insertText("x", 1)); // digitou antes da citação
    const mesmo = citacoesDoEditor(depois.doc)[0].no;
    expect(mesmo).toBe(antes); // o ProseMirror reaproveita a peça que não mudou
    expect(guarda.textoDe(mesmo)).toBeDefined();
  });
});

describe("colar", () => {
  it("o que vem do próprio Apud com citações é colado com as citações; o resto continua sem formatação", () => {
    const html = `<p data-pm-slice="1 1 []">veja <span data-citacao="{&quot;tipo&quot;:&quot;sem-referencia&quot;,&quot;texto&quot;:&quot;A&quot;}" class="citacao">(A)</span></p>`;
    expect(colagemDoApud(html)).toBe(true);
    expect(colagemDoApud("<p><b>do Word</b> com <i>formatação</i></p>")).toBe(false);
    expect(colagemDoApud("<p>texto que fala de data-citacao no meio</p>")).toBe(false);
    expect(colagemDoApud("")).toBe(false);
  });

  it("copiar do Apud e colar no Apud: os dados da citação saem e voltam iguais", () => {
    const dados: Citacao = { tipo: "apud", original: "Freud, 1915", obra: { referencia: "x", localizador: { tipo: "pagina", valor: "12" }, grifo: true } };
    const e = estado([{ tipo: "paragrafo", trechos: [{ citacao: dados }] }]);
    const no = citacoesDoEditor(e.doc)[0].no;
    // O que o ProseMirror escreve ao copiar (toDOM) ...
    const saida = esquema.nodes.citacao.spec.toDOM!(no) as unknown as [string, Record<string, string>, string];
    expect(saida[0]).toBe("span");
    // ... e o que ele lê ao colar (a regra de leitura do editor).
    const regra = esquema.nodes.citacao.spec.parseDOM![0];
    const elemento = { getAttribute: (n: string) => saida[1][n] ?? null } as unknown as HTMLElement;
    expect(regra.tag).toBe("span[data-citacao]");
    const attrs = (regra.getAttrs as (d: HTMLElement) => Record<string, unknown>)(elemento);
    expect(attrs.dados).toEqual(dados);
  });
});

describe("controle da janela", () => {
  it("cada abertura começa do zero e o clique abre para editar", () => {
    const j = new ControleDaJanela();
    let avisos = 0;
    j.ouvir(() => avisos++);
    j.abrirParaInserir("arroba", 5, 6);
    const a = j.ler();
    expect([a.aberta, a.modo, a.origem, a.de, a.ate]).toEqual([true, "inserir", "arroba", 5, 6]);
    j.fechar();
    expect(j.ler().aberta).toBe(false);
    j.abrirParaEditar(9, par("a"));
    const b = j.ler();
    expect([b.aberta, b.modo, b.de, b.ate, b.citacao]).toEqual([true, "editar", 9, 10, par("a")]);
    expect(b.chave).toBeGreaterThan(a.chave);
    expect(avisos).toBe(3);
  });
});
