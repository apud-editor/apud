import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { escreverArquivo, lerArquivo, type Trabalho } from "./formato";
import type { Referencia } from "../documento/modelo";
import { SalvamentoAutomatico } from "./salvamento";
import type { Armazenamento } from "./armazenamento";

const referencias = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "..", "perfis", "prova", "referencias.json"), "utf8"),
) as Referencia[];

const trabalho: Trabalho = {
  nome: "Relato de estágio",
  perfil: { perfil: "ABNT", versao: "2025", revisao: 3 },
  ajustes: { ABNT: { "referências, prenomes": "abreviados" }, APA: { "citação, primeira vez com três a cinco autores": "todos os autores" } },
  criadoEm: "2026-11-20T18:00:00.000Z",
  modificadoEm: "2026-11-20T18:30:00.000Z",
  documento: {
    versao: 2,
    blocos: [
      { tipo: "titulo", nivel: 1, trechos: [{ texto: "Introdução" }] },
      { tipo: "quebra" },
      { tipo: "titulo", nivel: 2, trechos: [{ texto: "1.1 Contexto" }] },
      { tipo: "paragrafo", trechos: [{ texto: "Texto com " }, { texto: "itálico", marcas: ["italico"] }] },
      { tipo: "lista", sequencia: false, itens: [{ trechos: [{ texto: "a" }], subitens: [{ trechos: [{ texto: "b" }] }] }] },
      {
        tipo: "paragrafo",
        trechos: [
          { citacao: { tipo: "narrativa", obra: { referencia: "lima2018" } } },
          { texto: " lembra que " },
          { citacao: { tipo: "parenteses", direta: true, obras: [{ referencia: "silva2019", localizador: { tipo: "pagina", valor: "15" }, grifo: true }] } },
          { citacao: { tipo: "apud", original: "Freud, 1915", obra: { referencia: "costa2021", localizador: { tipo: "pagina", valor: "12" } } } },
          { citacao: { tipo: "sem-referencia", texto: "Usuária A" } },
          { citacao: { tipo: "parenteses", obras: [{ referencia: "garcia2015", localizador: { tipo: "outro", rotulo: "local.", valor: "7" }, traducao: true }, { referencia: "rudio2002" }] } },
        ],
      },
    ],
    referencias,
  },
};

/** Um arquivo como a fase 1 do Apud gravava (versão 1), escrito à mão. */
const ARQUIVO_DA_FASE_1 = `{
  "formato": "apud",
  "versao": 1,
  "nome": "Relato antigo",
  "perfil": { "perfil": "ABNT", "versao": "2025", "revisao": 3 },
  "criadoEm": "2026-11-20T18:40:00.000Z",
  "modificadoEm": "2026-11-20T19:02:11.000Z",
  "documento": {
    "versao": 1,
    "blocos": [
      { "tipo": "titulo", "nivel": 1, "trechos": [{ "texto": "1 Introdução" }] },
      { "tipo": "paragrafo", "trechos": [{ "texto": "O estágio " }, { "texto": "começou", "marcas": ["negrito"] }, { "texto": "." }] },
      { "tipo": "quebra" },
      { "tipo": "lista", "sequencia": true, "itens": [{ "trechos": [{ "texto": "a" }] }] }
    ]
  }
}
`;
describe("formato do arquivo .apud", () => {
  it("escreve e lê de volta sem mudar nada", () => {
    expect(lerArquivo(escreverArquivo(trabalho))).toEqual({ ok: true, trabalho });
  });

  it("aceita o arquivo com a marca de começo que o Bloco de Notas às vezes põe", () => {
    expect(lerArquivo("﻿" + escreverArquivo(trabalho)).ok).toBe(true);
  });

  it("recusa arquivo cortado pela metade, com o motivo", () => {
    const texto = escreverArquivo(trabalho);
    expect(lerArquivo(texto.slice(0, texto.length / 2))).toEqual({
      ok: false,
      erro: "o arquivo não é um .apud válido (o texto está incompleto ou foi alterado)",
    });
  });

  it("recusa arquivo de uma versão mais nova do Apud", () => {
    const novo = JSON.parse(escreverArquivo(trabalho));
    novo.versao = 3;
    const r = lerArquivo(JSON.stringify(novo));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toContain("versão mais nova");
  });

  it("recusa texto numa versão do modelo que este Apud não conhece", () => {
    const novo = JSON.parse(escreverArquivo(trabalho));
    novo.documento.versao = 3;
    expect(lerArquivo(JSON.stringify(novo))).toEqual({ ok: false, erro: "o texto do trabalho está numa versão que este Apud não conhece" });
  });

  it("aponta qual bloco está estragado, em vez de jogar o bloco fora", () => {
    const ruim = JSON.parse(escreverArquivo(trabalho));
    ruim.documento.blocos[3].trechos = "texto solto";
    expect(lerArquivo(JSON.stringify(ruim))).toEqual({ ok: false, erro: "o bloco 4 do texto está estragado" });
  });

  it("abre os arquivos da versão de teste que guardava a escolha de numerar", () => {
    const antigo = JSON.parse(escreverArquivo(trabalho));
    antigo.documento.blocos[2].numerado = false;
    const r = lerArquivo(JSON.stringify(antigo));
    expect(r.ok && r.trabalho.documento.blocos[2]).toEqual({ tipo: "titulo", nivel: 2, trechos: [{ texto: "1.1 Contexto" }] });
  });

  it("recusa outros arquivos JSON", () => {
    expect(lerArquivo('{"nome": "x"}').ok).toBe(false);
  });
});

