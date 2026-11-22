// Conversão entre o modelo do Apud (modelo.ts) e o formato interno do editor TipTap.
//
// Regra principal: nenhum texto pode se perder. Se o editor tiver algo que o
// modelo não conhece, o texto vira parágrafo comum em vez de sumir.
//
// O editor só cuida dos blocos do texto. As referências do trabalho não passam
// por ele: quem guarda e grava o documento inteiro é a tela do trabalho. Assim,
// nada que o editor faça pode apagar uma referência.
//
// Cada citação é um nó "citacao" do editor, que não se divide (o cursor pula
// por cima dele), com os dados da citação guardados como estão no modelo. A
// nota de rodapé é parecida: um nó "notaDeRodape" no ponto do número, com o
// texto da nota guardado nele.
//
// Figura e tabela (fase 3) são um nó com partes: o título, a imagem ou a
// grade, a fonte e a nota, na mesma ordem em que saem no PDF. Assim, as
// citações da fonte ficam na ordem certa do texto.
//
// Os dados do trabalho, a abertura (capa, resumos...) e as imagens não passam
// pelo editor, como as referências: quem os guarda é a tela do trabalho.

import type { JSONContent } from "@tiptap/core";
import {
  ehCitacao,
  ehNota,
  ESPECIES_DE_ILUSTRACAO,
  ORDEM_DAS_MARCAS,
  type Bloco,
  type Citacao,
  type Identificacao,
  type ItemDeLista,
  type Marca,
  type NivelDeTitulo,
  type NotaDeRodape,
  type Trecho,
} from "./modelo";

/** Nome do nó das citações no editor (extensão em editor/extensoes.ts). */
export const NO_DA_CITACAO = "citacao";
/** Nome do nó da lista de referências no editor. */
export const NO_DA_LISTA_DE_REFERENCIAS = "listaDeReferencias";
/** Nomes dos nós da fase 3 no editor (editor/nos.ts). */
export const NO_DA_CITACAO_LONGA = "citacaoLonga";
export const NO_DA_NOTA = "notaDeRodape";
export const NO_DA_FIGURA = "figura";
export const NO_DA_TABELA = "tabela";
export const NO_DO_TITULO_DA_ILUSTRACAO = "tituloDaIlustracao";
export const NO_DA_FONTE_DA_ILUSTRACAO = "fonteDaIlustracao";
export const NO_DA_NOTA_DA_ILUSTRACAO = "notaDaIlustracao";

const MARCA_DO_EDITOR: Record<Marca, string> = {
  negrito: "bold",
  italico: "italic",
  sobrescrito: "superscript",
};
const MARCA_DO_APUD: Record<string, Marca> = {
  bold: "negrito",
  italic: "italico",
  superscript: "sobrescrito",
};

// ---------------------------------------------------------------------------
// Do editor para o Apud

/** Converte o conteúdo do editor nos blocos do texto do Apud. */
export function blocosDoEditor(json: JSONContent): Bloco[] {
  const blocos: Bloco[] = [];
  for (const no of json.content ?? []) blocos.push(...blocosDoNo(no));
  if (blocos.length === 0) blocos.push({ tipo: "paragrafo", trechos: [] });
  return blocos;
}

function blocosDoNo(no: JSONContent): Bloco[] {
  switch (no.type) {
    case "paragraph":
      return [{ tipo: "paragrafo", trechos: trechosDe(no) }];
    case "heading":
      return [{ tipo: "titulo", nivel: nivelValido(no.attrs?.level), trechos: trechosDe(no) }];
    case "quebraDePagina":
      return [{ tipo: "quebra" }];
    case NO_DA_LISTA_DE_REFERENCIAS:
      return [{ tipo: "referencias" }];
    case NO_DA_CITACAO_LONGA:
      return [{ tipo: "citacaoLonga", trechos: trechosDe(no) }];
    case NO_DA_FIGURA: {
      const especie = ESPECIES_DE_ILUSTRACAO.find((e) => e !== "figura" && e === no.attrs?.especie) as "grafico" | "quadro" | undefined;
      const largura = Number(no.attrs?.largura);
      return [
        {
          tipo: "figura",
          imagem: String(no.attrs?.imagem ?? ""),
          ...(especie ? { especie } : {}),
          ...(Number.isFinite(largura) && largura >= 10 && largura < 100 ? { largura } : {}),
          ...identificacaoDe(no),
        },
      ];
    }
    case NO_DA_TABELA: {
      const grade = no.content?.find((f) => f.type === "table");
      const { linhas, cabecalho } = gradeDe(grade);
      return [{ tipo: "tabela", linhas, cabecalho, ...identificacaoDe(no) }];
    }
    case "bulletList":
    case "orderedList":
      return [{ tipo: "lista", sequencia: no.type === "orderedList", itens: itensDe(no) }];
    default: {
      // Algo que o modelo não conhece: guarda o texto como parágrafo.
      const trechos = trechosDe(no);
      return trechos.length ? [{ tipo: "paragrafo", trechos }] : [];
    }
  }
}

