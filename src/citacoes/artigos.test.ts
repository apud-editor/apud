// Os artigos de teste (perfis/artigos) e os casos que a conferência com o
// artigo da UNIVALI revelou (fase 2, parte 5b). Passam pelo Typst de verdade,
// como o documento de prova.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  carregarNorma,
  compararComGabarito,
  documentoDoTexto,
  lerGabarito,
  lerTextoComCitacoes,
  PASTA_PERFIS,
  rodarTrabalho,
} from "../../scripts/prova-lib";
import { lerArquivo } from "../arquivos/formato";
import { niveisDaInstituicao, type Referencia } from "../documento/modelo";

const PASTA = join(PASTA_PERFIS, "artigos");

describe("artigos de teste", () => {
  for (const pasta of readdirSync(PASTA, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== "saida")) {
    const dir = join(PASTA, pasta.name);
    const trabalho = JSON.parse(readFileSync(join(dir, "trabalho.json"), "utf8"));
    const referencias = JSON.parse(readFileSync(join(dir, "referencias.json"), "utf8")) as Referencia[];
    const lido = documentoDoTexto(readFileSync(join(dir, "artigo.md"), "utf8"), referencias);

    it(`${pasta.name}: as chamadas e a lista saem iguais ao gabarito conferido`, () => {
      const resultado = rodarTrabalho(lido, carregarNorma(trabalho.norma, trabalho.ajustes ?? {}));
      expect(compararComGabarito(resultado, lerGabarito(trabalho.gabarito, dir))).toEqual([]);
    });

    it(`${pasta.name}: o .apud da pasta abre no Apud e tem o mesmo texto e as mesmas fontes`, () => {
      const leitura = lerArquivo(readFileSync(join(dir, trabalho.arquivo), "utf8"));
      expect(leitura.ok).toBe(true);
      if (leitura.ok) expect(leitura.trabalho.documento).toEqual(lido.documento);
    });
  }
});

// ---------------------------------------------------------------------------
// Casos pequenos, um por correção

const pessoa = (sobrenome: string, prenomes: string) => ({ sobrenome, prenomes });
const instituicao = (nome: string) => ({ instituicao: nome });

/** Monta um texto curto com essas fontes e devolve as chamadas e a lista. */
function montar(texto: string, referencias: Referencia[], norma = "abnt.txt") {
  const lido = documentoDoTexto(texto, referencias);
  return rodarTrabalho(lido, carregarNorma(norma));
}
const chamadas = (r: ReturnType<typeof montar>) => r.chamadas.map((c) => c.saida);

describe("subtítulos na ABNT", () => {
  const capitulo: Referencia = {
    id: "cap",
    tipo: "capitulo",
    autores: [pessoa("Gardella", "Édouard")],
    titulo: "A urgência como cronopolítica",
    subtitulo: "o abrigo para pessoas em situação de rua",
    publicacao: { titulo: "Novas faces da vida nas ruas", subtitulo: "um balanço", organizadores: [pessoa("Rui", "Taniele")] },
    cidade: "São Carlos",
    editora: "EdUFSCAR",
    data: { ano: 2016 },
    paginas: "141-174",
  };
  const artigo: Referencia = {
    id: "art",
    tipo: "artigo",
    autores: [pessoa("Harrits", "Gitte Sommer")],
    titulo: "Categories and categorization",
    subtitulo: "towards a comprehensive sociological framework",
    publicacao: { titulo: "Distinktion", subtitulo: "Journal of Social Theory", volume: "12", numero: "2" },
    paginas: "229-247",
    data: { ano: 2011 },
  };

  it("o subtítulo do capítulo fica com o capítulo, e o do livro com o livro, sem destaque", () => {
    const { referencias } = montar("[@cap]", [capitulo]);
    expect(referencias).toEqual([
      "GARDELLA, Édouard. A urgência como cronopolítica: o abrigo para pessoas em situação de rua. *In*: RUI, Taniele (org.). **Novas faces da vida nas ruas**: um balanço. São Carlos: EdUFSCAR, 2016. p. 141-174.",
    ]);
  });

  it("o subtítulo do artigo fica com o artigo, e o da revista sai sem destaque; revista sem cidade leva [S. l.]", () => {
    const { referencias } = montar("[@art]", [artigo]);
    expect(referencias).toEqual([
      "HARRITS, Gitte Sommer. Categories and categorization: towards a comprehensive sociological framework. **Distinktion**: Journal of Social Theory, *[S. l.]*, v. 12, n. 2, p. 229-247, 2011.",
    ]);
  });

  it("na APA nada muda: o subtítulo continua junto do título", () => {
    const { referencias } = montar("[@cap] [@art]", [capitulo, artigo], "apa.txt");
    expect(referencias.join("\n")).toContain("A urgência como cronopolítica: O abrigo para pessoas em situação de rua");
    expect(referencias.join("\n")).toContain("Categories and categorization: Towards a comprehensive sociological framework");
    expect(referencias.join("\n")).not.toContain("[S. l.]");
  });
});

