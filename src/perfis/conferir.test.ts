// Testes da conferência dos perfis: cada erro de escrita gera a mensagem
// certa, em português, apontando a linha.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ajustarParaTrabalho, regrasAjustaveis } from "./ajustes";
import { conferirPerfis, type Arquivo } from "./conferir";
import { aplicarPerfilNoCsl } from "./csl";
import { ESQUEMA_ABNT } from "./esquema-abnt";
import { formatarMensagem } from "./tipos";

const PASTA = join(import.meta.dirname, "..", "..", "perfis");
const ABNT = readFileSync(join(PASTA, "abnt.txt"), "utf8");
const APA = readFileSync(join(PASTA, "apa.txt"), "utf8");
const CSL_ABNT = readFileSync(join(PASTA, "estilos", "abnt.csl"), "utf8");
const ESTILOS: Arquivo[] = [
  { nome: "abnt.csl", conteudo: CSL_ABNT },
  { nome: "apa.csl", conteudo: readFileSync(join(PASTA, "estilos", "apa.csl"), "utf8") },
];

/** Troca uma linha do perfil ABNT (a que começa com `inicio`) e confere. */
function abntCom(inicio: string, novaLinha: string | null) {
  const linhas = ABNT.split("\n");
  const i = linhas.findIndex((l) => l.startsWith(inicio));
  if (i < 0) throw new Error(`linha não encontrada: ${inicio}`);
  if (novaLinha === null) linhas.splice(i, 1);
  else linhas[i] = novaLinha;
  const [r] = conferirPerfis([{ nome: "abnt.txt", conteudo: linhas.join("\n") }], ESTILOS);
  return { resultado: r, linha: i + 1, textos: r.mensagens.map(formatarMensagem) };
}

/** Confere um perfil personalizado montado sobre o ABNT original. */
function personalizado(texto: string) {
  const resultados = conferirPerfis(
    [
      { nome: "abnt.txt", conteudo: ABNT },
      { nome: "meu.txt", conteudo: texto },
    ],
    ESTILOS,
  );
  return resultados[1];
}

const FICHA = `perfil: ABNT – Universidade X
herda de: ABNT 2025, revisão 7
revisão: 1
data da revisão: 20/11/2026
nota da revisão: teste
`;

describe("perfis originais", () => {
  it("ABNT e APA estão certos, inclusive a ligação com os estilos CSL", () => {
    const resultados = conferirPerfis(
      [
        { nome: "abnt.txt", conteudo: ABNT },
        { nome: "apa.txt", conteudo: APA },
      ],
      ESTILOS,
    );
    for (const r of resultados) expect(r.mensagens.map(formatarMensagem)).toEqual([]);
    expect(resultados[0].perfil?.identificacao).toMatchObject({ perfil: "ABNT", versao: "2025", revisao: 7 });
    expect(resultados[1].perfil?.identificacao).toMatchObject({ perfil: "APA", versao: "7", revisao: 7 });
  });

  it("guarda os valores já entendidos", () => {
    const [r] = conferirPerfis([{ nome: "abnt.txt", conteudo: ABNT }]);
    const regras = r.perfil!.regras;
    expect(regras.get("recuo de parágrafo")?.valor).toEqual({ tipo: "medida", numero: 1.25, unidade: "cm" });
    expect(regras.get("entrelinhas")?.valor).toEqual({ tipo: "espacamento", numero: 1.5 });
    expect(regras.get("família da fonte")?.situacao).toEqual({ tipo: "faculdade" });
    expect(regras.get("impressão")?.situacao).toEqual({ tipo: "escolha", opcoes: ["só frente", "frente e verso"] });
    expect(regras.get("lombada")?.situacao).toEqual({ tipo: "desligada" });
    expect(regras.get("título nível 1, destaque")?.valor).toMatchObject({ maiusculas: true, negrito: true });
  });
});