/** Título, fonte e nota de uma figura ou tabela. */
function identificacaoDe(no: JSONContent): Identificacao {
  const parte = (tipo: string) => no.content?.find((f) => f.type === tipo);
  const nota = parte(NO_DA_NOTA_DA_ILUSTRACAO);
  const trechosDaNota = nota ? trechosDe(nota) : [];
  return {
    titulo: trechosDe(parte(NO_DO_TITULO_DA_ILUSTRACAO) ?? {}),
    fonte: trechosDe(parte(NO_DA_FONTE_DA_ILUSTRACAO) ?? {}),
    ...(no.attrs?.fontePropria ? { fontePropria: true as const } : {}),
    ...(trechosDaNota.length ? { nota: trechosDaNota } : {}),
  };
}

/**
 * As células da grade do editor. Uma linha é cabeçalho quando todas as
 * células dela são de cabeçalho; contam só as primeiras linhas. A grade sai
 * sempre retangular: células juntadas (que a versão 1 não faz) guardam o
 * texto e ganham células vazias ao lado, para nada se perder nem desalinhar.
 */
function gradeDe(grade: JSONContent | undefined): { linhas: Trecho[][][]; cabecalho: number } {
  const linhas: Trecho[][][] = [];
  let cabecalho = 0;
  let noCabecalho = true;
  for (const linha of grade?.content ?? []) {
    const celulas = (linha.content ?? []).filter((c) => c.type === "tableCell" || c.type === "tableHeader");
    if (!celulas.length) continue;
    const saida: Trecho[][] = [];
    for (const c of celulas) {
      saida.push(textoDaCelula(c));
      const juntas = Math.max(1, Math.floor(Number(c.attrs?.colspan) || 1));
      for (let i = 1; i < juntas; i++) saida.push([]);
    }
    linhas.push(saida);
    if (noCabecalho && celulas.every((c) => c.type === "tableHeader")) cabecalho++;
    else noCabecalho = false;
  }
  if (!linhas.length) return { linhas: [[[]]], cabecalho: 0 };
  const largura = Math.max(...linhas.map((l) => l.length));
  for (const l of linhas) while (l.length < largura) l.push([]);
  return { linhas, cabecalho };
}

/** Uma célula com mais de um parágrafo vira um texto só, com espaço entre eles. */
function textoDaCelula(c: JSONContent): Trecho[] {
  const partes = (c.content ?? []).map((p) => trechosDe(p)).filter((p) => p.length);
  return normalizar(partes.flatMap((p, i) => (i ? [{ texto: " " }, ...p] : p)));
}

function nivelValido(n: unknown): NivelDeTitulo {
  const v = Number(n);
  return (v >= 1 && v <= 5 ? Math.round(v) : 1) as NivelDeTitulo;
}

function itensDe(lista: JSONContent): ItemDeLista[] {
  const itens: ItemDeLista[] = [];
  for (const filho of lista.content ?? []) {
    const item: ItemDeLista = { trechos: [] };
    const partes: Trecho[][] = [];
    for (const parte of filho.content ?? []) {
      if (parte.type === "bulletList" || parte.type === "orderedList") {
        item.subitens = [...(item.subitens ?? []), ...itensDe(parte)];
      } else {
        partes.push(trechosDe(parte));
      }
    }
    // Um item com mais de um parágrafo (pode vir de uma colagem): junta com espaço.
    item.trechos = normalizar(partes.filter((p) => p.length).flatMap((p, i) => (i ? [{ texto: " " }, ...p] : p)));
    itens.push(item);
  }
  return itens;
}

/** Junta todo o texto de um nó (e dos nós dentro dele), com as marcas. */
function trechosDe(no: JSONContent): Trecho[] {
  const trechos: Trecho[] = [];
  const visitar = (n: JSONContent) => {
    if (n.type === "text" && n.text) {
      const marcas = ORDEM_DAS_MARCAS.filter((m) => n.marks?.some((x) => MARCA_DO_APUD[x.type] === m));
      trechos.push(marcas.length ? { texto: n.text, marcas } : { texto: n.text });
    } else if (n.type === "hardBreak") {
      trechos.push({ texto: " " });
    } else if (n.type === NO_DA_CITACAO && n.attrs?.dados) {
      trechos.push({ citacao: structuredClone(n.attrs.dados as Citacao) });
    } else if (n.type === NO_DA_NOTA && n.attrs?.dados) {
      trechos.push({ nota: structuredClone(n.attrs.dados as NotaDeRodape) });
    }
    n.content?.forEach(visitar);
  };
  no.content?.forEach(visitar);
  return normalizar(trechos);
}

