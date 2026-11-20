// Conversão entre o modelo do Apud (modelo.ts) e o formato interno do editor TipTap.
//
// Regra principal: nenhum texto pode se perder. Se o editor tiver algo que o
// modelo não conhece, o texto vira parágrafo comum em vez de sumir.

import type { JSONContent } from "@tiptap/core";
import {
  ORDEM_DAS_MARCAS,
  VERSAO_DO_FORMATO,
  type Bloco,
  type Documento,
  type ItemDeLista,
  type Marca,
  type NivelDeTitulo,
  type Trecho,
} from "./modelo";

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

/** Converte o conteúdo do editor no documento do Apud. */
export function documentoDoEditor(json: JSONContent): Documento {
  const blocos: Bloco[] = [];
  for (const no of json.content ?? []) blocos.push(...blocosDoNo(no));
  if (blocos.length === 0) blocos.push({ tipo: "paragrafo", trechos: [] });
  return { versao: VERSAO_DO_FORMATO, blocos };
}

function blocosDoNo(no: JSONContent): Bloco[] {
  switch (no.type) {
    case "paragraph":
      return [{ tipo: "paragrafo", trechos: trechosDe(no) }];
    case "heading":
      return [{ tipo: "titulo", nivel: nivelValido(no.attrs?.level), trechos: trechosDe(no) }];
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
    }
    n.content?.forEach(visitar);
  };
  no.content?.forEach(visitar);
  return normalizar(trechos);
}

/** Junta trechos vizinhos com as mesmas marcas e tira os vazios. */
export function normalizar(trechos: Trecho[]): Trecho[] {
  const saida: Trecho[] = [];
  for (const t of trechos) {
    if (!t.texto) continue;
    const ultimo = saida[saida.length - 1];
    if (ultimo && mesmasMarcas(ultimo, t)) ultimo.texto += t.texto;
    else saida.push(t.marcas?.length ? { texto: t.texto, marcas: [...t.marcas] } : { texto: t.texto });
  }
  return saida;
}

function mesmasMarcas(a: Trecho, b: Trecho): boolean {
  return (a.marcas ?? []).join() === (b.marcas ?? []).join();
}

// ---------------------------------------------------------------------------
// Do Apud para o editor

/** Converte o documento do Apud no conteúdo que o editor abre. */
export function editorDoDocumento(doc: Documento): JSONContent {
  const content = doc.blocos.map(noDoBloco);
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

function noDoBloco(b: Bloco): JSONContent {
  switch (b.tipo) {
    case "paragrafo":
      return comTexto({ type: "paragraph" }, b.trechos);
    case "titulo":
      return comTexto({ type: "heading", attrs: { level: b.nivel } }, b.trechos);
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
  const content = trechos
    .filter((t) => t.texto)
    .map((t) => ({
      type: "text",
      text: t.texto,
      ...(t.marcas?.length ? { marks: t.marcas.map((m) => ({ type: MARCA_DO_EDITOR[m] })) } : {}),
    }));
  return content.length ? { ...no, content } : no;
}
