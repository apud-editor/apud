// A árvore de elementos da versão 2 (decisão 3): cada elemento segue o de cima
// até ser mudado. O Texto é a raiz: tudo herda dele a fonte, o tamanho e a
// entrelinha, inclusive a capa e o número da página.
//
//   Texto
//   ├ Página › Número da página
//   ├ Parágrafo
//   ├ Títulos › Nível 1 (› Título sem número, › Título repetido), Nível 2 … Nível 5
//   ├ Listas · Citação longa · Nota de rodapé · Equações (guardado)
//   ├ Ilustrações › Figura, Tabela, Identificação, Fonte e nota
//   ├ Lista de referências
//   ├ Abertura › Capa, Folha de rosto (› Natureza), Página de título, Dedicatória,
//   │             Epígrafe, Agradecimentos, Resumo (› Palavras-chave), Sumário,
//   │             e os guardados: Lombada, Ficha catalográfica, Errata,
//   │             Folha de aprovação, Listas de ilustrações e siglas
//   ├ Depois do texto (guardado) › Glossário, Apêndice, Anexo, Índice
//   └ Citações e referências
//
// Cada elemento declara as suas propriedades, em quatro grupos (ver tipos.ts).
// As do grupo "norma" guardam o que a norma diz e o Apud ainda não aplica, com
// o nome que a regra tinha no perfil da versão 1 ("resumo, extensão em artigo").
// As de "Citações e referências" também mantêm os nomes da versão 1: o motor de
// citações e o estilo CSL as leem assim até a etapa 5.
//
// Nada aqui é valor de norma: só o que existe e o tipo de cada coisa. Os
// valores ficam nos modelos (pasta modelos/).

import { ESQUEMA_ABNT, ELEMENTOS_DO_TEXTO } from "../perfis/esquema-abnt";
import { ESQUEMA_APA } from "../perfis/esquema-apa";
import { normalizar, sugerir } from "../perfis/texto";
import { destaque, espacamento, lista, medida, opcao, simNao, texto, type TipoValor } from "../perfis/valores";
import type { DefinicaoDeAtalho, DefinicaoDeElemento, DefinicaoDePropriedade, Grupo } from "./tipos";
import { distanciaLateral, linhasEmBranco, recuo, textoOuNenhum } from "./valores";

// ---------------------------------------------------------------------------
// As regras da versão 1 que ficam com o mesmo nome (grupos "norma" e "citações").

const REGRAS_DA_VERSAO_1 = [...ESQUEMA_ABNT.regras, ...ESQUEMA_APA.regras];

/** O tipo que a regra tinha no perfil da versão 1, para ser conferida do mesmo jeito. */
function tipoDaVersao1(chave: string): TipoValor {
  const definicao = REGRAS_DA_VERSAO_1.find((d) => d.chave === chave);
  if (!definicao) throw new Error(`a regra “${chave}” não existe nos perfis da versão 1`);
  return definicao.tipo;
}

/** Regras da versão 1 guardadas como "o que a norma diz", com o mesmo nome e o mesmo tipo. */
const daNorma = (...chaves: string[]): DefinicaoDePropriedade[] => chaves.map((nome) => ({ nome, tipo: tipoDaVersao1(nome), grupo: "norma" }));

/**
 * As regras das seções de citações e referências dos perfis da versão 1, menos
 * as que são da forma na página e foram para outros elementos (citação longa,
 * lista de referências).
 */
const FORAM_PARA_OUTROS_ELEMENTOS = new Set([
  "citação longa, recuo",
  "citação longa, aspas",
  "citação longa, linhas em branco antes e depois",
  "citação, ponto final",
  "citação em bloco, recuo",
  "citação em bloco, aspas",
  "citação em bloco, ponto final",
  "rótulo das referências",
  "referências, alinhamento",
  "referências, entre uma e outra",
  "referências, página nova",
  "referências, linhas em branco entre elas",
  "referências, recuo das linhas seguintes",
]);

