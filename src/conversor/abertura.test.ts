// As decisões da abertura que não são medidas da norma: quais elementos saem
// e em que ordem, a frase da natureza, os rótulos de cada idioma, a data por
// extenso e as palavras-chave.

import { describe, expect, it } from "vitest";
import {
  aberturaVazia,
  adicionarAAbertura,
  blocoVazioDaAbertura,
  dadosVazios,
  ordenarAbertura,
  temTextoNaAbertura,
  tirarDaAbertura,
  type Abertura,
  type DadosDoTrabalho,
  type Resumo,
} from "../documento/modelo";
import {
  dataPorExtenso,
  deNome,
  elementosDaAbertura,
  generoDoNome,
  juntarNomes,
  naturezaDoTrabalho,
  palavrasChave,
  repetirTituloNoTexto,
  nomeDoIdiomaNoModelo,
} from "./abertura";

const texto = (t: string) => [[{ texto: t }]];
const resumo = (idioma: string, t: string): Resumo => ({ tipo: "resumo", idioma, trechos: t ? [{ texto: t }] : [], palavrasChave: [] });
const tudoLigado = (): Abertura => ({
  ...aberturaVazia(),
  blocos: [
    { tipo: "capa" },
    { tipo: "folhaDeRosto" },
    { tipo: "paginaDeTitulo" },
    { tipo: "dedicatoria", paragrafos: texto("A minha mãe.") },
    { tipo: "agradecimentos", paragrafos: texto("Obrigado.") },
    { tipo: "epigrafe", paragrafos: texto("Uma frase."), autoria: "Autor" },
    resumo("pt-BR", "Resumo."),
    resumo("en", "Abstract."),
    { tipo: "sumario" },
  ],
});

describe("quais elementos saem, e em que ordem", () => {
  const abnt = new Set(["capa", "folhaDeRosto", "dedicatoria", "agradecimentos", "epigrafe", "resumo", "sumario"]);
  const apa = new Set(["paginaDeTitulo", "resumo"]);

  it("ABNT: a ordem da NBR 14724, com o sumário no fim; a página de título (da APA) não sai", () => {
    const tipos = elementosDaAbertura(tudoLigado(), (e) => abnt.has(e)).map((e) => e.tipo);
    expect(tipos).toEqual(["capa", "folhaDeRosto", "dedicatoria", "agradecimentos", "epigrafe", "resumo", "resumo", "sumario"]);
  });

  it("APA: só a página de título e os resumos (a APA não tem capa, dedicatória, sumário...)", () => {
    expect(elementosDaAbertura(tudoLigado(), (e) => apa.has(e)).map((e) => e.tipo)).toEqual(["paginaDeTitulo", "resumo", "resumo"]);
  });

  it("os resumos saem na ordem da lista", () => {
    const r = elementosDaAbertura(tudoLigado(), () => true).flatMap((e) => (e.tipo === "resumo" ? [e.resumo.idioma] : []));
    expect(r).toEqual(["pt-BR", "en"]);
  });

  it("bloco tirado da abertura não sai, mesmo com o texto guardado; bloco vazio também não", () => {
    let a = tudoLigado();
    a = tirarDaAbertura(a, a.blocos.findIndex((b) => b.tipo === "dedicatoria"));
    a.blocos = a.blocos.map((b) => (b.tipo === "epigrafe" ? { ...b, paragrafos: [[{ texto: "   " }]] } : b));
    a.blocos = ordenarAbertura([...a.blocos, { ...resumo("es", ""), palavrasChave: ["x"] }]);
    const tipos = elementosDaAbertura(a, () => true).map((e) => e.tipo);
    expect(tipos).not.toContain("dedicatoria");
    expect(tipos).not.toContain("epigrafe");
    expect(tipos.filter((t) => t === "resumo")).toHaveLength(2);
  });

  it("a ordem é a da norma, mesmo que os blocos venham noutra ordem", () => {
    const a = tudoLigado();
    a.blocos = [...a.blocos].reverse();
    const tipos = elementosDaAbertura(a, () => true).map((e) => (e.tipo === "resumo" ? e.resumo.idioma : e.tipo));
    expect(tipos).toEqual(["capa", "folhaDeRosto", "paginaDeTitulo", "dedicatoria", "agradecimentos", "epigrafe", "en", "pt-BR", "sumario"]);
  });

  it("abertura sem blocos: nada sai", () => {
    expect(elementosDaAbertura(aberturaVazia(), () => true)).toEqual([]);
  });
});

