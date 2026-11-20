// Confere que os perfis cobrem cada linha do checklist de regras aprovado em
// 20/11/2026, com a situação certa, e na ordem do checklist.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { conferirPerfis } from "./conferir";
import type { EsquemaNorma } from "./esquema";
import { ESQUEMA_ABNT } from "./esquema-abnt";
import { ESQUEMA_APA } from "./esquema-apa";

/** As linhas do checklist, por seção, e a situação marcada em cada uma. */
type Situacao = "confirmada" | "escolha" | "faculdade" | "fora";
const CHECKLIST: Record<string, Array<[linha: string, situacao: Situacao]>> = {
  "ABNT: página e texto": [
    ["Papel", "confirmada"],
    ["Margens", "confirmada"],
    ["Impressão", "escolha"],
    ["Tamanho da fonte", "confirmada"],
    ["Família da fonte", "faculdade"],
    ["Fonte menor", "confirmada"],
    ["Entrelinhas", "confirmada"],
    ["Espaço simples", "confirmada"],
    ["Alinhamento", "faculdade"],
    ["Recuo de parágrafo", "faculdade"],
    ["Numeração de página", "faculdade"],
    ["Página no verso", "faculdade"],
    ["Seção primária", "confirmada"],
    ["Ficha catalográfica", "fora"],
    ["Notas de rodapé", "confirmada"],
    ["Numeração das notas", "confirmada"],
    ["Ilustração: título", "confirmada"],
    ["Ilustração: fonte", "confirmada"],
    ["Tabelas", "confirmada"],
    ["Siglas", "fora"],
    ["Equações", "fora"],
  ],
  "ABNT: estrutura do trabalho": [
    ["Capa", "confirmada"],
    ["Lombada", "fora"],
    ["Folha de rosto", "confirmada"],
    ["Ficha catalográfica", "fora"],
    ["Errata", "fora"],
    ["Folha de aprovação", "fora"],
    ["Dedicatória", "confirmada"],
    ["Agradecimentos", "confirmada"],
    ["Epígrafe", "confirmada"],
    ["Resumo", "confirmada"],
    ["Resumo em língua estrangeira", "confirmada"],
    ["Listas de ilustrações, tabelas, siglas e símbolos", "fora"],
    ["Sumário", "confirmada"],
    ["Introdução, desenvolvimento e conclusão", "confirmada"],
    ["Referências", "confirmada"],
    ["Glossário", "fora"],
    ["Apêndice", "fora"],
    ["Anexo", "fora"],
    ["Índice", "fora"],
  ],
  "ABNT: resumo e sumário": [
    ["Extensão do resumo", "confirmada"],
    ["Forma do resumo", "confirmada"],
    ["Espaçamento do resumo", "faculdade"],
    ["Palavras-chave", "confirmada"],
    ["Sumário", "confirmada"],
  ],
  "ABNT: títulos e numeração": [
    ["Números", "confirmada"],
    ["Número e título", "confirmada"],
    ["Espaço em volta do título", "confirmada"],
    ["Título em mais de uma linha", "confirmada"],
    ["Destaque por nível", "faculdade"],
    ["Títulos sem número", "confirmada"],
    ["Sem título nem número", "confirmada"],
    ["Listas viram alíneas", "confirmada"],
    ["Pontuação das alíneas", "confirmada"],
    ["Sub-alíneas", "confirmada"],
  ],
  "ABNT: citações": [
    ["Autor na chamada", "confirmada"],
    ["Instituição como autor", "confirmada"],
    ["Órgão de governo", "confirmada"],
    ["Página", "confirmada"],
    ["Fonte sem página", "confirmada"],
    ["Citação direta curta", "confirmada"],
    ["Citação direta longa", "confirmada"],
    ["Ponto final", "confirmada"],
    ["Supressão e acréscimo", "confirmada"],
    ["Destaque seu", "escolha"],
    ["Tradução sua", "escolha"],
    ["Dois ou três autores", "confirmada"],
    ["Quatro ou mais autores", "escolha"],
    ["Mesmo sobrenome e ano", "confirmada"],
    ["Mesmo autor e ano", "confirmada"],
    ["Mesmo autor, anos diferentes", "confirmada"],
    ["Várias obras juntas", "confirmada"],
    ["Obra sem autor", "confirmada"],
    ["Citação de citação", "confirmada"],
    ["Entrevistas e falas", "confirmada"],
    ["Expressões latinas", "fora"],
    ["Sistema numérico", "fora"],
  ],
  "ABNT: referências": [
    ["Lista", "confirmada"],
    ["Ordem", "confirmada"],
    ["Autor", "confirmada"],
    ["Prenomes", "escolha"],
    ["Até três autores", "confirmada"],
    // A escolha mora na linha "autores, quatro ou mais", na seção de citações.
    ["Quatro ou mais autores", "confirmada"],
    ["Destaque do título", "escolha"],
    ["Obra sem autor", "confirmada"],
    ["Expressões", "confirmada"],
    ["Sem local ou editora", "confirmada"],
    ["Data incerta", "confirmada"],
    ["Livro", "confirmada"],
    ["Capítulo", "confirmada"],
    ["Artigo", "confirmada"],
    ["Artigo sem página", "confirmada"],
    ["ISSN", "confirmada"],
    ["Documento online", "confirmada"],
    ["Meses", "confirmada"],
  ],
  "APA 7: página, estrutura e títulos": [
    ["Margens", "confirmada"],
    ["Fonte", "escolha"],
    ["Entrelinhas", "confirmada"],
    ["Alinhamento", "confirmada"],
    ["Recuo de parágrafo", "confirmada"],
    ["Número de página", "confirmada"],
    ["Cabeçalho com título curto", "escolha"],
    ["Página de título (estudante)", "confirmada"],
    ["Página de título (profissional)", "confirmada"],
    ["Resumo", "escolha"],
    ["Ordem das partes", "confirmada"],
    ["Rótulos de seção", "confirmada"],
    ["Início do texto", "confirmada"],
    ["Títulos: nível 1", "confirmada"],
    ["Títulos: nível 2", "confirmada"],
    ["Títulos: nível 3", "confirmada"],
    ["Títulos: nível 4", "confirmada"],
    ["Títulos: nível 5", "confirmada"],
    ["Títulos em geral", "faculdade"],
    ["Tabelas e figuras", "confirmada"],
    ["Espaço dentro da tabela", "confirmada"],
  ],
  "APA 7: citações e referências": [
    ["Chamada", "confirmada"],
    ["Dois autores", "confirmada"],
    ["Três ou mais autores", "confirmada"],
    ["Duas obras que ficam iguais com et al.", "confirmada"],
    ["Citação curta", "confirmada"],
    ["Citação em bloco", "confirmada"],
    ["Comunicação pessoal", "confirmada"],
    ["Falas de participantes", "confirmada"],
    ["Título da lista", "confirmada"],
    ["Forma da lista", "confirmada"],
    ["Ordem", "confirmada"],
    ["Autor", "confirmada"],
    ["Quantos autores", "confirmada"],
    ["Título da obra", "confirmada"],
    ["Artigo", "confirmada"],
    ["Livro", "confirmada"],
  ],
};