function regrasDeCitacao(): DefinicaoDePropriedade[] {
  const vistas = new Set<string>();
  const saida: DefinicaoDePropriedade[] = [];
  for (const d of REGRAS_DA_VERSAO_1) {
    const secao = normalizar(d.secao);
    if (!secao.includes("citações") && !secao.includes("referências")) continue;
    if (FORAM_PARA_OUTROS_ELEMENTOS.has(d.chave) || vistas.has(d.chave)) continue;
    vistas.add(d.chave);
    saida.push({ nome: d.chave, tipo: d.tipo, grupo: "citações" });
  }
  return saida;
}

// ---------------------------------------------------------------------------
// Ajudas para escrever a árvore

const p = (nome: string, tipo: TipoValor, grupo: Grupo, reservada = false): DefinicaoDePropriedade =>
  reservada ? { nome, tipo, grupo, reservada } : { nome, tipo, grupo };

const aparencia = (nome: string, tipo: TipoValor) => p(nome, tipo, "aparência");
const montagem = (nome: string, tipo: TipoValor) => p(nome, tipo, "montagem");
const opcoes = (nome: string, tipo: TipoValor) => p(nome, tipo, "opções");
const reservada = (nome: string, tipo: TipoValor) => p(nome, tipo, "opções", true);
/** Se o elemento existe no modelo (a capa existe na ABNT; na APA, não). */
const existe = () => opcoes("existe", simNao());

const ALINHAMENTOS = ["à esquerda", "justificado", "centralizado", "à direita"];

/** "espaço antes e depois: 1 linha" escreve as duas propriedades. */
const espacoAntesEDepois: DefinicaoDeAtalho = {
  nome: "espaço antes e depois",
  tipo: linhasEmBranco(),
  expandir: (_v, t) => [
    ["espaço antes", t],
    ["espaço depois", t],
  ],
};

const IDIOMAS = ["português", "inglês", "espanhol", "francês", "italiano", "alemão"] as const;

const CAMPOS_DA_CAPA = ["instituição", "autor", "título", "subtítulo", "volume", "natureza", "orientador", "cidade", "ano"];
const CAMPOS_DA_PAGINA_DE_TITULO = [
  "título",
  "autor",
  "autores",
  "departamento e universidade",
  "afiliação",
  "código e nome da disciplina",
  "professor",
  "data de entrega",
  "nota do autor",
  "título curto",
];

// ---------------------------------------------------------------------------
// A árvore