describe("natureza do trabalho", () => {
  const dados = (extra: Partial<DadosDoTrabalho>): DadosDoTrabalho => ({ ...dadosVazios(), ...extra });

  it("trabalho de disciplina, com a disciplina, o curso e a instituição", () => {
    expect(naturezaDoTrabalho(dados({ disciplina: "Psicopatologia", curso: "Psicologia", instituicao: "Universidade do Vale do Itajaí" }))).toBe(
      "Trabalho apresentado à disciplina de Psicopatologia, do curso de Psicologia da Universidade do Vale do Itajaí, como requisito parcial para aprovação na disciplina.",
    );
  });

  it("TCC e estágio", () => {
    expect(naturezaDoTrabalho(dados({ tipo: "tcc", curso: "Psicologia", instituicao: "Instituto Federal de Santa Catarina" }))).toBe(
      "Trabalho de Conclusão de Curso apresentado ao curso de Psicologia do Instituto Federal de Santa Catarina, como requisito parcial para a conclusão do curso.",
    );
    expect(naturezaDoTrabalho(dados({ tipo: "estagio", curso: "Psicologia" }))).toBe(
      "Relatório de estágio apresentado ao curso de Psicologia, como requisito parcial para aprovação no estágio.",
    );
  });

  it("só a instituição, ou sem a disciplina", () => {
    expect(naturezaDoTrabalho(dados({ tipo: "tcc", instituicao: "Faculdade Exemplo" }))).toBe(
      "Trabalho de Conclusão de Curso apresentado à Faculdade Exemplo, como requisito parcial para a conclusão do curso.",
    );
    expect(naturezaDoTrabalho(dados({ curso: "Psicologia" }))).toBe("Trabalho apresentado ao curso de Psicologia, como requisito parcial para aprovação.");
  });

  it("o texto que a pessoa escreveu vale mais; sem dados, nada", () => {
    expect(naturezaDoTrabalho(dados({ natureza: "  Minha frase.  ", curso: "Psicologia" }))).toBe("Minha frase.");
    expect(naturezaDoTrabalho(dados({}))).toBe("");
  });

  it("o artigo da instituição sai pela primeira palavra; sigla fica sem artigo", () => {
    expect(generoDoNome("Universidade Federal")).toBe("a");
    expect(generoDoNome("Fundação Getulio Vargas")).toBe("a");
    expect(generoDoNome("Centro Universitário")).toBe("o");
    expect(generoDoNome("UNIVALI")).toBe("");
    expect(deNome("UNIVALI")).toBe("de UNIVALI");
  });
});

describe("rótulos, datas, nomes e palavras-chave", () => {
  it("rótulos do resumo por idioma; idioma sem rótulo usa o inglês", () => {
    // Os rótulos ficam no modelo Em branco ("título em espanhol: Resumen"); aqui, o nome do idioma.
    expect(nomeDoIdiomaNoModelo("pt-BR")).toBe("português");
    expect(nomeDoIdiomaNoModelo("es")).toBe("espanhol");
    expect(nomeDoIdiomaNoModelo("fr")).toBe("francês");
    expect(nomeDoIdiomaNoModelo("xx")).toBe("inglês");
  });

  it("data por extenso, com o que se sabe dela", () => {
    expect(dataPorExtenso({ ano: 2026, mes: 11, dia: 30 })).toBe("30 de novembro de 2026");
    expect(dataPorExtenso({ ano: 2026, mes: 3 })).toBe("março de 2026");
    expect(dataPorExtenso({ ano: 2026 })).toBe("2026");
  });

  it("nomes juntados com vírgula e “e”", () => {
    expect(juntarNomes(["Ana"])).toBe("Ana");
    expect(juntarNomes(["Ana", "Bruno"])).toBe("Ana e Bruno");
    expect(juntarNomes(["Ana", " ", "Bruno", "Carla"])).toBe("Ana, Bruno e Carla");
    expect(juntarNomes([])).toBe("");
  });

  it("palavras-chave com o separador e o final da norma, sem dobrar o ponto", () => {
    expect(palavrasChave(["acolhimento", "saúde mental."], "ponto e vírgula", "ponto")).toBe("acolhimento; saúde mental.");
    expect(palavrasChave(["welcoming", "mental health", ""], "vírgula", "nenhum")).toBe("welcoming, mental health");
    expect(palavrasChave([], "vírgula", "ponto")).toBe("");
  });

  it("APA: o título se repete no texto, menos quando o texto já começa por ele", () => {
    const d = { ...dadosVazios(), titulo: "O acolhimento", subtitulo: "um relato" };
    expect(repetirTituloNoTexto(d, [{ tipo: "paragrafo", trechos: [{ texto: "Texto." }] }])).toBe(true);
    expect(repetirTituloNoTexto(d, [{ tipo: "paragrafo", trechos: [] }, { tipo: "titulo", nivel: 1, trechos: [{ texto: "O Acolhimento: um relato" }] }])).toBe(false);
    expect(repetirTituloNoTexto(d, [{ tipo: "titulo", nivel: 1, trechos: [{ texto: "o acolhimento" }] }])).toBe(false);
    expect(repetirTituloNoTexto({ ...d, titulo: "" }, [])).toBe(false);
  });
});

