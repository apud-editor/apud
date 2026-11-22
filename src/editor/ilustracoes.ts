// Figuras e tabelas dentro do editor: como entram no texto, como se muda o que
// elas têm de próprio (espécie, largura, "elaborado pelo autor") e como a
// colagem do Excel preenche a grade. Funções puras sobre o estado do editor
// (ProseMirror), para poderem ser testadas sem navegador.

import { Selection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { Node as NoPM } from "@tiptap/pm/model";
import type { JSONContent } from "@tiptap/core";
import { NO_DA_FIGURA, NO_DA_TABELA, editorDosBlocos } from "../documento/tiptap";
import type { Bloco } from "../documento/modelo";

// ---------------------------------------------------------------------------
// Inserir um bloco novo

/** Uma tabela nova: linhas × colunas, com a primeira linha de cabeçalho. */
export function tabelaNova(linhas = 3, colunas = 3): Bloco {
  return {
    tipo: "tabela",
    linhas: Array.from({ length: Math.max(2, linhas) }, () => Array.from({ length: Math.max(1, colunas) }, () => [])),
    cabecalho: 1,
    titulo: [],
    fonte: [],
  };
}

/** Uma figura nova, com a imagem pelo código. */
export const figuraNova = (imagem: string): Bloco => ({ tipo: "figura", imagem, titulo: [], fonte: [] });

/**
 * Coloca o bloco depois de onde está o cursor (no lugar do parágrafo, se ele
 * estiver vazio), garante um parágrafo depois dele (para o cursor poder sair)
 * e leva o cursor para o título do bloco. `json` é o bloco como o editor o abre.
 */
export function inserirBlocoDeIlustracao(state: EditorState, json: JSONContent): Transaction {
  const no = state.schema.nodeFromJSON(json);
  const { $from } = state.selection;
  let de: number;
  let ate: number;
  if ($from.depth >= 1) {
    const topo = $from.node(1);
    const vazio = topo.type.name === "paragraph" && topo.content.size === 0;
    de = vazio ? $from.before(1) : $from.after(1);
    ate = vazio ? $from.after(1) : de;
  } else {
    de = ate = state.selection.to;
  }
  const tr = state.tr.replaceWith(de, ate, no);
  const fim = de + no.nodeSize;
  if (!tr.doc.resolve(fim).nodeAfter) tr.insert(fim, state.schema.nodes.paragraph.create());
  // Dentro do bloco (+1), dentro do título (+1): o começo do texto do título.
  return tr.setSelection(TextSelection.create(tr.doc, de + 2)).scrollIntoView();
}

export const inserirFigura = (state: EditorState, imagem: string) => inserirBlocoDeIlustracao(state, editorDosBlocos([figuraNova(imagem)]).content![0]);
export const inserirTabela = (state: EditorState, linhas = 3, colunas = 3) =>
  inserirBlocoDeIlustracao(state, editorDosBlocos([tabelaNova(linhas, colunas)]).content![0]);

// ---------------------------------------------------------------------------
// Onde o cursor está

export interface IlustracaoDoCursor {
  tipo: "figura" | "tabela";
  pos: number;
  no: NoPM;
}

/** A figura ou tabela onde o cursor está (em qualquer parte dela), se estiver. */
export function ilustracaoDoCursor(state: EditorState): IlustracaoDoCursor | null {
  const { $from } = state.selection;
  for (let d = $from.depth; d >= 1; d--) {
    const no = $from.node(d);
    if (no.type.name === NO_DA_FIGURA) return { tipo: "figura", pos: $from.before(d), no };
    if (no.type.name === NO_DA_TABELA) return { tipo: "tabela", pos: $from.before(d), no };
  }
  return null;
}

/** Muda os atributos da figura ou tabela (espécie, largura, imagem, "elaborado pelo autor"). */
export function mudarIlustracao(state: EditorState, pos: number, parcial: Record<string, unknown>): Transaction | null {
  const no = state.doc.nodeAt(pos);
  if (!no || (no.type.name !== NO_DA_FIGURA && no.type.name !== NO_DA_TABELA)) return null;
  return state.tr.setNodeMarkup(pos, undefined, { ...no.attrs, ...parcial });
}

/** Apaga a figura ou tabela inteira. Se era o único bloco do texto, deixa um parágrafo vazio. */
export function apagarIlustracao(state: EditorState, pos: number): Transaction | null {
  const no = state.doc.nodeAt(pos);
  if (!no || (no.type.name !== NO_DA_FIGURA && no.type.name !== NO_DA_TABELA)) return null;
  const tr = state.tr;
  if (state.doc.childCount === 1) tr.replaceWith(pos, pos + no.nodeSize, state.schema.nodes.paragraph.create());
  else tr.delete(pos, pos + no.nodeSize);
  return tr.setSelection(Selection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size)), -1)).scrollIntoView();
}

// ---------------------------------------------------------------------------
// Colar do Excel

/**
 * O texto copiado de uma planilha (colunas separadas por tabulação, linhas
 * por quebra de linha; célula com quebra ou tabulação vem entre aspas).
 * Devolve a grade, ou null quando é só um valor (uma célula).
 */