describe("arquivos da fase 1 (versão 1)", () => {
  it("abrem sem perder nada: o texto fica igual, e entram a lista de referências e os ajustes vazios", () => {
    const r = lerArquivo(ARQUIVO_DA_FASE_1);
    expect(r).toEqual({
      ok: true,
      trabalho: {
        nome: "Relato antigo",
        perfil: { perfil: "ABNT", versao: "2025", revisao: 3 },
        ajustes: {},
        criadoEm: "2026-11-20T18:40:00.000Z",
        modificadoEm: "2026-11-20T19:02:11.000Z",
        documento: {
          versao: 2,
          blocos: JSON.parse(ARQUIVO_DA_FASE_1).documento.blocos,
          referencias: [],
        },
      },
    });
  });

  it("quando o trabalho é salvo, vira versão 2, e a versão 2 abre igual", () => {
    const r = lerArquivo(ARQUIVO_DA_FASE_1);
    if (!r.ok) throw new Error(r.erro);
    const gravado = escreverArquivo(r.trabalho);
    expect(JSON.parse(gravado).versao).toBe(2);
    expect(JSON.parse(gravado).documento.versao).toBe(2);
    expect(lerArquivo(gravado)).toEqual(r);
  });

  it("um arquivo da versão 1 com defeito continua sendo recusado, com o motivo", () => {
    const ruim = JSON.parse(ARQUIVO_DA_FASE_1);
    ruim.documento.blocos[1].trechos[1].marcas = ["piscando"];
    expect(lerArquivo(JSON.stringify(ruim))).toEqual({ ok: false, erro: "o bloco 2 do texto está estragado" });
  });
});

describe("referências e citações no .apud (versão 2)", () => {
  const comMudanca = (mudar: (a: any) => void) => {
    const a = JSON.parse(escreverArquivo(trabalho));
    mudar(a);
    return lerArquivo(JSON.stringify(a));
  };

  it("as 27 referências do documento de prova e as citações vão e voltam sem mudar nada", () => {
    expect(trabalho.documento.referencias).toHaveLength(27);
    expect(lerArquivo(escreverArquivo(trabalho))).toEqual({ ok: true, trabalho });
  });

  it("o arquivo continua legível: a citação aparece como texto no meio do parágrafo", () => {
    expect(escreverArquivo(trabalho)).toContain('"citacao": {\n');
  });

  it("recusa referência estragada, dizendo qual", () => {
    expect(comMudanca((a) => (a.documento.referencias[2].autores = "Costa"))).toEqual({
      ok: false,
      erro: "a referência 3 da lista está estragada",
    });
    expect(comMudanca((a) => (a.documento.referencias[0].tipo = "disco de vinil")).ok).toBe(false);
    expect(comMudanca((a) => (a.documento.referencias[0].data = { ano: "2019" })).ok).toBe(false);
    expect(comMudanca((a) => (a.documento.referencias[0].data = { ano: 2019, mes: 13 })).ok).toBe(false);
    expect(comMudanca((a) => (a.documento.referencias[3].publicacao = { volume: "10" })).ok).toBe(false);
  });

  it("recusa duas referências com o mesmo código, em vez de escolher uma", () => {
    expect(comMudanca((a) => (a.documento.referencias[1].id = a.documento.referencias[0].id))).toEqual({
      ok: false,
      erro: "a referência 2 usa o mesmo código de outra (silva2019)",
    });
  });

  it("recusa citação estragada, dizendo o bloco", () => {
    expect(comMudanca((a) => (a.documento.blocos[5].trechos[2].citacao.obras = []))).toEqual({
      ok: false,
      erro: "o bloco 6 do texto está estragado",
    });
    expect(comMudanca((a) => (a.documento.blocos[5].trechos[2].citacao.tipo = "nota")).ok).toBe(false);
    expect(comMudanca((a) => (a.documento.blocos[5].trechos[2].citacao.obras[0].localizador = { tipo: "pagina" })).ok).toBe(false);
  });

  it("aceita citação de uma referência que não existe mais (o Apud avisa no texto, sem estragar o arquivo)", () => {
    const r = comMudanca((a) => (a.documento.blocos[5].trechos[0].citacao.obra.referencia = "apagada"));
    expect(r.ok).toBe(true);
  });

  it("mantém campos que este Apud ainda não conhece, para nunca perder dado", () => {
    const r = comMudanca((a) => (a.documento.referencias[0].isbn = "978-85-326-0000-0"));
    expect(r.ok && (r.trabalho.documento.referencias[0] as unknown as Record<string, unknown>).isbn).toBe("978-85-326-0000-0");
  });

  it("recusa ajustes estragados e arquivo da versão 2 sem lista de referências", () => {
    expect(comMudanca((a) => (a.ajustes = { ABNT: { "referências, prenomes": 3 } }))).toEqual({
      ok: false,
      erro: "os ajustes da norma do trabalho estão estragados",
    });
    expect(comMudanca((a) => delete a.ajustes).ok).toBe(false);
    expect(comMudanca((a) => delete a.documento.referencias)).toEqual({
      ok: false,
      erro: "falta a lista de referências do trabalho",
    });
  });
});

