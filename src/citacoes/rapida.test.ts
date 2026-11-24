import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Referencia } from "../documento/modelo";
import { citacaoRapida, consultaRapida, criarReconhecedor, localizadorDoTexto, obrasDoArroba } from "./rapida";

const referencias = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "testes", "prova", "referencias.json"), "utf8")) as Referencia[];
const reconhecer = criarReconhecedor(referencias);

const pagina = (valor: string) => ({ tipo: "pagina" as const, valor });

describe("localizador escrito à mão", () => {
  it("página, com ou sem p.", () => {
    expect(localizadorDoTexto("p. 15")).toEqual(pagina("15"));
    expect(localizadorDoTexto("p.15")).toEqual(pagina("15"));
    expect(localizadorDoTexto("15")).toEqual(pagina("15"));
    expect(localizadorDoTexto("pp. 15 – 16")).toEqual(pagina("15-16"));
  });
  it("outros: capítulo, local e tempo de vídeo", () => {
    expect(localizadorDoTexto("cap. 3")).toEqual({ tipo: "outro", rotulo: "cap.", valor: "3" });
    expect(localizadorDoTexto("cap 3")).toEqual({ tipo: "outro", rotulo: "cap.", valor: "3" });
    expect(localizadorDoTexto("§ 2")).toEqual({ tipo: "outro", rotulo: "§", valor: "2" });
    expect(localizadorDoTexto("1:56")).toEqual({ tipo: "outro", rotulo: "", valor: "1:56" });
  });
  it("o que não parece localizador fica de fora", () => {
    expect(localizadorDoTexto("")).toBeNull();
    expect(localizadorDoTexto("vários lugares")).toBeNull();
    expect(localizadorDoTexto("p. abc")).toBeNull();
  });
});

describe("o que se digita depois do @", () => {
  it("sem vírgula, tudo é busca; com vírgula, o resto é o localizador", () => {
    expect(consultaRapida("silva 2019")).toEqual({ busca: "silva 2019" });
    expect(consultaRapida("silva, p. 15")).toEqual({ busca: "silva", localizador: pagina("15") });
    expect(consultaRapida("silva,")).toEqual({ busca: "silva" });
  });
  it("um localizador que não entendi não é jogado fora em silêncio", () => {
    expect(consultaRapida("silva, vários")).toEqual({ busca: "silva", localizadorNaoEntendido: "vários" });
  });
  it("a busca acha a obra por autor, ano ou título, sem acento nem maiúscula", () => {
    expect(obrasDoArroba(referencias, "SILVA 2019").map((r) => r.id)).toEqual(["silva2019"]);
    expect(obrasDoArroba(referencias, "rudio").map((r) => r.id)).toEqual(["rudio2002", "rudio2003"]);
    expect(obrasDoArroba(referencias, "zzz")).toEqual([]);
    expect(obrasDoArroba(referencias, "").length).toBe(referencias.length);
  });
});

describe("a citação rápida", () => {
  it("entre parênteses, com ou sem página; ou com o autor no texto", () => {
    expect(citacaoRapida("silva2019")).toEqual({ tipo: "parenteses", obras: [{ referencia: "silva2019" }] });
    expect(citacaoRapida("silva2019", pagina("15"))).toEqual({
      tipo: "parenteses",
      obras: [{ referencia: "silva2019", localizador: pagina("15") }],
    });
    expect(citacaoRapida("silva2019", pagina("15"), true)).toEqual({
      tipo: "narrativa",
      obra: { referencia: "silva2019", localizador: pagina("15") },
    });
  });
});

