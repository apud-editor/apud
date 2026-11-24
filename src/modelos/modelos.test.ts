// Testes da base dos modelos (versão 2, etapa 1a): a árvore de elementos, a
// leitura e a conferência dos arquivos de modelo, as duas heranças e o Em branco.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizar } from "../perfis/texto";
import { conferirModelos, idDoModelo, type Arquivo } from "./conferir";
import { caminho, ELEMENTOS, elemento, elementoPeloCaminho, linhagem, propriedade } from "./elementos";
import { deOndeVem, valorEfetivo, valorProprio } from "./herdar";
import { lerModelo } from "./ler";
import type { ModeloResolvido } from "./tipos";

const PASTA = join(import.meta.dirname, "..", "..", "modelos");
const emBranco: Arquivo = { nome: "em-branco.txt", conteudo: readFileSync(join(PASTA, "em-branco.txt"), "utf8") };

/** Um modelo de teste que herda do Em branco. */
const filho = (corpo: string, ficha = "modelo: Teste\nherda de: Em branco, revisão 2"): Arquivo => ({
  nome: "teste.txt",
  conteudo: `${ficha}\nrevisão: 1\ndata da revisão: 24/11/2026\nnota da revisão: teste\n\n${corpo}\n`,
});

function conferir(...arquivos: Arquivo[]) {
  return conferirModelos([emBranco, ...arquivos]);
}

function resolvido(...arquivos: Arquivo[]): ModeloResolvido {
  const r = conferir(...arquivos);
  const ultimo = r[r.length - 1];
  expect(ultimo.mensagens.filter((m) => m.gravidade === "erro")).toEqual([]);
  return ultimo.resolvido!;
}

const texto = (m: ModeloResolvido, el: string, prop: string) => valorEfetivo(m, el, prop)?.texto;
const erros = (arquivos: Arquivo[]) =>
  conferir(...arquivos)
    .flatMap((r) => r.mensagens)
    .filter((m) => m.gravidade === "erro")
    .map((m) => m.texto);

describe("árvore de elementos", () => {
  it("cada elemento tem identificador e caminho únicos, e o pai existe", () => {
    expect(new Set(ELEMENTOS.map((e) => e.id)).size).toBe(ELEMENTOS.length);
    expect(new Set(ELEMENTOS.map((e) => normalizar(caminho(e.id)))).size).toBe(ELEMENTOS.length);
    for (const e of ELEMENTOS) if (e.pai) expect(() => elemento(e.pai!)).not.toThrow();
    expect(ELEMENTOS.filter((e) => !e.pai).map((e) => e.id)).toEqual(["texto"]);
  });

  it("todo elemento chega ao Texto (sem voltas)", () => {
    for (const e of ELEMENTOS) expect(linhagem(e.id).at(-1)!.id).toBe("texto");
  });

  it("os caminhos são os que aparecem nos modelos", () => {
    expect(caminho("texto")).toBe("Texto");
    expect(caminho("titulos.nivel1")).toBe("Títulos › Nível 1");
    expect(caminho("titulos.semNumero")).toBe("Títulos › Nível 1 › Título sem número");
    expect(caminho("abertura.resumo.palavrasChave")).toBe("Abertura › Resumo › Palavras-chave");
    expect(elementoPeloCaminho("títulos > nível 2")?.id).toBe("titulos.nivel2");
  });

  it("nenhuma propriedade é declarada duas vezes no mesmo caminho (o de baixo esconderia a de cima)", () => {
    for (const e of ELEMENTOS) {
      const nomes = linhagem(e.id).flatMap((x) => x.propriedades.map((p) => normalizar(p.nome)));
      const repetidos = nomes.filter((n, i) => nomes.indexOf(n) !== i);
      expect(repetidos, caminho(e.id)).toEqual([]);
    }
  });

  it("um elemento recebe as propriedades dele e as dos elementos de cima", () => {
    expect(propriedade("titulos.nivel2", "fonte")?.grupo).toBe("aparência");
    expect(propriedade("titulos.nivel2", "posição")?.grupo).toBe("aparência");
    expect(propriedade("titulos.nivel2", "filete")).toBeUndefined();
    expect(propriedade("titulos", "página nova")?.reservada).toBeUndefined();
    expect(propriedade("referencias", "página nova")?.reservada).toBe(true);
  });

  it("cada atalho escreve só propriedades que o elemento tem, com valores que elas aceitam", () => {
    for (const e of ELEMENTOS) {
      for (const a of e.atalhos ?? []) {
        const exemplo = { margens: "2,54 cm", "fonte e tamanho": "Arial 11 pt", "distância das bordas": "2 cm", marcador: "a)", "espaço antes e depois": "1 linha" }[a.nome];
        expect(exemplo, a.nome).toBeDefined();
        const lido = a.tipo.ler(exemplo!, a.nome);
        expect(lido.ok).toBe(true);
        if (!lido.ok) continue;
        for (const [prop, t] of a.expandir(lido.valor, lido.texto)) {
          const def = propriedade(e.id, prop);
          expect(def, `${a.nome} → ${prop}`).toBeDefined();
          expect(def!.tipo.ler(t, prop).ok).toBe(true);
        }
      }
    }
  });

  it("as regras de citações e referências mantêm os nomes da versão 1, e as da página saíram delas", () => {
    const nomes = elemento("citacoes").propriedades.map((p) => p.nome);
    expect(nomes).toContain("citação, rótulo da página");
    expect(nomes).toContain("referências, prenomes");
    expect(nomes).toContain("meses");
    expect(nomes).not.toContain("citação longa, recuo");
    expect(nomes).not.toContain("rótulo das referências");
    expect(new Set(nomes).size).toBe(nomes.length);
  });
});

