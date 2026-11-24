// A Abertura em blocos sem tela: nomes, situação, o que dá para adicionar, as
// peças das folhas e como uma peça editada muda os dados do trabalho.

import { describe, expect, it } from "vitest";
import { carregarPerfil } from "../../scripts/prova-lib";
import { aberturaVazia, dadosVazios, tirarDaAbertura, type Abertura, type DadosDoTrabalho } from "../documento/modelo";
import {
  chaveDoBloco,
  comPaginaNova,
  faixasDaFolha,
  linhasDePaginaNova,
  mudarPeca,
  nomeDoBlocoDaAbertura,
  opcoesDeAdicionar,
  situacaoDoBloco,
  temEscolhaDePaginaNova,
} from "./abertura";

const abnt = carregarPerfil("abnt.txt").modelo;
const apa = carregarPerfil("apa.txt").modelo;
const dados = (p: Partial<DadosDoTrabalho> = {}): DadosDoTrabalho => ({ ...dadosVazios(), titulo: "Meu trabalho", autores: ["Ana Souza", "Bruno Lima"], ...p });
const abertura = (p: Partial<Abertura> = {}): Abertura => ({ ...aberturaVazia(), ...p });

describe("nome, chave e situação dos blocos", () => {
  it("o resumo leva o idioma no nome", () => {
    expect(nomeDoBlocoDaAbertura({ tipo: "resumo", idioma: "es", trechos: [], palavrasChave: [] })).toBe("Resumo (Espanhol)");
    expect(nomeDoBlocoDaAbertura({ tipo: "folhaDeRosto" })).toBe("Folha de rosto");
  });

  it("a chave não muda com os blocos de antes e separa resumos do mesmo idioma", () => {
    const r = (idioma: string) => ({ tipo: "resumo" as const, idioma, trechos: [], palavrasChave: [] });
    const blocos = [{ tipo: "capa" as const }, r("pt-BR"), r("en"), r("pt-BR")];
    expect(blocos.map((_, i) => chaveDoBloco(blocos, i))).toEqual(["capa", "resumo-pt-BR-0", "resumo-en-0", "resumo-pt-BR-1"]);
    expect(chaveDoBloco(blocos.slice(1), 1)).toBe("resumo-en-0");
  });

  it("avisa quando a norma não tem o elemento, e quando o texto está vazio", () => {
    expect(situacaoDoBloco({ tipo: "capa" }, apa, "APA")).toBe("A APA não tem a capa: fica guardada no trabalho, mas não sai no PDF.");
    expect(situacaoDoBloco({ tipo: "agradecimentos", paragrafos: [] }, apa, "APA")).toBe("A APA não tem os agradecimentos: ficam guardados no trabalho, mas não saem no PDF.");
    expect(situacaoDoBloco({ tipo: "sumario" }, apa, "APA")).toBe("A APA não tem o sumário: fica guardado no trabalho, mas não sai no PDF.");
    expect(situacaoDoBloco({ tipo: "capa" }, abnt, "ABNT")).toBeNull();
    expect(situacaoDoBloco({ tipo: "dedicatoria", paragrafos: [[{ texto: "  " }]] }, abnt, "ABNT")).toBe("Vazio: só sai no PDF depois de ter texto.");
    expect(situacaoDoBloco({ tipo: "resumo", idioma: "en", trechos: [{ texto: "A." }], palavrasChave: [] }, abnt, "ABNT")).toBeNull();
  });
});