/** Junta trechos de texto vizinhos com as mesmas marcas e tira os vazios. As citações e as notas ficam como estão. */
export function normalizar(trechos: Trecho[]): Trecho[] {
  const saida: Trecho[] = [];
  for (const t of trechos) {
    if (ehCitacao(t) || ehNota(t)) {
      saida.push(t);
      continue;
    }
    if (!t.texto) continue;
    const ultimo = saida[saida.length - 1];
    if (ultimo && "texto" in ultimo && (ultimo.marcas ?? []).join() === (t.marcas ?? []).join()) ultimo.texto += t.texto;
    else saida.push(t.marcas?.length ? { texto: t.texto, marcas: [...t.marcas] } : { texto: t.texto });
  }
  return saida;
}

// ---------------------------------------------------------------------------
// Do Apud para o editor

/** Converte os blocos do texto no conteúdo que o editor abre. */
export function editorDosBlocos(blocos: Bloco[]): JSONContent {
  const content = blocos.map(noDoBloco);
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

function noDoBloco(b: Bloco): JSONContent {
  switch (b.tipo) {
    case "paragrafo":
      return comTexto({ type: "paragraph" }, b.trechos);
    case "titulo":
      return comTexto({ type: "heading", attrs: { level: b.nivel } }, b.trechos);
    case "quebra":
      return { type: "quebraDePagina" };
    case "referencias":
      return { type: NO_DA_LISTA_DE_REFERENCIAS };
    case "lista":
      return noDaLista(b.itens, b.sequencia);
    case "citacaoLonga":
      return comTexto({ type: NO_DA_CITACAO_LONGA }, b.trechos);
    case "figura":
      return {
        type: NO_DA_FIGURA,
        attrs: { imagem: b.imagem, especie: b.especie ?? null, largura: b.largura ?? null, fontePropria: !!b.fontePropria },
        content: partesDaIdentificacao(b),
      };
    case "tabela": {
      const [titulo, ...resto] = partesDaIdentificacao(b);
      const grade: JSONContent = {
        type: "table",
        content: b.linhas.map((linha, i) => ({
          type: "tableRow",
          content: linha.map((celula) => ({
            type: i < b.cabecalho ? "tableHeader" : "tableCell",
            content: [comTexto({ type: "paragraph" }, celula)],
          })),
        })),
      };
      return { type: NO_DA_TABELA, attrs: { fontePropria: !!b.fontePropria }, content: [titulo, grade, ...resto] };
    }
  }
}

/** Título, fonte e nota (sempre as três, mesmo vazias, para o editor ter onde escrever). */
function partesDaIdentificacao(b: Identificacao): JSONContent[] {
  return [
    comTexto({ type: NO_DO_TITULO_DA_ILUSTRACAO }, b.titulo),
    comTexto({ type: NO_DA_FONTE_DA_ILUSTRACAO }, b.fonte),
    comTexto({ type: NO_DA_NOTA_DA_ILUSTRACAO }, b.nota ?? []),
  ];
}

function noDaLista(itens: ItemDeLista[], sequencia: boolean): JSONContent {
  return {
    type: sequencia ? "orderedList" : "bulletList",
    // Os subitens seguem o tipo da lista de fora.
    content: itens.map((item) => ({
      type: "listItem",
      content: [
        comTexto({ type: "paragraph" }, item.trechos),
        ...(item.subitens?.length ? [noDaLista(item.subitens, sequencia)] : []),
      ],
    })),
  };
}

function comTexto(no: JSONContent, trechos: Trecho[]): JSONContent {
  const content: JSONContent[] = [];
  for (const t of trechos) {
    if (ehCitacao(t)) {
      content.push({ type: NO_DA_CITACAO, attrs: { dados: structuredClone(t.citacao) } });
    } else if (ehNota(t)) {
      content.push({ type: NO_DA_NOTA, attrs: { dados: structuredClone(t.nota) } });
    } else if (t.texto) {
      content.push({
        type: "text",
        text: t.texto,
        ...(t.marcas?.length ? { marks: t.marcas.map((m) => ({ type: MARCA_DO_EDITOR[m] })) } : {}),
      });
    }
  }
  return content.length ? { ...no, content } : no;
}