describe("leitura do arquivo de modelo", () => {
  it("separa a ficha, as seções e os valores, e guarda o comentário logo acima de cada linha", () => {
    const lido = lerModelo(
      [
        "# cabeçalho do arquivo, solto",
        "",
        "modelo: X",
        "revisão: 2",
        "",
        "# comentário da seção",
        "== Títulos › Nível 1 ==",
        "# A norma não diz como.",
        "# Segunda linha.",
        "destaque: negrito | NBR 6024 | ajustável",
        "",
        "# solto, separado por linha em branco",
        "",
        "posição: centralizado | APA 7",
      ].join("\n"),
    );
    expect(lido.mensagens).toEqual([]);
    expect(lido.ficha.get("modelo")?.valor).toBe("X");
    expect(lido.secoes).toHaveLength(1);
    expect(lido.secoes[0]).toMatchObject({ caminho: "Títulos › Nível 1", nota: "comentário da seção" });
    expect(lido.secoes[0].valores).toEqual([
      { nome: "destaque", valor: "negrito", origem: "NBR 6024", situacao: "ajustável", linha: 10, nota: "A norma não diz como.\nSegunda linha." },
      { nome: "posição", valor: "centralizado", origem: "APA 7", situacao: undefined, linha: 14 },
    ]);
  });

  it("explica os erros de escrita com o número da linha", () => {
    const lido = lerModelo(["modelo: X", "fonte: Arial | Manual", "== Texto ==", "fonte Arial | Manual", "fonte: Arial", "tamanho: 12 pt | ajustável", "== Texto"].join("\n"));
    expect(lido.mensagens.map((m) => [m.linha, m.texto.split(".")[0]])).toEqual([
      [2, "a linha “fonte” está antes da primeira seção"],
      [4, "falta o sinal de dois-pontos entre o nome e o valor"],
      [5, "falta a origem"],
      [6, "falta a origem antes da situação"],
      [7, "o título de seção precisa começar e terminar com ==, como “== Títulos › Nível 1 ==”"],
    ]);
  });
});

