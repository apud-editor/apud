// A busca pelo DOI sem internet: o Crossref é simulado por respostas de exemplo
// e por um "fetch" de mentira.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Referencia } from "../documento/modelo";
import {
  buscarPorDoi,
  consultarCrossref,
  enderecoDaConsulta,
  MENSAGEM_DO_DOI_INVALIDO,
  MENSAGEM_DO_DOI_VAZIO,
  type Consultador,
  type RespostaDaConsulta,
} from "./buscaDoi";

const exemplo = (nome: string): unknown => JSON.parse(readFileSync(join(import.meta.dirname, "crossref-exemplos", `${nome}.json`), "utf8"));
const sinal = () => new AbortController().signal;
const respondendo = (json: unknown): Consultador => vi.fn(async () => ({ ok: true, json }) as RespostaDaConsulta);
const falhando = (erro: Extract<RespostaDaConsulta, { ok: false }>["erro"]): Consultador => vi.fn(async () => ({ ok: false, erro }) as RespostaDaConsulta);

const existente = (doi?: string): Referencia => ({ id: "ja", tipo: "artigo", autores: [{ sobrenome: "Lima" }], titulo: "Já cadastrada", data: { ano: 2018 }, ...(doi && { doi }) });

describe("buscarPorDoi", () => {
  it("DOI bom: devolve a fonte para conferir e não salva nada", async () => {
    const consultar = respondendo(exemplo("livro"));
    const r = await buscarPorDoi("https://doi.org/10.1234/LIVRO.2019.7", [], sinal(), consultar);
    expect(r.tipo).toBe("achou");
    if (r.tipo !== "achou") return;
    expect(r.referencia).toMatchObject({ tipo: "livro", titulo: "Psicologia clínica", doi: "10.1234/livro.2019.7" });
    expect(r.avisos).toEqual([]);
    // O Crossref foi perguntado pelo DOI limpo, não pelo texto colado.
    expect(consultar).toHaveBeenCalledWith("10.1234/livro.2019.7", expect.anything());
  });

  it("os avisos da conversão chegam à tela", async () => {
    const resposta = { status: "ok", "message-type": "work", message: { type: "dataset", DOI: "10.1234/d", title: ["TÍTULO TODO EM MAIÚSCULAS"] } };
    const r = await buscarPorDoi("10.1234/d", [], sinal(), respondendo(resposta));
    expect(r.tipo === "achou" && r.avisos).toHaveLength(2);
  });

  it("campo vazio: pede o DOI, sem consultar", async () => {
    const consultar = respondendo(exemplo("livro"));
    expect(await buscarPorDoi("   ", [], sinal(), consultar)).toEqual({ tipo: "erro", mensagem: MENSAGEM_DO_DOI_VAZIO });
    expect(consultar).not.toHaveBeenCalled();
  });

  it("texto que não é DOI: explica como é um DOI, sem consultar", async () => {
    const consultar = respondendo(exemplo("livro"));
    expect(await buscarPorDoi("www.exemplo.com/artigo", [], sinal(), consultar)).toEqual({ tipo: "erro", mensagem: MENSAGEM_DO_DOI_INVALIDO });
    expect(consultar).not.toHaveBeenCalled();
    expect(MENSAGEM_DO_DOI_INVALIDO).toContain("10.");
  });

  it("DOI já cadastrado: mostra a fonte que existe, sem criar outra e sem usar a internet", async () => {
    const consultar = respondendo(exemplo("artigo"));
    const jaTem = existente("https://doi.org/10.1234/RPA.2018.0012");
    const r = await buscarPorDoi("10.1234/rpa.2018.0012", [jaTem], sinal(), consultar);
    expect(r).toEqual({ tipo: "repetida", existente: jaTem });
    expect(consultar).not.toHaveBeenCalled();
  });

  it("se o Crossref devolver um DOI que já está no trabalho (DOI antigo apontando para o novo), também é repetida", async () => {
    const jaTem = existente("10.1234/rpa.2018.0012");
    // A pessoa pediu outro DOI, mas a ficha que volta é a do artigo que já existe.
    const r = await buscarPorDoi("10.1234/antigo", [jaTem], sinal(), respondendo(exemplo("artigo")));
    expect(r).toEqual({ tipo: "repetida", existente: jaTem });
  });

  it("a fonte nova nunca usa o código de uma que já existe", async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `r${i}`);
    const outras = ids.map((id) => ({ ...existente(), id }));
    const r = await buscarPorDoi("10.1234/livro.2019.7", outras, sinal(), respondendo(exemplo("livro")));
    expect(r.tipo === "achou" && ids.includes(r.referencia.id)).toBe(false);
  });

  describe("erros em linguagem simples", () => {
    const casos: [Extract<RespostaDaConsulta, { ok: false }>["erro"], RegExp][] = [
      ["nao-existe", /não achou esse DOI/],
      ["sem-internet", /conexão com a internet/],
      ["servico", /não está respondendo/],
      ["demorou", /demorou demais/],
      ["fora-do-esperado", /Adicionar à mão/],
    ];
    for (const [erro, esperado] of casos) {
      it(`${erro}`, async () => {
        const r = await buscarPorDoi("10.1234/x", [], sinal(), falhando(erro));
        expect(r.tipo).toBe("erro");
        if (r.tipo === "erro") {
          expect(r.mensagem).toMatch(esperado);
          // Nada de termo técnico para o leigo.
          expect(r.mensagem).not.toMatch(/HTTP|404|500|JSON|fetch|CORS|timeout/i);
        }
      });
    }

    it("DOI que não existe orienta a cadastrar à mão", async () => {
      const r = await buscarPorDoi("10.1234/x", [], sinal(), falhando("nao-existe"));
      expect(r.tipo === "erro" && r.mensagem).toContain("Adicionar à mão");
    });

    it("resposta que não é uma ficha de obra: 'fora do esperado'", async () => {
      const r = await buscarPorDoi("10.1234/x", [], sinal(), respondendo({ qualquer: "coisa" }));
      expect(r.tipo === "erro" && r.mensagem).toMatch(/não entendeu/);
    });
  });

  it("cancelada: devolve 'cancelada', e não mostra erro nem abre formulário", async () => {
    const controle = new AbortController();
    const consultar: Consultador = vi.fn(async () => {
      controle.abort();
      return { ok: true, json: exemplo("livro") } as RespostaDaConsulta;
    });
    expect(await buscarPorDoi("10.1234/livro.2019.7", [], controle.signal, consultar)).toEqual({ tipo: "cancelada" });
    expect(await buscarPorDoi("10.1234/x", [], sinal(), falhando("cancelada"))).toEqual({ tipo: "cancelada" });
  });

  it("a busca é assíncrona: devolve uma promessa e não trava quem a chamou", async () => {
    let liberar!: (r: RespostaDaConsulta) => void;
    const consultar: Consultador = () => new Promise<RespostaDaConsulta>((ok) => (liberar = ok));
    let terminou = false;
    const promessa = buscarPorDoi("10.1234/livro.2019.7", [], sinal(), consultar).then((r) => {
      terminou = true;
      return r;
    });
    await Promise.resolve();
    expect(terminou).toBe(false);
    liberar({ ok: true, json: exemplo("livro") });
    expect((await promessa).tipo).toBe("achou");
  });
});

