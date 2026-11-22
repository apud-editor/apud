import { describe, expect, it } from "vitest";
import { arquivosDasImagens, caminhoDaImagem, deBase64, larguraPadrao, pontoDaCitacaoLonga } from "./elementos";
import { documentoVazio, type Citacao, type Imagem, type Trecho } from "../documento/modelo";

const c: Citacao = { tipo: "parenteses", direta: true, obras: [{ referencia: "silva2019", localizador: { tipo: "pagina", valor: "15" } }] };
const cit: Trecho = { citacao: c };

describe("ponto final da citação longa: vale a norma", () => {
  it("ABNT: o ponto escrito antes da chamada vai para depois dela", () => {
    expect(pontoDaCitacaoLonga([{ texto: "na semana seguinte. " }, cit], "depois")).toEqual([{ texto: "na semana seguinte " }, cit, { texto: "." }]);
  });

  it("ABNT: sem espaço antes da chamada, o Apud põe um", () => {
    expect(pontoDaCitacaoLonga([{ texto: "seguinte." }, cit], "depois")).toEqual([{ texto: "seguinte " }, cit, { texto: "." }]);
  });

  it("ABNT: ponto antes e depois vira um ponto só, depois", () => {
    expect(pontoDaCitacaoLonga([{ texto: "seguinte. " }, cit, { texto: "." }], "depois")).toEqual([{ texto: "seguinte " }, cit, { texto: "." }]);
  });

  it("ABNT: já escrito certo, fica igual", () => {
    const certo = [{ texto: "seguinte " }, cit, { texto: "." }];
    expect(pontoDaCitacaoLonga(certo, "depois")).toEqual(certo);
  });

  it("APA: o ponto escrito depois da chamada vai para antes dela, e nada fica depois", () => {
    expect(pontoDaCitacaoLonga([{ texto: "na semana seguinte " }, cit, { texto: "." }], "antes")).toEqual([{ texto: "na semana seguinte. " }, cit]);
  });

  it("APA: ponto antes e depois vira um ponto só, antes", () => {
    expect(pontoDaCitacaoLonga([{ texto: "seguinte. " }, cit, { texto: "." }], "antes")).toEqual([{ texto: "seguinte. " }, cit]);
  });

  it("APA: já escrito certo, fica igual", () => {
    const certo = [{ texto: "seguinte. " }, cit];
    expect(pontoDaCitacaoLonga(certo, "antes")).toEqual(certo);
  });

  it("vai e volta: ABNT → APA → ABNT dá o mesmo texto", () => {
    const abnt = [{ texto: "Texto " }, { texto: "em itálico", marcas: ["italico" as const] }, { texto: " no fim " }, cit, { texto: "." }];
    const apa = pontoDaCitacaoLonga(abnt, "antes");
    expect(apa).toEqual([{ texto: "Texto " }, { texto: "em itálico", marcas: ["italico"] }, { texto: " no fim. " }, cit]);
    expect(pontoDaCitacaoLonga(apa, "depois")).toEqual(abnt);
  });

  it("o ponto de um trecho em itálico também muda, sem perder o itálico", () => {
    expect(pontoDaCitacaoLonga([{ texto: "termina em itálico.", marcas: ["italico"] }, { texto: " " }, cit], "depois")).toEqual([
      { texto: "termina em itálico ", marcas: ["italico"] },
      cit,
      { texto: "." },
    ]);
  });

  it("reticências, ? e ! ficam como estão", () => {
    for (const fim of ["[...]", "assim...", "será?", "basta!"]) {
      const t = [{ texto: `${fim} ` }, cit];
      expect(pontoDaCitacaoLonga(t, "depois")).toEqual(t);
    }
    const pergunta = [{ texto: "será? " }, cit, { texto: "." }];
    expect(pontoDaCitacaoLonga(pergunta, "antes")).toEqual([{ texto: "será? " }, cit]);
  });

  it("citação longa que não termina com a chamada, ou sem chamada, fica igual", () => {
    const meio = [{ texto: "Segundo " }, cit, { texto: ", o texto continua." }];
    expect(pontoDaCitacaoLonga(meio, "depois")).toEqual(meio);
    expect(pontoDaCitacaoLonga(meio, "antes")).toEqual(meio);
    expect(pontoDaCitacaoLonga([{ texto: "Sem chamada." }], "depois")).toEqual([{ texto: "Sem chamada." }]);
    expect(pontoDaCitacaoLonga([cit, { texto: "." }], "antes")).toEqual([cit, { texto: "." }]);
  });

  it("uma nota entre o texto e a chamada deixa tudo como está", () => {
    const t: Trecho[] = [{ texto: "fim." }, { nota: { trechos: [{ texto: "n" }] } }, cit];
    expect(pontoDaCitacaoLonga(t, "depois")).toEqual(t);
  });

  it("sem regra no perfil, nada muda", () => {
    const t = [{ texto: "fim. " }, cit];
    expect(pontoDaCitacaoLonga(t, undefined)).toBe(t);
  });
});

describe("imagens das figuras", () => {
  const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGP4z8DAwPAfAAcAAf9+CLHQAAAAAElFTkSuQmCC";
  const imagem = (id: string, extra: Partial<Imagem> = {}): Imagem => ({ id, formato: "png", dados: PNG, ...extra });

  it("o caminho tem a posição, o código sem sinais e a extensão", () => {
    expect(caminhoDaImagem(imagem("ab/c d"), 2)).toBe("/imagens/2-ab_c_d.png");
    expect(caminhoDaImagem(imagem("x", { formato: "jpeg" }), 0)).toBe("/imagens/0-x.jpg");
  });

  it("só vão para o motor as imagens que alguma figura usa, com os bytes certos", () => {
    const doc = {
      ...documentoVazio(),
      imagens: [imagem("usada"), imagem("solta")],
      blocos: [{ tipo: "figura" as const, imagem: "usada", titulo: [], fonte: [] }],
    };
    const arquivos = arquivosDasImagens(doc);
    expect(arquivos.map((a) => a.caminho)).toEqual(["/imagens/0-usada.png"]);
    expect(Buffer.from(arquivos[0].dados).toString("base64")).toBe(PNG);
    expect([...deBase64(PNG).slice(1, 4)].map((b) => String.fromCharCode(b)).join("")).toBe("PNG");
  });

  it("largura padrão: o tamanho natural a 96 pontos por polegada, sem passar do texto", () => {
    // 302 px = 8 cm; num texto de 16 cm, metade da largura.
    expect(larguraPadrao(imagem("a", { largura: 302 }), 16)).toBe(49.9);
    expect(larguraPadrao(imagem("a", { largura: 4000 }), 16)).toBe(100);
    expect(larguraPadrao(imagem("a", { largura: 10 }), 16)).toBe(10);
    expect(larguraPadrao(imagem("a"), 16)).toBe(100);
    expect(larguraPadrao(undefined, 16)).toBe(100);
  });
});
