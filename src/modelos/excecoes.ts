// O "só este" e o "todos os iguais" (decisões 2 e 5 da v2, etapa 2).
//
// Uma exceção vale só para um bloco do texto (este parágrafo, este título) e
// fica guardada no próprio bloco, no documento: { "alinhamento": "centralizado" }.
// "Todos os iguais" muda o elemento inteiro (todos os parágrafos, todos os
// títulos de nível 2) e vai para as escolhas do trabalho, como as Escolhas do
// autor: "Parágrafo › alinhamento": "centralizado".
//
// O valor que vale para um bloco segue esta ordem:
//   1. a exceção do bloco ("só este");
//   2. o elemento do bloco (Parágrafo, Títulos › Nível 2);
//   3. o elemento de cima (Títulos, depois Texto).
// Os passos 2 e 3 já somam as camadas Em branco › norma › este trabalho.
//
// Mudar um valor que a norma fixa é permitido, com aviso (decisão do
// Francisco, 24/11/2026): o trabalho sai da norma naquele ponto.

import type { Bloco, Excecoes } from "../documento/modelo";
import { listarComE, normalizar } from "../perfis/texto";
import { caminho, elemento as definicaoDoElemento, propriedade as definicaoDaPropriedade } from "./elementos";
import { deOndeVem, valorEfetivo } from "./herdar";
import type { ModeloResolvido, ValorNoModelo } from "./tipos";
import { COMO_NO_TEXTO } from "./valores";

/**
 * As propriedades que um bloco pode ter como exceção, pelo elemento de cima
 * (Parágrafo ou Títulos). São as da janelinha do ⚙; o painel completo (etapa 3)
 * vai abrir mais. Toda exceção daqui tem efeito no PDF.
 */
const PROPRIEDADES_COM_EXCECAO: Record<string, readonly string[]> = {
  paragrafo: ["entrelinha", "alinhamento", "recuo da primeira linha"],
  titulos: ["destaque", "posição"],
};

/** O elemento da árvore de um bloco do texto que aceita exceções (parágrafo e título). */
export function elementoDoBloco(b: Bloco): string | undefined {
  if (b.tipo === "paragrafo") return "paragrafo";
  if (b.tipo === "titulo") return `titulos.nivel${b.nivel}`;
  return undefined;
}

/** As propriedades que o elemento aceita como exceção, com o nome escrito como na árvore. */
export function propriedadesComExcecao(elemento: string): readonly string[] {
  const grupo = elemento.startsWith("titulos.nivel") ? "titulos" : elemento;
  return PROPRIEDADES_COM_EXCECAO[grupo] ?? [];
}

/** O nome da propriedade como na árvore ("Alinhamento" → "alinhamento"), se ela aceita exceção. */
function nomeAceito(elemento: string, nome: string): string | undefined {
  const n = normalizar(nome);
  return propriedadesComExcecao(elemento).find((p) => normalizar(p) === n);
}

/** Quem diz o valor de onde vem: "este bloco", "este trabalho" ou o nome do modelo. */
export const DE_ESTE_BLOCO = "este bloco";
export const ORIGEM_DA_EXCECAO = "só este";

/**
 * Confere as exceções de um bloco, como vêm do arquivo. Devolve as exceções
 * com os valores escritos do jeito do Apud ("1,5", "centralizado"), ou o
 * motivo do erro. Lista vazia vira undefined (o bloco fica sem o campo).
 */
export function conferirExcecoes(elemento: string, v: unknown): { ok: true; excecoes?: Excecoes } | { ok: false; erro: string } {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return { ok: false, erro: "as exceções do bloco estão estragadas" };
  const saida: Excecoes = {};
  for (const [nome, escrito] of Object.entries(v)) {
    const aceito = nomeAceito(elemento, nome);
    if (!aceito) return { ok: false, erro: `“${nome}” não pode ser uma exceção de ${caminho(elemento)}` };
    if (typeof escrito !== "string") return { ok: false, erro: `a exceção “${nome}” está estragada` };
    const lido = definicaoDaPropriedade(elemento, aceito)!.tipo.ler(escrito, aceito);
    if (!lido.ok) return { ok: false, erro: lido.erro };
    saida[aceito] = lido.texto;
  }
  return { ok: true, ...(Object.keys(saida).length ? { excecoes: saida } : {}) };
}

/**
 * As exceções de `v` que o elemento aceita, cada uma com valor certo; as
 * outras saem. Serve ao editor: um bloco que muda de tipo (parágrafo para
 * título) fica só com as exceções que o elemento novo aceita. Undefined
 * quando não sobra nenhuma.
 */
