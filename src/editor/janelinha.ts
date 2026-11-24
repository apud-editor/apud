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
import { NO_DA_CITACAO_LONGA } from "../documento/tiptap";

/** Um bloco do texto que tem janelinha: parágrafo, título ou citação longa. */
export interface BlocoAjustavel {
  /** O elemento na árvore: "paragrafo", "titulos.nivel2", "citacaoLonga". */
  elemento: string;
  tipo: "parágrafo" | "título" | "citação longa";
  nivel?: NivelDeTitulo;
  excecoes?: Excecoes;
}

/** O bloco de nível mais alto do editor, se for parágrafo, título ou citação longa. Os outros (listas, figuras...) ainda não têm janelinha. */
export function blocoAjustavel(no: NoPM | null | undefined): BlocoAjustavel | null {
  if (!no) return null;
  const excecoes = (no.attrs.excecoes as Excecoes | null) ?? undefined;
  if (no.type.name === "paragraph") return { elemento: "paragrafo", tipo: "parágrafo", excecoes };
  if (no.type.name === NO_DA_CITACAO_LONGA) return { elemento: "citacaoLonga", tipo: "citação longa", excecoes };
  if (no.type.name === "heading") {
    const nivel = no.attrs.level as NivelDeTitulo;
    return { elemento: `titulos.nivel${nivel}`, tipo: "título", nivel, excecoes };
  }
  return null;
}

/** "Parágrafo", "Título 2", "Citação longa". */
export function nomeDoBloco(b: BlocoAjustavel): string {
  return b.tipo === "parágrafo" ? "Parágrafo" : b.tipo === "citação longa" ? "Citação longa" : `Título ${b.nivel}`;
}