describe("Adicionar à abertura", () => {
  it("ABNT: oferece o que o modelo tem e falta, na ordem da norma, um resumo por idioma que falta", () => {
    const a = abertura({ blocos: [{ tipo: "capa" }, { tipo: "resumo", idioma: "pt-BR", trechos: [], palavrasChave: [] }] });
    const o = opcoesDeAdicionar(a, abnt);
    expect(o.map((x) => x.rotulo)).toEqual([
      "Folha de rosto",
      "Dedicatória",
      "Agradecimentos",
      "Epígrafe",
      "Resumo (Inglês)",
      "Resumo (Espanhol)",
      "Resumo (Francês)",
      "Resumo (Italiano)",
      "Resumo (Alemão)",
      "Sumário",
    ]);
    expect(o.every((x) => !x.guardado && !x.foraDaNorma)).toBe(true);
  });

  it("APA: só a página de título e os resumos, mais o que estiver guardado (com aviso)", () => {
    let a = abertura({ blocos: [{ tipo: "dedicatoria", paragrafos: [[{ texto: "À família." }]] }] });
    a = tirarDaAbertura(a, 0);
    const o = opcoesDeAdicionar(a, apa);
    expect(o[0]).toEqual({ tipo: "paginaDeTitulo", rotulo: "Página de título", guardado: false, foraDaNorma: false });
    expect(o.find((x) => x.tipo === "dedicatoria")).toEqual({ tipo: "dedicatoria", rotulo: "Dedicatória", guardado: true, foraDaNorma: true });
    expect(o.some((x) => x.tipo === "capa" || x.tipo === "sumario")).toBe(false);
  });

  it("um resumo guardado volta marcado, e um idioma que a lista não conhece também aparece", () => {
    const a = abertura({
      guardados: [
        { tipo: "resumo", idioma: "en", trechos: [{ texto: "A." }], palavrasChave: [] },
        { tipo: "resumo", idioma: "ca", trechos: [{ texto: "B." }], palavrasChave: [] },
      ],
    });
    const resumos = opcoesDeAdicionar(a, abnt).filter((x) => x.tipo === "resumo");
    expect(resumos.find((x) => x.idioma === "en")?.guardado).toBe(true);
    expect(resumos.find((x) => x.idioma === "es")?.guardado).toBe(false);
    expect(resumos.find((x) => x.idioma === "ca")).toMatchObject({ guardado: true, rotulo: "Resumo (ca)" });
  });
});

describe("as peças das folhas", () => {
  const nomes = (f: ReturnType<typeof faixasDaFolha>) => f.map((x) => `${x.nome}: ${x.pecas.map((p) => p.rotulo).join(", ")}`);

  it("capa da ABNT: instituição, curso e autoria no topo; título no meio; cidade e ano no pé", () => {
    expect(nomes(faixasDaFolha("capa", dados(), abnt, false))).toEqual(["Topo: Instituição, Curso, Autores", "Meio: Título, Subtítulo", "Pé: Cidade, Ano"]);
  });

  it("folha de rosto: o rótulo do orientador muda em trabalho de disciplina; a natureza é montada", () => {
    const tcc = faixasDaFolha("folhaDeRosto", dados({ tipo: "tcc", curso: "Psicologia" }), abnt, false);
    expect(nomes(tcc)).toEqual(["Topo: Autores", "Meio: Título, Subtítulo, Natureza do trabalho, Orientador(a)", "Pé: Cidade, Ano"]);
    const natureza = tcc[1].pecas.find((p) => p.campo === "natureza")!;
    expect(natureza.montada).toBe(true);
    expect(natureza.valor).toContain("Trabalho de Conclusão de Curso apresentado ao curso de Psicologia");
    expect(natureza.editavel).toBe("");
    expect(faixasDaFolha("folhaDeRosto", dados(), abnt, false)[1].pecas.map((p) => p.rotulo)).toContain("Professor(a)");
  });

  it("página de título da APA: as peças do modo estudante, numa faixa só", () => {
    const f = faixasDaFolha("paginaDeTitulo", dados({ dataDeEntrega: { ano: 2026, mes: 11, dia: 30 } }), apa, false);
    expect(nomes(f)).toEqual(["Topo: Título, Subtítulo, Autores, Curso, Instituição, Disciplina, Professor(a), Data de entrega"]);
    expect(f[0].pecas.find((p) => p.campo === "dataDeEntrega")).toMatchObject({ valor: "30 de novembro de 2026", editavel: "2026-11-30" });
  });

  it("os autores aparecem separados por ponto e vírgula e se editam um por linha; sem identificação, avisa", () => {
    const capa = faixasDaFolha("capa", dados(), abnt, true);
    const autoria = capa[0].pecas.find((p) => p.campo === "autores")!;
    expect(autoria).toMatchObject({ valor: "Ana Souza; Bruno Lima", editavel: "Ana Souza\nBruno Lima", escondido: true, linhas: true });
    expect(faixasDaFolha("capa", dados({ autores: ["Ana"] }), abnt, false)[0].pecas[2].rotulo).toBe("Autoria");
  });

  it("o ano vem da data de entrega quando falta, mas o campo mostra só o ano escrito", () => {
    const ano = faixasDaFolha("capa", dados({ dataDeEntrega: { ano: 2025 } }), abnt, false)[2].pecas[1];
    expect(ano).toMatchObject({ valor: "2025", editavel: "" });
  });
});