export const ELEMENTOS: readonly DefinicaoDeElemento[] = [
  {
    id: "texto",
    nome: "Texto",
    descricao: "A raiz de tudo: a fonte, o tamanho e o espaço que todo elemento segue até ser mudado.",
    propriedades: [
      aparencia("fonte", texto()),
      aparencia("tamanho", medida("pt", 6, 72)),
      aparencia("entrelinha", espacamento()),
      aparencia("alinhamento", opcao(...ALINHAMENTOS)),
      aparencia("recuo da primeira linha", recuo()),
      aparencia("recuo à esquerda", medida("cm", 0, 10)),
      aparencia("destaque", destaque()),
      aparencia("espaço antes", linhasEmBranco()),
      aparencia("espaço depois", linhasEmBranco()),
      ...daNorma(
        "fonte menor",
        "fonte menor, onde",
        "espaço simples, onde",
        "entrelinhas, vale para",
        "siglas, primeira vez",
        "texto, divisão",
        "introdução, desenvolvimento e conclusão",
      ),
    ],
    atalhos: [
      {
        nome: "fonte e tamanho",
        tipo: fonteETamanho(),
        expandir: (_v, t) => {
          const m = t.match(/^(.*?)\s+(\d+(?:,\d+)?)\s*pt$/)!;
          return [
            ["fonte", m[1]],
            ["tamanho", `${m[2]} pt`],
          ];
        },
      },
      espacoAntesEDepois,
    ],
  },
  {
    id: "pagina",
    nome: "Página",
    pai: "texto",
    descricao: "O papel e as margens.",
    propriedades: [
      opcoes("margem superior", medida("cm", 0.5, 6)),
      opcoes("margem inferior", medida("cm", 0.5, 6)),
      opcoes("margem esquerda", medida("cm", 0.5, 6)),
      opcoes("margem direita", medida("cm", 0.5, 6)),
      ...daNorma("papel", "papel, cor do texto", "papel, cor nas ilustrações", "margens, inverter no verso", "impressão"),
    ],
    atalhos: [
      {
        nome: "margens",
        tipo: medida("cm", 0.5, 6),
        expandir: (_v, t) => [
          ["margem superior", t],
          ["margem inferior", t],
          ["margem esquerda", t],
          ["margem direita", t],
        ],
      },
    ],
  },
  {
    id: "pagina.numero",
    nome: "Número da página",
    pai: "pagina",
    descricao: "Onde o número aparece, a que distância das bordas e desde que folha conta.",
    propriedades: [
      opcoes("posição", opcao("canto superior direito", "canto inferior direito", "centro inferior")),
      opcoes("distância vertical", medida("cm", 0, 5)),
      opcoes("distância lateral", distanciaLateral()),
      opcoes("contar desde", opcao("capa", "folha de rosto")),
      opcoes("mostrar desde", opcao("primeira página contada", "primeira folha do texto")),
      ...daNorma("numeração de página, algarismos", "página no verso, posição do número", "número de página, desde"),
    ],
    atalhos: [
      {
        nome: "distância das bordas",
        tipo: medida("cm", 0, 5),
        expandir: (_v, t) => [
          ["distância vertical", t],
          ["distância lateral", t],
        ],
      },
    ],
  },
  {
    id: "paragrafo",
    nome: "Parágrafo",
    pai: "texto",
    descricao: "O corpo do texto.",
    propriedades: [...daNorma("espaço extra entre parágrafos")],
  },
  {
    id: "titulos",
    nome: "Títulos",
    pai: "texto",
    descricao: "Os títulos das seções, em cinco níveis.",
    propriedades: [
      aparencia("posição", opcao("à esquerda", "centralizado", "com recuo")),
      opcoes("texto depois", opcao("parágrafo novo", "na mesma linha")),
      opcoes("final na mesma linha", opcao("ponto", "nenhum")),
      // Etapa 2 (decisão 10). Na etapa 1, sem efeito: o número, as letras e as
      // quebras de página continuam como a pessoa escreve.
      reservada("numerar sozinho", simNao()),
      reservada("maiúsculas sozinho", simNao()),
      reservada("página nova", simNao()),
      ...daNorma(
        "títulos, números",
        "títulos, níveis",
        "títulos, entre número e título",
        "títulos, linhas seguintes",
        "títulos, numeração",
        "títulos, maiúsculas",
      ),
    ],
  },
  ...([1, 2, 3, 4, 5] as const).map(
    (n): DefinicaoDeElemento => ({
      id: `titulos.nivel${n}`,
      nome: `Nível ${n}`,
      pai: "titulos",
      descricao: `Os títulos de nível ${n}.`,
      propriedades: n === 1 ? daNorma("seção primária, em frente e verso") : [],
    }),
  ),
  {
    id: "titulos.semNumero",
    nome: "Título sem número",
    pai: "titulos.nivel1",
    descricao: "Os rótulos que o Apud escreve (RESUMO, SUMÁRIO, REFERÊNCIAS...): seguem o nível 1.",
    propriedades: daNorma("títulos sem número, destaque", "títulos sem número, onde", "sem título nem número", "rótulos de seção, destaque"),
  },
  {
    id: "titulos.repetido",
    nome: "Título repetido",
    pai: "titulos.nivel1",
    descricao: "O título do trabalho repetido no começo do texto (APA).",
    propriedades: [opcoes("repetir no começo do texto", simNao()), ...daNorma("início do texto, destaque", "início do texto, título introdução")],
  },
  {
    id: "listas",
    nome: "Listas",
    pai: "texto",
    descricao: "Listas em sequência (passos) e sem sequência, com as sub-listas.",
    propriedades: [
      montagem("marcador em sequência", texto()),
      montagem("marcador sem sequência", texto()),
      montagem("marcador da sub-lista", opcao("igual ao da lista", "travessão", "meia-risca")),
      aparencia("recuo a mais da sub-lista", medida("cm", 0, 5)),
      ...daNorma("alíneas, linhas seguintes", "alíneas, pontuação", "alíneas, inicial"),
    ],
    atalhos: [
      {
        nome: "marcador",
        tipo: texto(),
        expandir: (_v, t) => [
          ["marcador em sequência", t],
          ["marcador sem sequência", t],
        ],
      },
    ],
  },
  {
    id: "citacaoLonga",
    nome: "Citação longa",
    pai: "texto",
    descricao: "A citação em bloco, recuada.",
    propriedades: [
      opcoes("ponto final", opcao("como a pessoa escreveu", "antes da chamada", "depois da chamada")),
      ...daNorma("citação longa, aspas", "citação em bloco, aspas"),
    ],
  },
  {
    id: "nota",
    nome: "Nota de rodapé",
    pai: "texto",
    descricao: "As notas no pé da página.",
    propriedades: [
      opcoes("filete", medida("cm", 1, 15)),
      opcoes("linhas seguintes", opcao("na margem", "alinhadas sob a primeira letra")),
      ...daNorma("numeração das notas", "numeração das notas, algarismos"),
    ],
  },
  {
    id: "equacoes",
    nome: "Equações",
    pai: "texto",
    descricao: "Guardado para depois.",
    reservado: true,
    propriedades: daNorma("equações, numeração"),
  },
  {
    id: "ilustracoes",
    nome: "Ilustrações",
    pai: "texto",
    descricao: "Figuras e tabelas: o espaço em volta, a posição e as espécies contadas separadas.",
    propriedades: [
      montagem("espécies", lista()),
      opcoes("posição", opcao("centralizada", "à esquerda")),
      opcoes("largura do título e da fonte", opcao("largura do texto", "largura da ilustração")),
      ...daNorma(
        "ilustração, posição do título",
        "ilustração, posição da fonte",
        "ilustração, fonte obrigatória",
        "ilustração, depois da fonte",
        "tabelas, identificação e fonte",
        "tabelas e figuras, posição",
        "tabelas e figuras, nota",
      ),
    ],
  },
  {
    id: "ilustracoes.figura",
    nome: "Figura",
    pai: "ilustracoes",
    descricao: "A imagem.",
    propriedades: [],
  },
  {
    id: "ilustracoes.tabela",
    nome: "Tabela",
    pai: "ilustracoes",
    descricao: "A tabela: rótulo, fios, alinhamento, largura e o que fazer quando passa de página.",
    propriedades: [
      montagem("rótulo", texto()),
      opcoes("fios", opcao("todos os fios", "acima e abaixo do cabeçalho e no fim, sem fios nas laterais")),
      opcoes("alinhamento das células", opcao("à esquerda", "cabeçalho ao centro, primeira coluna à esquerda, demais ao centro")),
      opcoes("largura", opcao("largura do texto", "largura do conteúdo")),
      opcoes("em mais de uma página", opcao("só o cabeçalho se repete", "número, título e cabeçalho repetidos em cada página")),
      montagem("indicações", lista(undefined, { quantidadeExata: 3 })),
      opcoes("posição das indicações", opcao("à direita", "à esquerda")),
      ...daNorma("tabelas, desenho"),
    ],
  },
  {
    id: "ilustracoes.identificacao",
    nome: "Identificação",
    pai: "ilustracoes",
    descricao: "O que vem acima: “Figura 1 – Título”.",
    propriedades: [
      montagem("separador", opcao("travessão", "hífen", "ponto", "dois-pontos")),
      montagem("destaque do número", destaque()),
      montagem("título na linha de baixo", simNao()),
      montagem("destaque do título", destaque()),
    ],
  },
  {
    id: "ilustracoes.fonte",
    nome: "Fonte e nota",
    pai: "ilustracoes",
    descricao: "O que vem abaixo: a fonte e a nota (ou legenda).",
    propriedades: [
      montagem("rótulo da fonte", texto()),
      montagem("fonte quando é sua", textoOuNenhum()),
      montagem("rótulo da nota", texto()),
      montagem("destaque do rótulo da nota", destaque()),
      montagem("fonte dentro da nota", simNao()),
    ],
  },
  {
    id: "referencias",
    nome: "Lista de referências",
    pai: "texto",
    descricao: "O título e a forma da lista na página. A forma de cada referência fica em Citações e referências.",
    propriedades: [
      montagem("título", texto()),
      aparencia("espaço entre as referências", linhasEmBranco()),
      aparencia("recuo das linhas seguintes", medida("cm", 0, 5)),
      reservada("página nova", simNao()),
      ...daNorma("referências"),
    ],
  },
  {
    id: "abertura",
    nome: "Abertura",
    pai: "texto",
    descricao: "O que vem antes do texto.",
    propriedades: daNorma("ordem das partes", "ordem das partes, página nova"),
  },
  {
    id: "abertura.capa",
    nome: "Capa",
    pai: "abertura",
    descricao: "A capa, com os campos na ordem da norma.",
    propriedades: [
      existe(),
      montagem("campos", lista(CAMPOS_DA_CAPA, { aceitaOpcional: true })),
      montagem("destaque do título", destaque()),
      ...daNorma("capa", "capa, subtítulo"),
    ],
  },
  {
    id: "abertura.folhaDeRosto",
    nome: "Folha de rosto",
    pai: "abertura",
    descricao: "A folha de rosto, com a natureza do trabalho.",
    propriedades: [
      existe(),
      montagem("campos", lista(CAMPOS_DA_CAPA, { aceitaOpcional: true })),
      montagem("destaque do título", destaque()),
      montagem("rótulo do orientador", texto()),
      montagem("rótulo do professor", texto()),
      ...daNorma("folha de rosto", "folha de rosto, natureza"),
    ],
  },
  {
    id: "abertura.folhaDeRosto.natureza",
    nome: "Natureza",
    pai: "abertura.folhaDeRosto",
    descricao: "A frase da natureza do trabalho, do meio da página para a direita.",
    propriedades: daNorma("folha de rosto, posição da natureza"),
  },
  {
    id: "abertura.paginaDeTitulo",
    nome: "Página de título",
    pai: "abertura",
    descricao: "A página de título (APA).",
    propriedades: [
      existe(),
      opcoes("modo quando o trabalho é artigo", opcao("estudante", "profissional")),
      montagem("campos no modo estudante", lista(CAMPOS_DA_PAGINA_DE_TITULO)),
      montagem("campos no modo profissional", lista(CAMPOS_DA_PAGINA_DE_TITULO)),
      montagem("destaque do título", destaque()),
      aparencia("linhas antes do título", linhasEmBranco(10)),
      aparencia("linhas depois do título", linhasEmBranco(10)),
      ...daNorma("modo", "página de título (estudante), alinhamento", "página de título (estudante), data", "cabeçalho com título curto"),
    ],
  },
  {
    id: "abertura.dedicatoria",
    nome: "Dedicatória",
    pai: "abertura",
    descricao: "A dedicatória, no pé da página, à direita.",
    propriedades: [existe(), ...daNorma("dedicatória", "dedicatória, posição")],
  },
  {
    id: "abertura.epigrafe",
    nome: "Epígrafe",
    pai: "abertura",
    descricao: "A epígrafe, no pé da página, à direita.",
    propriedades: [existe(), opcoes("autoria", simNao()), ...daNorma("epígrafe", "epígrafe, posição")],
  },
  {
    id: "abertura.agradecimentos",
    nome: "Agradecimentos",
    pai: "abertura",
    descricao: "Os agradecimentos.",
    propriedades: [existe(), montagem("título", texto()), ...daNorma("agradecimentos")],
  },
  {
    id: "abertura.resumo",
    nome: "Resumo",
    pai: "abertura",
    descricao: "Os resumos, um por idioma.",
    propriedades: [
      existe(),
      ...IDIOMAS.map((i) => montagem(`título em ${i}`, texto())),
      ...daNorma(
        "resumo",
        "resumo em língua estrangeira",
        "resumo, extensão em trabalho acadêmico",
        "resumo, extensão em artigo",
        "resumo, forma",
        "resumo, verbo",
        "resumo, no modo estudante",
        "resumo, no modo profissional",
        "resumo, extensão máxima",
      ),
    ],
  },
  {
    id: "abertura.resumo.palavrasChave",
    nome: "Palavras-chave",
    pai: "abertura.resumo",
    descricao: "As palavras-chave, logo abaixo do resumo.",
    propriedades: [
      ...IDIOMAS.map((i) => montagem(`rótulo em ${i}`, texto())),
      montagem("destaque do rótulo", destaque()),
      montagem("separador", opcao("ponto e vírgula", "vírgula", "ponto")),
      montagem("final", opcao("ponto", "nenhum")),
      ...daNorma("palavras-chave, posição", "palavras-chave, iniciais", "palavras-chave"),
    ],
  },
  {
    id: "abertura.sumario",
    nome: "Sumário",
    pai: "abertura",
    descricao: "O sumário, último elemento antes do texto.",
    propriedades: [
      existe(),
      montagem("título", texto()),
      montagem("ligação até a página", opcao("pontilhado", "nenhuma")),
      ...daNorma(
        "sumário",
        "sumário, posição",
        "sumário, alinhamento do título",
        "sumário, números das seções",
        "sumário, alinhamento dos títulos",
        "sumário, grafia e destaque",
        "sumário, página",
        "sumário, elementos pré-textuais",
      ),
    ],
  },
  guardado("abertura.lombada", "Lombada", "abertura", "lombada"),
  guardado(
    "abertura.fichaCatalografica",
    "Ficha catalográfica",
    "abertura",
    "ficha catalográfica",
    "ficha catalográfica, conteúdo",
    "ficha catalográfica, contada",
    "ficha catalográfica, posição no pdf",
  ),
  guardado("abertura.errata", "Errata", "abertura", "errata", "errata, colunas"),
  guardado("abertura.folhaDeAprovacao", "Folha de aprovação", "abertura", "folha de aprovação", "folha de aprovação, conteúdo"),
  guardado(
    "abertura.listas",
    "Listas de ilustrações e siglas",
    "abertura",
    "listas de ilustrações, tabelas, siglas e símbolos",
    "listas, conteúdo",
    "lista de siglas, ordem",
  ),
  { id: "depois", nome: "Depois do texto", pai: "texto", descricao: "Guardado para depois.", reservado: true, propriedades: [] },
  guardado("depois.glossario", "Glossário", "depois", "glossário"),
  guardado("depois.apendice", "Apêndice", "depois", "apêndice", "apêndice, título", "rótulo do apêndice"),
  guardado("depois.anexo", "Anexo", "depois", "anexo", "anexo, título", "anexo, referências"),
  guardado("depois.indice", "Índice", "depois", "índice", "índice, norma"),
  {
    id: "citacoes",
    nome: "Citações e referências",
    pai: "texto",
    descricao: "Como montar as chamadas no texto e a lista. Até a etapa 5, as regras têm os nomes dos perfis da versão 1.",
    propriedades: regrasDeCitacao(),
  },
];

