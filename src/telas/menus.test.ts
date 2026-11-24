// Os menus do cabeçalho do editor: o que cada um tem e como o teclado anda
// neles (lógica pura) e como a barra aparece fechada (sem navegador).
// Abrir, escolher e a navegação de verdade são vistos num Chrome real, fora do repositório.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BarraDeMenus from "./BarraDeMenus";
import { ehEscolhivel, menuVizinho, montarMenus, primeiroItem, proximoItem, ultimoItem, type ContextoDosMenus, type ItemDeMenu } from "./menus";

function contexto(p: Partial<ContextoDosMenus> = {}): ContextoDosMenus {
  const nada = () => {};
  return {
    norma: "ABNT",
    normas: ["ABNT", "APA"],
    temaEscolhido: "sistema",
    painelAberto: null,
    podeCitar: true,
    exportando: false,
    temEscolhasDoAutor: true,
    aoVoltar: nada,
    aoExportar: nada,
    aoAbrirConfiguracoes: nada,
    aoAdicionarAAbertura: nada,
    aoEscolherTema: nada,
    aoTrocarNorma: nada,
    aoAlternarPainel: nada,
    desfazer: nada,
    refazer: nada,
    inserir: nada,
    ...p,
  };
}

const rotulos = (itens: ItemDeMenu[]) => itens.filter((i) => i.tipo !== "separador" && i.tipo !== "titulo").map((i) => (i as { rotulo: string }).rotulo);

describe("menus do cabeçalho", () => {
  it("são cinco, na ordem do protótipo", () => {
    expect(montarMenus(contexto()).map((m) => m.rotulo)).toEqual(["Arquivo", "Editar", "Inserir", "Modelo", "Referências"]);
  });

  it("o tema mora em Arquivo › Preferências e marca o escolhido", () => {
    const arquivo = montarMenus(contexto({ temaEscolhido: "escuro" }))[0];
    const temas = arquivo.itens.filter((i) => i.id.startsWith("tema-"));
    expect(temas.map((t) => (t as { rotulo: string }).rotulo)).toEqual(["Claro", "Escuro", "Sistema"]);
    expect(temas.map((t) => (t as { marcado: boolean }).marcado)).toEqual([false, true, false]);
    expect(arquivo.itens.some((i) => i.tipo === "titulo" && i.rotulo.includes("Preferências"))).toBe(true);
  });

  it("escolher um tema chama a troca com o valor certo", () => {
    const aoEscolherTema = vi.fn();
    const tema = montarMenus(contexto({ aoEscolherTema }))[0].itens.find((i) => i.id === "tema-claro");
    if (tema?.tipo !== "opcao") throw new Error("falta o item de tema");
    tema.aoEscolher();
    expect(aoEscolherTema).toHaveBeenCalledWith("claro");
  });

  it("Arquivo: voltar, exportar e as configurações do trabalho", () => {
    const aoAbrirConfiguracoes = vi.fn();
    const itens = montarMenus(contexto({ aoAbrirConfiguracoes }))[0].itens;
    expect(rotulos(itens)).toEqual(expect.arrayContaining(["Voltar para a lista de trabalhos", "Exportar PDF", "Configurações do trabalho…"]));
    const cfg = itens.find((i) => i.id === "configuracoes");
    if (cfg?.tipo !== "acao") throw new Error("falta o item");
    cfg.aoEscolher();
    expect(aoAbrirConfiguracoes).toHaveBeenCalledWith("dados");
  });

  it("enquanto o PDF é montado, o item de exportar fica desativado", () => {
    const exportar = montarMenus(contexto({ exportando: true }))[0].itens.find((i) => i.id === "exportar");
    expect(exportar).toMatchObject({ tipo: "acao", desativado: true, rotulo: "Montando o PDF…" });
  });

  it("Editar: desfazer e refazer, com os atalhos que já valem", () => {
    const itens = montarMenus(contexto())[1].itens;
    expect(itens.map((i) => (i as { atalho?: string }).atalho)).toEqual(["Ctrl+Z", "Ctrl+Y"]);
  });

  it("Inserir: só o que a barra já inseria, e a citação só se puder citar", () => {
    const com = rotulos(montarMenus(contexto())[2].itens);
    expect(com).toEqual(["Citação (@)", "Figura…", "Tabela", "Nota de rodapé", "Quebra de página"]);
    const sem = rotulos(montarMenus(contexto({ podeCitar: false }))[2].itens);
    expect(sem).not.toContain("Citação (@)");
  });

  it("Inserir chama o pedido certo para cada item", () => {
    const inserir = vi.fn();
    for (const i of montarMenus(contexto({ inserir }))[2].itens) if (i.tipo === "acao") i.aoEscolher();
    expect(inserir.mock.calls.map((c) => c[0])).toEqual(["citacao", "imagem", "tabela", "nota", "quebra"]);
  });

  it("Modelo: a norma do trabalho vem marcada e trocar chama a troca", () => {
    const aoTrocarNorma = vi.fn();
    const modelo = montarMenus(contexto({ norma: "APA", aoTrocarNorma }))[3];
    const normas = modelo.itens.filter((i) => i.tipo === "opcao");
    expect(normas.map((n) => [(n as { rotulo: string }).rotulo, (n as { marcado: boolean }).marcado])).toEqual([
      ["ABNT", false],
      ["APA", true],
    ]);
    if (normas[0].tipo !== "opcao") throw new Error();
    normas[0].aoEscolher();
    expect(aoTrocarNorma).toHaveBeenCalledWith("ABNT");
  });

  it("Referências: o texto do item muda conforme o painel está aberto", () => {
    const fechado = montarMenus(contexto())[4].itens;
    const aberto = montarMenus(contexto({ painelAberto: "referencias" }))[4].itens;
    expect(rotulos(fechado)).toContain("Abrir a lista de referências");
    expect(rotulos(aberto)).toContain("Fechar a lista de referências");
    expect(fechado.find((i) => i.id === "lista")).toMatchObject({ atalho: "Alt+R" });
  });

  it("as escolhas do autor só aparecem se a norma tiver", () => {
    expect(rotulos(montarMenus(contexto({ temEscolhasDoAutor: false }))[4].itens)).not.toContain("Escolhas do autor…");
    expect(rotulos(montarMenus(contexto())[4].itens)).toContain("Escolhas do autor…");
  });

  it("os ids dos itens não se repetem dentro de um menu", () => {
    for (const m of montarMenus(contexto())) expect(new Set(m.itens.map((i) => i.id)).size).toBe(m.itens.length);
  });
});