describe("instituição com subordinação (ABNT, revisão 5)", () => {
  const livro = (id: string, autor: string, titulo: string, ano = 2014): Referencia => ({
    id,
    tipo: "livro",
    autores: [instituicao(autor)],
    titulo,
    cidade: "Brasília, DF",
    editora: "MS",
    data: { ano },
  });

  it("os níveis são separados pelo ponto", () => {
    expect(niveisDaInstituicao("Brasil. Ministério da Saúde")).toEqual(["Brasil", "Ministério da Saúde"]);
    expect(niveisDaInstituicao("Brasil. Ministério da Saúde. Secretaria de Atenção Primária")).toHaveLength(3);
    expect(niveisDaInstituicao("Associação Brasileira de Saúde Mental")).toEqual(["Associação Brasileira de Saúde Mental"]);
    // Ponto seguido de minúscula não separa (abreviação no meio do nome).
    expect(niveisDaInstituicao("Instituto Prof. de estudos")).toEqual(["Instituto Prof. de estudos"]);
  });

  it("na lista, só a entidade principal vai em maiúsculas; na chamada, só ela aparece", () => {
    const r = montar("[@ms] e @ms", [livro("ms", "Brasil. Ministério da Saúde", "Política Nacional")]);
    expect(chamadas(r)).toEqual(["(Brasil, 2014)", "Brasil (2014)"]);
    expect(r.referencias).toEqual(["BRASIL. Ministério da Saúde. **Política Nacional**. Brasília, DF: MS, 2014."]);
  });

  it("dois órgãos do mesmo governo no mesmo ano: as chamadas ficariam iguais, então entram as letras", () => {
    const r = montar("[@ms] [@mec]", [livro("ms", "Brasil. Ministério da Saúde", "Saúde"), livro("mec", "Brasil. Ministério da Educação", "Educação")]);
    expect(chamadas(r)).toEqual(["(Brasil, 2014b)", "(Brasil, 2014a)"]);
  });

  it("vários autores, um com subordinação: cada um como deve", () => {
    const r = montar("[@mpf]", [
      {
        id: "mpf",
        tipo: "relatorio",
        autores: [instituicao("Ministério Público Federal. Procuradoria Federal dos Direitos do Cidadão"), instituicao("Ministério Público do Trabalho")],
        titulo: "Relatório da inspeção",
        cidade: "Brasília",
        editora: "MPF; MPT",
        data: { ano: 2025 },
      },
    ]);
    expect(chamadas(r)).toEqual(["(Ministério Público Federal; Ministério Público do Trabalho, 2025)"]);
    expect(r.referencias[0]).toMatch(/^MINISTÉRIO PÚBLICO FEDERAL\. Procuradoria Federal dos Direitos do Cidadão; MINISTÉRIO PÚBLICO DO TRABALHO\. /);
  });

  it("os nomes de pessoas continuam em maiúsculas, também os organizadores e com partícula", () => {
    const r = montar("[@x]", [
      {
        id: "x",
        tipo: "capitulo",
        autores: [pessoa("Oliveira", "Luciano Márcio Freitas de")],
        titulo: "Cap",
        publicacao: { titulo: "Livro", organizadores: [pessoa("Ugá", "Vivian")] },
        cidade: "Natal",
        editora: "EDUFRN",
        data: { ano: 2019 },
      },
    ]);
    expect(r.referencias[0]).toBe("OLIVEIRA, Luciano Márcio Freitas de. Cap. *In*: UGÁ, Vivian (org.). **Livro**. Natal: EDUFRN, 2019.");
  });

  it("na APA a chamada mantém o nome inteiro (a APA não separa os níveis)", () => {
    const r = montar("[@ms]", [livro("ms", "Brasil. Ministério da Saúde", "Política Nacional")], "apa.txt");
    expect(chamadas(r)).toEqual(["(Brasil. Ministério da Saúde, 2014)"]);
  });
});

describe("mesmo sobrenome no mesmo ano (ABNT)", () => {
  const obra = (id: string, autores: { sobrenome: string; prenomes: string }[]): Referencia => ({
    id,
    tipo: "livro",
    autores,
    titulo: id,
    cidade: "Rio de Janeiro",
    editora: "Centro Edelstein",
    data: { ano: 2013 },
  });

  it("chamadas que já são diferentes não ganham iniciais: Spink (2013) e Spink e Medrado (2013)", () => {
    const r = montar("@p e @mj", [obra("p", [pessoa("Spink", "Peter")]), obra("mj", [pessoa("Spink", "Mary Jane"), pessoa("Medrado", "Benedito")])]);
    expect(chamadas(r)).toEqual(["Spink (2013)", "Spink e Medrado (2013)"]);
  });

  it("chamadas que ficariam iguais ganham as iniciais: (Spink, P., 2013; Spink, M. J., 2013)", () => {
    const r = montar("[@p; @mj]", [obra("p", [pessoa("Spink", "Peter")]), obra("mj", [pessoa("Spink", "Mary Jane")])]);
    expect(chamadas(r)).toEqual(["(Spink, P., 2013; Spink, M. J., 2013)"]);
  });
});

