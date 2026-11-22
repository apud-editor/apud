// O conversor: junta o texto do trabalho (blocos) com o perfil da norma e
// escreve o código Typst, que o motor Typst transforma em páginas.
//
// Todas as medidas vêm do perfil (margens, fonte, entrelinhas, recuos, títulos,
// listas, número de página). Nada de norma fica escrito aqui: mudar o perfil
// muda o PDF. Os perfis da ABNT e da APA dão nomes diferentes a algumas regras
// ("margens, esquerda" e "margens"; "família da fonte" e "fonte"); a classe
// Regras lê as duas formas.
//
// O que fica com a pessoa (decisão de 20/11/2026): as letras dos títulos saem
// como ela escreveu (o Apud não põe em maiúsculas), o número do título é o que
// ela escreveu ("1.1 Contexto"), a página nova só acontece onde ela pôs uma
// quebra de página, e a lista de referências sai onde ela pôs o bloco "Lista
// de referências". Tudo o que sai no PDF tem um lugar no editor.
//
// Citações e referências (fase 2): cada citação é montada pelo motor de
// citações (citacoes/motor.ts) com as regras do perfil, e uma marca invisível
// põe a obra na lista. A lista é montada pelo estilo CSL dentro do Typst, só
// com as obras citadas.
//
// Entrelinhas como no Word: no Word, a linha "simples" mede 1,15 vez o tamanho
// da fonte (Times 12 pt = 13,8 pt), e 1,5 linha mede 1,5 vez isso (20,7 pt).
// Aqui, cada linha é uma caixa de 1,15 em, e o espaço entre as caixas completa
// o resto.

import {
  ehCitacao,
  ehNota,
  ehTexto,
  type Bloco,
  type Documento,
  type ItemDeLista,
  type NivelDeTitulo,
  type Trecho,
  type TrechoDeTexto,
} from "../documento/modelo";
import { separarNumero } from "../documento/estrutura";
import type { PerfilResolvido, Valor } from "../perfis";
import { criarMotor, temGrifo, type Motor, type Pedaco } from "../citacoes/motor";

/** Altura da linha simples, em "em" (vezes o tamanho da fonte), como no Word. */
const LINHA_SIMPLES = 1.15;

export interface OpcoesDoConversor {
  /** Nome do trabalho, que vai para as propriedades do PDF. */
  titulo?: string;
  /**
   * O estilo CSL da norma (perfis/norma.ts), que monta a lista de referências.
   * Obrigatório quando o texto tem a lista de referências e citações.
   */
  csl?: string;
}

// ---------------------------------------------------------------------------
// Leitura das regras do perfil

class Regras {
  constructor(readonly perfil: PerfilResolvido) {}

  /** O texto de uma regra, ou undefined se o perfil não tem a regra. */
  talvez(chave: string): string | undefined {
    const r = this.perfil.regras.get(chave);
    return r && r.situacao.tipo !== "desligada" ? r.texto : undefined;
  }

  tem(chave: string): boolean {
    return this.talvez(chave) !== undefined;
  }

  /** A primeira das regras que o perfil tem (os perfis dão nomes diferentes à mesma regra). */
  primeira(...chaves: string[]): string {
    const chave = chaves.find((c) => this.tem(c));
    if (!chave) throw new Error(`o perfil ${this.perfil.identificacao.perfil} não tem a regra "${chaves[0]}"`);
    return chave;
  }

  private valor(chave: string): Valor {
    const r = this.perfil.regras.get(chave);
    if (!r) throw new Error(`o perfil ${this.perfil.identificacao.perfil} não tem a regra "${chave}"`);
    return r.valor;
  }

  medida(chave: string): string {
    const v = this.valor(chave);
    if (v.tipo !== "medida") throw new Error(`a regra "${chave}" precisa ser uma medida`);
    return `${numero(v.numero)}${v.unidade}`;
  }

  numero(chave: string): number {
    const v = this.valor(chave);
    if (v.tipo === "espacamento" || v.tipo === "quantidade" || v.tipo === "medida") return v.numero;
    throw new Error(`a regra "${chave}" precisa ser um número`);
  }

  opcao(chave: string): string {
    const v = this.valor(chave);
    if (v.tipo === "opcao" || v.tipo === "texto") return v.valor;
    throw new Error(`a regra "${chave}" precisa ser uma opção`);
  }

  destaque(chave: string) {
    const v = this.valor(chave);
    if (v.tipo !== "destaque") throw new Error(`a regra "${chave}" precisa ser um destaque`);
    return v;
  }