const PASTA = join(import.meta.dirname, "..", "..", "perfis");
const ler = (nome: string) => ({ nome, conteudo: readFileSync(join(PASTA, nome), "utf8") });
const [abnt, apa] = conferirPerfis([ler("abnt.txt"), ler("apa.txt")]);

function conferirCobertura(esquema: EsquemaNorma, resultado: typeof abnt) {
  const perfil = resultado.perfil!;
  const secoes = Object.entries(CHECKLIST).filter(([s]) => s.startsWith(esquema.norma));

  for (const [secao, linhas] of secoes) {
    for (const [linha, situacao] of linhas) {
      const regras = esquema.regras.filter((r) => r.secao === secao && r.checklist.includes(linha));
      expect(regras.length, `${secao} / ${linha}: nenhuma regra cobre esta linha`).toBeGreaterThan(0);
      const situacoes = regras.map((r) => perfil.regras.get(r.chave)!.situacao.tipo);

      if (situacao === "fora") {
        expect(situacoes.every((s) => s === "desligada"), `${secao} / ${linha} deveria estar desligada`).toBe(true);
      } else {
        expect(situacoes.includes("desligada"), `${secao} / ${linha} não pode estar desligada`).toBe(false);
      }
      if (situacao === "faculdade") {
        expect(situacoes, `${secao} / ${linha} deveria ter uma regra “faculdade”`).toContain("faculdade");
      }
      if (situacao === "escolha") {
        // A escolha pode morar em outra seção (como "autores, quatro ou mais").
        const qualquer = esquema.regras.filter((r) => r.checklist.includes(linha));
        const tipos = qualquer.map((r) => perfil.regras.get(r.chave)!.situacao.tipo);
        expect(tipos, `${secao} / ${linha} deveria ter uma regra “escolha”`).toContain("escolha");
      }
    }
  }

  // Toda regra do esquema que diz cobrir uma linha cobre uma linha que existe.
  for (const regra of esquema.regras) {
    for (const linha of regra.checklist) {
      const existe = CHECKLIST[regra.secao]?.some(([l]) => l === linha);
      expect(existe, `a regra “${regra.chave}” aponta para “${linha}”, que não está no checklist`).toBe(true);
    }
  }
}

describe("cobertura do checklist", () => {
  it("os dois perfis originais não têm erros", () => {
    expect(abnt.mensagens).toEqual([]);
    expect(apa.mensagens).toEqual([]);
  });

  it("ABNT cobre cada linha do checklist, com a situação aprovada", () => {
    conferirCobertura(ESQUEMA_ABNT, abnt);
  });

  it("APA cobre cada linha do checklist, com a situação aprovada", () => {
    conferirCobertura(ESQUEMA_APA, apa);
  });

  it("as regras estão no arquivo na ordem do checklist", () => {
    for (const r of [abnt, apa]) {
      const linhas = [...r.perfil!.regras.values()].map((regra) => regra.linha);
      expect(linhas).toEqual([...linhas].sort((a, b) => a - b));
    }
  });

  it("toda regra tem a norma de origem", () => {
    for (const r of [abnt, apa]) {
      for (const regra of r.perfil!.regras.values()) expect(regra.origem.length).toBeGreaterThan(3);
    }
  });
});