describe("forma curta: citação direta", () => {
  it("+direta marca a citação direta, entre parênteses e na narrativa", () => {
    const { trechos } = lerTextoComCitacoes("[@a, p. 3, +direta] e @b [+direta] e @c [p. 4, +direta]");
    expect(trechos.flatMap((t) => ("citacao" in t ? [t.citacao] : []))).toEqual([
      { tipo: "parenteses", direta: true, obras: [{ referencia: "a", localizador: { tipo: "pagina", valor: "3" } }] },
      { tipo: "narrativa", direta: true, obra: { referencia: "b" } },
      { tipo: "narrativa", direta: true, obra: { referencia: "c", localizador: { tipo: "pagina", valor: "4" } } },
    ]);
  });
});

describe("APA: o que a conferência com o artigo da revista revelou (revisão 6)", () => {
  const post = (id: string, titulo: string, data: { ano: number; mes?: number; dia?: number }): Referencia => ({
    id,
    tipo: "rede-social",
    autores: [pessoa("Coelho", "Robison")],
    titulo,
    perfil: "@robisoncoelho",
    tipoDaPostagem: "Vídeo",
    publicacao: { titulo: "Instagram" },
    data,
  });

  it("mesmo autor e ano: as letras seguem a data completa (só o ano vem primeiro), e não o título", () => {
    const r = montar(
      "[@jan] [@mar] [@ano] [@fev]",
      [post("jan", "Zebra", { ano: 2025, mes: 1, dia: 2 }), post("mar", "Abacate", { ano: 2025, mes: 3, dia: 1 }), post("ano", "Meio", { ano: 2025 }), post("fev", "Banana", { ano: 2025, mes: 2, dia: 24 })],
      "apa.txt",
    );
    expect(chamadas(r)).toEqual(["(Coelho, 2025b)", "(Coelho, 2025d)", "(Coelho, 2025a)", "(Coelho, 2025c)"]);
    expect(r.referencias.map((x) => x.match(/\(2025[a-d][^)]*\)/)![0])).toEqual(["(2025a)", "(2025b, 2 de janeiro)", "(2025c, 24 de fevereiro)", "(2025d, 1 de março)"]);
  });

  it("na ABNT as letras continuam pela ordem do título", () => {
    const r = montar("[@jan] [@mar]", [post("jan", "Zebra", { ano: 2025, mes: 1, dia: 2 }), post("mar", "Abacate", { ano: 2025, mes: 3, dia: 1 })]);
    expect(chamadas(r)).toEqual(["(Coelho, 2025b)", "(Coelho, 2025a)"]);
  });

  it("notícia só com o ano: (2023), sem vírgula sobrando", () => {
    const r = montar("[@n]", [{ id: "n", tipo: "noticia", autores: [pessoa("Catie", "Talita")], titulo: "Morador de rua", publicacao: { titulo: "NSC Total" }, data: { ano: 2023 } }], "apa.txt");
    expect(r.referencias[0]).toBe("Catie, T. (2023). Morador de rua. *NSC Total*.");
  });

  const lei = (id: string, titulo: string, ano: number): Referencia => ({ id, tipo: "lei", autores: [instituicao("Brasil")], titulo, data: { ano } });

  it("lei: o nome vai sem a data na chamada, e duas leis do Brasil não se juntam como se fossem do mesmo autor", () => {
    const r = montar(
      "[@d; @c] e [@l, § 3º]",
      [lei("d", "Decreto nº 7.053, de 23 de dezembro de 2009", 2009), lei("c", "Constituição da República Federativa do Brasil", 1988), lei("l", "Lei Municipal nº 7.839, de 5 de novembro de 2025", 2025)],
      "apa.txt",
    );
    expect(chamadas(r)).toEqual(["(Constituição da República Federativa do Brasil, 1988; Decreto nº 7.053, 2009)", "(Lei Municipal nº 7.839, 2025, § 3º)"]);
  });

  it("na ABNT, as leis continuam pelo autor, com os anos juntos: (Brasil, 1988, 2009)", () => {
    const r = montar("[@d; @c]", [lei("d", "Decreto nº 7.053, de 23 de dezembro de 2009", 2009), lei("c", "Constituição", 1988)]);
    expect(chamadas(r)).toEqual(["(Brasil, 1988, 2009)"]);
  });

  it("páginas do capítulo na lista: pp.", () => {
    const r = montar(
      "[@cap]",
      [{ id: "cap", tipo: "capitulo", autores: [pessoa("Spink", "Peter")], titulo: "Análise", publicacao: { titulo: "Práticas", organizadores: [pessoa("Spink", "Mary Jane")] }, editora: "Centro", data: { ano: 2013 }, paginas: "100-126" }],
      "apa.txt",
    );
    expect(r.referencias[0]).toContain("(pp. 100–126)");
  });
});

