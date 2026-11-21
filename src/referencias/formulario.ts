// O formulário "Adicionar à mão" da gaveta de referências, em funções puras.
//
// A tela guarda tudo o que a pessoa digita como texto (formulário). Aqui o
// formulário vira uma Referencia do modelo do Apud (documento/referencias.ts),
// conferida por conferirReferencia, a mesma conferência que o .apud usa ao
// abrir um arquivo. Assim a tela nunca monta uma referência que o arquivo
// recusaria.
//
// Nenhuma regra de norma fica aqui: a forma ("SILVA, João" ou "Silva, J.") é do
// perfil. O formulário só diz quais dados cada tipo de fonte usa.

import { conferirReferencia } from "../arquivos/formato";
import {
  ehInstituicao,
  novoIdDeReferencia,
  type Autor,
  type Data,
  type Referencia,
  type TipoDeReferencia,
} from "../documento/modelo";

// ---------------------------------------------------------------------------
// O que cada tipo de fonte pede

/** Os tipos na ordem em que aparecem no formulário: os mais comuns primeiro (escolha do Francisco, 20/11/2026). */
export const TIPOS_NO_FORMULARIO: readonly TipoDeReferencia[] = [
  "artigo",
  "livro",
  "capitulo",
  "tese",
  "site",
  "evento",
  "relatorio",
  "lei",
  "noticia",
  "rede-social",
];

export const NOME_DO_TIPO_NA_TELA: Record<TipoDeReferencia, string> = {
  artigo: "Artigo de revista",
  livro: "Livro",
  capitulo: "Capítulo de livro",
  tese: "Tese ou dissertação",
  site: "Site",
  evento: "Trabalho em evento",
  relatorio: "Relatório ou nota técnica",
  lei: "Lei",
  noticia: "Notícia",
  "rede-social": "Postagem em rede social",
};

/**
 * Os campos de texto do formulário. Os que têm ponto ("publicacao.titulo")
 * ficam dentro de "publicacao" ou "evento" na referência.
 */
export const CAMPOS_DE_TEXTO = [
  "titulo",
  "subtitulo",
  "edicao",
  "cidade",
  "editora",
  "paginas",
  "numeroEletronico",
  "folhas",
  "tipoDoTrabalho",
  "grau",
  "serie",
  "numeroNaSerie",
  "ementa",
  "perfil",
  "tipoDaPostagem",
  "notas",
  "url",
  "publicacao.titulo",
  "publicacao.subtitulo",
  "publicacao.cidade",
  "publicacao.volume",
  "publicacao.numero",
  "evento.nome",
  "evento.numero",
  "evento.ano",
  "evento.cidade",
] as const;

export type ChaveDoCampo = (typeof CAMPOS_DE_TEXTO)[number];

export interface CampoDeTexto {
  chave: ChaveDoCampo;
  rotulo: string;
  /** Exemplo que aparece dentro do campo vazio. */
  exemplo?: string;
  /** Campo curto: dois por linha. */
  curto?: boolean;
}

export interface DescricaoDoTipo {
  /** O título do campo de autores, que muda conforme o tipo ("Jurisdição" na lei). */
  rotuloDosAutores: string;
  exemploDosAutores?: string;
  /** Quem organizou o livro ou os anais: capítulo e trabalho em evento. */
  rotuloDosOrganizadores?: string;
  /** Livro: a caixa que diz que os autores são os organizadores (a lista escreve "(org.)"). */
  rotuloDosAutoresOrganizadores?: string;
  campos: CampoDeTexto[];
}

const c = (chave: ChaveDoCampo, rotulo: string, exemplo?: string, curto = false): CampoDeTexto => ({ chave, rotulo, exemplo, curto });

