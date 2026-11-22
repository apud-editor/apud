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
// Citação longa, notas de rodapé, figuras e tabelas (fase 3): a forma de
// cada um vem do perfil (recuo, fonte menor, espaço simples, fios da tabela).
// As figuras e tabelas são numeradas sozinhas, na ordem do texto; na ABNT,
// cada espécie de ilustração (Figura, Gráfico, Quadro) tem a sua contagem.
// As imagens não vão dentro do código: o motor as recebe como arquivos
// (arquivosDasImagens, em elementos.ts).
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
  type CitacaoLonga,
  type Documento,
  type Figura,
  type Identificacao,
  type Imagem,
  type ItemDeLista,
  type NivelDeTitulo,
  type Tabela,
  type Trecho,
  type TrechoDeTexto,
} from "../documento/modelo";
import { caminhosDasImagens, larguraPadrao, pontoDaCitacaoLonga } from "./elementos";
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

  lista(chave: string): string[] {
    const r = this.perfil.regras.get(chave);
    return r && r.situacao.tipo !== "desligada" && r.valor.tipo === "lista" ? r.valor.itens : [];
  }

  /** ABNT: se a parte do trabalho está em "fonte menor, onde" ou em "espaço simples, onde". */
  menor(parte: string): boolean {
    return this.lista("fonte menor, onde").includes(parte);
  }
  simples(parte: string): boolean {
    return this.lista("espaço simples, onde").includes(parte);
  }

  /** Um número de linhas em branco (0 quando o perfil não tem a regra). */
  linhas(chave: string): number {
    return this.tem(chave) ? this.numero(chave) : 0;
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
  citacaoLonga: {
    recuo: string;
    tamanho: string;
    /** Espaço entre as linhas dentro da citação. */
    entre: string;
    /** Espaço antes e depois do bloco. */
    fora: string;
    ponto: "antes" | "depois" | undefined;
  };
  ilustracoes: Ilustracoes;
}

