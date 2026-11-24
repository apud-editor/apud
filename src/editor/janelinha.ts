// A janelinha do ⚙ e o quadro de valores da barra (etapa 2c da v2), em funções
// puras: a conta do que mostrar e do que escrever fica aqui, testada sem
// navegador; a tela (Ajustes.tsx) só desenha.
//
// A janelinha mexe nas propriedades que a 2a deixou aceitar "só este" (modelos/
// excecoes.ts): no Parágrafo, a entrelinha, o alinhamento e o recuo da primeira
// linha; no Título, o destaque, a posição, o número, as maiúsculas e a página
// nova. Cada linha mostra o valor que vale e, ao clicar, diz o que escrever.
// Quem escreve (a exceção no bloco ou a escolha do trabalho) é a tela.

import type { Node as NoPM } from "@tiptap/pm/model";
import type { Excecoes, NivelDeTitulo, TipoDeTrabalho } from "../documento/modelo";
import { destaque } from "../perfis/valores";
import { comecaEmPaginaNova, numeraSozinho, vaiEmMaiusculas } from "../modelos/titulos";
import { deOndeVemNoBloco, descreverProcedencia, mudarSoEste, mudarTodos, propriedadesComExcecao, valorNoBloco } from "../modelos/excecoes";
import { valorEfetivo } from "../modelos/herdar";
import type { ModeloResolvido, ValorNoModelo } from "../modelos/tipos";
import { normalizar } from "../perfis/texto";

/** Um bloco do texto que tem janelinha: parágrafo ou título. */
export interface BlocoAjustavel {
  /** O elemento na árvore: "paragrafo", "titulos.nivel2". */
  elemento: string;
  tipo: "parágrafo" | "título";
  nivel?: NivelDeTitulo;
  excecoes?: Excecoes;
}

/** O bloco de nível mais alto do editor, se for parágrafo ou título. Os outros (listas, figuras...) ainda não têm janelinha. */
export function blocoAjustavel(no: NoPM | null | undefined): BlocoAjustavel | null {
  if (!no) return null;
  const excecoes = (no.attrs.excecoes as Excecoes | null) ?? undefined;
  if (no.type.name === "paragraph") return { elemento: "paragrafo", tipo: "parágrafo", excecoes };
  if (no.type.name === "heading") {
    const nivel = no.attrs.level as NivelDeTitulo;
    return { elemento: `titulos.nivel${nivel}`, tipo: "título", nivel, excecoes };
  }
  return null;
}

/** "Parágrafo", "Título 2". */
export function nomeDoBloco(b: BlocoAjustavel): string {
  return b.tipo === "parágrafo" ? "Parágrafo" : `Título ${b.nivel}`;
}

// ---------------------------------------------------------------------------
// O destaque (negrito, itálico, sublinhado, maiúsculas) como interruptores

export type ParteDoDestaque = "maiúsculas" | "negrito" | "itálico" | "sublinhado";

/** O destaque como texto ("negrito, itálico"), ligando ou desligando uma parte. "normal" quando não sobra nenhuma. */
export function alternarDestaque(texto: string, parte: ParteDoDestaque, ligar: boolean): string {
  const lido = destaque().ler(texto, "destaque");
  const v = lido.ok && lido.valor.tipo === "destaque" ? lido.valor : { maiusculas: false, negrito: false, italico: false, sublinhado: false };
  const estado: Record<ParteDoDestaque, boolean> = { maiúsculas: v.maiusculas, negrito: v.negrito, itálico: v.italico, sublinhado: v.sublinhado };
  estado[parte] = ligar;
  const partes = (["maiúsculas", "negrito", "itálico", "sublinhado"] as const).filter((p) => estado[p]);
  return partes.length ? partes.join(", ") : "normal";
}

function partesDoDestaque(v: ValorNoModelo | undefined): Record<ParteDoDestaque, boolean> {
  const d = v?.valor.tipo === "destaque" ? v.valor : undefined;
  return { maiúsculas: !!d?.maiusculas, negrito: !!d?.negrito, itálico: !!d?.italico, sublinhado: !!d?.sublinhado };
}

// ---------------------------------------------------------------------------
// As linhas da janelinha

/** O que escrever: uma ou mais propriedades (ligar as maiúsculas mexe em duas). */
export type Escrita = Array<[propriedade: string, escrito: string]>;

export interface OpcaoDaLinha {
  rotulo: string;
  /** Este é o valor que vale agora. */
  ativa: boolean;
  /** O que a escolha escreve. Nas chaves (liga/desliga), é o contrário do que vale agora. */
  escrita: Escrita;
}

export interface LinhaDaJanelinha {
  rotulo: string;
  /** "opcoes": um botão por valor; "chave": um interruptor. */
  forma: "opcoes" | "chave";
  opcoes: OpcaoDaLinha[];
  /** As propriedades que a linha mexe (para saber se o bloco tem exceção nela). */
  propriedades: string[];
  /** O bloco tem uma exceção "só este" em alguma dessas propriedades. */
  deExcecao: boolean;
}

export type AplicarA = "todos" | "este";

