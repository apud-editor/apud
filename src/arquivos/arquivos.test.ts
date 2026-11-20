import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { escreverArquivo, lerArquivo, type Trabalho } from "./formato";
import { SalvamentoAutomatico } from "./salvamento";
import type { Armazenamento } from "./armazenamento";

const trabalho: Trabalho = {
  nome: "Relato de estágio",
  perfil: { perfil: "ABNT", versao: "2025", revisao: 3 },
  criadoEm: "2026-11-20T18:00:00.000Z",
  modificadoEm: "2026-11-20T18:30:00.000Z",
  documento: {
    versao: 1,
    blocos: [
      { tipo: "titulo", nivel: 1, trechos: [{ texto: "Introdução" }] },
      { tipo: "paragrafo", trechos: [{ texto: "Texto com " }, { texto: "itálico", marcas: ["italico"] }] },
      { tipo: "lista", sequencia: false, itens: [{ trechos: [{ texto: "a" }], subitens: [{ trechos: [{ texto: "b" }] }] }] },
    ],
  },
};

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
    novo.versao = 2;
    const r = lerArquivo(JSON.stringify(novo));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toContain("versão mais nova");
  });

  it("aponta qual bloco está estragado, em vez de jogar o bloco fora", () => {
    const ruim = JSON.parse(escreverArquivo(trabalho));
    ruim.documento.blocos[1].trechos = "texto solto";
    expect(lerArquivo(JSON.stringify(ruim))).toEqual({ ok: false, erro: "o bloco 2 do texto está estragado" });
  });

  it("recusa outros arquivos JSON", () => {
    expect(lerArquivo('{"nome": "x"}').ok).toBe(false);
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
