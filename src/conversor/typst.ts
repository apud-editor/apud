// O conversor: junta o texto do trabalho (blocos) com o modelo da norma e
// escreve o código Typst, que o motor Typst transforma em páginas.
//
// Todas as medidas vêm do modelo (margens, fonte, entrelinhas, recuos, títulos,
// listas, número de página), lidas na árvore de elementos (versão 2, etapa 1c):
// cada valor é o do elemento ou, se ele não diz, o do elemento de cima. Nada de
// norma fica escrito aqui, e não há caminhos "se é ABNT, se é APA": o que muda
// entre as normas vem dos valores do modelo (por exemplo, a figura da APA, com
// o número em negrito e o título em itálico na linha de baixo, é a Identificação
// com "título na linha de baixo: sim").
//
// Títulos automáticos (versão 2, etapa 2, decisão 10): quando o modelo liga,
// o Apud numera os títulos (1, 1.1...), aplica as maiúsculas do destaque e
// começa o título numa página nova (modelos/titulos.ts, a mesma conta que o
// editor mostra). Com a opção desligada, vale o que a pessoa escreveu: as
// letras como estão, o número escrito no começo ("1.1 Contexto") e a página
// nova só onde ela pôs uma quebra. A lista de referências sai onde ela pôs o
// bloco "Lista de referências". Tudo o que sai no PDF tem um lugar no editor.
//
// Citações e referências (fase 2): cada citação é montada pelo motor de
// citações (citacoes/motor.ts) com as regras de citação do modelo, e uma marca invisível
// põe a obra na lista. A lista é montada pelo estilo CSL dentro do Typst, só
// com as obras citadas.
//
// Citação longa, notas de rodapé, figuras e tabelas (fase 3): a forma de
// cada um vem do modelo (recuo, fonte menor, espaço simples, fios da tabela).
// As figuras e tabelas são numeradas sozinhas, na ordem do texto; na ABNT,
// cada espécie de ilustração (Figura, Gráfico, Quadro) tem a sua contagem.
// As imagens não vão dentro do código: o motor as recebe como arquivos
// (arquivosDasImagens, em elementos.ts).
//
// Abertura (fase 3, parte 4): capa, folha de rosto, dedicatória,
// agradecimentos, epígrafe, resumos e sumário (ABNT), ou página de título e
// resumos (APA). Cada elemento ocupa a própria folha, e o texto começa na
// folha seguinte. A ordem e a frase da natureza ficam em abertura.ts; a forma,
// aqui, pelo modelo. Sem nenhum elemento ligado, o PDF sai como antes.
//
// Exceções "só este" (etapa 2 da v2): um parágrafo ou título com exceção
// sai com a forma dele, numa regra que vale só para ele; os outros seguem as
// regras gerais. Um Parágrafo diferente do Texto ("todos os parágrafos", nas
// escolhas do trabalho) também sai assim, parágrafo por parágrafo.
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
  type Excecoes,
  type Documento,
  type Figura,
  type Identificacao,
  type Imagem,
  type ItemDeLista,
  type NivelDeTitulo,
  type Tabela,
  type Titulo,
  type Resumo,
  type Trecho,
  type TrechoDeTexto,
} from "../documento/modelo";
import { caminhosDasImagens, larguraPadrao, pontoDaCitacaoLonga } from "./elementos";
import {
  anoDoTrabalho,
  comecaEmPaginaNovaNaAbertura,
  dataPorExtenso,
  elementosDaAbertura,
  existeNoModelo,
  idiomaParaTypst,
  juntarNomes,
  naturezaDoTrabalho,
  palavrasChave,
  paginaNovaPodeSair,
  repetirTituloNoTexto,
  nomeDoIdiomaNoModelo,
  type ElementoDaAbertura,
} from "./abertura";
import { separarNumero } from "../documento/estrutura";
import { valorEfetivo } from "../modelos/herdar";
import { valorNoBloco } from "../modelos/excecoes";
import { formaDosTitulos, numeraSozinho, numeroEscritoNoTitulo, vaiEmMaiusculas, type FormaDoTitulo } from "../modelos/titulos";
import { perfilDeCitacoes } from "../modelos/ponte";
import type { ModeloResolvido } from "../modelos/tipos";
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
  /**
   * Só para a prévia: uma marca invisível antes de cada bloco do texto e, no fim,
   * a lista de onde cada marca ficou (página e altura), para a prévia acompanhar
   * o cursor. O PDF exportado não leva as marcas.
   */
  marcarBlocos?: boolean;
}

/** A marca de cada bloco (o valor é a posição do bloco no texto) e a lista de onde elas ficaram. */
export const MARCA_DO_BLOCO = "apud-bloco";
export const MARCA_DAS_POSICOES = "apud-posicoes";

// ---------------------------------------------------------------------------
// Leitura do modelo

class Leitor {
  constructor(readonly modelo: ModeloResolvido) {}

  private v(elemento: string, propriedade: string) {
    const v = valorEfetivo(this.modelo, elemento, propriedade);
    if (!v) throw new Error(`o modelo ${this.modelo.identificacao.nome} não dá valor a “${propriedade}” em ${elemento}`);
    return v;
  }

  /** O valor como texto ("justificado", "canto superior direito"). */
  texto(elemento: string, propriedade: string): string {
    return this.v(elemento, propriedade).texto;
  }

  /** Um texto que pode ser "nenhuma" (vazio). */
  textoOuVazio(elemento: string, propriedade: string): string {
    const v = this.v(elemento, propriedade).valor;
    return v.tipo === "texto" ? v.valor : "";
  }

  /** Uma medida para o Typst: "1.25cm", "12pt". Zero sai como "0pt". */
  medida(elemento: string, propriedade: string): string {
    const v = this.v(elemento, propriedade).valor;
    if (v.tipo !== "medida") throw new Error(`“${propriedade}” em ${elemento} precisa ser uma medida`);
    return v.numero === 0 ? "0pt" : `${numero(v.numero)}${v.unidade}`;
  }

  /** Um número: entrelinha (1, 1,5, 2), linhas em branco, medida. */
  numero(elemento: string, propriedade: string): number {
    const v = this.v(elemento, propriedade).valor;
    if (v.tipo === "espacamento" || v.tipo === "quantidade" || v.tipo === "medida") return v.numero;
    throw new Error(`“${propriedade}” em ${elemento} precisa ser um número`);
  }

  destaque(elemento: string, propriedade: string) {
    const v = this.v(elemento, propriedade).valor;
    if (v.tipo !== "destaque") throw new Error(`“${propriedade}” em ${elemento} precisa ser um destaque`);
    return v;
  }

  lista(elemento: string, propriedade: string): string[] {
    const v = this.v(elemento, propriedade).valor;
    return v.tipo === "lista" ? v.itens : [];
  }

  sim(elemento: string, propriedade: string): boolean {
    const v = this.v(elemento, propriedade).valor;
    return v.tipo === "simnao" && v.valor;
  }