/** A forma das figuras e tabelas, lida do perfil. */
interface Ilustracoes {
  /** "abnt": "Figura 1 – Título" numa linha, fonte embaixo; "apa": número em negrito, título em itálico na linha de baixo e "Nota." */
  estilo: "abnt" | "apa";
  /** O nome que vai antes do número, pela espécie ("Figura", "Gráfico", "Quadro", "Tabela"). */
  rotulo: (especie: string) => string;
  /** Contagem de cada espécie, na ordem do texto. */
  contagem: Map<string, number>;
  separador: string;
  rotuloDaFonte: string;
  fonteSua: string;
  rotuloDaNota: string;
  fora: string;
  centralizada: boolean;
  /** Tamanho e espaço da fonte e da nota (ABNT: fonte menor, espaço simples). */
  tamanhoDoRodape: string;
  entreDoRodape: string;
  entreDoCorpo: string;
  /** Espaço de cima e de baixo de cada célula: o espaçamento do corpo dividido entre as duas bordas. */
  respiroDaCelula: string;
  fios: boolean;
  alinhar: boolean;
  /** Largura do texto na página, em cm, para a largura padrão das figuras. */
  larguraDoTexto: number;
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
    citacaoLonga: citacaoLonga(r, k, entre, passo),
    ilustracoes: ilustracoes(r, k, entre, passo, margens),
  };
  escreverTitulos(l, r, medidas);
  escreverNotas(l, r, justificado);

  // Itens de lista: o marcador numa coluna, o texto alinhado ao lado.
  l(`#let alinea(recuo, marcador, corpo) = block(above: ${entre}, below: ${entre}, pad(left: recuo, grid(columns: (auto, 1fr), column-gutter: 0.25em, marcador, {`);
  l(`  set par(first-line-indent: 0pt)`);
  l(`  corpo`);
  l(`})))`);
  l();

  // As citações são montadas na ordem do texto (algumas regras dependem da primeira citação).
  const motor = criarMotor(doc, perfil);
  const caminhos = caminhosDasImagens(doc);
  const escrita: Escrita = {
    motor,
    imagem: (id) => {
      const imagem = doc.imagens.find((im) => im.id === id);
      return imagem ? { imagem, caminho: caminhos.get(id)! } : undefined;
    },
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

/** Espaço entre as linhas para um espaçamento (1 = simples, 1,5, 2 = duplo), como no Word. */
const entreLinhas = (k: number) => `${numero((k - 1) * LINHA_SIMPLES)}em`;

/** Espaço antes e depois de um bloco com n linhas em branco: o espaço normal mais as linhas. */
const comLinhas = (entre: string, passo: string, n: number) => (n ? `${entre} + ${numero(n)} * ${passo}` : entre);

/** Citação longa (ABNT) ou em bloco (APA). */
function citacaoLonga(r: Regras, k: number, entre: string, passo: string): Medidas["citacaoLonga"] {
  const abnt = r.tem("citação longa, recuo");
  const ponto = r.talvez("citação em bloco, ponto final") ?? r.talvez("citação, ponto final");
  return {
    recuo: r.medida(abnt ? "citação longa, recuo" : "citação em bloco, recuo"),
    tamanho: r.menor("citações longas") ? r.fonteMenor() : r.fonte().tamanho,
    entre: r.simples("citações longas") ? entreLinhas(1) : entreLinhas(k),
    fora: comLinhas(entre, passo, r.linhas("citação longa, linhas em branco antes e depois")),
    ponto: ponto === "antes da chamada" ? "antes" : ponto === "depois da chamada" ? "depois" : undefined,
  };
}

/** Os nomes das espécies, sem acento e em minúsculas, para achar "Gráfico" pela espécie "grafico". */
const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function ilustracoes(r: Regras, k: number, entre: string, passo: string, margens: ReturnType<Regras["margens"]>): Ilustracoes {
  const apa = r.tem("tabelas e figuras, número");
  const separadores: Record<string, string> = { travessão: " – ", hífen: " - ", ponto: ". ", "dois-pontos": ": " };
  const tipos = r.lista("ilustração, tipos");
  const rotuloDaFigura = r.talvez("figura, rótulo");
  const rotuloDaTabela = r.talvez("tabelas, rótulo") ?? r.talvez("tabela, rótulo") ?? "Tabela";
  const cm = (m: string) => parseFloat(m) * (m.endsWith("mm") ? 0.1 : 1);
  const corpo = r.tem("tabelas, espaçamento do corpo") ? r.numero("tabelas, espaçamento do corpo") : k;
  const rodapeSimples = !apa && r.simples("fontes de ilustrações e tabelas");
  return {
    estilo: apa ? "apa" : "abnt",
    rotulo: (especie) => {
      if (especie === "tabela") return rotuloDaTabela;
      if (rotuloDaFigura) return rotuloDaFigura;
      return tipos.find((t) => semAcento(t) === especie) ?? tipos[0] ?? "Figura";
    },
    contagem: new Map(),
    separador: separadores[r.talvez("ilustração, separador do título") ?? "travessão"] ?? " – ",
    rotuloDaFonte: r.talvez("ilustração, rótulo da fonte") ?? "Fonte:",
    fonteSua: r.talvez("ilustração, fonte quando é sua") ?? "",
    rotuloDaNota: r.talvez("tabelas e figuras, rótulo da nota") ?? "Nota.",
    fora: comLinhas(entre, passo, r.linhas(apa ? "tabelas e figuras, linhas em branco antes e depois" : "ilustrações e tabelas, linhas em branco antes e depois")),
    centralizada: (r.talvez("ilustração, posição na página") ?? r.talvez("figuras, posição da imagem")) !== "à esquerda",
    tamanhoDoRodape: !apa && r.menor("fontes de ilustrações e tabelas") ? r.fonteMenor() : r.fonte().tamanho,
    entreDoRodape: rodapeSimples ? entreLinhas(1) : apa && r.tem("tabelas, espaçamento de número, título e nota") ? entreLinhas(r.numero("tabelas, espaçamento de número, título e nota")) : entre,
    entreDoCorpo: entreLinhas(corpo),
    respiroDaCelula: `${numero(((corpo - 1) * LINHA_SIMPLES) / 2 + 0.15)}em`,
    fios: r.talvez("tabelas, fios") === "acima e abaixo do cabeçalho e no fim, sem fios nas laterais",
    alinhar: r.talvez("tabelas, alinhamento") === "cabeçalho ao centro, primeira coluna à esquerda, demais ao centro",
    larguraDoTexto: 21 - cm(margens.esquerda) - cm(margens.direita),
  };
}

/**
 * Notas de rodapé: o filete, a fonte e o espaço vêm do perfil. Na ABNT, as
 * linhas seguintes ficam sob a primeira letra da nota (o número numa coluna
 * própria); na APA, a nota corre como no Word.
 */
function escreverNotas(l: (s?: string) => void, r: Regras, justificado: boolean) {
  const abnt = r.tem("notas de rodapé, linhas seguintes");
  const tamanho = abnt ? (r.menor("notas de rodapé") ? r.fonteMenor() : r.fonte().tamanho) : r.tem("notas de rodapé, tamanho da fonte") ? r.medida("notas de rodapé, tamanho da fonte") : r.fonte().tamanho;
  const entre = abnt
    ? r.simples("notas de rodapé") ? entreLinhas(1) : entreLinhas(r.numero("entrelinhas"))
    : entreLinhas(r.tem("notas de rodapé, espaçamento") ? r.numero("notas de rodapé, espaçamento") : 1);
  const filete = r.tem("notas de rodapé, filete") ? r.medida("notas de rodapé, filete") : "5cm";
  const sob = r.talvez("notas de rodapé, linhas seguintes") === "alinhadas sob a primeira letra";
  // O filete fica numa caixa da altura de meia linha, para não encostar no texto da nota.
  l(`#set footnote.entry(separator: box(height: 0.5em, line(length: ${filete}, stroke: 0.5pt)), clearance: ${numero(LINHA_SIMPLES)}em, gap: ${entre}, indent: 0pt)`);
  l(`#show footnote.entry: it => {`);
  l(`  let n = numbering(it.note.numbering, ..counter(footnote).at(it.note.location()))`);
  l(`  set text(size: ${tamanho})`);
  l(`  set par(justify: ${justificado}, leading: ${entre}, spacing: ${entre}, first-line-indent: 0pt)`);
  l(sob ? `  grid(columns: (auto, 1fr), column-gutter: 0.2em, super(n), it.note.body)` : `  [#super(n) #it.note.body]`);
  l(`}`);
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
  /** A imagem de uma figura e o caminho dela para o motor; undefined se sumiu do arquivo. */
  imagem: (id: string) => { imagem: Imagem; caminho: string } | undefined;
  /** APA: a expressão "[ênfase adicionada]", que vai logo depois do trecho destacado. */
  enfase?: string;
  /** O Typst da lista de referências, para o bloco da lista. */
  lista: () => string;
  /**
   * Quando existe, as marcas que põem as obras na lista ficam guardadas aqui
   * em vez de irem no meio do texto. A tabela mede o próprio conteúdo, e o
   * Typst não sabe medir um texto com essas marcas.
   */
  registros?: string[];
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
    case "citacaoLonga":
      return temConteudo(b.trechos) ? citacaoLongaParaTypst(b, m, e) : "";
    case "figura":
      return figuraParaTypst(b, m, e);
    case "tabela":
      return tabelaParaTypst(b, m, e);
  }
}

