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
// Abertura (fase 3, parte 4): capa, folha de rosto, dedicatória,
// agradecimentos, epígrafe, resumos e sumário (ABNT), ou página de título e
// resumos (APA). Cada elemento ocupa a própria folha, e o texto começa na
// folha seguinte. A ordem e a frase da natureza ficam em abertura.ts; a forma,
// aqui, pelo perfil. Sem nenhum elemento ligado, o PDF sai como antes.
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
  type Resumo,
  type Trecho,
  type TrechoDeTexto,
} from "../documento/modelo";
import { caminhosDasImagens, larguraPadrao, pontoDaCitacaoLonga } from "./elementos";
import {
  anoDoTrabalho,
  dataPorExtenso,
  elementosDaAbertura,
  existeNaNorma,
  idiomaParaTypst,
  juntarNomes,
  lingua,
  naturezaDoTrabalho,
  palavrasChave,
  repetirTituloNoTexto,
  rotulosDoIdioma,
  type ElementoDaAbertura,
} from "./abertura";
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
  /**
   * Tabela em mais de uma página (IBGE, 8.3): número e título repetidos em cada
   * página, com as indicações da primeira, das do meio e da última. Null: só o
   * cabeçalho se repete (APA).
   */
  continuidade: { continua: string; continuacao: string; conclusao: string; direita: boolean } | null;
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
  const elementos = elementosDaAbertura(doc.abertura, existeNaNorma((k) => r.tem(k)));
  // ABNT: o número só aparece a partir da primeira folha do texto. APA: desde a página de título.
  const esconderAteOTexto = elementos.length > 0 && r.talvez("numeração de página, mostrar desde") === "primeira folha do texto";

  l(`// Gerado pelo Apud com o perfil ${perfil.identificacao.perfil} ${perfil.identificacao.versao}, revisão ${perfil.identificacao.revisao}.`);
  if (opcoes.titulo) l(`#set document(title: ${texto(opcoes.titulo)})`);

  // Página e número de página
  l(`#set page(`);
  l(`  paper: "a4",`);
  l(`  margin: (left: ${margens.esquerda}, top: ${margens.superior}, right: ${margens.direita}, bottom: ${margens.inferior}),`);
  // Sem abertura, o texto começa na página 1. Com ela, a contagem e o lugar onde o número aparece seguem a norma.
  const numeroDaPagina = `place(${lugarDoNumero(r, margens.direita)}, text(size: ${r.fonteMenor()}, top-edge: "cap-height", bottom-edge: "baseline", counter(page).display("1")))`;
  if (esconderAteOTexto) {
    l(`  foreground: context { let i = query(<apud-texto>); if i.len() == 0 or here().page() >= i.first().location().page() { ${numeroDaPagina} } },`);
  } else {
    l(`  foreground: context ${numeroDaPagina},`);
  }
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
  if (elementos.length) {
    for (const parte of aberturaParaTypst(doc, elementos, r, medidas, escrita)) l(parte);
    // A marca do começo do texto: daqui em diante o número da página aparece (ABNT).
    l(`#metadata("texto") <apud-texto>`);
  }
  // APA: o título do trabalho se repete no começo do texto.
  if (r.talvez("início do texto") === "repete o título do trabalho" && repetirTituloNoTexto(doc.dados, doc.blocos)) {
    l(`#heading(level: 1, numbering: none, outlined: false)[${tituloParaTypst(doc, (x) => x)}]`);
    l();
  }
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

function continuidadeDaTabela(r: Regras): Ilustracoes["continuidade"] {
  if (r.talvez("tabelas em mais de uma página") !== "número, título e cabeçalho repetidos em cada página") return null;
  const [continua, continuacao, conclusao] = r.tem("tabelas em mais de uma página, indicações")
    ? r.lista("tabelas em mais de uma página, indicações")
    : ["(continua)", "(continuação)", "(conclusão)"];
  return { continua, continuacao, conclusao, direita: r.talvez("tabelas em mais de uma página, posição das indicações") !== "à esquerda" };
}

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
    continuidade: continuidadeDaTabela(r),
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
// Abertura: os elementos antes do texto

/** Aplica negrito, itálico e sublinhado de uma regra de destaque. As letras ficam como estão. */
function comDestaque(r: Regras, chave: string, x: string): string {
  if (!r.tem(chave)) return x;
  const d = r.destaque(chave);
  let s = x;
  if (d.negrito) s = `#strong[${s}]`;
  if (d.italico) s = `#emph[${s}]`;
  if (d.sublinhado) s = `#underline[${s}]`;
  return s;
}