const temExcecao = (excecoes: Excecoes | undefined, propriedade: string) =>
  !!excecoes && Object.keys(excecoes).some((k) => normalizar(k) === normalizar(propriedade));

function opcoes(rotulo: string, propriedade: string, escolhas: Array<{ rotulo: string; escrito: string; ativa: boolean }>): Omit<LinhaDaJanelinha, "deExcecao"> {
  return {
    rotulo,
    forma: "opcoes",
    propriedades: [propriedade],
    opcoes: escolhas.map((e) => ({ rotulo: e.rotulo, ativa: e.ativa, escrita: [[propriedade, e.escrito]] })),
  };
}

function chave(rotulo: string, propriedades: string[], ligada: boolean, escrita: Escrita): Omit<LinhaDaJanelinha, "deExcecao"> {
  return { rotulo, forma: "chave", propriedades, opcoes: [{ rotulo, ativa: ligada, escrita }] };
}

/**
 * As linhas da janelinha de um bloco. Em "este", mostra o valor que vale para o
 * bloco (com a exceção dele); em "todos", o do elemento, sem a exceção do bloco:
 * cada modo mostra o que ele mesmo vai mudar.
 */
export function linhasDaJanelinha(modelo: ModeloResolvido, tipoDeTrabalho: TipoDeTrabalho, bloco: BlocoAjustavel, aplicarA: AplicarA): LinhaDaJanelinha[] {
  const ex = aplicarA === "este" ? bloco.excecoes : undefined;
  const v = (propriedade: string) => valorNoBloco(modelo, bloco.elemento, propriedade, ex);
  const opcao = (propriedade: string) => {
    const x = v(propriedade)?.valor;
    return x?.tipo === "opcao" ? x.valor : undefined;
  };

  const linhas: Array<Omit<LinhaDaJanelinha, "deExcecao">> = [];
  if (bloco.tipo === "parágrafo") {
    const entrelinha = v("entrelinha")?.valor;
    const numero = entrelinha?.tipo === "espacamento" ? entrelinha.numero : undefined;
    linhas.push(
      opcoes("Espaçamento entre linhas", "entrelinha", [
        { rotulo: "1", escrito: "simples", ativa: numero === 1 },
        { rotulo: "1,5", escrito: "1,5", ativa: numero === 1.5 },
        { rotulo: "2", escrito: "duplo", ativa: numero === 2 },
      ]),
    );
    const alinhamento = opcao("alinhamento");
    linhas.push(
      opcoes("Alinhamento", "alinhamento", [
        { rotulo: "Esquerda", escrito: "à esquerda", ativa: alinhamento === "à esquerda" },
        { rotulo: "Justificado", escrito: "justificado", ativa: alinhamento === "justificado" },
        { rotulo: "Centro", escrito: "centralizado", ativa: alinhamento === "centralizado" },
        { rotulo: "Direita", escrito: "à direita", ativa: alinhamento === "à direita" },
      ]),
    );
    const recuo = v("recuo da primeira linha")?.valor;
    const comRecuo = !(recuo?.tipo === "medida" && recuo.numero === 0);
    linhas.push(
      opcoes("Recuo da primeira linha", "recuo da primeira linha", [
        { rotulo: "Sim", escrito: "como no texto", ativa: comRecuo },
        { rotulo: "Não", escrito: "nenhum", ativa: !comRecuo },
      ]),
    );
  } else {
    const nivel = bloco.nivel!;
    const d = v("destaque");
    const partes = partesDoDestaque(d);
    const textoDoDestaque = d?.texto ?? "normal";
    for (const [rotulo, parte] of [
      ["Negrito", "negrito"],
      ["Itálico", "itálico"],
      ["Sublinhado", "sublinhado"],
    ] as const) {
      linhas.push(chave(rotulo, ["destaque"], partes[parte], [["destaque", alternarDestaque(textoDoDestaque, parte, !partes[parte])]]));
    }
    const posicao = opcao("posição");
    linhas.push(
      opcoes("Posição", "posição", [
        { rotulo: "Esquerda", escrito: "à esquerda", ativa: posicao === "à esquerda" },
        { rotulo: "Centro", escrito: "centralizado", ativa: posicao === "centralizado" },
        { rotulo: "Com recuo", escrito: "com recuo", ativa: posicao === "com recuo" },
      ]),
    );
    const numerado = numeraSozinho(modelo, nivel, ex);
    linhas.push(chave("Numerar sozinho", ["numerar sozinho"], numerado, [["numerar sozinho", numerado ? "não" : "sim"]]));
    const maiusculas = vaiEmMaiusculas(modelo, nivel, ex);
    // Ligar as maiúsculas também põe "maiúsculas" no destaque, se ele não tem: sem isso, o botão não faria nada.
    const ligarMaiusculas: Escrita = [["maiúsculas sozinho", "sim"]];
    if (!partes["maiúsculas"]) ligarMaiusculas.push(["destaque", alternarDestaque(textoDoDestaque, "maiúsculas", true)]);
    linhas.push(chave("Maiúsculas sozinho", ["maiúsculas sozinho", "destaque"], maiusculas, maiusculas ? [["maiúsculas sozinho", "não"]] : ligarMaiusculas));
    const paginaNova = comecaEmPaginaNova(modelo, nivel, tipoDeTrabalho, ex);
    linhas.push(chave("Começar em página nova", ["página nova"], paginaNova, [["página nova", paginaNova ? "não" : "sim"]]));
  }
  return linhas.map((l) => ({ ...l, deExcecao: l.propriedades.some((p) => temExcecao(bloco.excecoes, p)) }));
}