  /** Uma regra de citação (elemento Citações e referências), ou undefined se o modelo não a tem. */
  citacao(chave: string): string | undefined {
    const v = this.modelo.valores.get("citacoes")?.get(chave);
    return v && v.situacao.tipo !== "desligada" ? v.texto : undefined;
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

/** As medidas que os blocos usam, já lidas do modelo. */
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
  /** O modelo, para os blocos com exceção (que leem o valor do bloco). */
  modelo: ModeloResolvido;
  /** A forma do parágrafo nas regras gerais (a do Texto). Um parágrafo diferente sai com a própria. */
  formaDoTexto: FormaDoParagrafo;
  /** O número, a página nova e as maiúsculas de cada título do texto (os vazios não contam). */
  formasDosTitulos: Map<Bloco, FormaDoTitulo>;
}

/** O que muda de um parágrafo para outro: o alinhamento, a entrelinha e o recuo da primeira linha. */
interface FormaDoParagrafo {
  alinhamento: string;
  entrelinha: number;
  recuo: string;
}

/** A forma de um elemento (Texto ou Parágrafo), com as exceções do bloco, se houver. */
function formaDoParagrafo(modelo: ModeloResolvido, elemento: string, excecoes?: Excecoes): FormaDoParagrafo {
  const v = (p: string) => {
    const achado = valorNoBloco(modelo, elemento, p, excecoes);
    if (!achado) throw new Error(`o modelo ${modelo.identificacao.nome} não dá valor a “${p}” em ${elemento}`);
    return achado.valor;
  };
  const alinhamento = v("alinhamento");
  const entrelinha = v("entrelinha");
  const recuo = v("recuo da primeira linha");
  if (alinhamento.tipo !== "opcao" || entrelinha.tipo !== "espacamento" || recuo.tipo !== "medida") throw new Error(`a forma do parágrafo em ${elemento} está estragada`);
  return { alinhamento: alinhamento.valor, entrelinha: entrelinha.numero, recuo: recuo.numero === 0 ? "0pt" : `${numero(recuo.numero)}${recuo.unidade}` };
}

/** A forma das figuras e tabelas, lida do modelo. */
interface Ilustracoes {
  /** O nome que vai antes do número, pela espécie ("Figura", "Gráfico", "Quadro", "Tabela"). */
  rotulo: (especie: string) => string;
  /** Qual contagem a espécie usa: a dela, se o modelo a tem; senão a da primeira (na APA, tudo é Figura). */
  chave: (especie: string) => string;
  /** "Figura 1" com o destaque do número; o título com o dele, na mesma linha (com o separador) ou na de baixo. */
  destaqueDoNumero: (x: string) => string;
  destaqueDoTitulo: (x: string) => string;
  tituloNaLinhaDeBaixo: boolean;
  /** Espaço entre a identificação e o que vem embaixo. */
  entreDaIdentificacao: string;
  /** A fonte vai dentro da nota ("Nota. ... Fonte"), em vez de "Fonte: ..." e depois a nota. */
  fonteDentroDaNota: boolean;
  destaqueDoRotuloDaNota: (x: string) => string;
  /** O título e a fonte na largura da ilustração (ABNT), ou na largura do texto. */
  naLarguraDaIlustracao: boolean;
  /** A tabela na largura do conteúdo, no meio da página (IBGE), ou na largura do texto. */
  tabelaNaLarguraDoConteudo: boolean;
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
   * cabeçalho se repete.
   */
  continuidade: { continua: string; continuacao: string; conclusao: string; direita: boolean } | null;
  /** Largura do texto na página, em cm, para a largura padrão das figuras. */
  larguraDoTexto: number;
}

/** Escreve o código Typst do trabalho. */
export function documentoParaTypst(doc: Documento, modelo: ModeloResolvido, opcoes: OpcoesDoConversor = {}): string {
  const r = new Leitor(modelo);
  const k = r.numero("texto", "entrelinha");
  const entre = `${numero((k - 1) * LINHA_SIMPLES)}em`;
  const passo = `${numero(k * LINHA_SIMPLES)}em`;
  const justificado = r.texto("texto", "alinhamento") === "justificado";
  const fonte = { familia: r.texto("texto", "fonte"), tamanho: r.medida("texto", "tamanho") };
  const margens = {
    esquerda: r.medida("pagina", "margem esquerda"),
    superior: r.medida("pagina", "margem superior"),
    direita: r.medida("pagina", "margem direita"),
    inferior: r.medida("pagina", "margem inferior"),
  };

  const linhas: string[] = [];
  const l = (s = "") => linhas.push(s);
  const elementos = elementosDaAbertura(doc.abertura, existeNoModelo(modelo));
  // ABNT: o número só aparece a partir da primeira folha do texto. APA: desde a página de título.
  const esconderAteOTexto = elementos.length > 0 && r.texto("pagina.numero", "mostrar desde") === "primeira folha do texto";
  const id = modelo.identificacao;

  l(`// Gerado pelo Apud com o modelo ${id.nome}${id.versao ? ` ${id.versao}` : ""}, revisão ${id.revisao}.`);
  if (opcoes.titulo) l(`#set document(title: ${texto(opcoes.titulo)})`);

  // Página e número de página
  l(`#set page(`);
  l(`  paper: "a4",`);
  l(`  margin: (left: ${margens.esquerda}, top: ${margens.superior}, right: ${margens.direita}, bottom: ${margens.inferior}),`);
  // Sem abertura, o texto começa na página 1. Com ela, a contagem e o lugar onde o número aparece seguem a norma.
  const numeroDaPagina = `place(${lugarDoNumero(r, margens.direita)}, text(size: ${r.medida("pagina.numero", "tamanho")}, top-edge: "cap-height", bottom-edge: "baseline", counter(page).display("1")))`;
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
  const recuo = r.medida("texto", "recuo da primeira linha");
  l(`#set par(justify: ${justificado}, leading: ${entre}, spacing: ${entre}, first-line-indent: (amount: ${recuo}, all: true))`);

  // Títulos
  const medidas: Medidas = {
    entre,
    passo,
    recuo,
    naMesmaLinha: new Set(([1, 2, 3, 4, 5] as NivelDeTitulo[]).filter((n) => r.texto(`titulos.nivel${n}`, "texto depois") === "na mesma linha")),
    finalNaMesmaLinha: r.texto("titulos", "final na mesma linha") === "ponto" ? "." : "",
    listas: listas(r),
    citacaoLonga: citacaoLonga(r, entre, passo),
    ilustracoes: ilustracoes(r, entre, passo, margens),
    modelo,
    formaDoTexto: formaDoParagrafo(modelo, "texto"),
    formasDosTitulos: formasDosTitulos(doc, modelo),
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
  const motor = criarMotor(doc, perfilDeCitacoes(modelo));
  const caminhos = caminhosDasImagens(doc);
  // A lista de referências sai onde está o primeiro bloco "Lista de referências".
  // Sem o bloco, o PDF sai sem lista (o editor avisa) e as citações saem só como
  // texto: as marcas que põem as obras na lista não teriam lista onde entrar, e o
  // Typst não monta o documento. Um segundo bloco não repete a lista.
  const temLista = doc.blocos.some((b) => b.tipo === "referencias");
  let listaJaSaiu = false;
  const escrita: Escrita = {
    motor,
    semLista: !temLista,
    imagem: (id) => {
      const imagem = doc.imagens.find((im) => im.id === id);
      return imagem ? { imagem, caminho: caminhos.get(id)! } : undefined;
    },
    enfase: enfaseDepoisDoDestaque(r),
    lista: () => {
      if (listaJaSaiu || !motor.citadas.length) return "";
      listaJaSaiu = true;
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
  if (r.sim("titulos.repetido", "repetir no começo do texto") && repetirTituloNoTexto(doc.dados, doc.blocos)) {
    l(`#heading(level: 1, numbering: none, outlined: false)[${tituloParaTypst(doc, (x) => x)}]`);
    l();
  }
  const marcar = (i: number) => {
    if (opcoes.marcarBlocos) l(`#metadata(${i}) <${MARCA_DO_BLOCO}>`);
  };
  for (let i = 0; i < doc.blocos.length; i++) {
    const b = doc.blocos[i];
    // A página nova vem antes da marca da prévia: a marca fica na página do título.
    if (b.tipo === "titulo" && medidas.formasDosTitulos.get(b)?.paginaNova) l(PAGINA_NOVA);
    // Título na mesma linha do texto (APA, níveis 4 e 5): junta com o parágrafo seguinte.
    const seguinte = doc.blocos[i + 1];
    if (b.tipo === "titulo" && medidas.naMesmaLinha.has(b.nivel) && temConteudo(b.trechos) && seguinte?.tipo === "paragrafo" && temConteudo(seguinte.trechos)) {
      marcar(i);
      marcar(i + 1);
      l(tituloNaMesmaLinha(b, seguinte.trechos, medidas, escrita));
      i++;
      continue;
    }
    const s = blocoParaTypst(b, medidas, escrita);
    if (s) {
      marcar(i);
      l(s);
    }
  }
  if (opcoes.marcarBlocos) {
    // (bloco, página, altura em pt) de cada marca.
    l(`#context [#metadata(query(<${MARCA_DO_BLOCO}>).map(m => { let p = m.location().position(); (m.value, p.page, p.y / 1pt) })) <${MARCA_DAS_POSICOES}>]`);
  }
  return linhas.join("\n") + "\n";
}

/**
 * Onde fica o número da página: no canto ou no centro, a uma distância da borda
 * de cima (ou de baixo) e da lateral. A lateral pode ser "na margem": alinhado
 * à margem direita do texto (APA, como o cabeçalho do Word).
 */
function lugarDoNumero(r: Leitor, margemDireita: string): string {
  const posicao = r.texto("pagina.numero", "posição");
  const vertical = r.medida("pagina.numero", "distância vertical");
  const lateral = r.texto("pagina.numero", "distância lateral") === "na margem" ? margemDireita : r.medida("pagina.numero", "distância lateral");
  if (posicao === "canto inferior direito") return `bottom + right, dx: -${lateral}, dy: -${vertical}`;
  if (posicao === "centro inferior") return `bottom + center, dy: -${vertical}`;
  return `top + right, dx: -${lateral}, dy: ${vertical}`;
}

/**
 * O marcador dos itens de lista. O modelo dá um molde para cada tipo de lista:
 * com "a" (a), b), c)), com "1" (1., 2., 3.) ou um sinal fixo (•). A sub-lista
 * usa o mesmo molde ou um traço próprio (ABNT: sub-alínea com travessão).
 */
function listas(r: Leitor): Medidas["listas"] {
  const emSequencia = r.texto("listas", "marcador em sequência");
  const semSequencia = r.texto("listas", "marcador sem sequência");
  const sub = r.texto("listas", "marcador da sub-lista");
  const pelo = (molde: string, i: number) => (molde.includes("a") ? molde.replace("a", letraDaAlinea(i)) : molde.includes("1") ? molde.replace("1", String(i + 1)) : molde);
  return {
    recuo: r.medida("listas", "recuo à esquerda"),
    recuoSub: r.medida("listas", "recuo a mais da sub-lista"),
    marcador: (sequencia, nivel, i) => {
      if (nivel > 0 && sub !== "igual ao da lista") return sub === "travessão" ? "—" : "–";
      return pelo(sequencia ? emSequencia : semSequencia, i);
    },
  };
}

/** Espaço entre as linhas para um espaçamento (1 = simples, 1,5, 2 = duplo), como no Word. */
const entreLinhas = (k: number) => `${numero((k - 1) * LINHA_SIMPLES)}em`;

/** Espaço antes e depois de um bloco com n linhas em branco: o espaço normal mais as linhas. */
const comLinhas = (entre: string, passo: string, n: number) => (n ? `${entre} + ${numero(n)} * ${passo}` : entre);

/** Citação longa (ABNT) ou em bloco (APA). */
function citacaoLonga(r: Leitor, entre: string, passo: string): Medidas["citacaoLonga"] {
  const ponto = r.texto("citacaoLonga", "ponto final");
  return {
    recuo: r.medida("citacaoLonga", "recuo à esquerda"),
    tamanho: r.medida("citacaoLonga", "tamanho"),
    entre: entreLinhas(r.numero("citacaoLonga", "entrelinha")),
    fora: comLinhas(entre, passo, r.numero("citacaoLonga", "espaço antes")),
    ponto: ponto === "antes da chamada" ? "antes" : ponto === "depois da chamada" ? "depois" : undefined,
  };
}

/** Os nomes das espécies, sem acento e em minúsculas, para achar "Gráfico" pela espécie "grafico". */
const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function continuidadeDaTabela(r: Leitor): Ilustracoes["continuidade"] {
  if (r.texto("ilustracoes.tabela", "em mais de uma página") !== "número, título e cabeçalho repetidos em cada página") return null;
  const [continua, continuacao, conclusao] = r.lista("ilustracoes.tabela", "indicações");
  return { continua, continuacao, conclusao, direita: r.texto("ilustracoes.tabela", "posição das indicações") !== "à esquerda" };
}

/** Negrito, itálico e sublinhado de um destaque, em volta de um código já escrito. As letras ficam como estão. */
function aplicarDestaque(d: { negrito: boolean; italico: boolean; sublinhado: boolean }, x: string): string {
  let s = x;
  if (d.negrito) s = `#strong[${s}]`;
  if (d.italico) s = `#emph[${s}]`;
  if (d.sublinhado) s = `#underline[${s}]`;
  return s;
}

function ilustracoes(r: Leitor, entre: string, passo: string, margens: { esquerda: string; direita: string }): Ilustracoes {
  const separadores: Record<string, string> = { travessão: " – ", hífen: " - ", ponto: ". ", "dois-pontos": ": " };
  const especies = r.lista("ilustracoes", "espécies");
  const achar = (especie: string) => especies.find((t) => semAcento(t) === especie);
  const rotuloDaTabela = r.texto("ilustracoes.tabela", "rótulo");
  const cm = (m: string) => parseFloat(m) * (m.endsWith("mm") ? 0.1 : 1);
  const corpo = r.numero("ilustracoes.tabela", "entrelinha");
  const numero_ = r.destaque("ilustracoes.identificacao", "destaque do número");
  const titulo_ = r.destaque("ilustracoes.identificacao", "destaque do título");
  const rotuloDaNota_ = r.destaque("ilustracoes.fonte", "destaque do rótulo da nota");
  return {
    rotulo: (especie) => (especie === "tabela" ? rotuloDaTabela : (achar(especie) ?? especies[0] ?? "Figura")),
    chave: (especie) => (especie === "tabela" || achar(especie) ? especie : semAcento(especies[0] ?? "Figura")),
    destaqueDoNumero: (x) => aplicarDestaque(numero_, x),
    destaqueDoTitulo: (x) => aplicarDestaque(titulo_, x),
    tituloNaLinhaDeBaixo: r.sim("ilustracoes.identificacao", "título na linha de baixo"),
    entreDaIdentificacao: entreLinhas(r.numero("ilustracoes.identificacao", "entrelinha")),
    fonteDentroDaNota: r.sim("ilustracoes.fonte", "fonte dentro da nota"),
    destaqueDoRotuloDaNota: (x) => aplicarDestaque(rotuloDaNota_, x),
    naLarguraDaIlustracao: r.texto("ilustracoes", "largura do título e da fonte") === "largura da ilustração",
    tabelaNaLarguraDoConteudo: r.texto("ilustracoes.tabela", "largura") === "largura do conteúdo",
    contagem: new Map(),
    separador: separadores[r.texto("ilustracoes.identificacao", "separador")] ?? " – ",
    rotuloDaFonte: r.texto("ilustracoes.fonte", "rótulo da fonte"),
    fonteSua: r.textoOuVazio("ilustracoes.fonte", "fonte quando é sua"),
    rotuloDaNota: r.texto("ilustracoes.fonte", "rótulo da nota"),
    fora: comLinhas(entre, passo, r.numero("ilustracoes", "espaço antes")),
    centralizada: r.texto("ilustracoes", "posição") !== "à esquerda",
    tamanhoDoRodape: r.medida("ilustracoes.fonte", "tamanho"),
    entreDoRodape: entreLinhas(r.numero("ilustracoes.fonte", "entrelinha")),
    entreDoCorpo: entreLinhas(corpo),
    respiroDaCelula: `${numero(((corpo - 1) * LINHA_SIMPLES) / 2 + 0.15)}em`,
    fios: r.texto("ilustracoes.tabela", "fios") === "acima e abaixo do cabeçalho e no fim, sem fios nas laterais",
    alinhar: r.texto("ilustracoes.tabela", "alinhamento das células") === "cabeçalho ao centro, primeira coluna à esquerda, demais ao centro",
    continuidade: continuidadeDaTabela(r),
    larguraDoTexto: 21 - cm(margens.esquerda) - cm(margens.direita),
  };
}

/**
 * Notas de rodapé: o filete, a fonte e o espaço vêm do modelo. Na ABNT, as
 * linhas seguintes ficam sob a primeira letra da nota (o número numa coluna
 * própria); na APA, a nota corre como no Word.
 */
function escreverNotas(l: (s?: string) => void, r: Leitor, justificado: boolean) {
  const tamanho = r.medida("nota", "tamanho");
  const entre = entreLinhas(r.numero("nota", "entrelinha"));
  const filete = r.medida("nota", "filete");
  const sob = r.texto("nota", "linhas seguintes") === "alinhadas sob a primeira letra";
  // O filete fica numa caixa da altura de meia linha, para não encostar no texto da nota.
  l(`#set footnote.entry(separator: box(height: 0.5em, line(length: ${filete}, stroke: 0.5pt)), clearance: ${numero(LINHA_SIMPLES)}em, gap: ${entre}, indent: 0pt)`);
  l(`#show footnote.entry: it => {`);
  l(`  let n = numbering(it.note.numbering, ..counter(footnote).at(it.note.location()))`);
  l(`  set text(size: ${tamanho})`);
  l(`  set par(justify: ${justificado}, leading: ${entre}, spacing: ${entre}, first-line-indent: 0pt)`);
  l(sob ? `  grid(columns: (auto, 1fr), column-gutter: 0.2em, super(n), it.note.body)` : `  [#super(n) #it.note.body]`);
  l(`}`);
}

/**
 * O destaque de um título, como expressão do Typst em volta de `x`: negrito,
 * itálico e sublinhado, e as maiúsculas só quando o Apud pode mexer nas letras
 * ("maiúsculas sozinho"); senão, o título sai com as letras que a pessoa escreveu.
 */
function destaqueDoTituloTypst(d: { negrito: boolean; italico: boolean; sublinhado: boolean }, x: string, maiusculas = false): string {
  let s = maiusculas ? `upper(${x})` : x;
  if (d.negrito) s = `strong(${s})`;
  if (d.italico) s = `emph(${s})`;
  if (d.sublinhado) s = `underline(${s})`;
  return s;
}

/** A posição de um título (APA): centralizado, à esquerda ou com recuo de parágrafo, em volta de `x`. */
function posicaoDoTituloTypst(posicao: string, x: string, m: Medidas): string {
  return posicao === "centralizado" ? `align(center, ${x})` : posicao === "com recuo" ? `pad(left: ${m.recuo}, ${x})` : x;
}

/**
 * A regra que desenha os títulos. `destaque` é a expressão do destaque em
 * volta de `x`, e `posicao`, a da posição em volta de `corpo`: as funções de
 * cada nível, nas regras gerais, ou o valor de um título com exceção.
 */
function regraDosTitulos(destaque: string, posicao: string, antes: number, depois: number, m: Medidas): string[] {
  return [
    `#show heading: it => {`,
    // O número, um espaço e o título; as linhas seguintes ficam sob a primeira
    // letra do título. Sem número: só o título.
    `  set par(justify: false, first-line-indent: 0pt)`,
    `  let d(x) = ${destaque}`,
    `  let corpo = if it.numbering == none { d(it.body) } else { grid(columns: (auto, 1fr), column-gutter: 0.25em, d(counter(heading).display(it.numbering)), d(it.body)) }`,
    `  block(width: 100%, above: ${m.entre} + ${numero(antes)} * ${m.passo}, below: ${m.entre} + ${numero(depois)} * ${m.passo}, sticky: true, ${posicao})`,
    `}`,
  ];
}

/** A regra de destaque de cada nível de título, como função do Typst, e a forma de cada nível. */
function escreverTitulos(l: (s?: string) => void, r: Leitor, m: Medidas) {
  const antes = r.numero("titulos", "espaço antes");
  const depois = r.numero("titulos", "espaço depois");
  l(`#let destaque-do-titulo(n, x) = {`);
  for (let nivel = 1; nivel <= 5; nivel++) {
    const x = destaqueDoTituloTypst(r.destaque(`titulos.nivel${nivel}`, "destaque"), "x", vaiEmMaiusculas(r.modelo, nivel as NivelDeTitulo));
    l(`  ${nivel === 1 ? "if" : "else if"} n == ${nivel} { ${x} }`);
  }
  l(`  else { x }`);
  l(`}`);
  // Posição de cada nível (APA): centralizado, à esquerda ou com recuo de parágrafo.
  l(`#let posicao-do-titulo(n, x) = {`);
  for (let nivel = 1; nivel <= 5; nivel++) {
    const x = posicaoDoTituloTypst(r.texto(`titulos.nivel${nivel}`, "posição"), "x", m);
    l(`  ${nivel === 1 ? "if" : "else if"} n == ${nivel} { ${x} }`);
  }
  l(`  else { x }`);
  l(`}`);
  for (const linha of regraDosTitulos("destaque-do-titulo(it.level, x)", "posicao-do-titulo(it.level, corpo)", antes, depois, m)) l(linha);
  // Os títulos não têm tamanho próprio: usam o da fonte do texto.
  l(`#show heading: set text(size: ${r.medida("titulos", "tamanho")}, weight: "regular")`);
}

/**
 * Um título com exceção de destaque ou de posição: a regra dos títulos com os
 * valores dele, valendo só para ele. (O sumário segue o destaque do nível.)
 * Undefined quando o título não tem exceção dessas.
 */
function regraDoTituloComExcecao(nivel: NivelDeTitulo, excecoes: Excecoes | undefined, m: Medidas): string[] | undefined {
  if (!excecoes || !Object.keys(excecoes).some((k) => k === "destaque" || k === "posição" || k === "maiúsculas sozinho")) return undefined;
  const r = new Leitor(m.modelo);
  const el = `titulos.nivel${nivel}`;
  const destaque = valorNoBloco(m.modelo, el, "destaque", excecoes)!.valor;
  const posicao = valorNoBloco(m.modelo, el, "posição", excecoes)!.texto;
  if (destaque.tipo !== "destaque") throw new Error(`“destaque” em ${el} precisa ser um destaque`);
  return regraDosTitulos(destaqueDoTituloTypst(destaque, "x", vaiEmMaiusculas(m.modelo, nivel, excecoes)), posicaoDoTituloTypst(posicao, "corpo", m), r.numero("titulos", "espaço antes"), r.numero("titulos", "espaço depois"), m);
}

// ---------------------------------------------------------------------------
// Abertura: os elementos antes do texto

/** Aplica negrito, itálico e sublinhado de uma regra de destaque. As letras ficam como estão. */
function comDestaque(r: Leitor, elemento: string, propriedade: string, x: string): string {
  return aplicarDestaque(r.destaque(elemento, propriedade), x);
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
function rotuloDeSecao(rotulo: string, r: Leitor): string {
  const maiusculas = r.destaque("titulos.semNumero", "destaque").maiusculas;
  const centralizado = r.texto("titulos.semNumero", "alinhamento") === "centralizado";
  const t = `heading(level: 1, numbering: none, outlined: false)[${escaparTexto(maiusculas ? rotulo.toLocaleUpperCase("pt-BR") : rotulo)}]`;
  return centralizado ? `#align(center, ${t})` : `#${t}`;
}

/** Linhas como um parágrafo só, separadas por quebra de linha. Linhas vazias saem. */
const emLinhas = (linhas: (string | undefined)[]) => linhas.filter((x): x is string => !!x && x.trim() !== "").join(" \\\n");

function aberturaParaTypst(doc: Documento, elementos: ElementoDaAbertura[], r: Leitor, m: Medidas, e: Escrita): string[] {
  const d = doc.dados;
  const cego = doc.abertura.semIdentificacao;
  const autores = cego ? [] : d.autores.map((a) => escaparTexto(a.trim())).filter(Boolean);
  const ano = anoDoTrabalho(d);
  const justificado = r.texto("texto", "alinhamento") === "justificado";
  const partes: string[] = [];
  const contarACapa = r.texto("pagina.numero", "contar desde") === "capa";
  const paragrafos = (ps: TrechoDeTexto[][]) =>
    ps.filter((p) => p.some((t) => t.texto.trim())).map((p) => trechosParaTypst(p, e)).join("\n\n");
  // Uma folha inteira, sem recuo de parágrafo; o pagebreak fecha a folha.
  const folha = (corpo: string) => `#block(width: 100%, height: 100%, {\n  set par(first-line-indent: 0pt, justify: false)\n  ${corpo}\n})\n#pagebreak()\n`;
  const campos = (elemento: string, propriedade = "campos") => r.lista(elemento, propriedade).map((c) => c.replace(" (opcional)", ""));

  // Onde começa a parte de cada elemento, para tirar a página nova do fim dela quando o seguinte não a quer.
  const inicioDe: number[] = [];
  for (const el of elementos) {
    inicioDe.push(partes.length);
    switch (el.tipo) {
      case "capa": {
        const c = campos("abertura.capa");
        const quer = (x: string) => c.length === 0 || c.includes(x);
        const instituicao = quer("instituição") ? emLinhas([d.instituicao && escaparTexto(d.instituicao.trim()), d.curso && escaparTexto(d.curso.trim())]) : "";
        const titulo = d.titulo.trim() && quer("título") ? tituloParaTypst(doc, (x) => comDestaque(r, "abertura.capa", "destaque do título", x)) : "";
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
        const c = campos("abertura.folhaDeRosto");
        const quer = (x: string) => c.length === 0 || c.includes(x);
        const titulo = d.titulo.trim() && quer("título") ? tituloParaTypst(doc, (x) => comDestaque(r, "abertura.folhaDeRosto", "destaque do título", x)) : "";
        const natureza = quer("natureza") ? naturezaDoTrabalho(d) : "";
        const rotulo = r.texto("abertura.folhaDeRosto", d.tipo === "disciplina" ? "rótulo do professor" : "rótulo do orientador");
        const orientador = quer("orientador") && !cego && d.orientador?.trim() ? `${escaparTexto(rotulo)} ${escaparTexto(d.orientador.trim())}`.trim() : "";
        const entre = entreLinhas(r.numero("abertura.folhaDeRosto.natureza", "entrelinha"));
        const tamanhoDaNatureza = r.medida("abertura.folhaDeRosto.natureza", "tamanho");
        const tamanho = tamanhoDaNatureza !== r.medida("texto", "tamanho") ? `set text(size: ${tamanhoDaNatureza})\n` : "";
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
        const profissional = d.tipo === "artigo" && r.texto("abertura.paginaDeTitulo", "modo quando o trabalho é artigo") === "profissional";
        const c = campos("abertura.paginaDeTitulo", profissional ? "campos no modo profissional" : "campos no modo estudante");
        const quer = (x: string) => c.length === 0 || c.includes(x);
        // Na APA, o subtítulo é parte do título: o destaque vale para os dois.
        const titulo = d.titulo.trim() ? comDestaque(r, "abertura.paginaDeTitulo", "destaque do título", tituloParaTypst(doc, (x) => x)) : "";
        const filiacao = [d.curso?.trim(), d.instituicao?.trim()].filter(Boolean).map((x) => escaparTexto(x!)).join(", ");
        const linhasAbaixo = [
          quer("autor") || quer("autores") ? escaparTexto(juntarNomes(cego ? [] : d.autores)) : undefined,
          quer("departamento e universidade") || quer("afiliação") ? filiacao : undefined,
          quer("código e nome da disciplina") && d.disciplina?.trim() ? escaparTexto(d.disciplina.trim()) : undefined,
          quer("professor") && !cego && d.orientador?.trim() ? escaparTexto(d.orientador.trim()) : undefined,
          quer("data de entrega") && d.dataDeEntrega ? escaparTexto(dataPorExtenso(d.dataDeEntrega)) : undefined,
        ];
        const antes = r.numero("abertura.paginaDeTitulo", "linhas antes do título");
        const depois = r.numero("abertura.paginaDeTitulo", "linhas depois do título");
        const k = r.numero("abertura.paginaDeTitulo", "entrelinha");
        const entre = entreLinhas(k);
        partes.push(
          `#{\n  set par(first-line-indent: 0pt, justify: false, leading: ${entre}, spacing: ${entre})\n  set align(center)\n  v(${numero(antes)} * ${m.passo})\n  [${titulo}]\n  v(${numero(depois)} * ${m.passo})\n  [${emLinhas(linhasAbaixo)}]\n}\n#pagebreak()\n`,
        );
        break;
      }
      case "dedicatoria":
      case "epigrafe": {
        // NBR 14724: no pé da página, do meio para a direita, sem título.
        const el2 = el.bloco;
        const autoria = el.tipo === "epigrafe" && r.sim("abertura.epigrafe", "autoria") && el.bloco.autoria.trim() ? `\n\n#align(right)[${escaparTexto(el.bloco.autoria.trim())}]` : "";
        partes.push(folha(`align(bottom, pad(left: 50%, {\n  set par(justify: ${justificado}, leading: ${m.entre}, spacing: ${m.entre})\n  [${paragrafos(el2.paragrafos)}${autoria}]\n}))`));
        break;
      }
      case "agradecimentos": {
        const rotulo = r.texto("abertura.agradecimentos", "título");
        partes.push(`${rotuloDeSecao(rotulo, r)}\n${paragrafos(el.bloco.paragrafos)}\n#pagebreak()\n`);
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
  // Um elemento sem página nova ("só este", como dois resumos na mesma página)
  // fica logo depois do anterior: sai a quebra do fim da parte anterior. Só
  // depois de um elemento que não ocupa a folha inteira (paginaNovaPodeSair).
  for (let i = 1; i < elementos.length; i++) {
    const el = elementos[i];
    const excecoes = el.tipo === "resumo" ? el.resumo.excecoes : el.tipo === "agradecimentos" ? el.bloco.excecoes : el.tipo === "sumario" ? el.excecoes : undefined;
    if (!paginaNovaPodeSair(elementos[i - 1].tipo, el.tipo) || comecaEmPaginaNovaNaAbertura(m.modelo, el.tipo, excecoes)) continue;
    const k = inicioDe[i] - 1;
    partes[k] = partes[k].replace(/\n?#pagebreak\(\)\n$/, "\n");
  }
  return partes;
}

/**
 * Um resumo, na própria folha: o título do trabalho no idioma (se houver), o
 * rótulo (RESUMO, ABSTRACT...), o texto num parágrafo só e as palavras-chave.
 * O rótulo de cada idioma vem do modelo (o Em branco tem os de português,
 * inglês, espanhol, francês, italiano e alemão; um idioma sem rótulo usa o do inglês).
 */
function resumoParaTypst(resumo: Resumo, r: Leitor, m: Medidas, e: Escrita): string {
  const idioma = nomeDoIdiomaNoModelo(resumo.idioma);
  const rotulo = r.texto("abertura.resumo", `título em ${idioma}`);
  const rotuloDasPalavras = r.texto("abertura.resumo.palavrasChave", `rótulo em ${idioma}`);
  const k = r.numero("abertura.resumo", "entrelinha");
  const entre = entreLinhas(k);
  const passo = `${numero(k * LINHA_SIMPLES)}em`;
  const recuo = (elemento: string) => r.medida(elemento, "recuo da primeira linha");
  const separador = r.texto("abertura.resumo.palavrasChave", "separador") as "ponto e vírgula" | "vírgula" | "ponto";
  const final = r.texto("abertura.resumo.palavrasChave", "final") as "ponto" | "nenhum";
  const palavras = palavrasChave(resumo.palavrasChave, separador, final);
  const { lang, region } = idiomaParaTypst(resumo.idioma);
  const justificado = r.texto("texto", "alinhamento") === "justificado";
  const linhas = [
    resumo.titulo?.trim() ? `#align(center, block(below: ${m.passo})[#strong[${escaparTexto(resumo.titulo.trim())}]])` : "",
    rotuloDeSecao(rotulo, r),
    `#{`,
    `  set text(lang: ${texto(lang)}${region ? `, region: ${texto(region)}` : ""})`,
    `  set par(justify: ${justificado}, leading: ${entre}, spacing: ${entre}, first-line-indent: (amount: ${recuo("abertura.resumo")}, all: true))`,
    `  [${trechosParaTypst(resumo.trechos, e)}]`,
  ];
  if (palavras) {
    const n = r.numero("abertura.resumo.palavrasChave", "espaço antes");
    linhas.push(`  parbreak()`);
    if (n) linhas.push(`  v(${numero(n)} * ${passo})`);
    linhas.push(`  set par(first-line-indent: (amount: ${recuo("abertura.resumo.palavrasChave")}, all: true))`);
    linhas.push(`  [${comDestaque(r, "abertura.resumo.palavrasChave", "destaque do rótulo", escaparTexto(rotuloDasPalavras))} ${escaparTexto(palavras)}]`);
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
function sumarioParaTypst(doc: Documento, r: Leitor, m: Medidas): string {
  const rotulo = r.texto("abertura.sumario", "título");
  const numeros = doc.blocos.flatMap((b) => {
    if (b.tipo !== "titulo" || !temConteudo(b.trechos)) return [];
    const { numero: n } = numeroETexto(b, m);
    return n ? [`destaque-do-titulo(${b.nivel}, [${escaparTexto(n)}])`] : [];
  });
  const ligacao = r.texto("abertura.sumario", "ligação até a página") === "nenhuma" ? "h(1fr)" : "box(width: 1fr, repeat(gap: 0.15em)[.])";
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
 * Pontuação dobrada na lista de referências. O motor de referências (CSL) põe
 * o ponto depois do título mesmo quando ele termina em "?" ou "!"
 * ("…São Paulo?**.**"), e a NBR 6023 não pede esse ponto. Estas regras, em
 * código do Typst, tiram o ponto: a primeira quando os dois estão no mesmo
 * texto ("mais!. Natal"); a segunda quando o "?" está no fim do negrito ou do
 * itálico e o ponto logo depois, fora dele (aí é preciso olhar a referência
 * inteira: cada referência é um bloco, e a regra refaz só as que mudam).
 * Valem só dentro da lista. O script de prova usa as mesmas regras.
 */
export const PONTUACAO_DA_LISTA = String.raw`
  let apud-fim-do-texto(c) = {
    if c.has("text") { c.text }
    else if c.has("body") { apud-fim-do-texto(c.body) }
    else if c.has("child") { apud-fim-do-texto(c.child) }
    else if c.has("children") and c.children.len() > 0 { apud-fim-do-texto(c.children.last()) }
    else { "" }
  }
  // Devolve (o conteúdo sem o ponto dobrado, o texto em que ele termina). Desce
  // pelas sequências e pelos invólucros (menos negrito e itálico), levando o fim
  // do texto anterior, porque o ponto pode estar numa camada e o "?" noutra.
  let apud-tira-ponto(c, anterior) = {
    if type(c) != content { return (c, anterior) }
    if c.has("text") {
      if c.text.starts-with(".") and (anterior.ends-with("?") or anterior.ends-with("!")) {
        let resto = c.text.slice(1)
        return (text(resto), if resto == "" { anterior } else { resto })
      }
      return (c, if c.text == "" { anterior } else { c.text })
    }
    if c.has("children") {
      let saida = ()
      let fim = anterior
      for filho in c.children {
        let (novo, f) = apud-tira-ponto(filho, fim)
        saida.push(novo)
        fim = f
      }
      return (saida.join(), fim)
    }
    if c.func() != strong and c.func() != emph and c.has("body") and type(c.body) == content {
      let (novo, f) = apud-tira-ponto(c.body, anterior)
      return (if novo == c.body { c } else { novo }, f)
    }
    let t = apud-fim-do-texto(c)
    (c, if t == "" { anterior } else { t })
  }
  show block: it => {
    if type(it.body) != content { return it }
    let (novo, _) = apud-tira-ponto(it.body, "")
    if novo == it.body { it } else { let f = it.fields(); let _ = f.remove("body"); block(..f, novo) }
  }
  show regex("[?!]\\.( |$)"): m => m.text.slice(0, 1) + m.text.slice(2)
`;

/**
 * O título e a lista de referências, onde a pessoa pôs o bloco. O título vem
 * do modelo e tem a forma de um título de nível 1 sem número, centralizado se
 * o modelo manda (ABNT: REFERÊNCIAS; APA: Referências). A lista vem do CSL:
 *   - ABNT: espaço simples e uma linha em branco entre as referências;
 *   - APA: o espaço do texto, sem linha em branco, e as linhas seguintes recuadas.
 */
function listaDeReferencias(motor: Motor, r: Leitor, csl: string, m: Medidas): string {
  const rotulo = r.texto("referencias", "título");
  const centralizado = r.texto("titulos.semNumero", "alinhamento") === "centralizado";
  const titulo = `heading(level: 1, numbering: none, outlined: true)[${escaparTexto(rotulo)}]`;
  const simples = r.numero("referencias", "entrelinha") === 1;
  const branco = r.numero("referencias", "espaço entre as referências");
  const passoSimples = `${numero(LINHA_SIMPLES)}em`;
  const entreLinhas = simples ? "0em" : m.entre;
  const entreReferencias = simples ? `${branco} * ${passoSimples}` : `${m.entre} + ${branco} * ${passoSimples}`;
  const justificar = r.texto("referencias", "alinhamento") !== "à esquerda";
  const pendente = r.medida("referencias", "recuo das linhas seguintes");
  const dados = JSON.stringify(motor.referenciasDoTypst);
  return [
    centralizado ? `#align(center, ${titulo})` : `#${titulo}`,
    `#{`,
    `  set par(justify: ${justificar}, first-line-indent: 0pt, hanging-indent: ${pendente}, leading: ${entreLinhas}, spacing: ${entreReferencias})`,
    `  set block(spacing: ${entreReferencias})`,
    PONTUACAO_DA_LISTA,
    // Em português, o Typst repete na linha de baixo o hífen da quebra ("contra-" /
    // "-pessoas"), como manda a regra para palavras. Num endereço da internet isso
    // muda o endereço: nos endereços, o hífen não se repete.
    `  show link: set text(lang: "en")`,
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
  /** O trabalho não tem o bloco da lista: as citações saem sem as marcas da lista. */
  semLista?: boolean;
  /**
   * Quando existe, as marcas que põem as obras na lista ficam guardadas aqui
   * em vez de irem no meio do texto. A tabela mede o próprio conteúdo, e o
   * Typst não sabe medir um texto com essas marcas.
   */
  registros?: string[];
}

/** Na APA, o destaque seu vai dentro da citação, depois do trecho em itálico: "[ênfase adicionada]". */
function enfaseDepoisDoDestaque(r: Leitor): string | undefined {
  if (r.citacao("citação, destaque seu, onde") !== "entre colchetes, depois do trecho destacado") return undefined;
  const expressao = r.citacao("citação, destaque seu");
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

/** A forma de cada título com conteúdo, na ordem do texto (a mesma conta do editor). */
function formasDosTitulos(doc: Documento, modelo: ModeloResolvido): Map<Bloco, FormaDoTitulo> {
  const titulos = doc.blocos.filter((b): b is Titulo => b.tipo === "titulo" && temConteudo(b.trechos));
  const formas = formaDosTitulos(modelo, titulos, doc.dados.tipo);
  return new Map(titulos.map((t, i) => [t, formas[i]]));
}

/**
 * O número do título e o texto sem ele. Com a numeração automática, o número
 * é o do Apud, e um número de seção escrito à mão no começo sai do texto (para
 * não sair duas vezes). Sem ela, o número é o que a pessoa escreveu.
 */
function numeroETexto(b: Titulo, m: Medidas): { numero: string; trechos: Trecho[] } {
  if (!numeraSozinho(m.modelo, b.nivel, b.excecoes)) return numeroDoTitulo(b.trechos);
  const numero = m.formasDosTitulos.get(b)?.numero ?? "";
  const primeiro = b.trechos[0];
  const escrito = primeiro && ehTexto(primeiro) ? numeroEscritoNoTitulo(primeiro.texto) : undefined;
  return { numero, trechos: escrito ? [{ ...primeiro, texto: escrito.resto }, ...b.trechos.slice(1)] : b.trechos };
}

/** A quebra antes de um título que começa em página nova ("fraca": não deixa página em branco). */
const PAGINA_NOVA = "#pagebreak(weak: true)";

const mesmaForma = (a: FormaDoParagrafo, b: FormaDoParagrafo) => a.alinhamento === b.alinhamento && a.entrelinha === b.entrelinha && a.recuo === b.recuo;

/**
 * Um parágrafo. Com a forma do Texto, sai como está (as regras gerais valem).
 * Com outra (exceção "só este", ou o Parágrafo mudado para todos), sai com as
 * regras dele, valendo só dentro dele.
 */
function paragrafoComForma(corpo: string, forma: FormaDoParagrafo, m: Medidas): string {
  if (mesmaForma(forma, m.formaDoTexto)) return `${corpo}\n`;
  const entre = `${numero((forma.entrelinha - 1) * LINHA_SIMPLES)}em`;
  const regras = [`#set par(justify: ${forma.alinhamento === "justificado"}, leading: ${entre}, spacing: ${entre}, first-line-indent: (amount: ${forma.recuo}, all: true))`];
  if (forma.alinhamento === "centralizado") regras.push(`#set align(center)`);
  if (forma.alinhamento === "à direita") regras.push(`#set align(right)`);
  return `#[\n${regras.join("\n")}\n${corpo}\n]\n`;
}

function blocoParaTypst(b: Bloco, m: Medidas, e: Escrita): string {
  switch (b.tipo) {
    case "paragrafo": {
      // Parágrafos vazios não viram linhas em branco: o espaço é da norma, não da pessoa.
      if (!temConteudo(b.trechos)) return "";
      return paragrafoComForma(trechosParaTypst(b.trechos, e), formaDoParagrafo(m.modelo, "paragrafo", b.excecoes), m);
    }
    case "titulo": {
      if (!temConteudo(b.trechos)) return "";
      // O número (do Apud ou o escrito pela pessoa) vai como a "numeração" do título:
      // assim ele fica numa coluna própria (para o alinhamento) e também no sumário.
      const { numero, trechos } = numeroETexto(b, m);
      const numeracao = numero ? `(..n) => ${texto(numero)}` : "none";
      const fim = m.naMesmaLinha.has(b.nivel) ? finalDoTitulo(trechos, m) : "";
      const titulo = `#heading(level: ${b.nivel}, numbering: ${numeracao})[${trechosParaTypst(trechos, e)}${fim}]`;
      const regra = regraDoTituloComExcecao(b.nivel, b.excecoes, m);
      return regra ? `#[\n${regra.join("\n")}\n${titulo}\n]\n` : `${titulo}\n`;
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
  const chave = il.chave(especie);
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
  const fonte = b.fontePropria ? escaparTexto(il.fonteSua) : trechosParaTypst(b.fonte, e);
  const nota = b.nota ? trechosParaTypst(b.nota, e) : "";
  const linha = (conteudo: string, abaixo: string) => `#block(above: 0pt, below: ${abaixo}, sticky: true)[${conteudo}]`;
  // Um pouco de ar entre a imagem ou o último fio da tabela e a fonte, mesmo em espaço simples.
  const rodape = (conteudo: string) =>
    `#block(above: ${il.entreDoRodape} + 0.3em, below: 0pt)[#set text(size: ${il.tamanhoDoRodape}); #set par(leading: ${il.entreDoRodape}, spacing: ${il.entreDoRodape}); ${conteudo}]`;
  // Embaixo: "Nota. ... Fonte" (a fonte dentro da nota), ou "Fonte: ..." e depois a nota.
  const corpoDaNota = [nota, fonte].filter(Boolean).join(" ");
  const abaixo = il.fonteDentroDaNota
    ? corpoDaNota
      ? [rodape(`${il.destaqueDoRotuloDaNota(escaparTexto(il.rotuloDaNota))} ${corpoDaNota}`)]
      : []
    : [...(fonte ? [rodape(`${escaparTexto(il.rotuloDaFonte)} ${fonte}`)] : []), ...(nota ? [rodape(nota)] : [])];
  // Em cima: "Figura 1" e o título na linha de baixo, ou "Figura 1 – Título" numa linha só.
  if (il.tituloNaLinhaDeBaixo) {
    const t = il.destaqueDoTitulo(titulo);
    return {
      acima: [linha(il.destaqueDoNumero(escaparTexto(`${rotulo} ${n}`)), il.entreDaIdentificacao), linha(t, il.entreDaIdentificacao)],
      abaixo,
      titulo: t,
      numero: n,
    };
  }
  const sep = titulo ? escaparTexto(il.separador) : "";
  const completo = `${il.destaqueDoNumero(escaparTexto(`${rotulo} ${n}`))}${sep}${il.destaqueDoTitulo(titulo)}`;
  return { acima: [linha(completo, il.entreDaIdentificacao)], abaixo, titulo: completo, numero: n };
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
  // Título, fonte e nota na largura da ilustração (ABNT), ou na largura do texto, com a imagem no meio (APA).
  if (il.naLarguraDaIlustracao) {
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
  const continuidade = corpo.length > 0 ? il.continuidade : null;
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
  if (il.tabelaNaLarguraDoConteudo) {
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
  // Na largura do texto: a primeira coluna no tamanho do conteúdo, as outras divididas (APA).
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
function tituloNaMesmaLinha(titulo: Titulo, paragrafo: Trecho[], m: Medidas, e: Escrita): string {
  const { trechos } = numeroETexto(titulo, m);
  const corpo = `${trechosParaTypst(trechos, e)}${finalDoTitulo(trechos, m)}`;
  // Com exceção de destaque ou de maiúsculas, o destaque é o do título; senão, o do nível.
  const ex = titulo.excecoes;
  const proprio = ex && (ex.destaque !== undefined || ex["maiúsculas sozinho"] !== undefined);
  const destaque = proprio ? valorNoBloco(m.modelo, `titulos.nivel${titulo.nivel}`, "destaque", ex)!.valor : undefined;
  const destacado =
    destaque?.tipo === "destaque"
      ? `#${destaqueDoTituloTypst(destaque, `[${corpo}]`, vaiEmMaiusculas(m.modelo, titulo.nivel, ex))}`
      : `#destaque-do-titulo(${titulo.nivel}, [${corpo}])`;
  return `${destacado} ${trechosParaTypst(paragrafo, e)}\n`;
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
        const marcas = e.semLista ? "" : c.obras.map(registrar).join("");
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