/** O título do trabalho, com o subtítulo depois de dois-pontos. `destacar` vale só para o título. */
function tituloParaTypst(doc: Documento, destacar: (x: string) => string): string {
  const titulo = escaparTexto(doc.dados.titulo.trim());
  const sub = doc.dados.subtitulo?.trim();
  return sub ? `${destacar(titulo)}: ${escaparTexto(sub)}` : destacar(titulo);
}

/**
 * Um rótulo da norma (RESUMO, AGRADECIMENTOS, SUMÁRIO) como título sem número,
 * que não entra no sumário. Na ABNT, os títulos sem número têm o destaque do
 * nível 1: as maiúsculas valem para os rótulos (que são do Apud, não da pessoa).
 */
function rotuloDeSecao(rotulo: string, r: Regras): string {
  const maiusculas = r.talvez("títulos sem número, destaque") === "igual ao nível 1" && r.destaque("título nível 1, destaque").maiusculas;
  const centralizado = r.talvez("títulos sem número, alinhamento") === "centralizado" || r.talvez("rótulos de seção, alinhamento") === "centralizado";
  const t = `heading(level: 1, numbering: none, outlined: false)[${escaparTexto(maiusculas ? rotulo.toLocaleUpperCase("pt-BR") : rotulo)}]`;
  return centralizado ? `#align(center, ${t})` : `#${t}`;
}

/** Linhas como um parágrafo só, separadas por quebra de linha. Linhas vazias saem. */
const emLinhas = (linhas: (string | undefined)[]) => linhas.filter((x): x is string => !!x && x.trim() !== "").join(" \\\n");

