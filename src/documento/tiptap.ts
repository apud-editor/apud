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
// por cima dele), com os dados da citação guardados como estão no modelo.

import type { JSONContent } from "@tiptap/core";
import {
  ehCitacao,
  ORDEM_DAS_MARCAS,
  type Bloco,
  type Citacao,
  type ItemDeLista,
  type Marca,
  type NivelDeTitulo,
  type Trecho,
} from "./modelo";

/** Nome do nó das citações no editor (extensão em editor/extensoes.ts). */
export const NO_DA_CITACAO = "citacao";
/** Nome do nó da lista de referências no editor. */
export const NO_DA_LISTA_DE_REFERENCIAS = "listaDeReferencias";

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
    }
    n.content?.forEach(visitar);
  };
  no.content?.forEach(visitar);
  return normalizar(trechos);
}

/** Junta trechos de texto vizinhos com as mesmas marcas e tira os vazios. As citações ficam como estão. */
export function normalizar(trechos: Trecho[]): Trecho[] {
  const saida: Trecho[] = [];
  for (const t of trechos) {
    if (ehCitacao(t)) {
      saida.push(t);
      continue;
    }
    if (!t.texto) continue;
    const ultimo = saida[saida.length - 1];
    if (ultimo && !ehCitacao(ultimo) && (ultimo.marcas ?? []).join() === (t.marcas ?? []).join()) ultimo.texto += t.texto;
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
  }
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