describe("mensagens de erro", () => {
  it("recuo sem unidade", () => {
    const { textos, linha } = abntCom("recuo de parágrafo:", "recuo de parágrafo: 1,25 | NBR 14724:2024 | faculdade");
    expect(textos).toEqual([`linha ${linha}: falta a unidade em “recuo de parágrafo”: escreva 1,25 cm.`]);
  });

  it("recuo em outra unidade", () => {
    const { textos, linha } = abntCom("recuo de parágrafo:", "recuo de parágrafo: 12 mm | NBR 14724:2024 | faculdade");
    expect(textos).toEqual([
      `linha ${linha}: “recuo de parágrafo” precisa estar em cm (ex.: 1,25 cm), e não em mm.`,
    ]);
  });

  it("medida fora do razoável", () => {
    const { textos } = abntCom("margens, esquerda:", "margens, esquerda: 30 cm | NBR 14724:2024");
    expect(textos[0]).toMatch(/“margens, esquerda” precisa ficar entre 0,5 e 6 cm/);
  });

  it("regra com nome errado sugere o certo", () => {
    const { textos, linha } = abntCom("recuo de parágrafo:", "recuo do paragrafo: 1,25 cm | NBR 14724:2024");
    expect(textos).toContain(
      `linha ${linha}: não conheço a regra “recuo do paragrafo” na norma ABNT. Você quis dizer “recuo de parágrafo”?`,
    );
    // E a regra certa passa a faltar.
    expect(textos.some((t) => t.startsWith("falta a regra “recuo de parágrafo”"))).toBe(true);
  });

  it("regra repetida", () => {
    const linhas = ABNT.split("\n");
    linhas.push("entrelinhas: 1,5 | NBR 14724:2024");
    const [r] = conferirPerfis([{ nome: "abnt.txt", conteudo: linhas.join("\n") }]);
    const original = ABNT.split("\n").findIndex((l) => l.startsWith("entrelinhas:")) + 1;
    expect(r.mensagens.map(formatarMensagem)).toEqual([
      `linha ${linhas.length}: a regra “entrelinhas” já apareceu na linha ${original}. Cada regra aparece uma vez só.`,
    ]);
  });

  it("falta o dois-pontos", () => {
    const { textos, linha } = abntCom("entrelinhas:", "entrelinhas 1,5 | NBR 14724:2024");
    expect(textos[0]).toBe(
      `linha ${linha}: falta o sinal de dois-pontos entre o nome da regra e o valor. Exemplo: “margens, esquerda: 3 cm”.`,
    );
  });

  it("falta a norma de origem", () => {
    const { textos, linha } = abntCom("entrelinhas:", "entrelinhas: 1,5");
    expect(textos[0]).toBe(
      `linha ${linha}: falta a norma de origem. Depois do valor, escreva uma barra e a norma, como: “entrelinhas: 1,5 | NBR 14724:2024”.`,
    );
  });

  it("situação no lugar da origem", () => {
    const { textos, linha } = abntCom("lombada:", "lombada: opcional | desligada");
    expect(textos[0]).toBe(
      `linha ${linha}: falta a norma de origem antes da situação. Escreva assim: “lombada: opcional | (norma) | desligada”.`,
    );
  });

  it("situação desconhecida", () => {
    const { textos, linha } = abntCom("alinhamento:", "alinhamento: justificado | NBR 14724:2024 | universidade");
    expect(textos[0]).toBe(
      `linha ${linha}: “universidade” não é uma situação conhecida. Use “faculdade”, “desligada” ou “escolha: opção 1, opção 2”.`,
    );
  });

  it("valor fora das opções da escolha", () => {
    const { textos, linha } = abntCom(
      "referências, destaque do título:",
      "referências, destaque do título: negrito | NBR 6023:2025 | escolha: itálico, sublinhado",
    );
    expect(textos[0]).toBe(
      `linha ${linha}: o valor “negrito” não está entre as opções da escolha (“itálico” e “sublinhado”). O valor da linha é o padrão e precisa ser uma das opções.`,
    );
  });

  it("opção que o Apud não sabe aplicar, com sugestão", () => {
    const { textos, linha } = abntCom("alinhamento:", "alinhamento: justificdo | NBR 14724:2024 | faculdade");
    expect(textos[0]).toBe(
      `linha ${linha}: “justificdo” não é um valor aceito para “alinhamento”. Use “justificado” e “à esquerda”. Você quis dizer “justificado”?`,
    );
  });

  it("regra de valor único explica que mudar exige mudar o programa", () => {
    const { textos } = abntCom("papel:", "papel: Carta | NBR 14724:2024");
    expect(textos[0]).toMatch(/“papel” só aceita “A4”, que é como o Apud aplica esta regra/);
  });

  it("faixa invertida", () => {
    const { textos } = abntCom(
      "resumo, extensão em artigo:",
      "resumo, extensão em artigo: 250 a 100 palavras | NBR 6028:2021",
    );
    expect(textos[0]).toMatch(/o primeiro número \(250\) precisa ser menor que o segundo \(100\)/);
  });

  it("item desconhecido numa lista", () => {
    const { textos } = abntCom(
      "fonte menor, onde:",
      "fonte menor, onde: citações longas, nota de rodapé | NBR 14724:2024",
    );
    expect(textos[0]).toMatch(/não conheço o item “nota de rodapé” em “fonte menor, onde”. Você quis dizer “notas de rodapé”\?/);
  });

  it("aceita palavras digitadas sem acento e guarda a forma certa", () => {
    const { resultado } = abntCom(
      "margens, inverter no verso:",
      "margens, inverter no verso: nao | NBR 14724:2024",
    );
    expect(resultado.perfil?.regras.get("margens, inverter no verso")?.texto).toBe("não");
  });

  it("fonte menor maior que a do texto", () => {
    const { textos, linha } = abntCom("fonte menor:", "fonte menor: 12 pt | NBR 14724:2024");
    expect(textos).toEqual([
      `linha ${linha}: a fonte menor (12 pt) precisa ser menor que o tamanho da fonte do texto (12 pt).`,
    ]);
  });

  it("regra que falta no perfil original", () => {
    const { textos } = abntCom("entrelinhas:", null);
    expect(textos).toEqual([
      "falta a regra “entrelinhas” (seção “ABNT: página e texto”). Todas as regras precisam estar no perfil original.",
    ]);
  });

  it("ficha de identificação incompleta ou errada", () => {
    expect(abntCom("revisão:", null).textos).toEqual(["falta o campo “revisão” no começo do arquivo (ex.: revisão: 1)."]);
    const data = abntCom("data da revisão:", "data da revisão: 31/02/2026");
    expect(data.textos).toEqual([
      `linha ${data.linha}: a data da revisão precisa estar no formato dia/mês/ano, como “20/11/2026”.`,
    ]);
    const norma = abntCom("perfil:", "perfil: Vancouver");
    expect(norma.textos[0]).toMatch(/não conheço a norma “Vancouver”. O Apud conhece “ABNT” e “APA”/);
  });

  it("arquivo salvo fora do UTF-8", () => {
    const [r] = conferirPerfis([{ nome: "abnt.txt", conteudo: ABNT.replace("Times New Roman", "Times New Rom�n") }]);
    expect(r.mensagens[0].texto).toMatch(/não está salvo em UTF-8/);
    expect(r.perfil).toBeUndefined();
  });

  it("aceita o arquivo com quebras de linha do Windows e marca de UTF-8", () => {
    const [r] = conferirPerfis([{ nome: "abnt.txt", conteudo: "﻿" + ABNT.replace(/\n/g, "\r\n") }]);
    expect(r.mensagens).toEqual([]);
  });

  it("perfil com erro nunca é devolvido para uso", () => {
    expect(abntCom("entrelinhas:", "entrelinhas: 1,5").resultado.perfil).toBeUndefined();
  });
});

