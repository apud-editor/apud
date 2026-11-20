// O conversor: junta o texto do trabalho (blocos) com o perfil da norma e
// escreve o código Typst, que o motor Typst transforma em páginas.
//
// Todas as medidas vêm do perfil (margens, fonte, entrelinhas, recuos, títulos,
// alíneas, número de página). Nada de norma fica escrito aqui: mudar o perfil
// muda o PDF.
//
// O que fica com a pessoa (decisão de 20/11/2026): as letras dos títulos saem
// como ela escreveu (o Apud não põe em maiúsculas), o número do título é o que
// ela escreveu ("1.1 Contexto") e a página nova só acontece onde ela pôs uma
// quebra de página.
//
// Citações e referências (fase 2): cada citação é montada pelo motor de
// citações (citacoes/motor.ts) com as regras do perfil, e uma marca invisível
// põe a obra na lista. A lista de referências sai no fim, montada pelo estilo
// CSL dentro do Typst, só com as obras citadas.
//
// Entrelinhas como no Word: no Word, a linha "simples" mede 1,15 vez o tamanho
// da fonte (Times 12 pt = 13,8 pt), e 1,5 linha mede 1,5 vez isso (20,7 pt).
// Aqui, cada linha é uma caixa de 1,15 em, e o espaço entre as caixas completa
// o resto.

import { ehCitacao, type Bloco, type Documento, type ItemDeLista, type Trecho, type TrechoDeTexto } from "../documento/modelo";
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
   * Obrigatório quando o texto tem citações.
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

  sim(chave: string): boolean {
    const v = this.valor(chave);
    if (v.tipo !== "simnao") throw new Error(`a regra "${chave}" precisa ser sim ou não`);
    return v.valor;
  }

  destaque(chave: string) {
    const v = this.valor(chave);
    if (v.tipo !== "destaque") throw new Error(`a regra "${chave}" precisa ser um destaque`);
    return v;
  }
}

