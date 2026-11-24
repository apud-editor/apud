import { describe, expect, it } from "vitest";
import { carregarPerfil } from "../../scripts/prova-lib";
import { elementosDaAbertura, existeNoModelo } from "../conversor/abertura";
import { lerArquivo, escreverArquivo } from "../arquivos/formato";
import { dadosVazios, type DadosDoTrabalho } from "../documento/modelo";
import {
  aberturaPadrao,
  dataDoCampo,
  dataParaCampo,
  elementosDaNorma,
  idiomaDoProximoResumo,
  lerAno,
  limparDados,
  palavrasChaveDoTexto,
  problemasDosDados,
  resumoDoAssistente,
  trabalhoNovo,
} from "./trabalho";

const abnt = carregarPerfil("abnt.txt").modelo;
const apa = carregarPerfil("apa.txt").modelo;
const dados = (p: Partial<DadosDoTrabalho> = {}): DadosDoTrabalho => ({ ...dadosVazios(), titulo: "Um título", autores: ["Maria Silva"], ...p });

describe("elementos que ligam sozinhos", () => {
  it("ABNT: disciplina com capa e folha de rosto; estágio e TCC também com sumário; artigo sem nenhum", () => {
    const de = (t: DadosDoTrabalho["tipo"]) => aberturaPadrao(t, abnt).blocos.map((b) => b.tipo);
    expect(de("disciplina")).toEqual(["capa", "folhaDeRosto"]);
    expect(de("estagio")).toEqual(["capa", "folhaDeRosto", "sumario"]);
    expect(de("tcc")).toEqual(["capa", "folhaDeRosto", "sumario"]);
    expect(de("artigo")).toEqual([]);
  });

  it("APA: só a página de título, em todos os tipos; nada de capa, folha de rosto ou sumário", () => {
    for (const t of ["disciplina", "estagio", "artigo", "tcc"] as const) {
      expect(aberturaPadrao(t, apa).blocos).toEqual([{ tipo: "paginaDeTitulo" }]);
    }
  });

  it("diz quais elementos cada norma tem", () => {
    expect(elementosDaNorma(abnt)).toMatchObject({ capa: true, folhaDeRosto: true, paginaDeTitulo: false, dedicatoria: true, sumario: true, resumo: true });
    expect(elementosDaNorma(apa)).toMatchObject({ capa: false, folhaDeRosto: false, paginaDeTitulo: true, dedicatoria: false, sumario: false, resumo: true });
  });
});

describe("dados do trabalho", () => {
  it("limpa espaços, tira autor em branco e campo vazio", () => {
    const l = limparDados(dados({ titulo: "  Um   título  ", autores: [" Maria  Silva ", "", "  "], subtitulo: "   ", curso: " Psicologia ", ano: 2026, natureza: "  \n " }));
    expect(l.titulo).toBe("Um título");
    expect(l.autores).toEqual(["Maria Silva"]);
    expect(l).not.toHaveProperty("subtitulo");
    expect(l).not.toHaveProperty("natureza");
    expect(l.curso).toBe("Psicologia");
    expect(l.ano).toBe(2026);
  });

  it("não aceita ano que não é número", () => {
    expect(limparDados(dados({ ano: Number.NaN }))).not.toHaveProperty("ano");
    expect(lerAno("2026")).toBe(2026);
    expect(lerAno("")).toBeUndefined();
    expect(lerAno("20x6")).toBeNaN();
  });

  it("pede título e pelo menos um autor, em português simples", () => {
    expect(problemasDosDados(dados())).toEqual([]);
    expect(problemasDosDados(dados({ titulo: "  ", autores: [""] }))).toEqual(["Escreva o título do trabalho.", "Escreva o nome de pelo menos um autor."]);
    expect(problemasDosDados(dados({ ano: 12 }))[0]).toContain("ano");
  });

  it("palavras-chave: ponto e vírgula, vírgula ou linha; sem ponto final", () => {
    expect(palavrasChaveDoTexto("saúde mental; psicologia clínica,  estágio.\nclínica")).toEqual(["saúde mental", "psicologia clínica", "estágio", "clínica"]);
    expect(palavrasChaveDoTexto("  ")).toEqual([]);
  });

  it("resumo do assistente: pulado dá null; com texto, um parágrafo no idioma do trabalho", () => {
    expect(resumoDoAssistente("pt-BR", "  ", " ")).toBeNull();
    expect(resumoDoAssistente("pt-BR", "Este trabalho\n  estuda.", "a; b")).toEqual({ tipo: "resumo", idioma: "pt-BR", trechos: [{ texto: "Este trabalho estuda." }], palavrasChave: ["a", "b"] });
  });

  it("data do campo de data e de volta", () => {
    expect(dataDoCampo("2026-11-22")).toEqual({ ano: 2026, mes: 11, dia: 22 });
    expect(dataDoCampo("")).toBeUndefined();
    expect(dataParaCampo({ ano: 2026, mes: 3, dia: 5 })).toBe("2026-03-05");
    expect(dataParaCampo({ ano: 2026 })).toBe("");
  });

  it("o próximo resumo usa um idioma que ainda não tem", () => {
    expect(idiomaDoProximoResumo(["pt-BR"])).toBe("en");
    expect(idiomaDoProximoResumo(["pt-BR", "en"])).toBe("es");
  });
});

describe("trabalho novo", () => {
  it("monta o trabalho com os dados, a abertura do tipo e o resumo; o nome do arquivo é o título", () => {
    const resumo = resumoDoAssistente("pt-BR", "Resumo.", "x; y");
    const t = trabalhoNovo({ dados: dados({ tipo: "tcc", curso: "Psicologia", ano: 2026 }), resumo }, abnt, new Date("2026-11-22T12:00:00Z"));
    expect(t.nome).toBe("Um título");
    expect(t.modelo.identificacao.nome).toBe("ABNT");
    expect(t.documento.dados).toMatchObject({ tipo: "tcc", titulo: "Um título", autores: ["Maria Silva"], curso: "Psicologia", ano: 2026 });
    expect(t.documento.abertura.blocos).toEqual([{ tipo: "capa" }, { tipo: "folhaDeRosto" }, resumo, { tipo: "sumario" }]);
    expect(t.documento.blocos).toEqual([{ tipo: "paragrafo", trechos: [] }]);
    expect(t.criadoEm).toBe("2026-11-22T12:00:00.000Z");
  });

  it("pulando o resumo, não cria resumo vazio", () => {
    const t = trabalhoNovo({ dados: dados(), resumo: null }, apa);
    expect(t.documento.abertura.blocos).toEqual([{ tipo: "paginaDeTitulo" }]);
  });

  it("o arquivo do trabalho novo é lido de volta igual, e a abertura gera os elementos da norma", () => {
    const t = trabalhoNovo({ dados: dados({ tipo: "estagio" }), resumo: resumoDoAssistente("pt-BR", "Texto.", "a") }, abnt);
    const lido = lerArquivo(escreverArquivo(t));
    expect(lido.ok).toBe(true);
    if (!lido.ok) return;
    expect(lido.trabalho.documento).toEqual(t.documento);
    const tipos = elementosDaAbertura(lido.trabalho.documento.abertura, existeNoModelo(abnt)).map((e) => e.tipo);
    expect(tipos).toEqual(["capa", "folhaDeRosto", "resumo", "sumario"]);
  });

  it("título muito longo vira um nome de arquivo de até 80 letras", () => {
    expect(trabalhoNovo({ dados: dados({ titulo: "a".repeat(200) }), resumo: null }, abnt).nome).toHaveLength(80);
  });
});
