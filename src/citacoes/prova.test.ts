// Testes das chamadas e do documento de prova. O documento de prova passa
// pelo Typst de verdade, com os estilos CSL ajustados pelos perfis, e a saída
// é comparada com os gabaritos de perfis/prova/.

import { describe, expect, it } from "vitest";
import { compararComGabarito, documentoDeProva, lerGabarito, lerTextoComCitacoes, rodarProva } from "../../scripts/prova-lib";
import { designacaoDosAnais, primeirasPalavras } from "./preparar";
import { citacoesDoTexto } from "./motor";
import { conferirCitacao } from "../arquivos/formato";

describe("leitura da forma curta das citações (documento de prova)", () => {
  it("reconhece cada tipo de citação e guarda a escrita original", () => {
    const texto =
      "Segundo @lima2018, o acolhimento [@silva2019, p. 15, +grifo] vem antes [@a; @b]. " +
      "Para @dias2025 [p. 4], é postura [Freud, 1915 apud @costa2021, p. 12] [sem referência: Usuária A] [@g, local. 7].";
    const { trechos, escritas } = lerTextoComCitacoes(texto);
    expect(escritas).toEqual([
      "@lima2018",
      "[@silva2019, p. 15, +grifo]",
      "[@a; @b]",
      "@dias2025 [p. 4]",
      "[Freud, 1915 apud @costa2021, p. 12]",
      "[sem referência: Usuária A]",
      "[@g, local. 7]",
    ]);
    expect(trechos.flatMap((t) => ("citacao" in t ? [t.citacao] : []))).toEqual([
      { tipo: "narrativa", obra: { referencia: "lima2018" } },
      { tipo: "parenteses", obras: [{ referencia: "silva2019", localizador: { tipo: "pagina", valor: "15" }, grifo: true }] },
      { tipo: "parenteses", obras: [{ referencia: "a" }, { referencia: "b" }] },
      { tipo: "narrativa", obra: { referencia: "dias2025", localizador: { tipo: "pagina", valor: "4" } } },
      { tipo: "apud", original: "Freud, 1915", obra: { referencia: "costa2021", localizador: { tipo: "pagina", valor: "12" } } },
      { tipo: "sem-referencia", texto: "Usuária A" },
      { tipo: "parenteses", obras: [{ referencia: "g", localizador: { tipo: "outro", rotulo: "local.", valor: "7" } }] },
    ]);
    expect(trechos[0]).toEqual({ texto: "Segundo " });
  });

  it("não confunde colchetes de supressão nem endereços de e-mail", () => {
    expect(lerTextoComCitacoes("“O cuidado [...] é ético” e escreva para ana@exemplo.org.").escritas).toEqual([]);
  });

  it("o documento de prova vira um trabalho do Apud válido, com as 30 citações e as 27 referências", () => {
    const { documento, escritas } = documentoDeProva();
    const citacoes = citacoesDoTexto(documento.blocos);
    expect(citacoes).toHaveLength(30);
    expect(escritas).toHaveLength(30);
    for (const c of citacoes) expect(conferirCitacao(c)).toEqual(c);
    expect(documento.referencias).toHaveLength(27);
  });
});

describe("anais de evento (ABNT)", () => {
  it("mostra só a designação dos anais, e avisa quando cortou o resto", () => {
    expect(designacaoDosAnais("Anais do Seminário de Diamantina")).toEqual({ designacao: "Anais", cortou: true });
    expect(designacaoDosAnais("Anais eletrônicos da Reunião Anual")).toEqual({ designacao: "Anais eletrônicos", cortou: true });
    expect(designacaoDosAnais("Proceedings")).toEqual({ designacao: "Proceedings", cortou: false });
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

  it("APA com todos os autores na primeira citação, como pedem algumas revistas", () => {
    const r = rodarProva("apa.txt", { "citação, primeira vez com três a cinco autores": "todos os autores" });
    const saidas = (escrita: string) => r.chamadas.filter((c) => c.escrita === escrita).map((c) => c.saida);
    // Lima, Costa e Reis (3 autores): a primeira vez é narrativa; depois, et al.
    expect(saidas("@lima2018")).toEqual(["Lima, Costa e Reis (2018)"]);
    expect(saidas("[@lima2018; @silva2019]")).toEqual(["(Lima et al., 2018; J. P. Silva, 2019)"]);
    // Alves e outros 3 (4 autores): a primeira vez entre parênteses, com vírgula antes do &.
    expect(saidas("[@alves2022]")[0]).toBe("(Alves, Brito, Cunha, & Dias, 2022)");
    expect(saidas("@alves2022 [p. 40]")).toEqual(["Alves et al. (2022, p. 40)"]);
    // Dois autores não mudam.
    expect(saidas("[@dias2025, p. 4]")).toEqual(["(Dias & Lopes, 2025, p. 4)"]);
    // A lista de referências continua igual.
    expect(r.referencias).toEqual(lerGabarito("gabarito-apa.txt").referencias);
  });

  it("APA com prenomes por extenso e cidade da editora, como pedem algumas revistas", () => {
    const r = rodarProva("apa.txt", {
      "referências, prenomes": "por extenso",
      "referências, cidade da editora": "mostrar",
    });
    const chamada = (escrita: string) => r.chamadas.find((c) => c.escrita === escrita)?.saida;
    // Na lista, por extenso; no texto, iniciais para desempatar (J. Pavan, 2025a).
    expect(r.referencias).toContain("Silva, João Pedro. (2019). *Psicologia clínica: Fundamentos e prática* (2ª ed.). Petrópolis: Vozes.");
    expect(r.referencias).toContain("Silva, José. (2021). *Psicopatologia descritiva*. Barueri: Manole.");
    expect(chamada("[@silva2019, p. 15]")).toBe("(J. P. Silva, 2019, p. 15)");
    expect(chamada("[@silvaj2021; @silvam2021]")).toBe("(J. Silva, 2021; M. Silva, 2021)");
    expect(chamada("@lima2018")).toBe("Lima et al. (2018)");
    expect(chamada("[@dias2025, p. 4]")).toBe("(Dias & Lopes, 2025, p. 4)");
    // A cidade entra em livros, relatórios e no livro dos capítulos e anais; não em teses e sites.
    expect(r.referencias).toContain(
      "Costa, Helena. (2021). O acolhimento no serviço de saúde mental. Em Rui Melo & Sara Nunes (Orgs.), *Psicologia e saúde coletiva: Práticas no SUS* (pp. 9–30). Porto Alegre: Artmed.",
    );
    expect(r.referencias.find((x) => x.startsWith("Freitas"))).toContain("[Tese de doutorado, Universidade Estadual de Londrina]");
  });

  it("APA sem a escolha: et al. desde a primeira citação", () => {
    const r = rodarProva("apa.txt");
    expect(r.chamadas.find((c) => c.escrita === "[@alves2022]")?.saida).toBe("(Alves et al., 2022)");
  });

  it("título sublinhado, quando é a escolha", () => {
    const r = rodarProva("abnt.txt", { "referências, destaque do título": "sublinhado" });
    expect(r.referencias).toContain("GARCIA, Paulo. __Terapia cognitiva__. Novo Hamburgo: Sinopsys, 2015.");
  });
});