describe("andar pelos itens com o teclado", () => {
  const itens = montarMenus(contexto())[0].itens; // tem separadores, título e uma ação desativável

  it("só ações e opções recebem o foco", () => {
    expect(itens.filter(ehEscolhivel).every((i) => i.tipo === "acao" || i.tipo === "opcao")).toBe(true);
    expect(ehEscolhivel({ tipo: "separador", id: "s" })).toBe(false);
    expect(ehEscolhivel({ tipo: "titulo", id: "t", rotulo: "x" })).toBe(false);
    expect(ehEscolhivel({ tipo: "acao", id: "a", rotulo: "x", desativado: true, aoEscolher: () => {} })).toBe(false);
  });

  it("para baixo pula separador e título, e dá a volta", () => {
    let i = primeiroItem(itens);
    const visitados: string[] = [];
    for (let k = 0; k < itens.length; k++) {
      visitados.push(itens[i].id);
      i = proximoItem(itens, i, 1);
    }
    expect(visitados.slice(0, 4)).toEqual(["voltar", "exportar", "configuracoes", "tema-claro"]);
    expect(visitados.slice(0, 8)).toContain("tema-sistema");
    expect(proximoItem(itens, ultimoItem(itens), 1)).toBe(primeiroItem(itens));
  });

  it("para cima a partir de nenhum vai ao último, e do primeiro dá a volta", () => {
    expect(proximoItem(itens, -1, -1)).toBe(ultimoItem(itens));
    expect(proximoItem(itens, primeiroItem(itens), -1)).toBe(ultimoItem(itens));
  });

  it("pula o item desativado", () => {
    const com = montarMenus(contexto({ exportando: true }))[0].itens;
    expect(com[proximoItem(com, primeiroItem(com), 1)].id).toBe("configuracoes");
  });

  it("menu sem itens escolhíveis não prende o teclado", () => {
    expect(proximoItem([], -1, 1)).toBe(-1);
    expect(proximoItem([{ tipo: "separador", id: "s" }], -1, 1)).toBe(-1);
    expect(primeiroItem([])).toBe(-1);
    expect(ultimoItem([])).toBe(-1);
  });

  it("entre os menus da barra, dá a volta nos dois sentidos", () => {
    expect(menuVizinho(5, 4, 1)).toBe(0);
    expect(menuVizinho(5, 0, -1)).toBe(4);
    expect(menuVizinho(0, 0, 1)).toBe(-1);
  });
});

describe("a barra de menus fechada", () => {
  const html = renderToStaticMarkup(createElement(BarraDeMenus, { menus: montarMenus(contexto()) }));

  it("é uma barra de menus com os cinco botões", () => {
    expect(html).toContain('role="menubar"');
    for (const nome of ["Arquivo", "Editar", "Inserir", "Modelo", "Referências"]) expect(html).toContain(`>${nome}</button>`);
    expect((html.match(/role="menuitem"/g) ?? []).length).toBe(5);
  });

  it("só o primeiro botão entra na ordem do Tab; nenhum menu aparece aberto", () => {
    expect((html.match(/tabindex="0"/g) ?? []).length).toBe(1);
    expect((html.match(/aria-expanded="false"/g) ?? []).length).toBe(5);
    expect(html).not.toContain('role="menu"');
  });
});