describe("conferência dos modelos", () => {
  it("o Em branco está certo e é a raiz", () => {
    const [r] = conferirModelos([emBranco]);
    expect(r.mensagens).toEqual([]);
    expect(r.resolvido!.identificacao).toMatchObject({ id: "em-branco", nome: "Em branco", revisao: 2 });
    expect(r.resolvido!.identificacao.herdaDe).toBeUndefined();
  });

  it("aponta elemento e propriedade que não existem, com sugestão", () => {
    expect(erros([filho("== Titulos › Nivel 1 ==\ndestaque: negrito | x")])).toEqual(["não conheço o elemento “Titulos › Nivel 1”. Você quis dizer “Títulos › Nível 1”?"]);
    expect(erros([filho("== Texto ==\nfontes: Arial | x")])).toEqual(["o elemento “Texto” não tem “fontes”. Você quis dizer “fonte”?"]);
    expect(erros([filho("== Títulos › Nível 2 ==\nfilete: 5 cm | x")])[0]).toMatch(/^o elemento “Títulos › Nível 2” não tem “filete”/);
  });

  it("confere o valor pelo tipo da propriedade e a escolha", () => {
    expect(erros([filho("== Texto ==\ntamanho: 12 | x")])).toEqual(["falta a unidade em “tamanho”: escreva 12 pt."]);
    expect(erros([filho("== Texto ==\nalinhamento: justificar | x")])[0]).toMatch(/não é um valor aceito para “alinhamento”. .*Você quis dizer “justificado”\?/);
    expect(erros([filho("== Texto ==\nfonte: Arial | x | escolha: Times New Roman, Calibri")])[0]).toMatch(/não está entre as opções da escolha/);
    expect(erros([filho("== Texto ==\nfonte: Arial | x | talvez")])[0]).toMatch(/não é uma situação conhecida/);
    expect(erros([filho("== Texto ==\nfonte: Arial | x | faculdade")])).toEqual([
      "nos modelos, a situação “faculdade” se chama “ajustável” (vale também para revistas e para quem não está numa faculdade).",
    ]);
  });

  it("cada propriedade recebe um valor só em cada elemento, nem pela linha nem pelo atalho", () => {
    expect(erros([filho("== Texto ==\nfonte: Arial | x\nfonte: Calibri | y")])).toEqual([
      "“fonte” já recebeu um valor na linha 8. Cada propriedade aparece uma vez em cada elemento.",
    ]);
    expect(erros([filho("== Página ==\nmargens: 2 cm | x\nmargem superior: 3 cm | y")])).toEqual([
      "“margem superior” já recebeu um valor pelo atalho “margens”, na linha 8. Cada propriedade aparece uma vez em cada elemento.",
    ]);
    expect(erros([filho("== Texto ==\nfonte: Arial | x\n== Texto ==\ntamanho: 11 pt | y")])[0]).toMatch(/já apareceu na linha 7/);
  });

  it("confere a ficha", () => {
    expect(erros([{ nome: "x.txt", conteudo: "modelo: X\nherda de: Em branco\nrevisão: um\n" }])).toEqual([
      "a revisão precisa ser um número inteiro, como 1, 2 ou 3.",
      "falta o campo “data da revisão” no começo do arquivo (ex.: data da revisão: 24/11/2026).",
      "falta o campo “nota da revisão” no começo do arquivo (ex.: nota da revisão: o que mudou nesta revisão).",
      expect.stringMatching(/^escreva de quem o modelo herda/),
    ]);
  });

  it("monta a cadeia de herança e avisa quando o modelo de cima mudou de revisão", () => {
    const r = conferir(filho("== Texto ==\nfonte: Arial | x", "modelo: Teste\nherda de: Em branco, revisão 7"));
    expect(r[1].mensagens).toEqual([expect.objectContaining({ gravidade: "aviso", texto: expect.stringMatching(/revisão 7 de Em branco, que agora está na revisão 2/) })]);
    expect(r[1].resolvido!.cadeia.map((c) => c.nome)).toEqual(["Em branco", "Teste"]);
  });

  it("recusa herança de modelo que não existe, com erro ou em volta", () => {
    expect(erros([filho("", "modelo: Teste\nherda de: ABNT 2025, revisão 1")])).toEqual(["não achei o modelo “ABNT”, de quem este herda."]);
    const a = filho("", "modelo: A\nherda de: B, revisão 1");
    const b = { ...filho("", "modelo: B\nherda de: A, revisão 1"), nome: "b.txt" };
    expect(erros([a, b])[0]).toMatch(/a herança dá uma volta/);
    expect(erros([filho("", "modelo: Em branco\nherda de: Em branco, revisão 1")])[0]).toMatch(/já existe outro modelo chamado “Em branco”/);
  });

  it("a raiz precisa dar um valor a tudo o que o Apud aplica", () => {
    const semFonte = { nome: "em-branco.txt", conteudo: emBranco.conteudo.replace(/^fonte: .*$/m, "") };
    expect(conferirModelos([semFonte])[0].mensagens.map((m) => m.texto)).toEqual([
      "o modelo Em branco é a raiz (não herda de ninguém) e precisa dar um valor a “fonte” em “Texto” (ou a um elemento de cima).",
    ]);
  });

  it("o identificador vem do nome", () => {
    expect(idDoModelo("Em branco")).toBe("em-branco");
    expect(idDoModelo("ABNT – Universidade Exemplo")).toBe("abnt-universidade-exemplo");
  });
});