/** O que cada tipo usa, na ordem em que os campos aparecem (conforme o comentário de Referencia). A data, o endereço e a data de acesso são de todos. */
export const DESCRICAO_DOS_TIPOS: Record<TipoDeReferencia, DescricaoDoTipo> = {
  livro: {
    rotuloDosAutores: "Autores",
    rotuloDosAutoresOrganizadores: "São os organizadores do livro (a lista escreve “org.” depois dos nomes)",
    campos: [
      c("titulo", "Título", "Psicologia clínica"),
      c("subtitulo", "Subtítulo", "O que vem depois dos dois-pontos"),
      c("edicao", "Edição", "2", true),
      c("cidade", "Cidade", "Petrópolis", true),
      c("editora", "Editora", "Vozes"),
    ],
  },
  capitulo: {
    rotuloDosAutores: "Autores do capítulo",
    rotuloDosOrganizadores: "Organizadores do livro",
    campos: [
      c("titulo", "Título do capítulo"),
      c("publicacao.titulo", "Título do livro"),
      c("publicacao.subtitulo", "Subtítulo do livro"),
      c("edicao", "Edição", "2", true),
      c("cidade", "Cidade", "Porto Alegre", true),
      c("editora", "Editora do livro", "Artmed"),
      c("paginas", "Páginas do capítulo", "9-30"),
    ],
  },
  artigo: {
    rotuloDosAutores: "Autores",
    campos: [
      c("titulo", "Título do artigo"),
      c("subtitulo", "Subtítulo"),
      c("publicacao.titulo", "Revista", "Psicologia em Estudo"),
      c("publicacao.cidade", "Cidade da revista", "Maringá"),
      c("publicacao.volume", "Volume", "10", true),
      c("publicacao.numero", "Número", "2", true),
      c("paginas", "Páginas", "45-60", true),
      c("numeroEletronico", "Número do artigo (sem páginas)", "e2024017", true),
    ],
  },
  site: {
    rotuloDosAutores: "Autores ou instituição",
    campos: [
      c("titulo", "Título da página"),
      c("editora", "Site ou instituição", "Portal Psicologia Hoje"),
      c("cidade", "Cidade", "São Paulo"),
    ],
  },
  lei: {
    rotuloDosAutores: "Jurisdição",
    exemploDosAutores: "Brasil",
    campos: [
      c("titulo", "Título da lei", "Lei nº 10.216, de 6 de abril de 2001"),
      c("ementa", "Ementa"),
      c("cidade", "Cidade", "Brasília, DF", true),
      c("editora", "Quem publicou", "Presidência da República", true),
    ],
  },
  tese: {
    rotuloDosAutores: "Autores",
    campos: [
      c("titulo", "Título"),
      c("subtitulo", "Subtítulo"),
      c("tipoDoTrabalho", "Tipo do trabalho", "Tese, Dissertação…", true),
      c("grau", "Grau", "Doutorado em Psicologia", true),
      c("editora", "Universidade"),
      c("cidade", "Cidade", "Londrina", true),
      c("folhas", "Total de folhas", "312", true),
    ],
  },
  relatorio: {
    rotuloDosAutores: "Autores ou instituição",
    campos: [
      c("titulo", "Título"),
      c("serie", "Série", "Nota Técnica", true),
      c("numeroNaSerie", "Número na série", "103", true),
      c("cidade", "Cidade", "Brasília", true),
      c("editora", "Instituição que publicou", "Instituto de Pesquisa Social", true),
    ],
  },
  evento: {
    rotuloDosAutores: "Autores",
    rotuloDosOrganizadores: "Organizadores dos anais",
    campos: [
      c("titulo", "Título do trabalho"),
      c("evento.nome", "Nome do evento", "Seminário de Políticas Públicas"),
      c("evento.numero", "Número do evento", "20", true),
      c("evento.ano", "Ano do evento", "2024", true),
      c("evento.cidade", "Cidade do evento"),
      c("publicacao.titulo", "Título dos anais", "Anais do Seminário…"),
      c("cidade", "Cidade da publicação", undefined, true),
      c("editora", "Editora", undefined, true),
      c("paginas", "Páginas", "15-30"),
    ],
  },
  noticia: {
    rotuloDosAutores: "Autor (se houver)",
    campos: [
      c("titulo", "Título da notícia"),
      c("publicacao.titulo", "Jornal ou site", "Jornal do Litoral"),
      c("publicacao.cidade", "Cidade do jornal", "Itajaí"),
    ],
  },
  "rede-social": {
    rotuloDosAutores: "Autor (se houver)",
    campos: [
      c("titulo", "Texto da postagem"),
      c("perfil", "Perfil", "@perfil", true),
      c("tipoDaPostagem", "Tipo da postagem", "Vídeo", true),
      c("publicacao.titulo", "Rede social", "Instagram", true),
      c("cidade", "Cidade", undefined, true),
    ],
  },
};