// ---------------------------------------------------------------------------
// Citação longa, figuras e tabelas

function citacaoLongaParaTypst(b: CitacaoLonga, m: Medidas, e: Escrita): string {
  const c = m.citacaoLonga;
  const corpo = trechosParaTypst(pontoDaCitacaoLonga(b.trechos, c.ponto), e);
  return [
    `#block(above: ${c.fora}, below: ${c.fora}, pad(left: ${c.recuo})[`,
    `#set text(size: ${c.tamanho})`,
    `#set par(first-line-indent: 0pt, leading: ${c.entre}, spacing: ${c.entre})`,
    `${corpo}`,
    `])`,
    "",
  ].join("\n");
}

/** O número da figura ou tabela, contado na ordem do texto. Na APA, toda ilustração é Figura. */
function proximoNumero(especie: string, m: Medidas): { rotulo: string; numero: number } {
  const il = m.ilustracoes;
  const chave = il.estilo === "apa" && especie !== "tabela" ? "figura" : especie;
  const n = (il.contagem.get(chave) ?? 0) + 1;
  il.contagem.set(chave, n);
  return { rotulo: il.rotulo(chave), numero: n };
}

/**
 * As linhas de cima (identificação) e de baixo (fonte e nota) de uma figura ou tabela.
 *   ABNT: "Figura 1 – Título"; embaixo, "Fonte: ..." e a nota, em fonte menor e espaço simples.
 *   APA:  "Figura 1" em negrito; o título em itálico na linha de baixo; embaixo, "Nota." em itálico,
 *         com a nota e a fonte (a atribuição) dentro dela.
 */
