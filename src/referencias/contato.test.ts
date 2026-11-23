import { describe, expect, it } from "vitest";
import { consultarCrossref } from "./buscaDoi";
import { CHAVE_DO_EMAIL, emailValido, gravarEmailDeContato, lerEmailDeContato, type Armazem } from "./contato";

function armazem(inicial: Record<string, string> = {}): Armazem & { dados: Record<string, string> } {
  const dados = { ...inicial };
  return {
    dados,
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => {
      dados[k] = v;
    },
    removeItem: (k) => {
      delete dados[k];
    },
  };
}

describe("e-mail da pessoa para o Crossref", () => {
  it("confere se parece um e-mail", () => {
    expect(emailValido("nome@exemplo.com")).toBe(true);
    expect(emailValido("  nome@exemplo.com.br ")).toBe(true);
    expect(emailValido("nome@exemplo")).toBe(false);
    expect(emailValido("nome exemplo@x.com")).toBe(false);
    expect(emailValido("")).toBe(false);
  });

  it("guarda, lê de volta e apaga quando vazio", () => {
    const a = armazem();
    expect(lerEmailDeContato(a)).toBe("");
    expect(gravarEmailDeContato("  ana@exemplo.com ", a)).toEqual({ ok: true, email: "ana@exemplo.com" });
    expect(a.dados[CHAVE_DO_EMAIL]).toBe("ana@exemplo.com");
    expect(lerEmailDeContato(a)).toBe("ana@exemplo.com");
    expect(gravarEmailDeContato("", a)).toEqual({ ok: true, email: "" });
    expect(lerEmailDeContato(a)).toBe("");
  });

  it("não guarda e-mail incompleto, e explica em português simples", () => {
    const a = armazem({ [CHAVE_DO_EMAIL]: "ana@exemplo.com" });
    const r = gravarEmailDeContato("ana@", a);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("incompleto");
    expect(lerEmailDeContato(a)).toBe("ana@exemplo.com");
  });

  it("sem armazenamento ou com armazenamento que recusa: não quebra", () => {
    expect(lerEmailDeContato(null)).toBe("");
    expect(gravarEmailDeContato("ana@exemplo.com", null).ok).toBe(false);
    const recusa: Armazem = {
      getItem: () => {
        throw new Error("x");
      },
      setItem: () => {
        throw new Error("x");
      },
      removeItem: () => {},
    };
    expect(lerEmailDeContato(recusa)).toBe("");
    expect(gravarEmailDeContato("ana@exemplo.com", recusa).ok).toBe(false);
  });

  it("valor estragado no armazenamento é ignorado", () => {
    expect(lerEmailDeContato(armazem({ [CHAVE_DO_EMAIL]: "não é e-mail" }))).toBe("");
  });

  it("a busca pelo DOI leva o e-mail que a pessoa deu, e sem e-mail vai sem", async () => {
    const enderecos: string[] = [];
    const buscar = (async (url: string) => {
      enderecos.push(url);
      return new Response(JSON.stringify({ message: {} }), { status: 200 });
    }) as unknown as typeof fetch;
    await consultarCrossref("10.1234/x", new AbortController().signal, { buscar, email: "ana@exemplo.com" });
    await consultarCrossref("10.1234/x", new AbortController().signal, { buscar, email: "" });
    expect(enderecos[0]).toBe("https://api.crossref.org/works/10.1234/x?mailto=ana%40exemplo.com");
    expect(enderecos[1]).toBe("https://api.crossref.org/works/10.1234/x");
  });
});