describe("perfis personalizados (herança)", () => {
  it("guarda só as diferenças e herda o resto", () => {
    const r = personalizado(FICHA + "família da fonte: Arial | Manual da Universidade X\n");
    expect(r.mensagens).toEqual([]);
    const regras = r.perfil!.regras;
    expect(regras.get("família da fonte")).toMatchObject({ texto: "Arial", arquivo: "meu.txt" });
    expect(regras.get("família da fonte")?.situacao).toEqual({ tipo: "faculdade" });
    expect(regras.get("entrelinhas")).toMatchObject({ texto: "1,5", arquivo: "abnt.txt" });
    expect(regras.size).toBe(ESQUEMA_ABNT.regras.length);
    expect(r.perfil!.identificacao).toMatchObject({
      perfil: "ABNT – Universidade X",
      norma: "ABNT",
      versao: "2025",
      herdaDe: { perfil: "ABNT", versao: "2025", revisao: 7 },
    });
  });

  it("valor fora da escolha do original", () => {
    const r = personalizado(FICHA + "referências, prenomes: sem prenome | Manual da Universidade X\n");
    expect(r.mensagens.map(formatarMensagem)).toEqual([
      "linha 6: “sem prenome” não é um valor aceito para “referências, prenomes”. Use “por extenso” e “abreviados”.",
    ]);
  });

  it("avisa quando o original mudou de revisão", () => {
    const r = personalizado(FICHA.replace("revisão 7", "revisão 6"));
    expect(r.perfil).toBeDefined();
    expect(r.mensagens.map(formatarMensagem)).toEqual([
      "aviso, linha 2: este perfil foi feito sobre a revisão 6 de ABNT 2025, e o original está na revisão 7 " +
        "(“Fase 3: citação longa, notas de rodapé, figuras e tabelas no PDF. Novas regras para o espaço antes e depois da citação longa, das ilustrações e das tabelas, a posição da ilustração na página e o desenho e o espaçamento das tabelas.”). " +
        "Confira se as suas mudanças continuam valendo e depois atualize o número em “herda de”.",
    ]);
  });

  it("original que não existe", () => {
    const r = personalizado(FICHA.replace("ABNT 2025", "ABNT 2030"));
    expect(r.mensagens.map(formatarMensagem)).toEqual([
      "linha 2: não achei o perfil “ABNT 2030” na pasta de perfis. Perfis disponíveis: “ABNT 2025”.",
    ]);
  });

  it("nome igual ao original e versão própria são recusados", () => {
    const r = personalizado(FICHA.replace("ABNT – Universidade X", "ABNT") + "versão: 2026\n");
    const textos = r.mensagens.map(formatarMensagem);
    expect(textos).toContain(
      "linha 6: um perfil que herda de outro não tem “versão”: ela vem do original, no campo “herda de”.",
    );
    expect(textos).toContain(
      "linha 1: dê ao perfil personalizado um nome diferente do original, como “ABNT – Universidade X”.",
    );
  });
});

