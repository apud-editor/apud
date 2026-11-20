// O formato do arquivo .apud.
//
// É um arquivo de texto (JSON), legível em qualquer editor de texto: se um dia
// algo der errado, o conteúdo do trabalho ainda pode ser recuperado à mão.
// Exemplo:
//
//   {
//     "formato": "apud",
//     "versao": 1,
//     "nome": "Relato de experiência de estágio",
//     "perfil": { "perfil": "ABNT", "versao": "2025", "revisao": 3 },
//     "criadoEm": "2026-11-20T18:40:00.000Z",
//     "modificadoEm": "2026-11-20T19:02:11.000Z",
//     "documento": { "versao": 1, "blocos": [ ... ] }
//   }
//
// "perfil" guarda com que versão da norma o trabalho foi feito: um trabalho já
// entregue nunca muda sozinho quando o perfil for atualizado.

import { VERSAO_DO_FORMATO, type Bloco, type Documento, type ItemDeLista, type Trecho } from "../documento/modelo";

export const VERSAO_DO_ARQUIVO = 1;

export interface PerfilDoTrabalho {
  perfil: string;
  versao: string;
  revisao: number;
}

export interface Trabalho {
  nome: string;
  perfil: PerfilDoTrabalho;
  criadoEm: string;
  modificadoEm: string;
  documento: Documento;
}

export type Leitura = { ok: true; trabalho: Trabalho } | { ok: false; erro: string };

/** Escreve o trabalho como texto do arquivo .apud. */
export function escreverArquivo(t: Trabalho): string {
  const arquivo = {
    formato: "apud",
    versao: VERSAO_DO_ARQUIVO,
    nome: t.nome,
    perfil: t.perfil,
    criadoEm: t.criadoEm,
    modificadoEm: t.modificadoEm,
    documento: t.documento,
  };
  return JSON.stringify(arquivo, null, 2) + "\n";
}

/**
 * Lê o texto de um arquivo .apud e confere se está inteiro.
 * Nunca "conserta" em silêncio: se algo estiver errado, devolve o motivo, e o
 * arquivo fica como está no disco.
 */
export function lerArquivo(texto: string): Leitura {
  let dados: unknown;
  try {
    dados = JSON.parse(texto.replace(/^﻿/, ""));
  } catch {
    return { ok: false, erro: "o arquivo não é um .apud válido (o texto está incompleto ou foi alterado)" };
  }
  if (!objeto(dados) || dados.formato !== "apud") return { ok: false, erro: "o arquivo não é um trabalho do Apud" };
  if (typeof dados.versao !== "number") return { ok: false, erro: "falta a versão do arquivo" };
  if (dados.versao > VERSAO_DO_ARQUIVO) {
    return { ok: false, erro: "este trabalho foi feito numa versão mais nova do Apud. Atualize o Apud para abrir" };
  }
  if (typeof dados.nome !== "string") return { ok: false, erro: "falta o nome do trabalho" };
  const perfil = dados.perfil;
  if (!objeto(perfil) || typeof perfil.perfil !== "string" || typeof perfil.versao !== "string" || typeof perfil.revisao !== "number") {
    return { ok: false, erro: "falta a norma do trabalho" };
  }
  const documento = conferirDocumento(dados.documento);
  if (typeof documento === "string") return { ok: false, erro: documento };
  return {
    ok: true,
    trabalho: {
      nome: dados.nome,
      perfil: { perfil: perfil.perfil, versao: perfil.versao, revisao: perfil.revisao },
      criadoEm: typeof dados.criadoEm === "string" ? dados.criadoEm : "",
      modificadoEm: typeof dados.modificadoEm === "string" ? dados.modificadoEm : "",
      documento,
    },
  };
}

// ---------------------------------------------------------------------------
// Conferência do documento

function objeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Devolve o documento conferido, ou o motivo do erro. */
function conferirDocumento(v: unknown): Documento | string {
  if (!objeto(v) || !Array.isArray(v.blocos)) return "falta o texto do trabalho";
  if (v.versao !== VERSAO_DO_FORMATO) return "o texto do trabalho está numa versão que este Apud não conhece";
  const blocos: Bloco[] = [];
  for (const [i, b] of v.blocos.entries()) {
    const bloco = conferirBloco(b);
    if (!bloco) return `o bloco ${i + 1} do texto está estragado`;
    blocos.push(bloco);
  }
  return { versao: VERSAO_DO_FORMATO, blocos };
}

function conferirBloco(b: unknown): Bloco | null {
  if (!objeto(b)) return null;
  switch (b.tipo) {
    case "paragrafo": {
      const trechos = conferirTrechos(b.trechos);
      return trechos && { tipo: "paragrafo", trechos };
    }
    case "titulo": {
      const trechos = conferirTrechos(b.trechos);
      const nivel = b.nivel;
      if (!trechos || ![1, 2, 3, 4, 5].includes(nivel as number)) return null;
      return { tipo: "titulo", nivel: nivel as 1 | 2 | 3 | 4 | 5, trechos };
    }
    case "lista": {
      const itens = conferirItens(b.itens);
      if (!itens || typeof b.sequencia !== "boolean") return null;
      return { tipo: "lista", sequencia: b.sequencia, itens };
    }
    default:
      return null;
  }
}

function conferirItens(v: unknown): ItemDeLista[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const itens: ItemDeLista[] = [];
  for (const it of v) {
    if (!objeto(it)) return null;
    const trechos = conferirTrechos(it.trechos);
    if (!trechos) return null;
    const item: ItemDeLista = { trechos };
    if (it.subitens !== undefined) {
      const sub = conferirItens(it.subitens);
      if (!sub) return null;
      item.subitens = sub;
    }
    itens.push(item);
  }
  return itens;
}

const MARCAS = ["negrito", "italico", "sobrescrito"];

function conferirTrechos(v: unknown): Trecho[] | null {
  if (!Array.isArray(v)) return null;
  const trechos: Trecho[] = [];
  for (const t of v) {
    if (!objeto(t) || typeof t.texto !== "string") return null;
    if (t.marcas === undefined) {
      trechos.push({ texto: t.texto });
      continue;
    }
    if (!Array.isArray(t.marcas) || !t.marcas.every((m) => MARCAS.includes(m))) return null;
    const marcas = MARCAS.filter((m) => (t.marcas as string[]).includes(m)) as Trecho["marcas"];
    trechos.push(marcas!.length ? { texto: t.texto, marcas } : { texto: t.texto });
  }
  return trechos;
}