export function excecoesQueValem(elemento: string, v: unknown): Excecoes | undefined {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return undefined;
  const saida: Excecoes = {};
  for (const [nome, escrito] of Object.entries(v)) {
    const c = typeof escrito === "string" ? conferirExcecoes(elemento, { [nome]: escrito }) : undefined;
    if (c?.ok && c.excecoes) Object.assign(saida, c.excecoes);
  }
  return Object.keys(saida).length ? saida : undefined;
}

/** A exceção do bloco como um valor do modelo (para a herança e para mostrar de onde vem). */
function valorDaExcecao(elemento: string, propriedade: string, escrito: string): ValorNoModelo | undefined {
  const def = definicaoDaPropriedade(elemento, propriedade);
  if (!def) return undefined;
  const lido = def.tipo.ler(escrito, propriedade);
  if (!lido.ok) return undefined;
  return { valor: lido.valor, texto: lido.texto, origem: ORIGEM_DA_EXCECAO, situacao: { tipo: "confirmada" }, de: DE_ESTE_BLOCO };
}

/** A exceção que o bloco tem para a propriedade (o nome já normalizado), se tem. */
function excecaoDe(excecoes: Excecoes | undefined, propriedade: string): string | undefined {
  if (!excecoes) return undefined;
  const n = normalizar(propriedade);
  const chave = Object.keys(excecoes).find((k) => normalizar(k) === n);
  return chave === undefined ? undefined : excecoes[chave];
}

/**
 * O valor que vale para um bloco: a exceção dele, senão o do elemento, senão o
 * de um elemento de cima. Um recuo "como no texto" vira o recuo do Texto.
 */
export function valorNoBloco(modelo: ModeloResolvido, elemento: string, propriedade: string, excecoes?: Excecoes): ValorNoModelo | undefined {
  const escrito = excecaoDe(excecoes, propriedade);
  const daExcecao = escrito === undefined ? undefined : valorDaExcecao(elemento, propriedade, escrito);
  if (!daExcecao) return valorEfetivo(modelo, elemento, propriedade);
  if (daExcecao.valor.tipo === "opcao" && daExcecao.valor.valor === COMO_NO_TEXTO) {
    const doTexto = valorEfetivo(modelo, "texto", propriedade);
    return doTexto && { ...doTexto, origem: ORIGEM_DA_EXCECAO, de: DE_ESTE_BLOCO };
  }
  return daExcecao;
}

/** De onde vem o valor que vale para o bloco. */
export type Procedencia =
  | { tipo: "bloco" }
  /** `elemento`: onde o valor está na árvore (o próprio ou um de cima); `de`: o modelo, ou "este trabalho". */
  | { tipo: "elemento"; elemento: string; de: string };

export function deOndeVemNoBloco(modelo: ModeloResolvido, elemento: string, propriedade: string, excecoes?: Excecoes): Procedencia | undefined {
  if (excecaoDe(excecoes, propriedade) !== undefined) return { tipo: "bloco" };
  const onde = deOndeVem(modelo, elemento, propriedade);
  const v = onde && modelo.valores.get(onde)?.get(propriedade);
  return onde && v ? { tipo: "elemento", elemento: onde, de: v.de } : undefined;
}

/** A procedência em palavras, para a janelinha: "Só neste título", "Do modelo ABNT (Texto)". */
export function descreverProcedencia(p: Procedencia, bloco: "parágrafo" | "título"): string {
  if (p.tipo === "bloco") return `Só neste ${bloco}`;
  const onde = definicaoDoElemento(p.elemento).nome;
  if (p.de === "este trabalho") return `Deste trabalho (${onde})`;
  return `Do modelo ${p.de} (${onde})`;
}

// ---------------------------------------------------------------------------
// Valor fixo pela norma

/**
 * O aviso de quando o valor novo sai da norma: o valor que vale hoje é fixo
 * (confirmado) e foi dado por uma norma (não pelo Em branco, que é só o ponto
 * de partida). Undefined quando não há o que avisar.
 */
export function avisoDeNorma(modelo: ModeloResolvido, atual: ValorNoModelo | undefined, textoNovo: string): string | undefined {
  if (!atual || atual.situacao.tipo !== "confirmada") return undefined;
  if (atual.de === DE_ESTE_BLOCO || atual.de === "este trabalho") return undefined;
  if (atual.de === modelo.cadeia[0]?.nome) return undefined;
  if (normalizar(atual.texto) === normalizar(textoNovo)) return undefined;
  return `A ${atual.de} pede “${atual.texto}” (${atual.origem}). Com “${textoNovo}”, o trabalho sai da norma neste ponto.`;
}