describe("reconhecer a citação escrita à mão", () => {
  const um = (texto: string) => reconhecer(texto).map((r) => ({ recorte: texto.slice(r.de, r.ate), citacao: r.citacao }));

  it("(Silva, 2019), com página, em maiúsculas (ABNT) e em várias formas", () => {
    expect(um("Veja (Silva, 2019) aqui.")).toEqual([
      { recorte: "(Silva, 2019)", citacao: { tipo: "parenteses", obras: [{ referencia: "silva2019" }] } },
    ]);
    expect(um("(SILVA, 2019, p. 15)")[0].citacao).toEqual({
      tipo: "parenteses",
      obras: [{ referencia: "silva2019", localizador: pagina("15") }],
    });
    expect(um("(Silva, 2019, pp. 15-16)")[0].citacao).toMatchObject({ obras: [{ localizador: pagina("15-16") }] });
  });

  it("vários autores: e, &, ponto e vírgula, et al.", () => {
    const lima = { tipo: "parenteses", obras: [{ referencia: "lima2018" }] };
    expect(um("(Lima, Costa e Reis, 2018)")[0].citacao).toEqual(lima);
    expect(um("(Lima; Costa; Reis, 2018)")[0].citacao).toEqual(lima);
    expect(um("(LIMA; COSTA; REIS, 2018)")[0].citacao).toEqual(lima);
    expect(um("(Lima, Costa, & Reis, 2018)")[0].citacao).toEqual(lima);
    expect(um("(Lima et al., 2018)")[0].citacao).toEqual(lima);
    expect(um("(Dias e Lopes, 2025)")[0].citacao).toMatchObject({ obras: [{ referencia: "dias2025" }] });
  });

  it("várias obras na mesma citação", () => {
    expect(um("(Silva, 2019; Ferraz, 2024, p. 3)")[0].citacao).toEqual({
      tipo: "parenteses",
      obras: [{ referencia: "silva2019" }, { referencia: "ferraz2024", localizador: pagina("3") }],
    });
  });

  it("grifo e tradução", () => {
    expect(um("(Silva, 2019, p. 15, grifo nosso)")[0].citacao).toEqual({
      tipo: "parenteses",
      obras: [{ referencia: "silva2019", localizador: pagina("15"), grifo: true }],
    });
  });

  it("citação de citação (apud)", () => {
    expect(um("(Freud, 1915 apud Silva, 2019, p. 10)")[0].citacao).toEqual({
      tipo: "apud",
      original: "Freud, 1915",
      obra: { referencia: "silva2019", localizador: pagina("10") },
    });
  });

  it("autor no texto: Silva (2019) e Lima, Costa e Reis (2018, p. 4)", () => {
    expect(um("Segundo Silva (2019), o cuidado")).toEqual([
      { recorte: "Silva (2019)", citacao: { tipo: "narrativa", obra: { referencia: "silva2019" } } },
    ]);
    expect(um("Para Lima, Costa e Reis (2018, p. 4) é assim")).toEqual([
      { recorte: "Lima, Costa e Reis (2018, p. 4)", citacao: { tipo: "narrativa", obra: { referencia: "lima2018", localizador: pagina("4") } } },
    ]);
    // O "E" do começo da frase fica no texto: só "Costa (2021)" vira citação.
    expect(um("Segundo isso. E Costa (2021) concorda.").map((r) => r.recorte)).toEqual(["Costa (2021)"]);
    expect(um("Silva et al. (2019)")).toEqual([]); // Silva 2019 tem um autor só
    expect(um("Lima et al. (2018) dizem")[0].recorte).toBe("Lima et al. (2018)");
  });

  it("instituição, pelo nome como foi cadastrado", () => {
    expect(um("(Associação Brasileira de Ensino de Psicologia, 2023)")[0].citacao).toMatchObject({ obras: [{ referencia: "abep2023" }] });
  });

  it("na dúvida, não sugere: obra que não existe, ano errado, duas obras iguais", () => {
    expect(um("(Silva, 2018)")).toEqual([]); // nenhum Silva em 2018
    expect(um("(Pereira, 2019)")).toEqual([]);
    expect(um("(Silva, 2021)")).toEqual([]); // dois Silva em 2021
    expect(um("(Souza, 2020)")).toEqual([]); // 2020a e 2020b
    expect(um("(Silva e Costa, 2019)")).toEqual([]); // Silva 2019 tem um autor só
    expect(um("Segundo o Silva (2018) disse")).toEqual([]);
  });

  it("parênteses comuns não viram citação", () => {
    expect(um("O grupo (n = 12) e o ano (2019) foram")).toEqual([]);
    expect(um("(ver Silva)")).toEqual([]);
    expect(um("(Silva, 2019, tudo)")).toEqual([]); // localizador que não entendi
  });

  it("acha várias no mesmo texto, na ordem", () => {
    const t = "Silva (2019) e depois (Ferraz, 2024) concordam.";
    expect(um(t).map((r) => r.recorte)).toEqual(["Silva (2019)", "(Ferraz, 2024)"]);
  });

  it("uma peça que não é texto (citação, nota) no meio do trecho impede o reconhecimento", () => {
    expect(um("(Silva, ￼2019)")).toEqual([]);
  });
});