const CAMPO_DO_ENDERECO = c("url", "Endereço na internet", "https://…");

/**
 * Notas: elementos complementares que a norma permite e o formulário não tem
 * campo próprio (tradução, publicação original, entrevista concedida a…).
 * Saem como foram escritos, antes do endereço na ABNT e no fim na APA.
 */
const CAMPO_DAS_NOTAS = c("notas", "Notas (tradução, publicação original…)", "Tradução de Maria Souza. Originalmente publicado em 1845.");

/** Os campos de texto que o tipo usa, na ordem da tela (as notas e o endereço fecham a lista). */
export function camposDoTipo(tipo: TipoDeReferencia): CampoDeTexto[] {
  return [...DESCRICAO_DOS_TIPOS[tipo].campos, CAMPO_DAS_NOTAS, CAMPO_DO_ENDERECO];
}

// ---------------------------------------------------------------------------
// O formulário: tudo como texto, como a pessoa digitou

export type AutorNoFormulario =
  | { tipo: "pessoa"; sobrenome: string; prenomes: string }
  | { tipo: "instituicao"; nome: string };

/** Ano, mês e dia como texto. Vazio quando a pessoa não preencheu. */
export interface DataNoFormulario {
  ano: string;
  mes: string;
  dia: string;
}

export interface Formulario {
  tipo: TipoDeReferencia;
  texto: Record<ChaveDoCampo, string>;
  autores: AutorNoFormulario[];
  /** Livro: os autores são os organizadores. */
  autoresOrganizadores: boolean;
  /** Organizadores do livro (capítulo) ou dos anais (trabalho em evento). */
  organizadores: AutorNoFormulario[];
  data: DataNoFormulario;
  /** "[2019?]", "[201-]": usada quando não se sabe o ano certo. */
  dataIncerta: string;
  acesso: DataNoFormulario;
}

export const pessoaVazia = (): AutorNoFormulario => ({ tipo: "pessoa", sobrenome: "", prenomes: "" });
export const instituicaoVazia = (): AutorNoFormulario => ({ tipo: "instituicao", nome: "" });
const dataVazia = (): DataNoFormulario => ({ ano: "", mes: "", dia: "" });

/** Um formulário em branco. O primeiro tipo da lista vem escolhido. */
export function formularioVazio(tipo: TipoDeReferencia = TIPOS_NO_FORMULARIO[0]): Formulario {
  return {
    tipo,
    texto: Object.fromEntries(CAMPOS_DE_TEXTO.map((k) => [k, ""])) as Record<ChaveDoCampo, string>,
    autores: [pessoaVazia()],
    autoresOrganizadores: false,
    organizadores: [],
    data: dataVazia(),
    dataIncerta: "",
    acesso: dataVazia(),
  };
}

// ---------------------------------------------------------------------------
// Da referência para o formulário (para Editar)

const comoTexto = (v: string | number | undefined) => (v === undefined ? "" : String(v));

function autorNoFormulario(a: Autor): AutorNoFormulario {
  return ehInstituicao(a) ? { tipo: "instituicao", nome: a.instituicao } : { tipo: "pessoa", sobrenome: a.sobrenome, prenomes: a.prenomes ?? "" };
}

function dataNoFormulario(d: Data | undefined): DataNoFormulario {
  return d ? { ano: comoTexto(d.ano), mes: comoTexto(d.mes), dia: comoTexto(d.dia) } : dataVazia();
}

/** Abre uma referência no formulário. */
export function referenciaParaFormulario(r: Referencia): Formulario {
  const f = formularioVazio(r.tipo);
  const texto = f.texto;
  for (const chave of CAMPOS_DE_TEXTO) {
    const [grupo, campo] = chave.split(".") as [string, string | undefined];
    const valor = campo
      ? (r as unknown as Record<string, Record<string, unknown> | undefined>)[grupo]?.[campo]
      : (r as unknown as Record<string, unknown>)[grupo];
    if (typeof valor === "string") texto[chave] = valor;
  }
  f.autores = r.autores.length ? r.autores.map(autorNoFormulario) : [pessoaVazia()];
  f.autoresOrganizadores = r.autoresOrganizadores === true;
  f.organizadores = (r.publicacao?.organizadores ?? []).map(autorNoFormulario);
  f.data = dataNoFormulario(r.data);
  f.dataIncerta = r.dataIncerta ?? "";
  f.acesso = dataNoFormulario(r.acesso);
  return f;
}