describe("herança entre modelos", () => {
  it("o que o modelo de baixo não diz vem do Em branco; o que diz, vale por cima", () => {
    const m = resolvido(filho("== Texto ==\n# Manual da faculdade.\nfonte: Arial | Manual X | ajustável"));
    expect(valorProprio(m, "texto", "fonte")).toMatchObject({ texto: "Arial", origem: "Manual X", situacao: { tipo: "ajustavel" }, de: "Teste", nota: "Manual da faculdade." });
    expect(valorProprio(m, "texto", "tamanho")).toMatchObject({ texto: "12 pt", de: "Em branco" });
  });

  it("um atalho escreve as propriedades e continua anotado, até alguém mudar uma delas", () => {
    const m = resolvido(filho("== Página ==\nmargens: 2,54 cm | APA 7"));
    for (const lado of ["superior", "inferior", "esquerda", "direita"]) {
      expect(valorProprio(m, "pagina", `margem ${lado}`)).toMatchObject({ texto: "2,54 cm", atalho: "margens", de: "Teste" });
    }
    expect(m.atalhos.get("pagina")?.get("margens")?.texto).toBe("2,54 cm");

    const neto = { ...filho("== Página ==\nmargem esquerda: 3 cm | Manual", "modelo: Neto\nherda de: Teste, revisão 1"), nome: "neto.txt" };
    const r = conferir(filho("== Página ==\nmargens: 2,54 cm | APA 7"), neto);
    const n = r[2].resolvido!;
    expect(valorProprio(n, "pagina", "margem esquerda")?.texto).toBe("3 cm");
    expect(valorProprio(n, "pagina", "margem direita")?.texto).toBe("2,54 cm");
    expect(n.atalhos.get("pagina")?.has("margens")).toBe(false);
    expect(n.cadeia.map((c) => c.nome)).toEqual(["Em branco", "Teste", "Neto"]);
  });

  it("a escolha de um atalho é de pares: as propriedades ficam confirmadas, e a escolha fica no atalho", () => {
    const m = resolvido(filho("== Texto ==\nfonte e tamanho: Times New Roman 12 pt | APA 7 | escolha: Times New Roman 12 pt, Arial 11 pt"));
    expect(valorProprio(m, "texto", "fonte")).toMatchObject({ texto: "Times New Roman", situacao: { tipo: "confirmada" } });
    expect(valorProprio(m, "texto", "tamanho")?.texto).toBe("12 pt");
    expect(m.atalhos.get("texto")?.get("fonte e tamanho")?.situacao).toEqual({ tipo: "escolha", opcoes: ["Times New Roman 12 pt", "Arial 11 pt"] });
  });
});

describe("herança entre elementos", () => {
  const m = () =>
    resolvido(
      filho(
        [
          "== Texto ==",
          "fonte: Arial | x",
          "recuo da primeira linha: 1,25 cm | x",
          "== Títulos ==",
          "destaque: normal | x",
          "== Títulos › Nível 3 ==",
          "destaque: itálico | x",
          "== Abertura › Resumo ==",
          "recuo da primeira linha: como no texto | x",
        ].join("\n"),
      ),
    );

  it("o elemento que não diz usa o do elemento de cima mais perto", () => {
    const r = m();
    expect(texto(r, "titulos.nivel2", "fonte")).toBe("Arial");
    expect(deOndeVem(r, "titulos.nivel2", "fonte")).toBe("texto");
    expect(texto(r, "titulos.nivel2", "destaque")).toBe("normal");
    expect(deOndeVem(r, "titulos.nivel2", "destaque")).toBe("titulos");
    expect(texto(r, "titulos.nivel3", "destaque")).toBe("itálico");
    expect(texto(r, "titulos.semNumero", "destaque")).toBe("normal");
  });

  it("“como no texto” acompanha o recuo do Texto", () => {
    const r = m();
    expect(texto(r, "abertura.resumo", "recuo da primeira linha")).toBe("1,25 cm");
    // As palavras-chave seguem o resumo, que segue o Texto.
    expect(texto(r, "abertura.resumo.palavrasChave", "recuo da primeira linha")).toBe("1,25 cm");
  });
});

describe("modelo Em branco (decisão 13)", () => {
  const r = () => conferirModelos([emBranco])[0].resolvido!;

  it("Times New Roman 12, espaço simples, à esquerda, sem recuo", () => {
    expect(texto(r(), "paragrafo", "fonte")).toBe("Times New Roman");
    expect(texto(r(), "paragrafo", "tamanho")).toBe("12 pt");
    expect(texto(r(), "paragrafo", "entrelinha")).toBe("simples");
    expect(texto(r(), "paragrafo", "alinhamento")).toBe("à esquerda");
    expect(texto(r(), "paragrafo", "recuo da primeira linha")).toBe("nenhum");
  });

  it("títulos em negrito, sem número, maiúsculas nem página nova", () => {
    for (const n of [1, 2, 3, 4, 5]) expect(texto(r(), `titulos.nivel${n}`, "destaque")).toBe("negrito");
    expect(texto(r(), "titulos.nivel1", "numerar sozinho")).toBe("não");
    expect(texto(r(), "titulos.nivel1", "maiúsculas sozinho")).toBe("não");
    expect(texto(r(), "titulos.nivel1", "página nova")).toBe("não");
  });

  it("capa, folha de rosto, página de título e resumos desligados", () => {
    for (const el of ["abertura.capa", "abertura.folhaDeRosto", "abertura.paginaDeTitulo", "abertura.resumo", "abertura.sumario"]) {
      expect(texto(r(), el, "existe"), el).toBe("não");
    }
  });

  it("nenhuma regra de citação: o jeito de citar vem da norma (decisão 13)", () => {
    expect(r().valores.get("citacoes")).toBeUndefined();
  });
});