  // --- Regras com nomes diferentes na ABNT e na APA ---

  /** Margens: ABNT dá uma por lado; APA, uma só para todos. */
  margens() {
    if (this.tem("margens, esquerda")) {
      return {
        esquerda: this.medida("margens, esquerda"),
        superior: this.medida("margens, superior"),
        direita: this.medida("margens, direita"),
        inferior: this.medida("margens, inferior"),
      };
    }
    const todas = this.medida("margens");
    return { esquerda: todas, superior: todas, direita: todas, inferior: todas };
  }

  /** Fonte: ABNT tem família e tamanho; APA, as duas juntas ("Times New Roman 12 pt"). */
  fonte(): { familia: string; tamanho: string } {
    if (this.tem("família da fonte")) return { familia: this.opcao("família da fonte"), tamanho: this.medida("tamanho da fonte") };
    const m = this.opcao("fonte").match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*pt$/);
    if (!m) throw new Error(`a regra "fonte" precisa ter a família e o tamanho, como "Times New Roman 12 pt"`);
    return { familia: m[1], tamanho: `${m[2].replace(",", ".")}pt` };
  }

  /** Tamanho menor (ABNT: número de página, citações longas, notas). Sem a regra, o mesmo do texto. */
  fonteMenor(): string {
    return this.tem("fonte menor") ? this.medida("fonte menor") : this.fonte().tamanho;
  }
}

function numero(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/** A fonte pedida e outra com as mesmas medidas, para quando a pedida não estiver instalada. */
function fontes(familia: string): string {
  const parecidas: Record<string, string> = {
    "times new roman": "Liberation Serif",
    georgia: "Liberation Serif",
    arial: "Liberation Sans",
    calibri: "Liberation Sans",
    aptos: "Liberation Sans",
  };
  const reserva = parecidas[familia.toLowerCase()] ?? "Liberation Serif";
  return `(${texto(familia)}, ${texto(reserva)})`;
}

/** Um texto como string do Typst, entre aspas. */
function texto(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\u0000-\u001f]/g, (c) => `\\u{${c.charCodeAt(0).toString(16)}}`)}"`;
}

/**
 * Texto da pessoa dentro do código Typst. Sinais que o Typst entende como
 * comando (# * _ $ @ < [ ] \ e outros) ganham uma barra antes e saem como estão.
 * As aspas ficam livres: o Typst as troca pelas aspas curvas do português.
 */