// ---------------------------------------------------------------------------
// Do formulário para a referência

export interface ErroDoFormulario {
  /** Onde está o problema: "titulo", "autores.1.sobrenome", "data.ano", "acesso.mes"… ("" é do formulário todo). */
  campo: string;
  mensagem: string;
}

export type ResultadoDoFormulario = { ok: true; referencia: Referencia } | { ok: false; erros: ErroDoFormulario[] };

export interface OpcoesDoFormulario {
  /** Os códigos que já existem, para o código novo não repetir. */
  existentes: Iterable<string>;
  /** A referência que está sendo editada: ela mantém o código e os campos que o formulário não mostra (como o DOI). */
  base?: Referencia;
  sorteio?: () => number;
}

/** Tira espaços sobrando. */
export const limpar = (s: string) => s.replace(/\s+/g, " ").trim();

const diasDoMes = (ano: number, mes: number) => new Date(ano, mes, 0).getDate();

/** Escreve a data incerta como a ABNT pede, entre colchetes: "2019?" vira "[2019?]". */
export function escreverDataIncerta(texto: string): string {
  const t = limpar(texto);
  if (!t) return "";
  return `${t.startsWith("[") ? "" : "["}${t}${t.endsWith("]") ? "" : "]"}`;
}

function lerData(d: DataNoFormulario, campo: "data" | "acesso", erros: ErroDoFormulario[]): Data | undefined {
  const [ano, mes, dia] = [limpar(d.ano), limpar(d.mes), limpar(d.dia)];
  if (!ano && !mes && !dia) return undefined;
  const erro = (parte: string, mensagem: string) => erros.push({ campo: `${campo}.${parte}`, mensagem });
  if (!ano) {
    erro("ano", "Escreva o ano.");
    return undefined;
  }
  if (!/^\d{1,4}$/.test(ano) || Number(ano) < 1) {
    erro("ano", "O ano tem só números, como 2019.");
    return undefined;
  }
  const saida: Data = { ano: Number(ano) };
  if (mes) {
    if (!/^\d{1,2}$/.test(mes) || Number(mes) < 1 || Number(mes) > 12) {
      erro("mes", "O mês vai de 1 a 12.");
      return undefined;
    }
    saida.mes = Number(mes);
  }
  if (dia) {
    if (saida.mes === undefined) {
      erro("mes", "Escolha o mês do dia.");
      return undefined;
    }
    if (!/^\d{1,2}$/.test(dia) || Number(dia) < 1 || Number(dia) > diasDoMes(saida.ano, saida.mes)) {
      erro("dia", `Esse mês tem de 1 a ${diasDoMes(saida.ano, saida.mes)} dias.`);
      return undefined;
    }
    saida.dia = Number(dia);
  }
  return saida;
}

function lerAutores(linhas: AutorNoFormulario[], campo: string, erros: ErroDoFormulario[]): Autor[] {
  const saida: Autor[] = [];
  linhas.forEach((a, i) => {
    if (a.tipo === "instituicao") {
      const nome = limpar(a.nome);
      if (nome) saida.push({ instituicao: nome });
      return;
    }
    const [sobrenome, prenomes] = [limpar(a.sobrenome), limpar(a.prenomes)];
    if (!sobrenome && !prenomes) return; // linha em branco: some
    if (!sobrenome) {
      erros.push({ campo: `${campo}.${i}.sobrenome`, mensagem: "Falta o sobrenome." });
      return;
    }
    saida.push(prenomes ? { sobrenome, prenomes } : { sobrenome });
  });
  return saida;
}

/** Os campos que o formulário cuida: o resto da referência (o DOI, por exemplo) passa como estava. */
const CHAVES_DO_FORMULARIO = new Set<string>([
  "tipo",
  "autores",
  "autoresOrganizadores",
  "data",
  "dataIncerta",
  "acesso",
  "evento",
  "publicacao",
  ...CAMPOS_DE_TEXTO.filter((k) => !k.includes(".")),
]);