describe("enderecoDaConsulta", () => {
  it("a barra do DOI fica; o resto é codificado", () => {
    expect(enderecoDaConsulta("10.1037/0033-295x.84.2.191", "")).toBe("https://api.crossref.org/works/10.1037/0033-295x.84.2.191");
    expect(enderecoDaConsulta("10.1002/(sici)1097<1661>3.0.co;2-2#x?y", "")).toBe(
      "https://api.crossref.org/works/10.1002/(sici)1097%3C1661%3E3.0.co%3B2-2%23x%3Fy",
    );
  });

  it("com e-mail do projeto, vai como 'mailto' (a forma 'educada' do Crossref); sem e-mail, vai sem", () => {
    expect(enderecoDaConsulta("10.1234/x", "projeto@exemplo.org")).toBe("https://api.crossref.org/works/10.1234/x?mailto=projeto%40exemplo.org");
    expect(enderecoDaConsulta("10.1234/x", "  ")).toBe("https://api.crossref.org/works/10.1234/x");
  });

  it("só fala com o api.crossref.org", () => {
    expect(new URL(enderecoDaConsulta("10.1234/x@evil.com/..", "a@b.c")).hostname).toBe("api.crossref.org");
    expect(new URL(enderecoDaConsulta("//evil.com/x", "")).hostname).toBe("api.crossref.org");
  });
});