/** "deste parágrafo", "desta citação longa": para as frases da janelinha. */
export function desteBloco(b: BlocoAjustavel): string {
  return `${b.tipo === "citação longa" ? "desta" : "deste"} ${b.tipo}`;
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
  /**
   * Escreve sempre em "todos os iguais" deste elemento, qualquer que seja o
   * "Aplicar a" (a fonte e o tamanho valem para o trabalho todo: "texto").
   */
  todosEm?: string;
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
  /** A linha vale para o trabalho todo (a fonte e o tamanho), fora do "Aplicar a". */
  doTrabalho?: boolean;
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
    linhas.push(...linhasDaFonte(modelo));
  } else if (bloco.tipo === "citação longa") {
    const medida = (propriedade: string) => {
      const x = v(propriedade)?.valor;
      return x?.tipo === "medida" ? x.numero : undefined;
    };
    const tamanho = medida("tamanho");
    linhas.push(
      opcoes(
        "Tamanho da letra",
        "tamanho",
        [9, 10, 11, 12].map((n) => ({ rotulo: String(n), escrito: `${n} pt`, ativa: tamanho === n })),
      ),
    );
    const entrelinha = v("entrelinha")?.valor;
    const numero = entrelinha?.tipo === "espacamento" ? entrelinha.numero : undefined;
    linhas.push(
      opcoes("Espaçamento entre linhas", "entrelinha", [
        { rotulo: "1", escrito: "simples", ativa: numero === 1 },
        { rotulo: "1,5", escrito: "1,5", ativa: numero === 1.5 },
        { rotulo: "2", escrito: "duplo", ativa: numero === 2 },
      ]),
    );
    const recuo = medida("recuo à esquerda");
    linhas.push(
      opcoes("Recuo à esquerda", "recuo à esquerda", [
        { rotulo: "4 cm", escrito: "4 cm", ativa: recuo === 4 },
        { rotulo: "2 cm", escrito: "2 cm", ativa: recuo === 2 },
        { rotulo: "1,27 cm", escrito: "1,27 cm", ativa: recuo === 1.27 },
        { rotulo: "Nenhum", escrito: "0 cm", ativa: recuo === 0 },
      ]),
    );
    const alinhamento = opcao("alinhamento");
    linhas.push(
      opcoes("Alinhamento", "alinhamento", [
        { rotulo: "Esquerda", escrito: "à esquerda", ativa: alinhamento === "à esquerda" },
        { rotulo: "Justificado", escrito: "justificado", ativa: alinhamento === "justificado" },
      ]),
    );
    const antes = v("espaço antes")?.valor;
    const depois = v("espaço depois")?.valor;
    const linhasAntes = antes?.tipo === "quantidade" ? antes.numero : undefined;
    const linhasDepois = depois?.tipo === "quantidade" ? depois.numero : undefined;
    linhas.push({
      rotulo: "Espaço antes e depois",
      forma: "opcoes",
      propriedades: ["espaço antes", "espaço depois"],
      opcoes: [
        { rotulo: "Nenhum", ativa: linhasAntes === 0 && linhasDepois === 0, escrita: [["espaço antes", "nenhuma"], ["espaço depois", "nenhuma"]] },
        { rotulo: "1 linha", ativa: linhasAntes === 1 && linhasDepois === 1, escrita: [["espaço antes", "1 linha"], ["espaço depois", "1 linha"]] },
      ],
    });
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

// ---------------------------------------------------------------------------
// A fonte e o tamanho do trabalho (etapa 3b): no ⚙ do parágrafo e nas Configurações

/** As fontes que o Apud oferece: as mais usadas em trabalhos científicos, todas com reserva de mesmas medidas no PDF. */
export const FONTES_DO_TRABALHO = ["Times New Roman", "Arial", "Calibri", "Georgia"] as const;
export const TAMANHOS_DO_TRABALHO = [10, 11, 12, 13, 14] as const;

/**
 * As duas linhas "Fonte" e "Tamanho", que valem para o trabalho todo (o
 * elemento Texto, em "todos os iguais"). Na APA, a fonte e o tamanho são
 * escolhidos juntos ("Calibri 11 pt"): trocar a fonte leva o tamanho que a APA
 * pede para ela, e trocar o tamanho escreve o par com a fonte de agora (fora
 * das opções da APA, com aviso). Na ABNT, cada um é escrito sozinho.
 */
export function linhasDaFonte(modelo: ModeloResolvido): LinhaDaJanelinha[] {
  const fonte = valorEfetivo(modelo, "texto", "fonte")?.texto ?? "";
  const t = valorEfetivo(modelo, "texto", "tamanho")?.valor;
  const tamanho = t?.tipo === "medida" ? t.numero : undefined;
  const par = modelo.atalhos.get("texto")?.get("fonte e tamanho");
  const pares = par?.situacao.tipo === "escolha" ? par.situacao.opcoes : [];
  const escritaDaFonte = (f: string): Escrita => {
    if (!par) return [["fonte", f]];
    const daNorma = pares.find((x) => normalizar(x).startsWith(normalizar(f) + " "));
    return [["fonte e tamanho", daNorma ?? `${f} ${String(tamanho ?? 12).replace(".", ",")} pt`]];
  };
  const escritaDoTamanho = (n: number): Escrita => (par ? [["fonte e tamanho", `${fonte} ${n} pt`]] : [["tamanho", `${n} pt`]]);
  const propriedades = par ? ["fonte e tamanho"] : ["fonte", "tamanho"];
  return [
    {
      rotulo: "Fonte do trabalho",
      forma: "opcoes",
      propriedades,
      deExcecao: false,
      doTrabalho: true,
      opcoes: FONTES_DO_TRABALHO.map((f) => ({ rotulo: f, ativa: normalizar(f) === normalizar(fonte), escrita: escritaDaFonte(f), todosEm: "texto" })),
    },
    {
      rotulo: "Tamanho da letra",
      forma: "opcoes",
      propriedades,
      deExcecao: false,
      doTrabalho: true,
      opcoes: TAMANHOS_DO_TRABALHO.map((n) => ({ rotulo: String(n), ativa: tamanho === n, escrita: escritaDoTamanho(n), todosEm: "texto" })),
    },
  ];
}

/** As propriedades em que o bloco tem exceção, com o nome que a pessoa lê ("alinhamento", "página nova"). */
export function excecoesDoBloco(bloco: BlocoAjustavel): string[] {
  return propriedadesComExcecao(bloco.elemento).filter((p) => temExcecao(bloco.excecoes, p));
}

/** O alto da janelinha: de onde vem o que vale para o bloco. */
export function origemDaJanelinha(modelo: ModeloResolvido, bloco: BlocoAjustavel, aplicarA: AplicarA): string {
  const propria = excecoesDoBloco(bloco);
  if (aplicarA === "este" && propria.length) return `Só ${bloco.tipo === "citação longa" ? "nesta" : "neste"} ${bloco.tipo}: ${propria.join(", ")}. O resto vem do modelo.`;
  const primeira = bloco.tipo === "parágrafo" ? "alinhamento" : bloco.tipo === "citação longa" ? "recuo à esquerda" : "destaque";
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
  if (bloco.tipo === "citação longa") {
    const tamanho = texto("tamanho")?.replace(/\s*pt$/, "");
    const entrelinha = texto("entrelinha");
    const recuo = texto("recuo à esquerda");
    return ["No PDF: Citação longa", tamanho && `${tamanho} pt`, entrelinha && `esp. ${entrelinha}`, recuo && (recuo === "0 cm" ? "sem recuo" : `recuo ${recuo}`)].filter(Boolean).join(" · ");
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