function numero(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/** A fonte pedida e outra com as mesmas medidas, para quando a pedida não estiver instalada. */
function fontes(familia: string): string {
  const parecidas: Record<string, string> = {
    "times new roman": "Liberation Serif",
    arial: "Liberation Sans",
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

/** Escreve o código Typst do trabalho. */
export function documentoParaTypst(doc: Documento, perfil: PerfilResolvido, opcoes: OpcoesDoConversor = {}): string {
  const r = new Regras(perfil);
  const k = r.numero("entrelinhas");
  const entre = `${numero((k - 1) * LINHA_SIMPLES)}em`; // espaço entre as caixas das linhas
  const passo = `${numero(k * LINHA_SIMPLES)}em`; // uma linha inteira (para "1 linha em branco")
  const justificado = r.opcao("alinhamento") === "justificado";
  const tamanhoMenor = r.medida("fonte menor");

  const linhas: string[] = [];
  const l = (s = "") => linhas.push(s);

  l(`// Gerado pelo Apud com o perfil ${perfil.identificacao.perfil} ${perfil.identificacao.versao}, revisão ${perfil.identificacao.revisao}.`);
  if (opcoes.titulo) l(`#set document(title: ${texto(opcoes.titulo)})`);

  // Página e número de página
  const distancia = r.medida("numeração de página, distância das bordas");
  const posicao = r.opcao("numeração de página, posição");
  const lugar =
    posicao === "canto inferior direito"
      ? `bottom + right, dx: -${distancia}, dy: -${distancia}`
      : posicao === "centro inferior"
        ? `bottom + center, dy: -${distancia}`
        : `top + right, dx: -${distancia}, dy: ${distancia}`;
  l(`#set page(`);
  l(`  paper: "a4",`);
  l(
    `  margin: (left: ${r.medida("margens, esquerda")}, top: ${r.medida("margens, superior")}, right: ${r.medida("margens, direita")}, bottom: ${r.medida("margens, inferior")}),`,
  );
  // A capa e a folha de rosto (fase 3) vão mudar onde a contagem começa; sem elas, o texto começa na página 1.
  l(`  foreground: context place(${lugar}, text(size: ${tamanhoMenor}, top-edge: "cap-height", bottom-edge: "baseline", counter(page).display("1"))),`);
  l(`)`);

  // Texto
  l(
    `#set text(font: ${fontes(r.opcao("família da fonte"))}, size: ${r.medida("tamanho da fonte")}, lang: "pt", region: "BR", top-edge: 0.8em, bottom-edge: -0.35em, hyphenate: false, overhang: false)`,
  );
  l(
    `#set par(justify: ${justificado}, leading: ${entre}, spacing: ${entre}, first-line-indent: (amount: ${r.medida("recuo de parágrafo")}, all: true))`,
  );

  // Títulos
  const antes = r.numero("títulos, espaço antes");
  const depois = r.numero("títulos, espaço depois");
  l(`#show heading: it => {`);
  l(`  let destaque(x) = {`);
  l(`    let n = it.level`);
  for (let nivel = 1; nivel <= 5; nivel++) {
    const d = r.destaque(`título nível ${nivel}, destaque`);
    // "Maiúsculas" não é aplicado: o título sai com as letras que a pessoa escreveu.
    let x = "x";
    if (d.negrito) x = `strong(${x})`;
    if (d.italico) x = `emph(${x})`;
    if (d.sublinhado) x = `underline(${x})`;
    l(`    ${nivel === 1 ? "if" : "else if"} n == ${nivel} { ${x} }`);
  }
  l(`    else { x }`);
  l(`  }`);
  // O número que a pessoa escreveu, um espaço e o título; as linhas seguintes
  // ficam sob a primeira letra do título. Sem número escrito: só o título.
  l(`  set par(justify: false, first-line-indent: 0pt)`);
  l(
    `  let corpo = if it.numbering == none { destaque(it.body) } else { grid(columns: (auto, 1fr), column-gutter: 0.25em, destaque(counter(heading).display(it.numbering)), destaque(it.body)) }`,
  );
  l(`  block(above: ${entre} + ${antes} * ${passo}, below: ${entre} + ${depois} * ${passo}, sticky: true, corpo)`);
  l(`}`);
  // Os títulos não têm tamanho próprio: usam o da fonte do texto.
  l(`#show heading: set text(size: ${r.medida("tamanho da fonte")}, weight: "regular")`);

  // Alíneas
  const recuoAlinea = r.medida("alíneas, recuo");
  const recuoSub = r.medida("sub-alíneas, recuo a mais");
  l(`#let alinea(recuo, marcador, corpo) = block(above: ${entre}, below: ${entre}, pad(left: recuo, grid(columns: (auto, 1fr), column-gutter: 0.25em, marcador, {`);
  l(`  set par(first-line-indent: 0pt)`);
  l(`  corpo`);
  l(`})))`);
  l();

  // As citações são montadas na ordem do texto (algumas regras dependem da primeira citação).
  const motor = criarMotor(doc, perfil);
  const escrita: Escrita = { motor, enfase: enfaseDepoisDoDestaque(r) };
  for (const b of doc.blocos) {
    const s = blocoParaTypst(b, { recuoAlinea, recuoSub }, escrita);
    if (s) l(s);
  }

  if (motor.citadas.length) {
    if (!opcoes.csl) throw new Error("falta o estilo CSL da norma para montar a lista de referências");
    l(listaDeReferencias(motor, r, opcoes.csl, { entre, passoSimples: `${numero(LINHA_SIMPLES)}em` }));
  }
  return linhas.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Referências

/**
 * O título e a lista de referências, no fim do trabalho. O título é escrito
 * pelo Apud, como o perfil manda (ABNT: REFERÊNCIAS, centralizado, com o
 * destaque do nível 1). A lista vem do CSL, com espaço simples e uma linha em
 * branco entre as referências (ABNT).
 */
function listaDeReferencias(motor: Motor, r: Regras, csl: string, medidas: { entre: string; passoSimples: string }): string {
  const rotulo = r.talvez("rótulo das referências") ?? "Referências";
  const centralizado = r.talvez("títulos sem número, alinhamento") === "centralizado";
  const titulo = `heading(level: 1, numbering: none)[${escaparTexto(rotulo)}]`;
  const simples = (r.talvez("espaço simples, onde") ?? "").includes("referências");
  const linhasEmBranco = r.perfil.regras.get("referências, entre uma e outra")?.valor;
  const branco = linhasEmBranco?.tipo === "quantidade" ? linhasEmBranco.numero : 0;
  const entreLinhas = simples ? "0em" : medidas.entre;
  const entreReferencias = simples
    ? `${branco} * ${medidas.passoSimples}`
    : `${medidas.entre} + ${branco} * ${medidas.passoSimples}`;
  const justificar = r.talvez("referências, alinhamento") !== "à esquerda";
  const dados = JSON.stringify(motor.referenciasDoTypst);
  return [
    centralizado ? `#align(center, ${titulo})` : `#${titulo}`,
    `#{`,
    `  set par(justify: ${justificar}, first-line-indent: 0pt, leading: ${entreLinhas}, spacing: ${entreReferencias})`,
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
          if (!ehCitacao(antes) && antes.marcas?.includes("italico")) {
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
const temConteudo = (trechos: Trecho[]) => trechos.some((t) => ehCitacao(t) || t.texto.trim());

function blocoParaTypst(b: Bloco, recuos: { recuoAlinea: string; recuoSub: string }, e: Escrita): string {
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
      return `#heading(level: ${b.nivel}, numbering: ${numeracao})[${trechosParaTypst(trechos, e)}]\n`;
    }
    case "lista":
      return listaParaTypst(b.itens, 0, recuos, e) + "\n";
    case "quebra":
      // "weak": duas quebras seguidas não deixam uma página em branco.
      return "#pagebreak(weak: true)\n";
  }
}

/** Tira do começo do título o número que a pessoa escreveu ("1.1 "). */
function numeroDoTitulo(trechos: Trecho[]): { numero: string; trechos: Trecho[] } {
  if (!trechos.length || ehCitacao(trechos[0])) return { numero: "", trechos };
  const { numero, resto } = separarNumero(trechos[0].texto);
  if (!numero) return { numero: "", trechos };
  return { numero, trechos: [{ ...trechos[0], texto: resto }, ...trechos.slice(1)] };
}

function listaParaTypst(
  itens: ItemDeLista[],
  nivel: number,
  recuos: { recuoAlinea: string; recuoSub: string },
  e: Escrita,
): string {
  const recuo = nivel === 0 ? recuos.recuoAlinea : `${recuos.recuoAlinea} + ${nivel} * ${recuos.recuoSub}`;
  const partes: string[] = [];
  let letra = 0;
  for (const item of itens) {
    if (temConteudo(item.trechos)) {
      const corpo = trechosParaTypst(item.trechos, e);
      const marcador = nivel === 0 ? `[${letraDaAlinea(letra++)})]` : `[—]`;
      partes.push(`#alinea(${recuo}, ${marcador}, [${corpo}])`);
    }
    if (item.subitens?.length) partes.push(listaParaTypst(item.subitens, nivel + 1, recuos, e));
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
      let s = escaparTexto(t.texto);
      const m = t.marcas ?? [];
      if (m.includes("sobrescrito")) s = `#super[${s}]`;
      if (m.includes("italico")) s = `#emph[${s}]`;
      if (m.includes("negrito")) s = `#strong[${s}]`;
      return s;
    })
    .join("");
}