/** Um elemento guardado para depois: existe na árvore, só com o que a norma diz. */
function guardado(id: string, nome: string, pai: string, ...regras: string[]): DefinicaoDeElemento {
  return { id, nome, pai, descricao: "Guardado para depois.", reservado: true, propriedades: daNorma(...regras) };
}

/** "Times New Roman 12 pt", "Arial 11 pt": a família e o tamanho numa linha só. */
function fonteETamanho(): TipoValor {
  return {
    descricao: "uma fonte e o tamanho, como “Arial 11 pt”",
    permiteEscolha: true,
    ler(valor, regra) {
      const m = valor.trim().replace(/\s+/g, " ").match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*pt$/i);
      const tamanho = m ? Number(m[2].replace(",", ".")) : NaN;
      if (!m || !m[1] || !(tamanho >= 6 && tamanho <= 72)) {
        return { ok: false, erro: `“${regra}” precisa ter a fonte e o tamanho em pt, como “Times New Roman 12 pt”.` };
      }
      const t = `${m[1]} ${String(tamanho).replace(".", ",")} pt`;
      return { ok: true, valor: { tipo: "opcao", valor: t }, texto: t };
    },
  };
}

// ---------------------------------------------------------------------------
// Consultas à árvore

const PORID = new Map(ELEMENTOS.map((e) => [e.id, e]));