describe("ligação com o estilo CSL", () => {
  const [r] = conferirPerfis([{ nome: "abnt.txt", conteudo: ABNT }], ESTILOS);
  const perfil = r.perfil!;

  it("com os valores padrão, o CSL fica como está", () => {
    expect(aplicarPerfilNoCsl(CSL_ABNT, perfil, ESQUEMA_ABNT)).toBe(CSL_ABNT);
  });

  it("as escolhas do trabalho mudam o CSL", () => {
    const { perfil: ajustado } = ajustarParaTrabalho(perfil, ESQUEMA_ABNT, {
      "referências, prenomes": "abreviados",
      "autores, quatro ou mais": "primeiro com et al.",
      "referências, destaque do título": "itálico",
    });
    const csl = aplicarPerfilNoCsl(CSL_ABNT, ajustado!, ESQUEMA_ABNT);
    expect(csl).not.toContain('initialize="false"');
    expect(csl).toMatch(/<bibliography et-al-min="4" et-al-use-first="1">/);
    expect(csl).toContain('<text variable="title" font-style="italic"/>');
    expect(csl).not.toContain('<text variable="title" font-weight="bold"/>');
  });

  it("termos do perfil entram no CSL", () => {
    const linhas = ABNT.replace(
      /referências, sem local: \[S\. l\.\]/,
      "referências, sem local: [Sem local]",
    ).replace(/meses: jan\./, "meses: janeiro");
    const [mudado] = conferirPerfis([{ nome: "abnt.txt", conteudo: linhas }], ESTILOS);
    const csl = aplicarPerfilNoCsl(CSL_ABNT, mudado.perfil!, ESQUEMA_ABNT);
    expect(csl).toContain('<text value="[Sem local]" font-style="italic"/>');
    expect(csl).toContain('<term name="month-01" form="short">janeiro</term>');
  });

  it("modelo diferente do CSL gera aviso, não erro", () => {
    const linhas = ABNT.replace("modelo, livro: SOBRENOME, Prenome.", "modelo, livro: SOBRENOME, P.");
    const [mudado] = conferirPerfis([{ nome: "abnt.txt", conteudo: linhas }], ESTILOS);
    expect(mudado.perfil).toBeDefined();
    expect(mudado.mensagens).toHaveLength(1);
    expect(mudado.mensagens[0].gravidade).toBe("aviso");
    expect(mudado.mensagens[0].texto).toMatch(/o modelo mudou, mas quem monta a referência é o estilo abnt.csl/);
  });

  it("marca no CSL sem regra correspondente é erro", () => {
    const estilos = [{ nome: "abnt.csl", conteudo: CSL_ABNT.replace("<!-- apud: meses -->", "<!-- apud: mêses -->") }];
    const [mudado] = conferirPerfis([{ nome: "abnt.txt", conteudo: ABNT }], estilos);
    const textos = mudado.mensagens.map(formatarMensagem);
    expect(textos).toContain("o estilo abnt.csl tem a marca “apud: mêses”, mas essa regra não comanda o CSL.");
    expect(textos.some((t) => t.includes("a regra “meses” deveria comandar o estilo abnt.csl"))).toBe(true);
  });
});