describe("consultarCrossref com um fetch de mentira", () => {
  const resposta = (corpo: BodyInit | null, status = 200) => new Response(corpo, { status });
  const com = (buscar: typeof fetch, extra = {}) => consultarCrossref("10.1234/x", sinal(), { buscar, email: "", ...extra });

  it("200 com JSON: devolve o JSON", async () => {
    const buscar = vi.fn(async () => resposta(JSON.stringify({ a: 1 })));
    expect(await com(buscar as unknown as typeof fetch)).toEqual({ ok: true, json: { a: 1 } });
    expect(buscar).toHaveBeenCalledTimes(1);
    const [url, opcoes] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.crossref.org/works/10.1234/x");
    // Pedido simples: só GET e o Accept, que não pedem "pré-voo" do navegador.
    expect(opcoes.method).toBeUndefined();
    expect(Object.keys(opcoes.headers as object)).toEqual(["Accept"]);
  });

  it("404 e 400: o DOI não existe", async () => {
    expect(await com((async () => resposta("Resource not found.", 404)) as unknown as typeof fetch)).toEqual({ ok: false, erro: "nao-existe" });
    expect(await com((async () => resposta("bad", 400)) as unknown as typeof fetch)).toEqual({ ok: false, erro: "nao-existe" });
  });

  it("429 e 5xx: o serviço está fora", async () => {
    for (const status of [429, 500, 502, 503]) {
      expect(await com((async () => resposta("x", status)) as unknown as typeof fetch), String(status)).toEqual({ ok: false, erro: "servico" });
    }
  });

  it("sem internet (fetch lança TypeError): 'sem-internet'", async () => {
    const buscar = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await com(buscar)).toEqual({ ok: false, erro: "sem-internet" });
  });

  it("200 com corpo que não é JSON: 'fora-do-esperado'", async () => {
    expect(await com((async () => resposta("<html>oops</html>")) as unknown as typeof fetch)).toEqual({ ok: false, erro: "fora-do-esperado" });
  });

  it("cancelar no meio: 'cancelada', e o pedido é interrompido", async () => {
    const controle = new AbortController();
    let sinalDoPedido: AbortSignal | undefined;
    const buscar = ((_: string, opcoes: RequestInit) =>
      new Promise((_ok, falha) => {
        sinalDoPedido = opcoes.signal as AbortSignal;
        sinalDoPedido.addEventListener("abort", () => falha(new DOMException("abortado", "AbortError")));
      })) as unknown as typeof fetch;
    const promessa = consultarCrossref("10.1234/x", controle.signal, { buscar, email: "" });
    await Promise.resolve();
    controle.abort();
    expect(await promessa).toEqual({ ok: false, erro: "cancelada" });
    expect(sinalDoPedido?.aborted).toBe(true);
  });

  it("já cancelada antes de começar: nem faz o pedido", async () => {
    const controle = new AbortController();
    controle.abort();
    const buscar = vi.fn();
    expect(await consultarCrossref("10.1234/x", controle.signal, { buscar: buscar as unknown as typeof fetch })).toEqual({ ok: false, erro: "cancelada" });
    expect(buscar).not.toHaveBeenCalled();
  });

  it("Crossref que não responde: desiste no tempo limite, com 'demorou'", async () => {
    const buscar = ((_: string, opcoes: RequestInit) =>
      new Promise((_ok, falha) => {
        (opcoes.signal as AbortSignal).addEventListener("abort", () => falha(new DOMException("abortado", "AbortError")));
      })) as unknown as typeof fetch;
    expect(await consultarCrossref("10.1234/x", sinal(), { buscar, email: "", limiteMs: 20 })).toEqual({ ok: false, erro: "demorou" });
  });
});