function aberturaParaTypst(doc: Documento, elementos: ElementoDaAbertura[], r: Regras, m: Medidas, e: Escrita): string[] {
  const d = doc.dados;
  const cego = doc.abertura.semIdentificacao;
  const autores = cego ? [] : d.autores.map((a) => escaparTexto(a.trim())).filter(Boolean);
  const ano = anoDoTrabalho(d);
  const justificado = r.opcao("alinhamento") === "justificado";
  const partes: string[] = [];
  const contarACapa = r.talvez("numeração de página, contar desde") === "capa";
  const paragrafos = (ps: TrechoDeTexto[][]) =>
    ps.filter((p) => p.some((t) => t.texto.trim())).map((p) => trechosParaTypst(p, e)).join("\n\n");
  // Uma folha inteira, sem recuo de parágrafo; o pagebreak fecha a folha.
  const folha = (corpo: string) => `#block(width: 100%, height: 100%, {\n  set par(first-line-indent: 0pt, justify: false)\n  ${corpo}\n})\n#pagebreak()\n`;
  const campos = (chave: string) => r.lista(chave).map((c) => c.replace(" (opcional)", ""));

  for (const el of elementos) {
    switch (el.tipo) {
      case "capa": {
        const c = campos("capa, campos");
        const quer = (x: string) => c.length === 0 || c.includes(x);
        const instituicao = quer("instituição") ? emLinhas([d.instituicao && escaparTexto(d.instituicao.trim()), d.curso && escaparTexto(d.curso.trim())]) : "";
        const titulo = d.titulo.trim() && quer("título") ? tituloParaTypst(doc, (x) => comDestaque(r, "capa, destaque do título", x)) : "";
        const pe = emLinhas([quer("cidade") ? d.cidade && escaparTexto(d.cidade.trim()) : undefined, quer("ano") && ano ? String(ano) : undefined]);
        const autor = quer("autor") ? emLinhas(autores) : "";
        // Sem instituição, a capa começa pelo autor (NBR 14724: a instituição é opcional).
        const linhasDaCapa = instituicao ? [instituicao, "", autor, "", titulo, "", pe] : [autor, "", titulo, "", pe];
        const alturas = instituicao ? "(auto, 1fr, auto, 1fr, auto, 2fr, auto)" : "(auto, 1fr, auto, 2fr, auto)";
        partes.push(folha(`align(center, grid(rows: ${alturas}, ${linhasDaCapa.map((x) => `[${x}]`).join(", ")}))`));
        // A capa não conta: a folha de rosto é a folha 1 (NBR 14724).
        if (!contarACapa) partes.push(`#counter(page).update(1)`);
        break;
      }
      case "folhaDeRosto": {
        const c = campos("folha de rosto, campos");
        const quer = (x: string) => c.length === 0 || c.includes(x);
        const titulo = d.titulo.trim() && quer("título") ? tituloParaTypst(doc, (x) => comDestaque(r, "folha de rosto, destaque do título", x)) : "";
        const natureza = quer("natureza") ? naturezaDoTrabalho(d) : "";
        const rotulo = r.talvez(d.tipo === "disciplina" ? "folha de rosto, rótulo do professor" : "folha de rosto, rótulo do orientador") ?? "";
        const orientador = quer("orientador") && !cego && d.orientador?.trim() ? `${escaparTexto(rotulo)} ${escaparTexto(d.orientador.trim())}`.trim() : "";
        const simples = r.simples("natureza do trabalho");
        const entre = simples ? entreLinhas(1) : m.entre;
        const tamanho = r.menor("natureza do trabalho") ? `set text(size: ${r.fonteMenor()})\n` : "";
        const ladoDireito = [natureza && escaparTexto(natureza), orientador].filter(Boolean).join("\n\n");
        const meio = ladoDireito
          ? `[#v(2 * ${m.passo})#pad(left: 50%, {\n  ${tamanho}set par(justify: true, leading: ${entre}, spacing: ${m.passo})\n  [${ladoDireito}]\n})]`
          : "[]";
        const pe = emLinhas([quer("cidade") ? d.cidade && escaparTexto(d.cidade.trim()) : undefined, quer("ano") && ano ? String(ano) : undefined]);
        const autor = quer("autor") ? emLinhas(autores) : "";
        partes.push(folha(`grid(rows: (auto, 1fr, auto, auto, 1fr, auto), align(center)[${autor}], [], align(center)[${titulo}], ${meio}, [], align(center)[${pe}])`));
        break;
      }
      case "paginaDeTitulo": {
        const profissional = d.tipo === "artigo" && r.talvez("modo, quando o trabalho é artigo") === "profissional";
        const c = campos(profissional ? "página de título (profissional), campos" : "página de título (estudante), campos");
        const quer = (x: string) => c.length === 0 || c.includes(x);
        // Na APA, o subtítulo é parte do título: o destaque vale para os dois.
        const titulo = d.titulo.trim() ? comDestaque(r, "página de título (estudante), destaque do título", tituloParaTypst(doc, (x) => x)) : "";
        const filiacao = [d.curso?.trim(), d.instituicao?.trim()].filter(Boolean).map((x) => escaparTexto(x!)).join(", ");
        const linhasAbaixo = [
          quer("autor") || quer("autores") ? escaparTexto(juntarNomes(cego ? [] : d.autores)) : undefined,
          quer("departamento e universidade") || quer("afiliação") ? filiacao : undefined,
          quer("código e nome da disciplina") && d.disciplina?.trim() ? escaparTexto(d.disciplina.trim()) : undefined,
          quer("professor") && !cego && d.orientador?.trim() ? escaparTexto(d.orientador.trim()) : undefined,
          quer("data de entrega") && d.dataDeEntrega ? escaparTexto(dataPorExtenso(d.dataDeEntrega)) : undefined,
        ];
        const antes = r.linhas("página de título (estudante), linhas antes do título");
        const depois = r.linhas("página de título (estudante), linhas em branco depois do título");
        const k = r.tem("página de título (estudante), espaçamento") ? r.numero("página de título (estudante), espaçamento") : r.numero("entrelinhas");
        const entre = entreLinhas(k);
        partes.push(
          `#{\n  set par(first-line-indent: 0pt, justify: false, leading: ${entre}, spacing: ${entre})\n  set align(center)\n  v(${numero(antes)} * ${m.passo})\n  [${titulo}]\n  v(${numero(depois)} * ${m.passo})\n  [${emLinhas(linhasAbaixo)}]\n}\n#pagebreak()\n`,
        );
        break;
      }
      case "dedicatoria":
      case "epigrafe": {
        // NBR 14724: no pé da página, do meio para a direita, sem título.
        const el2 = el.tipo === "dedicatoria" ? doc.abertura.dedicatoria : doc.abertura.epigrafe;
        const autoria = el.tipo === "epigrafe" && r.talvez("epígrafe, autor") === "sim" && doc.abertura.epigrafe.autoria.trim() ? `\n\n#align(right)[${escaparTexto(doc.abertura.epigrafe.autoria.trim())}]` : "";
        partes.push(folha(`align(bottom, pad(left: 50%, {\n  set par(justify: ${justificado}, leading: ${m.entre}, spacing: ${m.entre})\n  [${paragrafos(el2.paragrafos)}${autoria}]\n}))`));
        break;
      }
      case "agradecimentos": {
        const rotulo = r.talvez("agradecimentos, título") ?? "Agradecimentos";
        partes.push(`${rotuloDeSecao(rotulo, r)}\n${paragrafos(doc.abertura.agradecimentos.paragrafos)}\n#pagebreak()\n`);
        break;
      }
      case "resumo":
        partes.push(resumoParaTypst(el.resumo, r, m, e));
        break;
      case "sumario":
        partes.push(sumarioParaTypst(doc, r, m));
        break;
    }
  }
  return partes;
}