describe("ajustes do trabalho", () => {
  const [r] = conferirPerfis([{ nome: "abnt.txt", conteudo: ABNT }]);
  const perfil = r.perfil!;

  it("lista só as regras de faculdade e de escolha", () => {
    const chaves = regrasAjustaveis(perfil).map((x) => x.chave);
    expect(chaves).toContain("família da fonte");
    expect(chaves).toContain("referências, prenomes");
    expect(chaves).not.toContain("entrelinhas");
  });

  it("aceita trocar o que depende da faculdade", () => {
    const { perfil: ajustado, mensagens } = ajustarParaTrabalho(perfil, ESQUEMA_ABNT, { "recuo de parágrafo": "1,5 cm" });
    expect(mensagens).toEqual([]);
    expect(ajustado!.regras.get("recuo de parágrafo")?.texto).toBe("1,5 cm");
  });

  it("recusa trocar regra fixa e opção fora da escolha", () => {
    const { perfil: ajustado, mensagens } = ajustarParaTrabalho(perfil, ESQUEMA_ABNT, {
      entrelinhas: "duplo",
      "impressão": "só verso",
    });
    expect(ajustado).toBeUndefined();
    expect(mensagens.map((m) => m.texto)).toEqual([
      "“entrelinhas”: essa regra é fixa na norma e não pode ser trocada nas configurações do trabalho.",
      "“impressão”: “só verso” não é um valor aceito para “impressão”. Use “só frente” e “frente e verso”.",
    ]);
  });
});