describe("mudar uma peça muda os dados do trabalho", () => {
  it("autores, um por linha, sem linhas em branco", () => {
    expect(mudarPeca(dados(), "autores", " Ana  Souza \n\nCarla Dias\n")).toEqual({ ok: true, dados: dados({ autores: ["Ana Souza", "Carla Dias"] }) });
  });

  it("texto em branco tira o dado; o título não pode ficar vazio", () => {
    const r = mudarPeca(dados({ cidade: "Itajaí" }), "cidade", "   ");
    expect(r.ok && r.dados).not.toHaveProperty("cidade");
    expect(mudarPeca(dados(), "titulo", "  ")).toEqual({ ok: false, erro: "O título do trabalho não pode ficar vazio." });
    expect(mudarPeca(dados(), "instituicao", "  Universidade   do Vale ")).toEqual({ ok: true, dados: dados({ instituicao: "Universidade do Vale" }) });
  });

  it("o ano é conferido", () => {
    expect(mudarPeca(dados(), "ano", "2026")).toEqual({ ok: true, dados: dados({ ano: 2026 }) });
    expect(mudarPeca(dados(), "ano", "20x6")).toEqual({ ok: false, erro: "Escreva o ano com quatro números, como 2026." });
    expect(mudarPeca(dados(), "ano", "12")).toMatchObject({ ok: false });
    const r = mudarPeca(dados({ ano: 2026 }), "ano", "");
    expect(r.ok && r.dados).not.toHaveProperty("ano");
  });

  it("a data de entrega e a natureza (em branco, volta a ser montada)", () => {
    expect(mudarPeca(dados(), "dataDeEntrega", "2026-12-05")).toEqual({ ok: true, dados: dados({ dataDeEntrega: { ano: 2026, mes: 12, dia: 5 } }) });
    expect(mudarPeca(dados(), "natureza", "Relatório.\nSegunda linha. ")).toEqual({ ok: true, dados: dados({ natureza: "Relatório.\nSegunda linha." }) });
    const r = mudarPeca(dados({ natureza: "X" }), "natureza", " ");
    expect(r.ok && r.dados).not.toHaveProperty("natureza");
  });
});

describe("a página nova entre os blocos da abertura", () => {
  const r = (idioma: string, excecoes?: Record<string, string>) => ({ tipo: "resumo" as const, idioma, trechos: [{ texto: "A." }], palavrasChave: [], ...(excecoes ? { excecoes } : {}) });

  it("uma linha acima de cada bloco menos o primeiro; só sai depois de um bloco que não ocupa a folha inteira", () => {
    const blocos = [{ tipo: "capa" as const }, { tipo: "folhaDeRosto" as const }, r("pt-BR"), r("en"), { tipo: "sumario" as const }];
    expect(linhasDePaginaNova(blocos, abnt)).toEqual([null, { podeSair: false }, { podeSair: false }, { podeSair: true }, { podeSair: true }]);
  });

  it("um bloco sem página nova (“só este”) não tem linha; um bloco que a norma não tem também não", () => {
    const blocos = [{ tipo: "capa" as const }, { tipo: "paginaDeTitulo" as const }, r("pt-BR"), r("en", { "página nova": "não" })];
    expect(linhasDePaginaNova(blocos, abnt)).toEqual([null, null, { podeSair: false }, null]);
  });

  it("tirar e pôr de volta a página nova escreve e apaga a exceção do bloco", () => {
    const sem = comPaginaNova(r("en"), abnt, false);
    expect(sem.excecoes).toEqual({ "página nova": "não" });
    expect(comPaginaNova(sem, abnt, true)).toEqual(r("en"));
    expect(temEscolhaDePaginaNova({ tipo: "capa" })).toBe(false);
    expect(temEscolhaDePaginaNova(r("en"))).toBe(true);
  });
});