/**
 * Monta a referência do formulário. Devolve os erros em português, um por
 * campo, quando algo não serve. Só entram os campos que o tipo usa: o que
 * sobrou de outro tipo (se a pessoa trocou o tipo ao editar) fica de fora.
 */
export function formularioParaReferencia(f: Formulario, opcoes: OpcoesDoFormulario): ResultadoDoFormulario {
  const erros: ErroDoFormulario[] = [];
  const descricao = DESCRICAO_DOS_TIPOS[f.tipo];
  const usados = camposDoTipo(f.tipo);
  const valor = (chave: ChaveDoCampo) => limpar(f.texto[chave] ?? "");
  const usa = (chave: ChaveDoCampo) => usados.some((u) => u.chave === chave);
  const rotuloDe = (chave: ChaveDoCampo) => usados.find((u) => u.chave === chave)?.rotulo ?? chave;

  const titulo = valor("titulo");
  if (!titulo) erros.push({ campo: "titulo", mensagem: "Escreva o título da obra." });

  const autores = lerAutores(f.autores, "autores", erros);
  const organizadores = descricao.rotuloDosOrganizadores ? lerAutores(f.organizadores, "organizadores", erros) : [];

  const data = lerData(f.data, "data", erros);
  const dataIncerta = escreverDataIncerta(f.dataIncerta);
  if (dataIncerta && !/\d/.test(dataIncerta)) {
    erros.push({ campo: "dataIncerta", mensagem: "Escreva como a norma pede, por exemplo [2019?] ou [201-]." });
  }
  if (dataIncerta && data) {
    erros.push({ campo: "dataIncerta", mensagem: "Use o ano ou a data incerta, não os dois." });
  }
  const acesso = lerData(f.acesso, "acesso", erros);

  // Os grupos "publicacao" e "evento" precisam do nome quando têm qualquer outro dado.
  const grupo = (prefixo: "publicacao" | "evento", nome: "titulo" | "nome", extra: boolean): Record<string, string> | undefined => {
    const campos: Record<string, string> = {};
    for (const chave of CAMPOS_DE_TEXTO) {
      if (!chave.startsWith(`${prefixo}.`) || !usa(chave)) continue;
      const v = valor(chave);
      if (v) campos[chave.slice(prefixo.length + 1)] = v;
    }
    if (!Object.keys(campos).length && !extra) return undefined;
    if (!campos[nome]) {
      erros.push({ campo: `${prefixo}.${nome}`, mensagem: `Falta ${rotuloDe(`${prefixo}.${nome}` as ChaveDoCampo).toLowerCase()}.` });
      return undefined;
    }
    return campos;
  };
  const publicacao = grupo("publicacao", "titulo", organizadores.length > 0);
  const evento = grupo("evento", "nome", false);

  if (erros.length) return { ok: false, erros };

  const { base } = opcoes;
  const resto = Object.fromEntries(Object.entries(base ?? {}).filter(([k]) => !CHAVES_DO_FORMULARIO.has(k) && k !== "id" && k !== "titulo"));
  const referencia: Record<string, unknown> = {
    id: base?.id ?? novoIdDeReferencia(opcoes.existentes, opcoes.sorteio),
    tipo: f.tipo,
    autores,
    titulo,
    ...resto,
  };
  for (const chave of CAMPOS_DE_TEXTO) {
    if (chave.includes(".") || chave === "titulo" || !usa(chave)) continue;
    if (valor(chave)) referencia[chave] = valor(chave);
  }
  if (descricao.rotuloDosAutoresOrganizadores && f.autoresOrganizadores && autores.length) referencia.autoresOrganizadores = true;
  if (data) referencia.data = data;
  if (dataIncerta) referencia.dataIncerta = dataIncerta;
  if (acesso) referencia.acesso = acesso;
  if (evento) referencia.evento = evento;
  if (publicacao) referencia.publicacao = organizadores.length ? { ...publicacao, organizadores } : publicacao;

  const conferida = conferirReferencia(referencia);
  if (!conferida) return { ok: false, erros: [{ campo: "", mensagem: "O Apud não conseguiu aceitar esta fonte. Confira os campos." }] };
  return { ok: true, referencia: conferida };
}
