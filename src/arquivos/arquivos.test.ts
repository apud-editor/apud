import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { escreverArquivo, lerArquivo, type Trabalho } from "./formato";
import { documentoVazio, type Referencia } from "../documento/modelo";
import { estilosEmbutidos, modeloEmbutido } from "../modelos/embutidos";
import { modeloDoArquivo, modeloParaArquivo } from "../modelos/arquivo";
import { normaDoTrabalho } from "../modelos/norma";
import type { ModeloResolvido, ValoresPorElemento } from "../modelos/tipos";
import { SalvamentoAutomatico } from "./salvamento";
import type { Armazenamento } from "./armazenamento";

const referencias = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "..", "testes", "prova", "referencias.json"), "utf8"),
) as Referencia[];

/**
 * O modelo sem a linha e o arquivo .txt de onde cada valor veio: isso só serve
 * para as mensagens de quem escreve o modelo, e não vai para o .apud.
 */
function semLugar(m: ModeloResolvido): ModeloResolvido {
  const limpar = (v: ValoresPorElemento): ValoresPorElemento =>
    new Map([...v].map(([el, props]) => [el, new Map([...props].map(([p, x]) => [p, (({ arquivo: _a, linha: _l, ...resto }) => resto)(x)]))]));
  return { ...m, valores: limpar(m.valores), atalhos: limpar(m.atalhos) };
}

/** O modelo como ele fica guardado no .apud. */
function copiaNoArquivo(nome: string): ModeloResolvido {
  const m = modeloDoArquivo(JSON.parse(JSON.stringify(modeloParaArquivo(modeloEmbutido(nome)))));
  if (typeof m === "string") throw new Error(m);
  return m;
}