export function elemento(id: string): DefinicaoDeElemento {
  const e = PORID.get(id);
  if (!e) throw new Error(`o elemento “${id}” não existe na árvore`);
  return e;
}

/** O elemento e os de cima, do mais perto ao Texto. */
export function linhagem(id: string): DefinicaoDeElemento[] {
  const saida: DefinicaoDeElemento[] = [];
  for (let e: DefinicaoDeElemento | undefined = elemento(id); e; e = e.pai ? elemento(e.pai) : undefined) saida.push(e);
  return saida;
}

/** O caminho como aparece nos modelos: "Títulos › Nível 1". O Texto é só "Texto". */
export function caminho(id: string): string {
  const nomes = linhagem(id)
    .reverse()
    .map((e) => e.nome);
  return nomes.length === 1 ? nomes[0] : nomes.slice(1).join(" › ");
}

const PORCAMINHO = new Map(ELEMENTOS.map((e) => [normalizar(caminho(e.id)), e]));

/** O elemento pelo caminho escrito no modelo ("Títulos › Nível 1"); aceita > no lugar de ›. */
export function elementoPeloCaminho(escrito: string): DefinicaoDeElemento | undefined {
  return PORCAMINHO.get(normalizar(escrito.replace(/\s*(›|>)\s*/g, " › ")));
}