export function gradeDoTextoColado(texto: string): string[][] | null {
  const dados = texto.replace(/\r\n?/g, "\n");
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let entreAspas = false;
  let comecoDaCelula = true;
  for (let i = 0; i < dados.length; i++) {
    const c = dados[i];
    if (entreAspas) {
      if (c === '"' && dados[i + 1] === '"') {
        celula += '"';
        i++;
      } else if (c === '"') entreAspas = false;
      else celula += c;
      continue;
    }
    if (c === '"' && comecoDaCelula) {
      entreAspas = true;
      comecoDaCelula = false;
    } else if (c === "\t") {
      linha.push(celula);
      celula = "";
      comecoDaCelula = true;
    } else if (c === "\n") {
      linha.push(celula);
      linhas.push(linha);
      linha = [];
      celula = "";
      comecoDaCelula = true;
    } else {
      celula += c;
      comecoDaCelula = false;
    }
  }
  // O Excel termina o texto com quebra de linha: a última linha só existe se tiver algo.
  if (celula !== "" || linha.length > 0) {
    linha.push(celula);
    linhas.push(linha);
  }
  const limpas = linhas.map((l) => l.map((c) => c.replace(/\s+/g, " ").trim()));
  if (limpas.length === 0 || (limpas.length === 1 && limpas[0].length === 1)) return null;
  const largura = Math.max(...limpas.map((l) => l.length));
  return limpas.map((l) => [...l, ...Array.from({ length: largura - l.length }, () => "")]);
}

/** A tabela do cursor, a linha e a coluna da célula onde ele está. */
function celulaDoCursor(state: EditorState) {
  const { $from } = state.selection;
  for (let d = $from.depth; d >= 1; d--) {
    if ($from.node(d).type.name === "table") {
      return { pos: $from.before(d), tabela: $from.node(d), linha: $from.index(d), coluna: $from.index(d + 1) };
    }
  }
  return null;
}

export const cursorNaGrade = (state: EditorState): boolean => celulaDoCursor(state) !== null;

const paragrafoDe = (texto: string): JSONContent => ({ type: "paragraph", ...(texto ? { content: [{ type: "text", text: texto }] } : {}) });

/**
 * Cola a grade a partir da célula onde o cursor está: sobrescreve as células
 * e, se faltar espaço, cria as linhas e colunas que faltam. Devolve null se o
 * cursor não está numa tabela.
 */
export function colarNaGrade(state: EditorState, dados: string[][]): Transaction | null {
  const alvo = celulaDoCursor(state);
  if (!alvo) return null;
  const json = alvo.tabela.toJSON() as JSONContent;
  const linhas = json.content ?? [];
  const largura = Math.max(...linhas.map((l) => l.content?.length ?? 0), 1);
  const novaLargura = Math.max(largura, alvo.coluna + Math.max(...dados.map((l) => l.length)));
  const novaAltura = Math.max(linhas.length, alvo.linha + dados.length);

  // Colunas que faltam, em todas as linhas (cabeçalho continua cabeçalho).
  for (const l of linhas) {
    const tipo = l.content?.[0]?.type === "tableHeader" ? "tableHeader" : "tableCell";
    while ((l.content?.length ?? 0) < novaLargura) (l.content ??= []).push({ type: tipo, content: [paragrafoDe("")] });
  }
  // Linhas que faltam, com células comuns.
  while (linhas.length < novaAltura) {
    linhas.push({ type: "tableRow", content: Array.from({ length: novaLargura }, () => ({ type: "tableCell", content: [paragrafoDe("")] })) });
  }
  dados.forEach((l, i) =>
    l.forEach((texto, j) => {
      linhas[alvo.linha + i].content![alvo.coluna + j].content = [paragrafoDe(texto)];
    }),
  );
  json.content = linhas;

  const nova = state.schema.nodeFromJSON(json);
  const tr = state.tr.replaceWith(alvo.pos, alvo.pos + alvo.tabela.nodeSize, nova);
  // O cursor fica no começo da primeira célula colada.
  let pos = alvo.pos + 1;
  for (let r = 0; r < alvo.linha; r++) pos += nova.child(r).nodeSize;
  pos += 1;
  for (let c = 0; c < alvo.coluna; c++) pos += nova.child(alvo.linha).child(c).nodeSize;
  return tr.setSelection(TextSelection.create(tr.doc, pos + 2)).scrollIntoView();
}

/**
 * Planilha colada num parágrafo vazio (e não numa tabela): vira uma tabela
 * nova, com a primeira linha de cabeçalho. Devolve null se o cursor não está
 * num parágrafo vazio no meio do texto.
 */
export function tabelaDaPlanilha(state: EditorState, dados: string[][]): Transaction | null {
  const { $from, empty } = state.selection;
  if (!empty || $from.depth !== 1 || $from.parent.type.name !== "paragraph" || $from.parent.content.size !== 0) return null;
  const bloco: Bloco = {
    tipo: "tabela",
    linhas: dados.map((l) => l.map((texto) => (texto ? [{ texto }] : []))),
    cabecalho: 1,
    titulo: [],
    fonte: [],
  };
  return inserirBlocoDeIlustracao(state, editorDosBlocos([bloco]).content![0]);
}