const trabalho: Trabalho = {
  nome: "Relato de estágio",
  modelo: copiaNoArquivo("ABNT"),
  ajustes: {
    ABNT: { "referências, prenomes": "abreviados", "Texto › fonte": "Arial" },
    APA: { "citação, primeira vez com três a cinco autores": "todos os autores" },
  },
  criadoEm: "2026-11-20T18:00:00.000Z",
  modificadoEm: "2026-11-20T18:30:00.000Z",
  documento: {
    ...documentoVazio(),
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
      { tipo: "referencias" },
    ],
    referencias,
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
    novo.versao = 9;
    const r = lerArquivo(JSON.stringify(novo));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toContain("versão mais nova");
  });

  it("recusa texto numa versão do modelo que este Apud não conhece", () => {
    const novo = JSON.parse(escreverArquivo(trabalho));
    novo.documento.versao = 9;
    expect(lerArquivo(JSON.stringify(novo))).toEqual({ ok: false, erro: "o texto do trabalho está numa versão que este Apud não conhece" });
    novo.documento.versao = 4;
    expect(lerArquivo(JSON.stringify(novo))).toEqual({ ok: false, erro: "o texto do trabalho está numa versão que este Apud não conhece" });
  });

  it("aponta qual bloco está estragado, em vez de jogar o bloco fora", () => {
    const ruim = JSON.parse(escreverArquivo(trabalho));
    ruim.documento.blocos[3].trechos = "texto solto";
    expect(lerArquivo(JSON.stringify(ruim))).toEqual({ ok: false, erro: "o bloco 4 do texto está estragado" });
  });

  it("guarda as exceções “só este” de parágrafos e títulos e lê de volta iguais", () => {
    const com = structuredClone(trabalho);
    com.documento.blocos[0] = { tipo: "titulo", nivel: 1, trechos: [{ texto: "Introdução" }], excecoes: { posição: "centralizado" } };
    com.documento.blocos[3] = { ...(com.documento.blocos[3] as object), excecoes: { alinhamento: "centralizado", entrelinha: "simples" } } as never;
    const texto = escreverArquivo(com);
    expect(JSON.parse(texto).documento.blocos[3].excecoes).toEqual({ alinhamento: "centralizado", entrelinha: "simples" });
    const r = lerArquivo(texto);
    expect(r.ok && r.trabalho.documento.blocos).toEqual(com.documento.blocos);
  });

  it("escreve as exceções do jeito do Apud e recusa uma estragada, dizendo qual", () => {
    const arquivo = JSON.parse(escreverArquivo(trabalho));
    arquivo.documento.blocos[3].excecoes = { Alinhamento: "Centralizado", entrelinha: "1.5" };
    const r = lerArquivo(JSON.stringify(arquivo));
    expect(r.ok && r.trabalho.documento.blocos[3]).toMatchObject({ excecoes: { alinhamento: "centralizado", entrelinha: "1,5" } });
    arquivo.documento.blocos[3].excecoes = { fonte: "Arial" };
    expect(lerArquivo(JSON.stringify(arquivo))).toEqual({ ok: false, erro: "o bloco 4 do texto está estragado: “fonte” não pode ser uma exceção de Parágrafo" });
    arquivo.documento.blocos[3].excecoes = { alinhamento: "torto" };
    expect(lerArquivo(JSON.stringify(arquivo))).toMatchObject({ ok: false, erro: expect.stringMatching(/^o bloco 4 do texto está estragado: /) });
  });

  it("guarda as exceções da citação longa (versão 8) e recusa uma que ela não aceita", () => {
    const arquivo = JSON.parse(escreverArquivo(trabalho));
    arquivo.documento.blocos[3] = { tipo: "citacaoLonga", trechos: [{ texto: "Citação." }], excecoes: { Tamanho: "11 pt", "recuo à esquerda": "2 cm", alinhamento: "À esquerda" } };
    const r = lerArquivo(JSON.stringify(arquivo));
    expect(r.ok && r.trabalho.documento.blocos[3]).toEqual({
      tipo: "citacaoLonga",
      trechos: [{ texto: "Citação." }],
      excecoes: { tamanho: "11 pt", "recuo à esquerda": "2 cm", alinhamento: "à esquerda" },
    });
    arquivo.documento.blocos[3].excecoes = { fonte: "Arial" };
    expect(lerArquivo(JSON.stringify(arquivo))).toEqual({ ok: false, erro: "o bloco 4 do texto está estragado: “fonte” não pode ser uma exceção de Citação longa" });
  });

  it("abre um arquivo da versão 7 sem mudar nada e grava na versão 8", () => {
    const antigo = JSON.parse(escreverArquivo(trabalho));
    antigo.versao = 7;
    antigo.documento.versao = 7;
    const r = lerArquivo(JSON.stringify(antigo));
    expect(r).toEqual({ ok: true, trabalho });
    expect(JSON.parse(escreverArquivo(trabalho)).versao).toBe(8);
  });

  /** A abertura como as versões 5 e 6 guardavam: caixas de marcar. */
  const aberturaDaVersao6 = {
    capa: true,
    folhaDeRosto: false,
    paginaDeTitulo: true,
    dedicatoria: { incluir: true, paragrafos: [[{ texto: "À minha família." }]] },
    agradecimentos: { incluir: false, paragrafos: [[{ texto: "Aos colegas." }]] },
    epigrafe: { incluir: false, paragrafos: [], autoria: "" },
    resumos: [
      { idioma: "pt-BR", trechos: [{ texto: "Resumo." }], palavrasChave: ["estágio"] },
      { idioma: "en", titulo: "Report", trechos: [], palavrasChave: [] },
    ],
    sumario: true,
    semIdentificacao: true,
  };

  for (const versao of [5, 6]) {
    it(`abre um arquivo da versão ${versao}, converte a abertura em blocos sem perder nada e grava na versão 8`, () => {
      const antigo = JSON.parse(escreverArquivo(trabalho));
      antigo.versao = versao;
      antigo.documento.versao = versao;
      antigo.documento.abertura = aberturaDaVersao6;
      const r = lerArquivo(JSON.stringify(antigo));
      if (!r.ok) throw new Error(r.erro);
      expect(r.trabalho.documento.blocos).toEqual(trabalho.documento.blocos);
      expect(r.trabalho.documento.versao).toBe(8);
      expect(r.trabalho.documento.abertura).toEqual({
        blocos: [
          { tipo: "capa" },
          { tipo: "paginaDeTitulo" },
          { tipo: "dedicatoria", paragrafos: [[{ texto: "À minha família." }]] },
          { tipo: "resumo", idioma: "pt-BR", trechos: [{ texto: "Resumo." }], palavrasChave: ["estágio"] },
          { tipo: "resumo", idioma: "en", titulo: "Report", trechos: [], palavrasChave: [] },
          { tipo: "sumario" },
        ],
        // Os agradecimentos estavam desligados, com texto: ficam guardados. A epígrafe desligada e vazia some.
        guardados: [{ tipo: "agradecimentos", paragrafos: [[{ texto: "Aos colegas." }]] }],
        semIdentificacao: true,
      });
      const regravado = JSON.parse(escreverArquivo(r.trabalho));
      expect([regravado.versao, regravado.documento.versao]).toEqual([8, 8]);
      expect(lerArquivo(JSON.stringify(regravado))).toEqual(r);
    });
  }

  it("recusa a abertura antiga estragada, e a abertura antiga num arquivo da versão 7", () => {
    const antigo = JSON.parse(escreverArquivo(trabalho));
    antigo.documento.versao = 6;
    antigo.documento.abertura = { ...aberturaDaVersao6, capa: "sim" };
    expect(lerArquivo(JSON.stringify(antigo))).toEqual({ ok: false, erro: "os elementos antes do texto (capa, resumos...) estão estragados" });
    antigo.documento.abertura = { ...aberturaDaVersao6, resumos: [{ idioma: "en" }] };
    expect(lerArquivo(JSON.stringify(antigo))).toEqual({ ok: false, erro: "o resumo 1 está estragado" });
    antigo.documento.versao = 7;
    antigo.documento.abertura = aberturaDaVersao6;
    expect(lerArquivo(JSON.stringify(antigo))).toEqual({ ok: false, erro: "os elementos antes do texto (capa, resumos...) estão estragados" });
  });

  it("recusa a abertura com blocos fora da ordem, repetidos ou estragados, dizendo o motivo", () => {
    const comAbertura = (abertura: unknown) => {
      const a = JSON.parse(escreverArquivo(trabalho));
      a.documento.abertura = abertura;
      return lerArquivo(JSON.stringify(a));
    };
    const base = { guardados: [], semIdentificacao: false };
    expect(comAbertura({ ...base, blocos: [{ tipo: "sumario" }, { tipo: "capa" }] })).toEqual({ ok: false, erro: "o bloco 2 da abertura (capa) está fora da ordem" });
    expect(comAbertura({ ...base, blocos: [{ tipo: "capa" }, { tipo: "capa" }] })).toEqual({ ok: false, erro: "a abertura tem capa duas vezes" });
    expect(comAbertura({ ...base, blocos: [{ tipo: "dedicatoria" }] })).toEqual({ ok: false, erro: "o bloco 1 da abertura está estragado" });
    expect(comAbertura({ ...base, blocos: [{ tipo: "lombada" }] })).toEqual({ ok: false, erro: "o bloco 1 da abertura está estragado" });
    expect(comAbertura({ ...base, blocos: [], guardados: [{ tipo: "capa" }] })).toEqual({ ok: false, erro: "o texto guardado 1 da abertura está estragado" });
    const resumo = { tipo: "resumo", idioma: "en", trechos: [{ texto: "A." }], palavrasChave: [] };
    expect(comAbertura({ ...base, blocos: [], guardados: [resumo, resumo] })).toEqual({ ok: false, erro: "a abertura tem resumo guardado duas vezes" });
    // A página nova "só este" de um resumo é lida; uma exceção que o bloco não aceita recusa o arquivo.
    const semPagina = comAbertura({ ...base, blocos: [{ ...resumo, excecoes: { "Página nova": "Não" } }] });
    expect(semPagina.ok && semPagina.trabalho.documento.abertura.blocos[0]).toEqual({ ...resumo, excecoes: { "página nova": "não" } });
    expect(comAbertura({ ...base, blocos: [{ tipo: "capa", excecoes: { "página nova": "não" } }] })).toEqual({
      ok: false,
      erro: "o bloco 1 da abertura está estragado: “página nova” não pode ser uma exceção de Abertura › Capa",
    });
    // Dois resumos no mesmo idioma na abertura são aceitos (a pessoa pode estar escrevendo um de novo).
    expect(comAbertura({ ...base, blocos: [resumo, resumo] }).ok).toBe(true);
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

describe("arquivos da versão de testes (versões 1 a 4)", () => {
  const MENSAGEM = "este trabalho foi feito na versão de testes do Apud e não abre nesta versão";

  it("são recusados com uma mensagem clara, qualquer que seja a versão", () => {
    for (const versao of [1, 2, 3, 4]) {
      const antigo = JSON.parse(escreverArquivo(trabalho));
      antigo.versao = versao;
      delete antigo.modelo;
      antigo.perfil = { perfil: "ABNT", versao: "2025", revisao: 3 };
      expect(lerArquivo(JSON.stringify(antigo))).toEqual({ ok: false, erro: MENSAGEM });
    }
  });

  it("um trabalho real gravado na versão 3 (o artigo da UNIVALI) é recusado, e o texto do arquivo não é mexido", () => {
    const texto = readFileSync(join(import.meta.dirname, "exemplos", "artigo-versao-3.apud"), "utf8");
    const copia = texto.slice();
    expect(lerArquivo(texto)).toEqual({ ok: false, erro: MENSAGEM });
    expect(texto).toBe(copia);
  });
});

describe("a cópia do modelo no .apud", () => {
  const comMudanca = (mudar: (a: any) => void) => {
    const a = JSON.parse(escreverArquivo(trabalho));
    mudar(a);
    return lerArquivo(JSON.stringify(a));
  };

  it("vai inteira no arquivo, com a origem de cada valor, e volta igual", () => {
    const a = JSON.parse(escreverArquivo(trabalho));
    expect(a.modelo).toMatchObject({ nome: "ABNT", versao: "2025" });
    expect(a.modelo.cadeia.map((c: any) => c.nome)).toEqual(["Em branco", "ABNT"]);
    expect(a.modelo.valores.texto.alinhamento).toMatchObject({ valor: "justificado", de: "ABNT" });
    expect(a.modelo.valores.texto.alinhamento.linha).toBeUndefined();
    const r = lerArquivo(JSON.stringify(a));
    expect(r.ok && r.trabalho.modelo).toEqual(semLugar(modeloEmbutido("ABNT")));
  });

  it("a APA também vai e volta igual", () => {
    const t = { ...trabalho, modelo: modeloEmbutido("APA") };
    const r = lerArquivo(escreverArquivo(t));
    expect(r.ok && r.trabalho.modelo).toEqual(semLugar(t.modelo));
  });

  it("o trabalho usa a cópia que está no arquivo, não o modelo que vem no Apud", () => {
    const r = comMudanca((a) => (a.modelo.valores.texto.alinhamento.valor = "à esquerda"));
    if (!r.ok) throw new Error(r.erro);
    const norma = normaDoTrabalho(r.trabalho.modelo, estilosEmbutidos(), {});
    expect(norma.problemas).toEqual([]);
    expect(norma.modelo.valores.get("texto")?.get("alinhamento")?.texto).toBe("à esquerda");
  });

  it("recusa a cópia estragada, com o motivo", () => {
    expect(comMudanca((a) => delete a.modelo)).toEqual({ ok: false, erro: "falta o modelo do trabalho" });
    expect(comMudanca((a) => (a.modelo.cadeia = []))).toEqual({ ok: false, erro: "a cópia do modelo está estragada (falta de onde ele vem)" });
    const r = comMudanca((a) => (a.modelo.valores.texto.alinhamento.valor = "torto"));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toMatch(/^a cópia do modelo está estragada: /);
    expect(comMudanca((a) => (a.modelo.valores.texto["cor inventada"] = { valor: "azul", origem: "", de: "ABNT" })).ok).toBe(false);
  });
});

describe("referências e citações no .apud", () => {
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

  it("recusa escolhas do trabalho estragadas e arquivo sem lista de referências", () => {
    expect(comMudanca((a) => (a.ajustes = { ABNT: { "referências, prenomes": 3 } }))).toEqual({
      ok: false,
      erro: "as escolhas do trabalho estão estragadas",
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

// ---------------------------------------------------------------------------
// Um trabalho com tudo: blocos, dados do trabalho, abertura e imagens

/** Uma imagem PNG de 2 × 1 pixels (vermelho e azul), em base64. */
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGP4z8DAwPAfAAcAAf9+CLHQAAAAAElFTkSuQmCC";

const completo: Trabalho = {
  ...trabalho,
  nome: "Relato completo",
  documento: {
    ...trabalho.documento,
    dados: {
      tipo: "estagio",
      idioma: "pt-BR",
      titulo: "Relato de experiência",
      subtitulo: "o estágio em saúde mental",
      autores: ["Francisco Diniz", "Ana Lima"],
      ano: 2026,
      curso: "Psicologia",
      instituicao: "Universidade do Vale do Itajaí",
      orientador: "Profa. Dra. Maria Souza",
      cidade: "Itajaí",
      disciplina: "Estágio Básico II",
      dataDeEntrega: { ano: 2026, mes: 12, dia: 5 },
      natureza: "Relatório apresentado à disciplina de Estágio Básico II.",
    },
    abertura: {
      blocos: [
        { tipo: "capa" },
        { tipo: "folhaDeRosto" },
        { tipo: "dedicatoria", paragrafos: [[{ texto: "À minha família." }]] },
        { tipo: "epigrafe", paragrafos: [[{ texto: "Viver é muito perigoso." }]], autoria: "Guimarães Rosa" },
        { tipo: "resumo", idioma: "pt-BR", trechos: [{ texto: "Este relato descreve " }, { texto: "o estágio", marcas: ["italico"] }], palavrasChave: ["estágio", "saúde mental"] },
        { tipo: "resumo", idioma: "en", titulo: "Experience report", trechos: [{ texto: "This report describes the internship." }], palavrasChave: ["internship"] },
        { tipo: "sumario" },
      ],
      guardados: [{ tipo: "agradecimentos", paragrafos: [[{ texto: "À supervisora " }, { texto: "Maria", marcas: ["negrito"] }], [{ texto: "Aos colegas." }]] }],
      semIdentificacao: false,
    },
    blocos: [
      ...trabalho.documento.blocos.slice(0, -1),
      {
        tipo: "paragrafo",
        trechos: [{ texto: "Texto com nota" }, { nota: { trechos: [{ texto: "A nota." }] } }, { texto: "." }],
      },
      {
        tipo: "citacaoLonga",
        excecoes: { tamanho: "11 pt", "espaço antes": "nenhuma", "espaço depois": "nenhuma" },
        trechos: [{ texto: "Uma citação longa " }, { citacao: { tipo: "parenteses", direta: true, obras: [{ referencia: "silva2019", localizador: { tipo: "pagina", valor: "15" } }] } }],
      },
      {
        tipo: "figura",
        imagem: "png-1",
        especie: "grafico",
        largura: 70,
        titulo: [{ texto: "Atendimentos" }],
        fonte: [{ citacao: { tipo: "narrativa", obra: { referencia: "lima2018" } } }],
        nota: [{ texto: "Legenda." }],
      },
      { tipo: "figura", imagem: "png-1", titulo: [{ texto: "De novo" }], fonte: [], fontePropria: true },
      {
        tipo: "tabela",
        titulo: [{ texto: "Usuários" }],
        cabecalho: 1,
        linhas: [
          [[{ texto: "Grupo" }], [{ texto: "Total" }]],
          [[{ texto: "Adultos" }], [{ texto: "12" }]],
        ],
        fonte: [{ texto: "Dados do serviço" }],
      },
      { tipo: "referencias" },
    ],
    imagens: [{ id: "png-1", formato: "png", dados: PNG, largura: 2, altura: 1, nome: "grafico.png" }],
  },
};

describe("um trabalho com tudo", () => {
  const comMudanca = (mudar: (a: any) => void) => {
    const a = JSON.parse(escreverArquivo(completo));
    mudar(a);
    return lerArquivo(JSON.stringify(a));
  };

  it("escreve e lê de volta sem mudar nada", () => {
    const texto = escreverArquivo(completo);
    expect(JSON.parse(texto).versao).toBe(8);
    expect(lerArquivo(texto)).toEqual({ ok: true, trabalho: completo });
  });

  it("o texto tirado da abertura fica guardado no arquivo", () => {
    const r = lerArquivo(escreverArquivo(completo));
    expect(r.ok && r.trabalho.documento.abertura.guardados).toEqual(completo.documento.abertura.guardados);
  });

  it("os arquivos .apud dos artigos de teste abrem inteiros", () => {
    for (const pasta of ["univali-abnt", "revista-apa"]) {
      const dir = join(import.meta.dirname, "..", "..", "testes", "artigos", pasta);
      const arquivo = JSON.parse(readFileSync(join(dir, "trabalho.json"), "utf8")).arquivo as string;
      const texto = readFileSync(join(dir, arquivo), "utf8");
      const r = lerArquivo(texto);
      if (!r.ok) throw new Error(`${pasta}: ${r.erro}`);
      expect(r.trabalho.documento.blocos).toEqual(JSON.parse(texto).documento.blocos);
      expect(r.trabalho.documento.referencias).toEqual(JSON.parse(texto).documento.referencias);
      expect(lerArquivo(escreverArquivo(r.trabalho))).toEqual(r);
    }
  });

  it("recusa tabela que não é uma grade retangular, ou com cabeçalho maior que a tabela", () => {
    const tabela = (a: any) => a.documento.blocos.find((b: any) => b.tipo === "tabela");
    expect(comMudanca((a) => tabela(a).linhas[1].push([]))).toEqual({ ok: false, erro: "o bloco 11 do texto está estragado" });
    expect(comMudanca((a) => (tabela(a).linhas = [])).ok).toBe(false);
    expect(comMudanca((a) => (tabela(a).linhas[0] = [])).ok).toBe(false);
    expect(comMudanca((a) => (tabela(a).cabecalho = 3)).ok).toBe(false);
    expect(comMudanca((a) => (tabela(a).cabecalho = -1)).ok).toBe(false);
    expect(comMudanca((a) => (tabela(a).cabecalho = 2)).ok).toBe(true);
  });

  it("recusa figura estragada, mas aceita figura cuja imagem sumiu (o Apud avisa na figura)", () => {
    const figura = (a: any) => a.documento.blocos.find((b: any) => b.tipo === "figura");
    expect(comMudanca((a) => (figura(a).imagem = "")).ok).toBe(false);
    expect(comMudanca((a) => (figura(a).especie = "mapa")).ok).toBe(false);
    expect(comMudanca((a) => (figura(a).largura = 5)).ok).toBe(false);
    expect(comMudanca((a) => (figura(a).titulo = "solto")).ok).toBe(false);
    expect(comMudanca((a) => delete figura(a).fonte).ok).toBe(false);
    expect(comMudanca((a) => (figura(a).imagem = "outra")).ok).toBe(true);
  });

  it("recusa imagem estragada ou repetida, dizendo qual", () => {
    expect(comMudanca((a) => (a.documento.imagens[0].dados = "não é base64!"))).toEqual({ ok: false, erro: "a imagem 1 está estragada" });
    expect(comMudanca((a) => (a.documento.imagens[0].dados = PNG.slice(0, -1))).ok).toBe(false);
    expect(comMudanca((a) => (a.documento.imagens[0].formato = "bmp")).ok).toBe(false);
    expect(comMudanca((a) => (a.documento.imagens[0].largura = 0)).ok).toBe(false);
    expect(comMudanca((a) => a.documento.imagens.push({ ...a.documento.imagens[0] }))).toEqual({
      ok: false,
      erro: "a imagem 2 usa o mesmo código de outra (png-1)",
    });
    expect(comMudanca((a) => delete a.documento.imagens)).toEqual({ ok: false, erro: "falta a lista de imagens do trabalho" });
  });

  it("recusa dados e abertura estragados, com o motivo", () => {
    const dadosRuins = { ok: false, erro: "os dados do trabalho (título, autores, curso...) estão estragados" };
    expect(comMudanca((a) => (a.documento.dados.tipo = "romance"))).toEqual(dadosRuins);
    expect(comMudanca((a) => (a.documento.dados.autores = "Francisco"))).toEqual(dadosRuins);
    expect(comMudanca((a) => (a.documento.dados.ano = "2026"))).toEqual(dadosRuins);
    expect(comMudanca((a) => (a.documento.dados.dataDeEntrega = { ano: 2026, mes: 13 }))).toEqual(dadosRuins);
    expect(comMudanca((a) => delete a.documento.dados)).toEqual(dadosRuins);
    const aberturaRuim = { ok: false, erro: "os elementos antes do texto (capa, resumos...) estão estragados" };
    const bloco = (a: any, tipo: string, n = 0) => a.documento.abertura.blocos.filter((b: any) => b.tipo === tipo)[n];
    expect(comMudanca((a) => (a.documento.abertura.semIdentificacao = "sim"))).toEqual(aberturaRuim);
    expect(comMudanca((a) => delete a.documento.abertura.guardados)).toEqual(aberturaRuim);
    expect(comMudanca((a) => delete bloco(a, "epigrafe").autoria)).toEqual({ ok: false, erro: "o bloco 4 da abertura está estragado" });
    expect(comMudanca((a) => (bloco(a, "dedicatoria").paragrafos = [[{ citacao: { tipo: "sem-referencia", texto: "x" } }]]))).toEqual({ ok: false, erro: "o bloco 3 da abertura está estragado" });
    expect(comMudanca((a) => (bloco(a, "resumo", 1).palavrasChave = "a; b"))).toEqual({ ok: false, erro: "o bloco 6 da abertura está estragado" });
    expect(comMudanca((a) => (bloco(a, "resumo").idioma = ""))).toEqual({ ok: false, erro: "o bloco 5 da abertura está estragado" });
  });

  it("nota de rodapé só com texto: citação ou nota dentro da nota estraga o bloco", () => {
    const comNota = (a: any) => a.documento.blocos.find((b: any) => b.trechos?.some((t: any) => t.nota)).trechos[1];
    expect(comMudanca((a) => comNota(a).nota.trechos.push({ citacao: { tipo: "sem-referencia", texto: "x" } })).ok).toBe(false);
    expect(comMudanca((a) => comNota(a).nota.trechos.push({ nota: { trechos: [] } })).ok).toBe(false);
    expect(comMudanca((a) => (comNota(a).nota = "texto")).ok).toBe(false);
  });

  it("mantém campos dos dados e das imagens que este Apud ainda não conhece", () => {
    const r = comMudanca((a) => {
      a.documento.dados.coorientador = "Prof. João";
      a.documento.imagens[0].descricao = "gráfico de barras";
    });
    expect(r.ok && (r.trabalho.documento.dados as unknown as Record<string, unknown>).coorientador).toBe("Prof. João");
    expect(r.ok && (r.trabalho.documento.imagens[0] as unknown as Record<string, unknown>).descricao).toBe("gráfico de barras");
  });
});
