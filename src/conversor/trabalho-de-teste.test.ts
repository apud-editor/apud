// O trabalho de teste do Apud (testes/trabalho-de-teste) continua abrindo no
// Apud e montando o PDF nas duas normas: se o formato ou os modelos mudarem,
// este teste avisa que é hora de rodar npm run trabalho-de-teste de novo.

import { describe, expect, it } from "vitest";
import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import { escreverArquivo, lerArquivo } from "../arquivos/formato";
import { carregarNorma, mapearImagens } from "../../scripts/prova-lib";
import { trabalhoDeTeste } from "../../scripts/trabalho-de-teste";
import { documentoParaTypst } from "./typst";

describe("trabalho de teste do Apud", () => {
  const trabalho = trabalhoDeTeste();

  it("tem todos os elementos do Apud", () => {
    const { blocos, abertura, referencias, imagens } = trabalho.documento;
    const tipos = new Set(blocos.map((b) => b.tipo));
    for (const t of ["titulo", "paragrafo", "lista", "citacaoLonga", "figura", "tabela", "quebra", "referencias"]) expect(tipos).toContain(t);
    expect(new Set(blocos.flatMap((b) => (b.tipo === "titulo" ? [b.nivel] : [])))).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(blocos.some((b) => b.tipo === "lista" && b.sequencia)).toBe(true);
    expect(blocos.some((b) => b.tipo === "lista" && !b.sequencia && b.itens.some((i) => i.subitens?.length))).toBe(true);
    expect(blocos.filter((b) => (b.tipo === "paragrafo" || b.tipo === "titulo") && b.excecoes).length).toBeGreaterThanOrEqual(5);
    const trechos = blocos.flatMap((b) => ("trechos" in b ? b.trechos : []));
    expect(new Set(trechos.flatMap((t) => ("marcas" in t ? (t.marcas ?? []) : [])))).toEqual(new Set(["negrito", "italico", "sobrescrito"]));
    expect(trechos.some((t) => "nota" in t)).toBe(true);
    expect(new Set(referencias.map((r) => r.tipo)).size).toBe(10);
    expect(imagens).toHaveLength(3);
    expect(abertura.blocos.map((b) => b.tipo)).toEqual(["capa", "folhaDeRosto", "paginaDeTitulo", "dedicatoria", "agradecimentos", "epigrafe", "resumo", "resumo", "resumo", "sumario"]);
    expect(abertura.blocos.flatMap((b) => (b.tipo === "resumo" ? [b.idioma] : []))).toEqual(["pt-BR", "en", "es"]);
  });

  it("abre no Apud do jeito que foi gravado", () => {
    const lido = lerArquivo(escreverArquivo(trabalho));
    if (!lido.ok) throw new Error(lido.erro);
    expect(lido.trabalho.documento.blocos).toEqual(trabalho.documento.blocos);
  });

  it.each(["abnt.txt", "apa.txt"])("monta o PDF em %s", (arquivo) => {
    const norma = carregarNorma(arquivo);
    const compilador = NodeCompiler.create({ workspace: process.cwd(), fontArgs: [{ fontPaths: ["public/fontes"] }] });
    mapearImagens(compilador, trabalho.documento);
    const r = compilador.compile({ mainFileContent: documentoParaTypst(trabalho.documento, norma.modelo, { csl: norma.csl }) });
    expect(r.result).toBeTruthy();
  });
});