// ---------------------------------------------------------------------------

function falso() {
  const gravados: string[] = [];
  let falhar = 0;
  const arm: Armazenamento = {
    pasta: async () => "",
    listar: async () => [],
    ler: async () => "",
    criar: async () => "",
    salvar: vi.fn(async (_a: string, c: string) => {
      await new Promise((r) => setTimeout(r, 10)); // a gravação leva um tempo
      if (falhar > 0) {
        falhar--;
        throw new Error("o disco está cheio");
      }
      gravados.push(c);
    }),
    renomear: vi.fn(async (_a: string, nome: string) => `${nome}.apud`),
    mostrarPasta: async () => {},
    fontesDoComputador: async () => [],
    exportarPdf: async () => null,
    abrirPdfExportado: async () => {},
  };
  return { arm, gravados, falharProximas: (n: number) => (falhar = n) };
}

describe("salvamento automático", () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it("espera a pausa na digitação e grava só o texto mais recente", async () => {
    const { arm, gravados } = falso();
    let texto = "a";
    const s = new SalvamentoAutomatico({ armazenamento: arm, arquivo: "x.apud", conteudo: () => texto, espera: 800 });
    for (const t of ["ab", "abc", "abcd"]) {
      texto = t;
      s.houveMudanca();
      await vi.advanceTimersByTimeAsync(300);
    }
    expect(gravados).toEqual([]);
    await vi.advanceTimersByTimeAsync(900);
    expect(gravados).toEqual(["abcd"]);
    expect(s.situacao.tipo).toBe("salvo");
  });

  it("salvarAgora grava na hora, e sem mudanças não grava de novo", async () => {
    const { arm, gravados } = falso();
    const s = new SalvamentoAutomatico({ armazenamento: arm, arquivo: "x.apud", conteudo: () => "t" });
    s.houveMudanca();
    const p = s.salvarAgora();
    await vi.advanceTimersByTimeAsync(20);
    await p;
    expect(gravados).toEqual(["t"]);
    await s.salvarAgora();
    expect(gravados).toEqual(["t"]);
  });

  it("uma mudança durante a gravação gera outra gravação", async () => {
    const { arm, gravados } = falso();
    let texto = "um";
    const s = new SalvamentoAutomatico({ armazenamento: arm, arquivo: "x.apud", conteudo: () => texto, espera: 100 });
    s.houveMudanca();
    await vi.advanceTimersByTimeAsync(105); // começou a gravar "um"
    texto = "dois";
    s.houveMudanca();
    await vi.advanceTimersByTimeAsync(300);
    expect(gravados).toEqual(["um", "dois"]);
    expect(s.situacao.tipo).toBe("salvo");
  });

  it("se a gravação falhar, avisa, não descarta e tenta de novo", async () => {
    const { arm, gravados, falharProximas } = falso();
    const s = new SalvamentoAutomatico({ armazenamento: arm, arquivo: "x.apud", conteudo: () => "t", espera: 100, esperaAposErro: 1000 });
    falharProximas(1);
    s.houveMudanca();
    await vi.advanceTimersByTimeAsync(150);
    expect(s.situacao).toEqual({ tipo: "erro", mensagem: "o disco está cheio" });
    expect(s.temMudancasNaoSalvas).toBe(true);
    await vi.advanceTimersByTimeAsync(1100);
    expect(gravados).toEqual(["t"]);
    expect(s.situacao.tipo).toBe("salvo");
  });

  it("salvarAgora avisa quando a gravação falha (para não fechar o programa perdendo texto)", async () => {
    const { arm, falharProximas } = falso();
    const s = new SalvamentoAutomatico({ armazenamento: arm, arquivo: "x.apud", conteudo: () => "t" });
    falharProximas(1);
    s.houveMudanca();
    const p = s.salvarAgora();
    const resultado = expect(p).rejects.toThrow("o disco está cheio");
    await vi.advanceTimersByTimeAsync(20);
    await resultado;
  });

  it("renomear grava antes e passa a salvar no arquivo novo", async () => {
    const { arm } = falso();
    const s = new SalvamentoAutomatico({ armazenamento: arm, arquivo: "x.apud", conteudo: () => "t" });
    s.houveMudanca();
    const p = s.renomear("Novo");
    await vi.advanceTimersByTimeAsync(20);
    expect(await p).toBe("Novo.apud");
    expect(arm.salvar).toHaveBeenCalledWith("x.apud", "t");
    s.houveMudanca();
    const q = s.salvarAgora();
    await vi.advanceTimersByTimeAsync(20);
    await q;
    expect(arm.salvar).toHaveBeenLastCalledWith("Novo.apud", "t");
  });
});