describe("tirar e adicionar à abertura", () => {
  it("tirar um bloco com texto guarda o texto; adicionar de novo traz o texto de volta, no lugar da norma", () => {
    let a = tudoLigado();
    a = tirarDaAbertura(a, 3);
    expect(a.blocos.map((b) => b.tipo)).not.toContain("dedicatoria");
    expect(a.guardados).toEqual([{ tipo: "dedicatoria", paragrafos: texto("A minha mãe.") }]);
    a = adicionarAAbertura(a, "dedicatoria");
    expect(a.blocos[3]).toEqual({ tipo: "dedicatoria", paragrafos: texto("A minha mãe.") });
    expect(a.guardados).toEqual([]);
  });

  it("tirar um bloco sem texto (capa, sumário, dedicatória vazia) não guarda nada", () => {
    let a = tudoLigado();
    a = tirarDaAbertura(a, 0);
    a = tirarDaAbertura(adicionarAAbertura({ ...a, blocos: a.blocos.filter((b) => b.tipo !== "dedicatoria") }, "dedicatoria"), 2);
    expect(a.guardados).toEqual([]);
    expect(a.blocos.map((b) => b.tipo)).toEqual(["folhaDeRosto", "paginaDeTitulo", "agradecimentos", "epigrafe", "resumo", "resumo", "sumario"]);
  });

  it("os resumos se guardam por idioma: tirar o inglês duas vezes fica com o último", () => {
    let a = tudoLigado();
    a = tirarDaAbertura(a, a.blocos.findIndex((b) => b.tipo === "resumo" && b.idioma === "en"));
    a = adicionarAAbertura(a, "resumo", "es");
    expect(a.blocos.filter((b) => b.tipo === "resumo").map((b) => (b as Resumo).idioma)).toEqual(["pt-BR", "es"]);
    a = { ...a, blocos: ordenarAbertura([...a.blocos, resumo("en", "Outro.")]) };
    a = tirarDaAbertura(a, a.blocos.findIndex((b) => b.tipo === "resumo" && b.idioma === "en"));
    expect(a.guardados).toEqual([resumo("en", "Outro.")]);
    a = adicionarAAbertura(a, "resumo", "en");
    expect(a.blocos.filter((b) => b.tipo === "resumo").map((b) => (b as Resumo).trechos)).toEqual([[{ texto: "Resumo." }], [], [{ texto: "Outro." }]]);
    expect(a.blocos[a.blocos.length - 1]).toEqual({ tipo: "sumario" });
  });

  it("um elemento que só pode haver um não entra duas vezes", () => {
    const a = tudoLigado();
    expect(adicionarAAbertura(a, "capa")).toBe(a);
  });

  it("o que conta como texto da pessoa", () => {
    expect(temTextoNaAbertura({ tipo: "capa" })).toBe(false);
    expect(temTextoNaAbertura(blocoVazioDaAbertura("epigrafe"))).toBe(false);
    expect(temTextoNaAbertura({ tipo: "epigrafe", paragrafos: [], autoria: "Rubem Alves" })).toBe(true);
    expect(temTextoNaAbertura({ ...resumo("en", ""), palavrasChave: ["a"] })).toBe(true);
    expect(temTextoNaAbertura({ ...resumo("en", ""), titulo: " " })).toBe(false);
  });
});