// ---------------------------------------------------------------------------
// Mudar: "só este" e "todos os iguais"

export type Mudanca<T> = { ok: true; resultado: T; aviso?: string } | { ok: false; erro: string };

/** Lê o valor que a pessoa escolheu pelo tipo da propriedade. */
function lerValorNovo(elemento: string, propriedade: string, escrito: string): { ok: true; nome: string; texto: string } | { ok: false; erro: string } {
  const def = definicaoDaPropriedade(elemento, propriedade);
  if (!def) return { ok: false, erro: `${caminho(elemento)} não tem “${propriedade}”.` };
  const lido = def.tipo.ler(escrito, def.nome);
  return lido.ok ? { ok: true, nome: def.nome, texto: lido.texto } : { ok: false, erro: lido.erro };
}

/**
 * "Só este": põe (ou troca) a exceção de um bloco. Um valor igual ao do
 * elemento não vira exceção: a que havia sai (o bloco volta a seguir o elemento).
 * `modelo` é o do trabalho, já com as escolhas dele.
 */
export function mudarSoEste(modelo: ModeloResolvido, elemento: string, excecoes: Excecoes | undefined, propriedade: string, escrito: string): Mudanca<Excecoes | undefined> {
  const aceito = nomeAceito(elemento, propriedade);
  if (!aceito) {
    const possiveis = propriedadesComExcecao(elemento);
    return { ok: false, erro: possiveis.length ? `Só este: dá para mudar ${listarComE([...possiveis])}.` : `${caminho(elemento)} ainda não aceita “só este”.` };
  }
  const lido = lerValorNovo(elemento, aceito, escrito);
  if (!lido.ok) return lido;
  const doElemento = valorEfetivo(modelo, elemento, aceito);
  const novas: Excecoes = { ...(excecoes ?? {}) };
  for (const k of Object.keys(novas)) if (normalizar(k) === normalizar(aceito)) delete novas[k];
  if (!doElemento || normalizar(doElemento.texto) !== normalizar(lido.texto)) novas[aceito] = lido.texto;
  const resultado = Object.keys(novas).length ? novas : undefined;
  const aviso = resultado?.[aceito] !== undefined ? avisoDeNorma(modelo, doElemento, lido.texto) : undefined;
  return { ok: true, resultado, ...(aviso ? { aviso } : {}) };
}

/** "Voltar ao do modelo": tira a exceção de uma propriedade. */
export function tirarExcecao(excecoes: Excecoes | undefined, propriedade: string): Excecoes | undefined {
  if (!excecoes) return undefined;
  const novas = Object.fromEntries(Object.entries(excecoes).filter(([k]) => normalizar(k) !== normalizar(propriedade)));
  return Object.keys(novas).length ? novas : undefined;
}

/** A chave de uma escolha do trabalho: "Parágrafo › alinhamento", "Títulos › Nível 2 › destaque". */
export function chaveDaEscolha(elemento: string, propriedade: string): string {
  return `${caminho(elemento)} › ${propriedade}`;
}

/**
 * "Todos os iguais": muda o elemento inteiro neste trabalho, nas escolhas do
 * trabalho (até a etapa 4 trazer "Salvar como modelo"). `base` é o modelo do
 * trabalho sem as escolhas (a cópia do arquivo): um valor igual ao do modelo
 * apaga a escolha, em vez de guardar uma escolha que não muda nada.
 */
export function mudarTodos(
  base: ModeloResolvido,
  ajustes: Record<string, string>,
  elemento: string,
  propriedade: string,
  escrito: string,
): Mudanca<Record<string, string>> {
  const lido = lerValorNovo(elemento, propriedade, escrito);
  if (!lido.ok) return lido;
  const chave = chaveDaEscolha(elemento, lido.nome);
  const doModelo = valorEfetivo(base, elemento, lido.nome);
  const novos = Object.fromEntries(Object.entries(ajustes).filter(([k]) => normalizar(k) !== normalizar(chave)));
  const igual = doModelo && normalizar(doModelo.texto) === normalizar(lido.texto);
  if (!igual) novos[chave] = lido.texto;
  const aviso = igual ? undefined : avisoDeNorma(base, doModelo, lido.texto);
  return { ok: true, resultado: novos, ...(aviso ? { aviso } : {}) };
}