/**
 * Um resumo, na própria folha: o título do trabalho no idioma (se houver), o
 * rótulo (RESUMO, ABSTRACT...), o texto num parágrafo só e as palavras-chave.
 * O rótulo do português e do inglês vem do perfil; o dos outros idiomas, de abertura.ts.
 */
function resumoParaTypst(resumo: Resumo, r: Regras, m: Medidas, e: Escrita): string {
  const ling = lingua(resumo.idioma);
  const padrao = rotulosDoIdioma(resumo.idioma);
  const rotulo =
    ling === "pt" ? (r.talvez("resumo, título") ?? r.talvez("rótulo do resumo") ?? padrao.resumo) : ling === "en" ? (r.talvez("resumo em língua estrangeira, título") ?? padrao.resumo) : padrao.resumo;
  const rotuloDasPalavras =
    ling === "pt" ? (r.talvez("palavras-chave, rótulo") ?? padrao.palavrasChave) : ling === "en" ? (r.talvez("resumo em língua estrangeira, rótulo das palavras-chave") ?? padrao.palavrasChave) : padrao.palavrasChave;
  const k = r.tem("resumo, espaçamento") ? r.numero("resumo, espaçamento") : r.numero("entrelinhas");
  const entre = entreLinhas(k);
  const passo = `${numero(k * LINHA_SIMPLES)}em`;
  const recuo = (chave: string) => (r.talvez(chave) === "como no texto" ? m.recuo : "0pt");
  const separador = (r.talvez("palavras-chave, separador") ?? "ponto e vírgula") as "ponto e vírgula" | "vírgula" | "ponto";
  const final = (r.talvez("palavras-chave, final") ?? "ponto") as "ponto" | "nenhum";
  const palavras = palavrasChave(resumo.palavrasChave, separador, final);
  const { lang, region } = idiomaParaTypst(resumo.idioma);
  const justificado = r.opcao("alinhamento") === "justificado";
  const linhas = [
    resumo.titulo?.trim() ? `#align(center, block(below: ${m.passo})[#strong[${escaparTexto(resumo.titulo.trim())}]])` : "",
    rotuloDeSecao(rotulo, r),
    `#{`,
    `  set text(lang: ${texto(lang)}${region ? `, region: ${texto(region)}` : ""})`,
    `  set par(justify: ${justificado}, leading: ${entre}, spacing: ${entre}, first-line-indent: (amount: ${recuo("resumo, recuo da primeira linha")}, all: true))`,
    `  [${trechosParaTypst(resumo.trechos, e)}]`,
  ];
  if (palavras) {
    const n = r.linhas("palavras-chave, linhas em branco antes");
    linhas.push(`  parbreak()`);
    if (n) linhas.push(`  v(${numero(n)} * ${passo})`);
    linhas.push(`  set par(first-line-indent: (amount: ${recuo("palavras-chave, recuo da primeira linha")}, all: true))`);
    linhas.push(`  [${comDestaque(r, "palavras-chave, destaque do rótulo", escaparTexto(rotuloDasPalavras))} ${escaparTexto(palavras)}]`);
  }
  linhas.push(`}`, `#pagebreak()`, "");
  return linhas.filter((x) => x !== "").join("\n") + "\n";
}

/**
 * Sumário (NBR 6027): os títulos do texto e as referências, com a página
 * inicial; os elementos antes do texto não entram. Os números das seções
 * ficam à esquerda, numa coluna da largura do número mais longo, e os títulos
 * alinhados depois dela, com o mesmo destaque do texto.
 */