export function escaparTexto(s: string): string {
  return s.replace(/[!#-&(-/:-@[-`{-~]/g, (c) => `\\${c}`).replace(/[\u0000-\u001f]/g, " ");
}

// ---------------------------------------------------------------------------

/** As medidas que os blocos usam, já lidas do perfil. */
interface Medidas {
  /** Espaço entre as caixas das linhas (entrelinhas). */
  entre: string;
  /** Uma linha inteira, para "1 linha em branco". */
  passo: string;
  /** Recuo de parágrafo. */
  recuo: string;
  /** Títulos que continuam na mesma linha do texto (APA, níveis 4 e 5). */
  naMesmaLinha: Set<NivelDeTitulo>;
  /** O que fecha um título na mesma linha ("." na APA). */
  finalNaMesmaLinha: string;
  listas: {
    recuo: string;
    recuoSub: string;
    /** Como numerar: "a)" (ABNT, alíneas), "1." (APA, em sequência), "•" (APA, sem sequência). */
    marcador: (sequencia: boolean, nivel: number, i: number) => string;
  };
}

/** Escreve o código Typst do trabalho. */
export function documentoParaTypst(doc: Documento, perfil: PerfilResolvido, opcoes: OpcoesDoConversor = {}): string {
  const r = new Regras(perfil);
  const k = r.numero("entrelinhas");
  const entre = `${numero((k - 1) * LINHA_SIMPLES)}em`;
  const passo = `${numero(k * LINHA_SIMPLES)}em`;
  const justificado = r.opcao("alinhamento") === "justificado";
  const fonte = r.fonte();
  const margens = r.margens();

  const linhas: string[] = [];
  const l = (s = "") => linhas.push(s);

  l(`// Gerado pelo Apud com o perfil ${perfil.identificacao.perfil} ${perfil.identificacao.versao}, revisão ${perfil.identificacao.revisao}.`);
  if (opcoes.titulo) l(`#set document(title: ${texto(opcoes.titulo)})`);

  // Página e número de página
  l(`#set page(`);
  l(`  paper: "a4",`);
  l(`  margin: (left: ${margens.esquerda}, top: ${margens.superior}, right: ${margens.direita}, bottom: ${margens.inferior}),`);
  // A capa e a folha de rosto (fase 3) vão mudar onde a contagem começa; sem elas, o texto começa na página 1.
  l(`  foreground: context place(${lugarDoNumero(r, margens.direita)}, text(size: ${r.fonteMenor()}, top-edge: "cap-height", bottom-edge: "baseline", counter(page).display("1"))),`);
  l(`)`);

  // Texto
  l(
    `#set text(font: ${fontes(fonte.familia)}, size: ${fonte.tamanho}, lang: "pt", region: "BR", top-edge: 0.8em, bottom-edge: -0.35em, hyphenate: false, overhang: false)`,
  );
  const recuo = r.medida("recuo de parágrafo");
  l(`#set par(justify: ${justificado}, leading: ${entre}, spacing: ${entre}, first-line-indent: (amount: ${recuo}, all: true))`);

  // Títulos
  const medidas: Medidas = {
    entre,
    passo,
    recuo,
    naMesmaLinha: new Set(([1, 2, 3, 4, 5] as NivelDeTitulo[]).filter((n) => r.talvez(`título nível ${n}, texto depois`) === "na mesma linha")),
    finalNaMesmaLinha: r.talvez("títulos na mesma linha, final") === "ponto" ? "." : "",
    listas: listas(r),
  };
  escreverTitulos(l, r, medidas);

  // Itens de lista: o marcador numa coluna, o texto alinhado ao lado.
  l(`#let alinea(recuo, marcador, corpo) = block(above: ${entre}, below: ${entre}, pad(left: recuo, grid(columns: (auto, 1fr), column-gutter: 0.25em, marcador, {`);
  l(`  set par(first-line-indent: 0pt)`);
  l(`  corpo`);
  l(`})))`);
  l();

  // As citações são montadas na ordem do texto (algumas regras dependem da primeira citação).
  const motor = criarMotor(doc, perfil);
  const escrita: Escrita = {
    motor,
    enfase: enfaseDepoisDoDestaque(r),
    lista: () => {
      if (!motor.citadas.length) return "";
      if (!opcoes.csl) throw new Error("falta o estilo CSL da norma para montar a lista de referências");
      return listaDeReferencias(motor, r, opcoes.csl, medidas);
    },
  };
  for (let i = 0; i < doc.blocos.length; i++) {
    const b = doc.blocos[i];
    // Título na mesma linha do texto (APA, níveis 4 e 5): junta com o parágrafo seguinte.
    const seguinte = doc.blocos[i + 1];
    if (b.tipo === "titulo" && medidas.naMesmaLinha.has(b.nivel) && temConteudo(b.trechos) && seguinte?.tipo === "paragrafo" && temConteudo(seguinte.trechos)) {
      l(tituloNaMesmaLinha(b.nivel, b.trechos, seguinte.trechos, medidas, escrita));
      i++;
      continue;
    }
    const s = blocoParaTypst(b, medidas, escrita);
    if (s) l(s);
  }
  return linhas.join("\n") + "\n";
}

/**
 * Onde fica o número da página. ABNT: a uma distância das bordas (2 cm do topo
 * e da direita). APA: no cabeçalho, a uma distância do topo, alinhado à
 * margem direita.
 */
function lugarDoNumero(r: Regras, margemDireita: string): string {
  const posicao = r.opcao(r.primeira("numeração de página, posição", "número de página, posição"));
  if (r.tem("numeração de página, distância das bordas")) {
    const d = r.medida("numeração de página, distância das bordas");
    if (posicao === "canto inferior direito") return `bottom + right, dx: -${d}, dy: -${d}`;
    if (posicao === "centro inferior") return `bottom + center, dy: -${d}`;
    return `top + right, dx: -${d}, dy: ${d}`;
  }
  const topo = r.medida("número de página, distância do topo");
  return `top + right, dx: -${margemDireita}, dy: ${topo}`;
}

/** O marcador dos itens de lista, pelas regras do perfil. */
function listas(r: Regras): Medidas["listas"] {
  // ABNT: alíneas a), b) nas duas formas de lista; sub-alíneas com travessão.
  if (r.tem("alíneas, marcador")) {
    const sub = r.talvez("sub-alíneas, marcador") === "travessão" ? "—" : "–";
    return {
      recuo: r.medida("alíneas, recuo"),
      recuoSub: r.medida("sub-alíneas, recuo a mais"),
      marcador: (_s, nivel, i) => (nivel === 0 ? `${letraDaAlinea(i)})` : sub),
    };
  }
  // APA: números só nas listas em sequência; marcadores nas outras.
  const numerado = r.opcao("listas em sequência, marcador");
  const marca = r.opcao("listas sem sequência, marcador");
  return {
    recuo: r.medida("listas, recuo"),
    recuoSub: r.medida("sub-listas, recuo a mais"),
    marcador: (sequencia, _n, i) => (sequencia ? numerado.replace("1", String(i + 1)) : marca),
  };
}

/** A regra de destaque de cada nível de título, como função do Typst, e a forma de cada nível. */
function escreverTitulos(l: (s?: string) => void, r: Regras, m: Medidas) {
  const antes = r.tem("títulos, espaço antes") ? r.numero("títulos, espaço antes") : 0;
  const depois = r.tem("títulos, espaço depois") ? r.numero("títulos, espaço depois") : 0;
  l(`#let destaque-do-titulo(n, x) = {`);
  for (let nivel = 1; nivel <= 5; nivel++) {
    const d = r.destaque(`título nível ${nivel}, destaque`);
    // "Maiúsculas" não é aplicado: o título sai com as letras que a pessoa escreveu.
    let x = "x";
    if (d.negrito) x = `strong(${x})`;
    if (d.italico) x = `emph(${x})`;
    if (d.sublinhado) x = `underline(${x})`;
    l(`  ${nivel === 1 ? "if" : "else if"} n == ${nivel} { ${x} }`);
  }
  l(`  else { x }`);
  l(`}`);
  // Posição de cada nível (APA): centralizado, à esquerda ou com recuo de parágrafo.
  l(`#let posicao-do-titulo(n, x) = {`);
  for (let nivel = 1; nivel <= 5; nivel++) {
    const p = r.talvez(`título nível ${nivel}, posição`);
    const x = p === "centralizado" ? "align(center, x)" : p === "com recuo" ? `pad(left: ${m.recuo}, x)` : "x";
    l(`  ${nivel === 1 ? "if" : "else if"} n == ${nivel} { ${x} }`);
  }
  l(`  else { x }`);
  l(`}`);
  l(`#show heading: it => {`);
  // O número que a pessoa escreveu, um espaço e o título; as linhas seguintes
  // ficam sob a primeira letra do título. Sem número escrito: só o título.
  l(`  set par(justify: false, first-line-indent: 0pt)`);
  l(`  let d(x) = destaque-do-titulo(it.level, x)`);
  l(
    `  let corpo = if it.numbering == none { d(it.body) } else { grid(columns: (auto, 1fr), column-gutter: 0.25em, d(counter(heading).display(it.numbering)), d(it.body)) }`,
  );
  l(`  block(width: 100%, above: ${m.entre} + ${numero(antes)} * ${m.passo}, below: ${m.entre} + ${numero(depois)} * ${m.passo}, sticky: true, posicao-do-titulo(it.level, corpo))`);
  l(`}`);
  // Os títulos não têm tamanho próprio: usam o da fonte do texto.
  l(`#show heading: set text(size: ${r.fonte().tamanho}, weight: "regular")`);
}

// ---------------------------------------------------------------------------
// Referências

/**
 * O título e a lista de referências, onde a pessoa pôs o bloco. O título vem
 * do perfil e tem a forma de um título de nível 1 sem número, centralizado se
 * o perfil manda (ABNT: REFERÊNCIAS; APA: Referências). A lista vem do CSL:
 *   - ABNT: espaço simples e uma linha em branco entre as referências;
 *   - APA: o espaço do texto, sem linha em branco, e as linhas seguintes recuadas.
 */
function listaDeReferencias(motor: Motor, r: Regras, csl: string, m: Medidas): string {
  const rotulo = r.talvez("rótulo das referências") ?? "Referências";
  const centralizado =
    r.talvez("títulos sem número, alinhamento") === "centralizado" || r.talvez("rótulos de seção, alinhamento") === "centralizado";
  const titulo = `heading(level: 1, numbering: none, outlined: true)[${escaparTexto(rotulo)}]`;
  const simples = (r.talvez("espaço simples, onde") ?? "").includes("referências");
  const linhasEmBranco = r.perfil.regras.get("referências, entre uma e outra")?.valor;
  const branco = linhasEmBranco?.tipo === "quantidade" ? linhasEmBranco.numero : 0;
  const passoSimples = `${numero(LINHA_SIMPLES)}em`;
  const entreLinhas = simples ? "0em" : m.entre;
  const entreReferencias = simples ? `${branco} * ${passoSimples}` : `${m.entre} + ${branco} * ${passoSimples}`;
  const justificar = !["à esquerda"].includes(r.talvez("referências, alinhamento") ?? r.opcao("alinhamento"));
  const pendente = r.tem("referências, recuo das linhas seguintes") ? r.medida("referências, recuo das linhas seguintes") : "0pt";
  const dados = JSON.stringify(motor.referenciasDoTypst);
  return [
    centralizado ? `#align(center, ${titulo})` : `#${titulo}`,
    `#{`,
    `  set par(justify: ${justificar}, first-line-indent: 0pt, hanging-indent: ${pendente}, leading: ${entreLinhas}, spacing: ${entreReferencias})`,
    `  set block(spacing: ${entreReferencias})`,
    `  bibliography(bytes(${texto(dados)}), style: bytes(${texto(csl)}), title: none)`,
    `}`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Texto e citações

interface Escrita {
  motor: Motor;
  /** APA: a expressão "[ênfase adicionada]", que vai logo depois do trecho destacado. */
  enfase?: string;
  /** O Typst da lista de referências, para o bloco da lista. */
  lista: () => string;
}

/** Na APA, o destaque seu vai dentro da citação, depois do trecho em itálico: "[ênfase adicionada]". */
function enfaseDepoisDoDestaque(r: Regras): string | undefined {
  if (r.talvez("citação, destaque seu, onde") !== "entre colchetes, depois do trecho destacado") return undefined;
  const expressao = r.talvez("citação, destaque seu");
  return expressao ? `[${expressao}]` : undefined;
}

/**
 * Põe a expressão de destaque (APA) logo depois do último trecho em itálico
 * antes de cada citação com grifo. Se não há trecho em itálico, nada muda.
 */
export function posicionarEnfase(trechos: Trecho[], enfase: string | undefined): Trecho[] {
  if (!enfase || !trechos.some((t) => ehCitacao(t) && temGrifo(t.citacao))) return trechos;
  const saida: Trecho[] = [];
  let inicio = 0;
  for (const t of trechos) {
    if (ehCitacao(t)) {
      if (temGrifo(t.citacao)) {
        for (let j = saida.length - 1; j >= inicio; j--) {
          const antes = saida[j];
          if (ehTexto(antes) && antes.marcas?.includes("italico")) {
            saida.splice(j + 1, 0, { texto: ` ${enfase}` } as TrechoDeTexto);
            break;
          }
        }
      }
      saida.push(t);
      inicio = saida.length;
    } else {
      saida.push(t);
    }
  }
  return saida;
}

/** Os pedaços de uma citação no formato do Typst. */
export function pedacosParaTypst(pedacos: Pedaco[]): string {
  return pedacos.map((p) => (p.italico ? `#emph[${escaparTexto(p.texto)}]` : escaparTexto(p.texto))).join("");
}

/** Marca invisível que põe a obra na lista de referências. */
export const registrar = (id: string) => `#cite(label(${texto(id)}), form: none)`;

/** Se há algo escrito (texto ou citação), sem montar as citações. */
const temConteudo = (trechos: Trecho[]) => trechos.some((t) => !ehTexto(t) || t.texto.trim());

function blocoParaTypst(b: Bloco, m: Medidas, e: Escrita): string {
  switch (b.tipo) {
    case "paragrafo": {
      // Parágrafos vazios não viram linhas em branco: o espaço é da norma, não da pessoa.
      return temConteudo(b.trechos) ? `${trechosParaTypst(b.trechos, e)}\n` : "";
    }
    case "titulo": {
      if (!temConteudo(b.trechos)) return "";
      // O número escrito pela pessoa vai como a "numeração" do título: assim ele fica
      // numa coluna própria (para o alinhamento) e, no futuro, também no sumário.
      const { numero, trechos } = numeroDoTitulo(b.trechos);
      const numeracao = numero ? `(..n) => ${texto(numero)}` : "none";
      const fim = m.naMesmaLinha.has(b.nivel) ? finalDoTitulo(trechos, m) : "";
      return `#heading(level: ${b.nivel}, numbering: ${numeracao})[${trechosParaTypst(trechos, e)}${fim}]\n`;
    }
    case "lista":
      return listaParaTypst(b.itens, b.sequencia, 0, m, e) + "\n";
    case "quebra":
      // "weak": duas quebras seguidas não deixam uma página em branco.
      return "#pagebreak(weak: true)\n";
    case "referencias":
      return e.lista();
    // Fase 3, parte 1: os blocos novos já são lidos, mas a forma deles no PDF
    // (recuo, fonte menor, numeração das figuras e tabelas) chega na parte 2.
    // Até lá, a citação longa sai como um parágrafo, como antes.
    case "citacaoLonga":
      return temConteudo(b.trechos) ? `${trechosParaTypst(b.trechos, e)}\n` : "";
    case "figura":
    case "tabela":
      return `// ${b.tipo}: a forma no PDF chega na parte 2 da fase 3\n`;
  }
}

/** O ponto que fecha um título na mesma linha (APA), se a pessoa não pôs pontuação. */
function finalDoTitulo(trechos: Trecho[], m: Medidas): string {
  const ultimo = [...trechos].reverse().find((t) => ehTexto(t) && t.texto.trim());
  const termina = ultimo && ehTexto(ultimo) ? /[.?!:]$/.test(ultimo.texto.trim()) : false;
  return m.finalNaMesmaLinha && !termina ? escaparTexto(m.finalNaMesmaLinha) : "";
}

/**
 * Título que continua na mesma linha do texto (APA, níveis 4 e 5): um
 * parágrafo só, começando pelo título com o destaque do nível e o ponto.
 */
function tituloNaMesmaLinha(nivel: NivelDeTitulo, titulo: Trecho[], paragrafo: Trecho[], m: Medidas, e: Escrita): string {
  const { trechos } = numeroDoTitulo(titulo);
  const corpo = `${trechosParaTypst(trechos, e)}${finalDoTitulo(trechos, m)}`;
  return `#destaque-do-titulo(${nivel}, [${corpo}]) ${trechosParaTypst(paragrafo, e)}\n`;
}

/** Tira do começo do título o número que a pessoa escreveu ("1.1 "). */
function numeroDoTitulo(trechos: Trecho[]): { numero: string; trechos: Trecho[] } {
  const primeiro = trechos[0];
  if (!primeiro || !ehTexto(primeiro)) return { numero: "", trechos };
  const { numero, resto } = separarNumero(primeiro.texto);
  if (!numero) return { numero: "", trechos };
  return { numero, trechos: [{ ...primeiro, texto: resto }, ...trechos.slice(1)] };
}

function listaParaTypst(itens: ItemDeLista[], sequencia: boolean, nivel: number, m: Medidas, e: Escrita): string {
  const recuo = nivel === 0 ? m.listas.recuo : `${m.listas.recuo} + ${nivel} * ${m.listas.recuoSub}`;
  const partes: string[] = [];
  let i = 0;
  for (const item of itens) {
    if (temConteudo(item.trechos)) {
      const corpo = trechosParaTypst(item.trechos, e);
      partes.push(`#alinea(${recuo}, [${escaparTexto(m.listas.marcador(sequencia, nivel, i++))}], [${corpo}])`);
    }
    if (item.subitens?.length) partes.push(listaParaTypst(item.subitens, sequencia, nivel + 1, m, e));
  }
  return partes.join("\n");
}

/** a, b, ..., z, aa, ab, ... */
export function letraDaAlinea(i: number): string {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** O texto de um parágrafo, título ou item, com as citações montadas na norma. */
function trechosParaTypst(trechos: Trecho[], e: Escrita): string {
  return posicionarEnfase(trechos, e.enfase)
    .map((t) => {
      if (ehCitacao(t)) {
        const c = e.motor.montar(t.citacao);
        return c.obras.map(registrar).join("") + pedacosParaTypst(c.pedacos);
      }
      // A forma da nota (fonte menor, filete) vem do perfil na parte 2; por ora, a nota padrão do Typst.
      if (ehNota(t)) return `#footnote[${trechosParaTypst(t.nota.trechos, e)}]`;
      let s = escaparTexto(t.texto);
      const m = t.marcas ?? [];
      if (m.includes("sobrescrito")) s = `#super[${s}]`;
      if (m.includes("italico")) s = `#emph[${s}]`;
      if (m.includes("negrito")) s = `#strong[${s}]`;
      return s;
    })
    .join("");
}