function identificacao(b: Identificacao, especie: string, m: Medidas, e: Escrita): { acima: string[]; abaixo: string[]; titulo: string } {
  const il = m.ilustracoes;
  const { rotulo, numero: n } = proximoNumero(especie, m);
  const titulo = trechosParaTypst(b.titulo, e);
  const fonte = b.fontePropria ? (il.estilo === "abnt" ? escaparTexto(il.fonteSua) : "") : trechosParaTypst(b.fonte, e);
  const nota = b.nota ? trechosParaTypst(b.nota, e) : "";
  const linha = (conteudo: string, abaixo: string) => `#block(above: 0pt, below: ${abaixo}, sticky: true)[${conteudo}]`;
  // Um pouco de ar entre a imagem ou o último fio da tabela e a fonte, mesmo em espaço simples.
  const rodape = (conteudo: string) =>
    `#block(above: ${il.entreDoRodape} + 0.3em, below: 0pt)[#set text(size: ${il.tamanhoDoRodape}); #set par(leading: ${il.entreDoRodape}, spacing: ${il.entreDoRodape}); ${conteudo}]`;
  if (il.estilo === "apa") {
    const corpoDaNota = [nota, fonte].filter(Boolean).join(" ");
    return {
      acima: [linha(`#strong[${escaparTexto(`${rotulo} ${n}`)}]`, il.entreDoRodape), linha(`#emph[${titulo}]`, il.entreDoRodape)],
      abaixo: corpoDaNota ? [rodape(`#emph[${escaparTexto(il.rotuloDaNota)}] ${corpoDaNota}`)] : [],
      titulo: `#emph[${titulo}]`,
    };
  }
  const sep = titulo ? escaparTexto(il.separador) : "";
  const completo = `${escaparTexto(`${rotulo} ${n}`)}${sep}${titulo}`;
  return {
    acima: [linha(completo, m.entre)],
    abaixo: [...(fonte ? [rodape(`${escaparTexto(il.rotuloDaFonte)} ${fonte}`)] : []), ...(nota ? [rodape(nota)] : [])],
    titulo: completo,
  };
}

function figuraParaTypst(b: Figura, m: Medidas, e: Escrita): string {
  const il = m.ilustracoes;
  const { acima, abaixo } = identificacao(b, b.especie ?? "figura", m, e);
  const achada = e.imagem(b.imagem);
  const largura = b.largura ?? larguraPadrao(achada?.imagem, il.larguraDoTexto);
  const imagem = achada
    ? `#image(${texto(achada.caminho)}, width: 100%)`
    : `#rect(width: 100%, height: 4cm, stroke: 0.5pt + gray, align(center + horizon, text(size: ${il.tamanhoDoRodape})[Imagem não encontrada no arquivo]))`;
  const lugar = il.centralizada ? "center" : "left";
  // ABNT: título, fonte e nota na largura da ilustração. APA: na largura do texto, e a imagem no meio.
  if (il.estilo === "abnt") {
    return [
      `#block(above: ${il.fora}, below: ${il.fora}, breakable: false, width: 100%, align(${lugar}, block(width: ${numero(largura)}%)[`,
      `#set align(left)`,
      `#set par(first-line-indent: 0pt, justify: false)`,
      ...acima,
      `#block(above: 0pt, below: 0pt)[${imagem}]`,
      ...abaixo,
      `]))`,
      "",
    ].join("\n");
  }
  return [
    `#block(above: ${il.fora}, below: ${il.fora}, breakable: false, width: 100%)[`,
    `#set par(first-line-indent: 0pt, justify: false)`,
    ...acima,
    `#block(above: 0pt, below: 0pt, width: 100%, align(${lugar}, block(width: ${numero(largura)}%)[${imagem}]))`,
    ...abaixo,
    `]`,
    "",
  ].join("\n");
}

