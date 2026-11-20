// Testes das chamadas e do documento de prova. O documento de prova passa
// pelo Typst de verdade, com os estilos CSL ajustados pelos perfis, e a saída
// é comparada com os gabaritos de perfis/prova/.

import { describe, expect, it } from "vitest";
import { compararComGabarito, lerGabarito, rodarProva } from "../../scripts/prova-lib";
import { encontrarChamadas } from "./chamadas";
import { primeirasPalavras } from "./preparar";

describe("leitura das chamadas", () => {
  it("reconhece cada tipo de chamada", () => {
    const texto =
      "Segundo @lima2018, o acolhimento [@silva2019, p. 15, +grifo] vem antes [@a; @b]. " +
      "Para @dias2025 [p. 4], é postura [Freud, 1915 apud @costa2021, p. 12] [sem referência: Usuária A].";
    expect(encontrarChamadas(texto)).toEqual([
      { tipo: "narrativa", escrita: "@lima2018", chave: "lima2018", localizador: undefined },
      {
        tipo: "parenteses",
        escrita: "[@silva2019, p. 15, +grifo]",
        itens: [{ chave: "silva2019", localizador: "p. 15", grifo: true }],
      },
      { tipo: "parenteses", escrita: "[@a; @b]", itens: [{ chave: "a" }, { chave: "b" }] },
      { tipo: "narrativa", escrita: "@dias2025 [p. 4]", chave: "dias2025", localizador: "p. 4" },
      {
        tipo: "apud",
        escrita: "[Freud, 1915 apud @costa2021, p. 12]",
        original: "Freud, 1915",
        item: { chave: "costa2021", localizador: "p. 12" },
      },
      { tipo: "sem-referencia", escrita: "[sem referência: Usuária A]", conteudo: "Usuária A" },
    ]);
  });

  it("não confunde colchetes de supressão nem endereços de e-mail", () => {
    expect(encontrarChamadas("“O cuidado [...] é ético” e escreva para ana@exemplo.org.")).toEqual([]);
  });
});

describe("obra sem autor (ABNT)", () => {
  it("a primeira palavra leva junto o artigo e as palavras de uma sílaba", () => {
    expect(primeirasPalavras("Guia de normalização")).toEqual({ inicio: "Guia", resto: "de normalização" });
    expect(primeirasPalavras("O cuidado em saúde")).toEqual({ inicio: "O cuidado", resto: "em saúde" });
    expect(primeirasPalavras("A formação de professores")).toEqual({ inicio: "A formação", resto: "de professores" });
  });
});

describe("documento de prova no Typst", () => {
  it("ABNT sai igual ao gabarito", () => {
    expect(compararComGabarito(rodarProva("abnt.txt"), lerGabarito("gabarito-abnt.txt"))).toEqual([]);
  });

  it("APA sai igual ao gabarito", () => {
    expect(compararComGabarito(rodarProva("apa.txt"), lerGabarito("gabarito-apa.txt"))).toEqual([]);
  });

  it("as escolhas do autor mudam a saída da ABNT", () => {
    const r = rodarProva("abnt.txt", {
      "autores, quatro ou mais": "primeiro com et al.",
      "referências, prenomes": "abreviados",
      "referências, destaque do título": "itálico",
      "citação, destaque seu": "grifo próprio",
    });
    const chamada = (escrita: string) => r.chamadas.find((c) => c.escrita === escrita)?.saida;
    expect(chamada("[@alves2022]")).toBe("(Alves *et al.*, 2022)");
    expect(chamada("@alves2022 [p. 40]")).toBe("Alves *et al.* (2022, p. 40)");
    expect(chamada("[@silva2019, p. 47, +grifo]")).toBe("(Silva, 2019, p. 47, grifo próprio)");
    expect(r.referencias).toContain("ALVES, A. M. *et al*. *Avaliação psicológica*. São Paulo: Summus, 2022.");
    expect(r.referencias).toContain(
      "SILVA, J. P. *Psicologia clínica*: fundamentos e prática. 2. ed. Petrópolis: Vozes, 2019.",
    );
  });

  it("título sublinhado, quando é a escolha", () => {
    const r = rodarProva("abnt.txt", { "referências, destaque do título": "sublinhado" });
    expect(r.referencias).toContain("GARCIA, Paulo. __Terapia cognitiva__. Novo Hamburgo: Sinopsys, 2015.");
  });
});