function sumarioParaTypst(doc: Documento, r: Regras, m: Medidas): string {
  const rotulo = r.talvez("sumário, título") ?? "Sumário";
  const numeros = doc.blocos.flatMap((b) => {
    if (b.tipo !== "titulo") return [];
    const { numero: n } = numeroDoTitulo(b.trechos);
    return n ? [`destaque-do-titulo(${b.nivel}, [${escaparTexto(n)}])`] : [];
  });
  const ligacao = r.talvez("sumário, ligação até a página") === "nenhuma" ? "h(1fr)" : "box(width: 1fr, repeat(gap: 0.15em)[.])";
  return [
    rotuloDeSecao(rotulo, r),
    `#{`,
    `  set par(first-line-indent: 0pt, justify: false, leading: ${m.entre}, spacing: ${m.entre})`,
    `  show outline.entry: it => context {`,
    `    let numeros = (${numeros.join(", ")}${numeros.length === 1 ? "," : ""})`,
    `    let largura = calc.max(0pt, ..numeros.map(x => measure(x).width))`,
    `    let numero = if it.element.numbering == none { [] } else { destaque-do-titulo(it.level, numbering(it.element.numbering, ..counter(heading).at(it.element.location()))) }`,
    `    let recuo = if largura == 0pt { 0pt } else { largura + 0.5em }`,
    // O número e um espaço até a largura do mais longo (sem caixa, para ficar na mesma linha de base); as linhas seguintes do título ficam sob a primeira letra.
    `    block(above: ${m.entre}, below: ${m.entre}, link(it.element.location(), par(hanging-indent: recuo)[#numero#h(recuo - measure(numero).width)#destaque-do-titulo(it.level, it.body()) ${"#"}${ligacao} #it.page()]))`,
    `  }`,
    `  outline(title: none, depth: 5)`,
    `}`,
    `#pagebreak()`,
    "",
  ].join("\n");
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
function identificacao(b: Identificacao, especie: string, m: Medidas, e: Escrita): { acima: string[]; abaixo: string[]; titulo: string; numero: number } {
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
      numero: n,
    };
  }
  const sep = titulo ? escaparTexto(il.separador) : "";
  const completo = `${escaparTexto(`${rotulo} ${n}`)}${sep}${titulo}`;
  return {
    acima: [linha(completo, m.entre)],
    abaixo: [...(fonte ? [rodape(`${escaparTexto(il.rotuloDaFonte)} ${fonte}`)] : []), ...(nota ? [rodape(nota)] : [])],
    titulo: completo,
    numero: n,
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
 *
 * Com a continuidade do IBGE (8.3), o número e o título também se repetem em
 * cada página: vão numa linha do cabeçalho que se repete, e logo abaixo deles
 * a indicação da página, "(continua)", "(continuação)" ou "(conclusão)". Para
 * saber em que página da tabela se está, duas marcas: uma antes da tabela e
 * uma na última linha. Tabela numa página só não leva indicação.
 */
function tabelaParaTypst(b: Tabela, m: Medidas, escrita: Escrita): string {
  const il = m.ilustracoes;
  const e: Escrita = { ...escrita, registros: [] };
  const { acima, abaixo, titulo, numero: n } = identificacao(b, "tabela", m, e);
  const colunas = b.linhas[0]?.length ?? 1;
  const fio = il.fios ? "table.hline(stroke: 0.5pt)," : "";
  const celula = (c: Trecho[]) => `[${trechosParaTypst(c, e)}],`;
  const cabecalho = b.linhas.slice(0, b.cabecalho);
  const corpo = b.linhas.slice(b.cabecalho);
  // Sem linhas no corpo não há o que continuar (e as marcas não teriam onde ficar).
  const continuidade = il.estilo === "abnt" && corpo.length > 0 ? il.continuidade : null;
  const inicio = `apud-tabela-${n}-inicio`;
  const fim = `apud-tabela-${n}-fim`;
  // As marcas vão na primeira célula da primeira e da última linha do corpo:
  // ficam na página em que a tabela começa e na página em que termina.
  const celulas = (linhas: Trecho[][][], marcar: boolean) =>
    linhas
      .flat()
      .map((c, k, todas) => {
        const marcas = !marcar ? "" : `${k === 0 ? `#metadata(none)<${inicio}>` : ""}${k === todas.length - linhas[linhas.length - 1].length ? `#metadata(none)<${fim}>` : ""}`;
        return marcas ? `[${marcas}${trechosParaTypst(c, e)}],` : celula(c);
      })
      .join(" ");
  // Com o título dentro da tabela, as linhas do cabeçalho da pessoa começam na terceira.
  const primeira = continuidade ? 1 : 0;
  const alinhamento = il.alinhar ? `align: (x, y) => if y < ${b.cabecalho + primeira} { center } else if x == 0 { left } else { center },` : "";
  let topo = "";
  if (continuidade) {
    const c = continuidade;
    const indicacao = [
      `context {`,
      `  let ini = locate(<${inicio}>).page()`,
      `  let fim = locate(<${fim}>).page()`,
      `  let aqui = here().page()`,
      `  if ini != fim {`,
      `    block(above: ${m.entre}, below: 0pt, width: 100%, align(${c.direita ? "right" : "left"}, if aqui == ini [${escaparTexto(c.continua)}] else if aqui == fim [${escaparTexto(c.conclusao)}] else [${escaparTexto(c.continuacao)}]))`,
      `  }`,
      `}`,
    ].join("\n");
    topo = `..if topo { (table.cell(colspan: ${colunas}, align: left, inset: (x: 0pt, top: 0pt, bottom: ${m.entre}))[#set par(leading: ${m.entre}, spacing: ${m.entre}); ${titulo} #${indicacao}],) } else { () },`;
  }
  // A grade, como função do Typst que recebe as larguras das colunas (e, com a
  // continuidade, se leva o título: sem ele, para medir a largura natural).
  const grade = [
    `let grade(colunas, topo: true) = {`,
    `  set par(leading: ${il.entreDoCorpo}, spacing: ${il.entreDoCorpo})`,
    // O fio do fim é a borda de baixo da última linha: um fio no fim da tabela o
    // Typst repete no pé de cada página, e o IBGE (8.3) quer o fio só na última.
    il.fios ? `  let ultima = ${b.linhas.length - 1}${continuidade ? " + if topo { 1 } else { 0 }" : ""}` : "",
    `  table(columns: colunas, stroke: ${il.fios ? "(x, y) => if y == ultima { (bottom: 0.5pt) } else { none }" : "0.5pt"}, inset: (x: 0.4em, y: ${il.respiroDaCelula}), ${alinhamento}`,
    continuidade
      ? `    table.header(repeat: true, ${topo} ${fio} ${celulas(cabecalho, false)} ${cabecalho.length ? fio : ""}),`
      : `    ${cabecalho.length ? `table.header(repeat: true, ${fio} ${cabecalho.flat().map(celula).join(" ")} ${fio}),` : fio}`,
    `    ${continuidade ? celulas(corpo, true) : corpo.flat().map(celula).join(" ")}`,
    // Uma linha vazia de altura zero fecha a tabela: assim o fio do fim fica entre
    // linhas, e não na borda da tabela (que o Typst repete no pé de cada página).
    il.fios ? `    table.cell(colspan: ${colunas}, inset: 0pt, breakable: false)[],` : "",
    `  )`,
    `}`,
  ].join("\n");
  const partes = (gradeFinal: string, comTitulo = true) =>
    [`#set align(left)`, `#set par(first-line-indent: 0pt, justify: false)`, ...(comTitulo ? acima : []), `#block(above: 0pt, below: 0pt, ${gradeFinal})`, ...abaixo].join("\n");
  if (il.estilo === "abnt") {
    // A largura do conteúdo, no meio da página. Se o título for mais largo, a
    // tabela se estica até ele, e os fios ficam na largura da identificação.
    const lugar = il.centralizada ? "center" : "left";
    const medir = continuidade ? `grade((auto,) * ${colunas}, topo: false)` : `grade((auto,) * ${colunas})`;
    return [
      `#block(above: ${il.fora}, below: ${il.fora}, width: 100%)[${e.registros!.join("")}#layout(espaco => {`,
      grade,
      `  let natural = measure(${medir}, width: espaco.width).width`,
      `  let doTitulo = measure([${titulo}], width: espaco.width).width`,
      `  let largura = calc.min(calc.max(natural, doTitulo), espaco.width)`,
      `  let final = if doTitulo > natural { grade((1fr,) * ${colunas}) } else { grade((auto,) * ${colunas}) }`,
      `  align(${lugar}, block(width: largura)[`,
      partes("final", !continuidade),
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