/**
 * Tabela. ABNT (IBGE): a largura do conteúdo, no meio da página, com o título
 * e a fonte na largura da tabela. APA: a largura do texto. Nas duas: fios só
 * no topo, embaixo do cabeçalho e no fim; o cabeçalho se repete quando a
 * tabela passa para a página seguinte.
 */
function tabelaParaTypst(b: Tabela, m: Medidas, escrita: Escrita): string {
  const il = m.ilustracoes;
  const e: Escrita = { ...escrita, registros: [] };
  const { acima, abaixo, titulo } = identificacao(b, "tabela", m, e);
  const colunas = b.linhas[0]?.length ?? 1;
  const fio = il.fios ? "table.hline(stroke: 0.5pt)," : "";
  const celula = (c: Trecho[]) => `[${trechosParaTypst(c, e)}],`;
  const cabecalho = b.linhas.slice(0, b.cabecalho);
  const corpo = b.linhas.slice(b.cabecalho);
  const alinhamento = il.alinhar ? `align: (x, y) => if y < ${b.cabecalho} { center } else if x == 0 { left } else { center },` : "";
  // A grade, como função do Typst que recebe as larguras das colunas.
  const grade = [
    `let grade(colunas) = {`,
    `  set par(leading: ${il.entreDoCorpo}, spacing: ${il.entreDoCorpo})`,
    `  table(columns: colunas, stroke: ${il.fios ? "none" : "0.5pt"}, inset: (x: 0.4em, y: ${il.respiroDaCelula}), ${alinhamento}`,
    `    ${cabecalho.length ? `table.header(repeat: true, ${fio} ${cabecalho.flat().map(celula).join(" ")} ${fio}),` : fio}`,
    `    ${corpo.flat().map(celula).join(" ")}`,
    `    ${fio}`,
    `  )`,
    `}`,
  ].join("\n");
  const partes = (gradeFinal: string) =>
    [`#set align(left)`, `#set par(first-line-indent: 0pt, justify: false)`, ...acima, `#block(above: 0pt, below: 0pt, ${gradeFinal})`, ...abaixo].join("\n");
  if (il.estilo === "abnt") {
    // A largura do conteúdo, no meio da página. Se o título for mais largo, a
    // tabela se estica até ele, e os fios ficam na largura da identificação.
    const lugar = il.centralizada ? "center" : "left";
    return [
      `#block(above: ${il.fora}, below: ${il.fora}, width: 100%)[${e.registros!.join("")}#layout(espaco => {`,
      grade,
      `  let natural = measure(grade((auto,) * ${colunas}), width: espaco.width).width`,
      `  let doTitulo = measure([${titulo}], width: espaco.width).width`,
      `  let largura = calc.min(calc.max(natural, doTitulo), espaco.width)`,
      `  let final = if doTitulo > natural { grade((1fr,) * ${colunas}) } else { grade((auto,) * ${colunas}) }`,
      `  align(${lugar}, block(width: largura)[`,
      partes("final"),
      `])`,
      `})]`,
      "",
    ].join("\n");
  }
  // APA: a largura do texto; a primeira coluna no tamanho do conteúdo, as outras divididas.
  const larguras = colunas > 1 ? `(auto, ..((1fr,) * ${colunas - 1}))` : `(1fr,)`;
  return [`#block(above: ${il.fora}, below: ${il.fora}, width: 100%, {`, grade, `[${e.registros!.join("")}`, partes(`grade(${larguras})`), `]`, `})`, ""].join("\n");
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
        const marcas = c.obras.map(registrar).join("");
        if (e.registros) {
          e.registros.push(marcas);
          return pedacosParaTypst(c.pedacos);
        }
        return marcas + pedacosParaTypst(c.pedacos);
      }
      // A forma da nota (fonte, filete, linhas seguintes) está no #show footnote.entry.
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