/** As propriedades em que o bloco tem exceção, com o nome que a pessoa lê ("alinhamento", "página nova"). */
export function excecoesDoBloco(bloco: BlocoAjustavel): string[] {
  return propriedadesComExcecao(bloco.elemento).filter((p) => temExcecao(bloco.excecoes, p));
}

/** O alto da janelinha: de onde vem o que vale para o bloco. */
export function origemDaJanelinha(modelo: ModeloResolvido, bloco: BlocoAjustavel, aplicarA: AplicarA): string {
  const propria = excecoesDoBloco(bloco);
  if (aplicarA === "este" && propria.length) return `Só neste ${bloco.tipo}: ${propria.join(", ")}. O resto vem do modelo.`;
  const primeira = bloco.tipo === "parágrafo" ? "alinhamento" : "destaque";
  const p = deOndeVemNoBloco(modelo, bloco.elemento, primeira, undefined);
  return p ? descreverProcedencia(p, bloco.tipo) : "Vem do modelo.";
}

// ---------------------------------------------------------------------------
// Escrever "só este"

export type ResultadoDoSoEste = { ok: true; excecoes: Excecoes | undefined; avisos: string[] } | { ok: false; erro: string };

/** "Só este": aplica a escrita (uma ou mais propriedades) às exceções do bloco. */
export function escreverSoEste(modelo: ModeloResolvido, bloco: BlocoAjustavel, escrita: Escrita): ResultadoDoSoEste {
  let excecoes = bloco.excecoes;
  const avisos: string[] = [];
  for (const [propriedade, escrito] of escrita) {
    const r = mudarSoEste(modelo, bloco.elemento, excecoes, propriedade, escrito);
    if (!r.ok) return r;
    excecoes = r.resultado;
    if (r.aviso) avisos.push(r.aviso);
  }
  return { ok: true, excecoes, avisos };
}

export type ResultadoDosTodos = { ok: true; ajustes: Record<string, string>; avisos: string[] } | { ok: false; erro: string };

/**
 * "Todos os iguais": aplica a escrita ao elemento inteiro, nas escolhas do
 * trabalho. `base` é o modelo do trabalho sem as escolhas; `ajustes`, as
 * escolhas dele para esse modelo.
 */
export function escreverTodos(base: ModeloResolvido, ajustes: Record<string, string>, elemento: string, escrita: Escrita): ResultadoDosTodos {
  let atuais = ajustes;
  const avisos: string[] = [];
  for (const [propriedade, escrito] of escrita) {
    const r = mudarTodos(base, atuais, elemento, propriedade, escrito);
    if (!r.ok) return r;
    atuais = r.resultado;
    if (r.aviso) avisos.push(r.aviso);
  }
  return { ok: true, ajustes: atuais, avisos };
}

// ---------------------------------------------------------------------------
// O quadro de valores da barra

const primeiraMaiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * "No PDF: Times New Roman · 12 · esp. 1,5 · Justificado" (parágrafo) ou
 * "No PDF: Título 1 · negrito, maiúsculas · numerado · página nova" (título).
 * Null quando o bloco não tem janelinha.
 */
export function quadroDosValores(modelo: ModeloResolvido, tipoDeTrabalho: TipoDeTrabalho, bloco: BlocoAjustavel | null): string | null {
  if (!bloco) return null;
  const ex = bloco.excecoes;
  const texto = (propriedade: string) => valorNoBloco(modelo, bloco.elemento, propriedade, ex)?.texto;
  if (bloco.tipo === "parágrafo") {
    const fonte = valorEfetivo(modelo, bloco.elemento, "fonte")?.texto;
    const tamanho = valorEfetivo(modelo, bloco.elemento, "tamanho")?.texto.replace(/\s*pt$/, "");
    const entrelinha = texto("entrelinha");
    const alinhamento = texto("alinhamento");
    return ["No PDF: " + (fonte ?? "—"), tamanho, entrelinha && `esp. ${entrelinha}`, alinhamento && primeiraMaiuscula(alinhamento)].filter(Boolean).join(" · ");
  }
  const nivel = bloco.nivel!;
  const partes = partesDoDestaque(valorNoBloco(modelo, bloco.elemento, "destaque", ex));
  const destaques: string[] = (["negrito", "itálico", "sublinhado"] as const).filter((p) => partes[p]);
  if (vaiEmMaiusculas(modelo, nivel, ex)) destaques.push("maiúsculas");
  return [
    `No PDF: Título ${nivel}`,
    destaques.length ? destaques.join(", ") : "sem destaque",
    numeraSozinho(modelo, nivel, ex) ? "numerado" : "sem número",
    comecaEmPaginaNova(modelo, nivel, tipoDeTrabalho, ex) ? "página nova" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