/** Os caminhos de todos os elementos, para sugerir quando a pessoa erra o nome. */
export function sugerirElemento(escrito: string): string | undefined {
  return sugerir(escrito, ELEMENTOS.map((e) => caminho(e.id)));
}

/**
 * A propriedade que o elemento pode receber: as dele e as dos elementos de cima.
 * Undefined se nenhum deles a declara.
 */
export function propriedade(id: string, nome: string): DefinicaoDePropriedade | undefined {
  const n = normalizar(nome);
  for (const e of linhagem(id)) {
    const achada = e.propriedades.find((p) => normalizar(p.nome) === n);
    if (achada) return achada;
  }
  return undefined;
}

/** O atalho que o elemento pode usar (os dele e os dos elementos de cima). */
export function atalho(id: string, nome: string): DefinicaoDeAtalho | undefined {
  const n = normalizar(nome);
  for (const e of linhagem(id)) {
    const achado = e.atalhos?.find((a) => normalizar(a.nome) === n);
    if (achado) return achado;
  }
  return undefined;
}

/** Os nomes de tudo o que o elemento pode receber, para sugerir quando a pessoa erra. */
export function nomesPossiveis(id: string): string[] {
  return linhagem(id).flatMap((e) => [...e.propriedades.map((p) => p.nome), ...(e.atalhos ?? []).map((a) => a.nome)]);
}

/** As partes do texto da regra "fonte menor, onde" e "espaço simples, onde" (perfil ABNT). */
export const PARTES_DO_TEXTO = ELEMENTOS_DO_TEXTO;

/** Os idiomas dos resumos que têm rótulo no modelo. */
export const IDIOMAS_DOS_RESUMOS = IDIOMAS;