describe("livro organizado e notas (decisões do Francisco, 20/11/2026)", () => {
  const organizado: Referencia = {
    id: "org",
    tipo: "livro",
    autores: [pessoa("Spink", "Mary Jane"), pessoa("Figueiredo", "Pedro")],
    autoresOrganizadores: true,
    titulo: "Psicologia social e pessoalidade",
    cidade: "Rio de Janeiro",
    editora: "Centro Edelstein",
    data: { ano: 2011 },
  };
  const traduzido: Referencia = {
    id: "eng",
    tipo: "livro",
    autores: [pessoa("Engels", "Friedrich")],
    titulo: "A situação da classe trabalhadora na Inglaterra",
    cidade: "São Paulo",
    editora: "Boitempo",
    data: { ano: 2008 },
    notas: "Tradução de Beatriz Alves Schumann. Originalmente publicado em 1845.",
    url: "https://exemplo.org/engels",
    acesso: { ano: 2026, mes: 5, dia: 20 },
  };

  it("ABNT: (org.) depois dos organizadores, e a chamada continua pelos nomes", () => {
    const r = montar("[@org]", [organizado]);
    expect(r.referencias[0]).toContain("SPINK, Mary Jane; FIGUEIREDO, Pedro (org.). **Psicologia social e pessoalidade**");
    expect(chamadas(r)).toEqual(["(Spink; Figueiredo, 2011)"]);
  });

  it("APA: (Org.) depois dos organizadores", () => {
    const r = montar("[@org]", [{ ...organizado, autores: [pessoa("Spink", "Mary Jane")] }], "apa.txt");
    expect(r.referencias[0]).toMatch(/^Spink, M\. J\. \(Org\.\)\. \(2011\)\./);
    expect(chamadas(r)).toEqual(["(Spink, 2011)"]);
  });

  it("ABNT: as notas saem como escritas, antes do endereço", () => {
    const r = montar("[@eng]", [traduzido]);
    expect(r.referencias[0]).toContain("São Paulo: Boitempo, 2008. Tradução de Beatriz Alves Schumann. Originalmente publicado em 1845. Disponível em:");
  });

  it("APA: as notas vão no fim", () => {
    const r = montar("[@eng]", [{ ...traduzido, url: undefined, acesso: undefined }], "apa.txt");
    expect(r.referencias[0]).toMatch(/Boitempo\. Tradução de Beatriz Alves Schumann\. Originalmente publicado em 1845\.$/);
  });
});

describe("lei na lista da ABNT (NBR 6023:2025, 7.11.1 e 7.11.2; perfil revisão 6)", () => {
  const brasil = [{ instituicao: "Brasil" }];
  it("a epígrafe vai em negrito; a ementa, não", () => {
    const r = montar("[@l]", [{ id: "l", tipo: "lei", autores: brasil, titulo: "Lei nº 10.216, de 6 de abril de 2001", ementa: "Dispõe sobre a proteção", cidade: "Brasília, DF", editora: "Presidência da República", data: { ano: 2001 } }]);
    expect(r.referencias[0]).toBe("BRASIL. **Lei nº 10.216, de 6 de abril de 2001**. Dispõe sobre a proteção. Brasília, DF: Presidência da República, 2001.");
  });

  it("na Constituição, o [Constituição (1988)] fica sem negrito, e o título leva o negrito", () => {
    const r = montar("[@c]", [{ id: "c", tipo: "lei", autores: brasil, titulo: "[Constituição (1988)]. Constituição da República Federativa do Brasil", cidade: "Brasília, DF", editora: "Presidência da República", data: { ano: 1988 } }]);
    expect(r.referencias[0]).toBe("BRASIL. [Constituição (1988)]. **Constituição da República Federativa do Brasil**. Brasília, DF: Presidência da República, 1988.");
    expect(chamadas(r)).toEqual(["(Brasil, 1988)"]);
  });

  it("na APA nada muda: a lei não leva negrito", () => {
    const r = montar("[@l]", [{ id: "l", tipo: "lei", autores: brasil, titulo: "Lei nº 10.216, de 6 de abril de 2001", data: { ano: 2001 }, url: "https://exemplo.org" }], "apa.txt");
    expect(r.referencias[0]).not.toContain("**");
  });
});
