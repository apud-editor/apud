// Da resposta do Crossref para uma Referencia do Apud.
//
// O Crossref é o cadastro público de DOIs. Para cada DOI ele devolve uma ficha
// ("work") em JSON. Este arquivo só converte essa ficha para o modelo do Apud
// (documento/referencias.ts); a rede fica em buscaDoi.ts. Assim, tudo aqui se
// testa com respostas de exemplo, sem internet.
//
// Princípios:
// - O Apud não inventa nada. O que o Crossref não traz fica em branco, e os
//   avisos de dado faltando continuam sendo os do motor ("monta e avisa").
// - A ordem dos autores é a do Crossref.
// - Nenhuma regra de norma fica aqui: a forma ("SILVA, J." ou "Silva, J.") é do
//   perfil. O que a conversão faz é dizer quais dados a obra tem.
// - O resultado passa por conferirReferencia, a mesma conferência do arquivo
//   .apud, e a tela só o mostra num formulário para a pessoa conferir: nada é
//   salvo sozinho.

import { conferirReferencia } from "../arquivos/formato";
import { novoIdDeReferencia, type Autor, type Data, type Referencia, type TipoDeReferencia } from "../documento/modelo";
import { normalizarDoi } from "./doi";
import { NOME_DO_TIPO_NA_TELA } from "./formulario";

// ---------------------------------------------------------------------------
// Texto: o Crossref às vezes devolve marcação nos títulos

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/**
 * Tira a marcação de um texto do Crossref. Os títulos chegam com <i>, <sub>,
 * <jats:italic>, "&amp;" e parecidos. O Apud guarda texto simples: o itálico
 * da lista vem da norma, não do título. Símbolos ficam como estão.
 */
export function limparTextoDoCrossref(texto: string): string {
  return texto
    .replace(/<[^>]*>/g, "") // primeiro as marcas; depois as entidades, para "&lt;i&gt;" ficar como texto
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteiro, nome: string) => {
      if (nome[0] === "#") {
        const codigo = nome[1].toLowerCase() === "x" ? parseInt(nome.slice(2), 16) : parseInt(nome.slice(1), 10);
        return Number.isInteger(codigo) && codigo > 0 && codigo <= 0x10ffff ? String.fromCodePoint(codigo) : inteiro;
      }
      return ENTIDADES[nome.toLowerCase()] ?? inteiro;
    })
    .replace(/\s+/g, " ")
    .trim();
}

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** O objeto sem os campos vazios (undefined ou texto em branco). */
const semVazios = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));

/** Um texto do Crossref, limpo. Aceita o texto solto ou uma lista (o primeiro não vazio). Vazio vira undefined. */
function texto(v: unknown): string | undefined {
  const itens = Array.isArray(v) ? v : [v];
  for (const item of itens) {
    const t = typeof item === "string" ? limparTextoDoCrossref(item) : typeof item === "number" ? String(item) : "";
    if (t) return t;
  }
  return undefined;
}

/** Título todo em maiúsculas: sem nenhuma letra minúscula e com letras suficientes para não ser só uma sigla. */
export function estaTodoEmMaiusculas(t: string): boolean {
  const letras = t.match(/\p{L}/gu) ?? [];
  return letras.length >= 10 && !/\p{Ll}/u.test(t);
}

// ---------------------------------------------------------------------------
// O tipo

interface TipoConvertido {
  tipo: TipoDeReferencia;
  /** O Apud não tem esse tipo: escolheu o mais parecido e vai avisar. */
  aproximado: boolean;
}

const tp = (tipo: TipoDeReferencia, aproximado = false): TipoConvertido => ({ tipo, aproximado });

/** Os tipos do Crossref e o tipo do Apud que lhes corresponde (ou o mais parecido). */
const TIPOS_DO_CROSSREF: Record<string, TipoConvertido> = {
  "journal-article": tp("artigo"),
  book: tp("livro"),
  monograph: tp("livro"),
  "edited-book": tp("livro"),
  "reference-book": tp("livro"),
  "book-set": tp("livro", true),
  "book-series": tp("livro", true),
  proceedings: tp("livro", true),
  "proceedings-series": tp("livro", true),
  "book-chapter": tp("capitulo"),
  "book-section": tp("capitulo"),
  "book-part": tp("capitulo"),
  "book-track": tp("capitulo"),
  "reference-entry": tp("capitulo"),
  "proceedings-article": tp("evento"),
  dissertation: tp("tese"),
  report: tp("relatorio"),
  "report-component": tp("relatorio"),
  "report-series": tp("relatorio", true),
  standard: tp("relatorio", true),
  "standard-series": tp("relatorio", true),
  "posted-content": tp("artigo", true),
  journal: tp("artigo", true),
  "journal-issue": tp("artigo", true),
  "journal-volume": tp("artigo", true),
  dataset: tp("site", true),
  database: tp("site", true),
  component: tp("site", true),
  grant: tp("site", true),
  "peer-review": tp("site", true),
  other: tp("site", true),
};

/** Como o aviso chama cada tipo que o Apud não tem. */
const NOME_DO_TIPO_DO_CROSSREF: Record<string, string> = {
  "posted-content": "pré-publicação (preprint)",
  dataset: "conjunto de dados",
  database: "base de dados",
  component: "componente de uma obra",
  grant: "financiamento",
  "peer-review": "parecer de revisão",
  other: "outro tipo",
  journal: "revista inteira",
  "journal-issue": "número de revista",
  "journal-volume": "volume de revista",
  proceedings: "anais inteiros",
  "proceedings-series": "série de anais",
  "book-set": "coleção de livros",
  "book-series": "série de livros",
  "report-series": "série de relatórios",
  standard: "norma técnica",
  "standard-series": "série de normas",
};

export function tipoDoApud(tipoDoCrossref: string): TipoConvertido {
  // Um tipo que nem o Crossref conhecia hoje cai no mais genérico, com aviso.
  return TIPOS_DO_CROSSREF[tipoDoCrossref] ?? tp("site", true);
}

// ---------------------------------------------------------------------------
// Autores e datas

/** Uma pessoa ou instituição do Crossref. "soNome" marca o autor que veio com um nome só. */
function converterAutor(a: unknown): { autor: Autor; soNome?: string } | null {
  if (!objeto(a)) return null;
  const [sobrenome, prenomes, nome] = [texto(a.family), texto(a.given), texto(a.name)];
  if (sobrenome) return { autor: prenomes ? { sobrenome, prenomes } : { sobrenome } };
  if (nome) return { autor: { instituicao: nome } };
  // Só o nome próprio: o Apud precisa de um sobrenome, então ele vai nesse lugar, com aviso.
  if (prenomes) return { autor: { sobrenome: prenomes }, soNome: prenomes };
  return null;
}

function converterAutores(lista: unknown, soNomes: string[]): Autor[] {
  if (!Array.isArray(lista)) return [];
  const saida: Autor[] = [];
  for (const item of lista) {
    const c = converterAutor(item);
    if (!c) continue;
    if (c.soNome) soNomes.push(c.soNome);
    saida.push(c.autor);
  }
  return saida;
}

const diasDoMes = (ano: number, mes: number) => new Date(ano, mes, 0).getDate();

/** "date-parts": [[2019, 5, 17]]. Ano, mês e dia, só até onde forem válidos. */
function converterData(v: unknown): Data | undefined {
  if (!objeto(v) || !Array.isArray(v["date-parts"])) return undefined;
  const partes = v["date-parts"][0];
  if (!Array.isArray(partes)) return undefined;
  const [ano, mes, dia] = partes as unknown[];
  if (typeof ano !== "number" || !Number.isInteger(ano) || ano < 1 || ano > 9999) return undefined;
  const data: Data = { ano };
  if (typeof mes === "number" && Number.isInteger(mes) && mes >= 1 && mes <= 12) {
    data.mes = mes;
    if (typeof dia === "number" && Number.isInteger(dia) && dia >= 1 && dia <= diasDoMes(ano, mes)) data.dia = dia;
  }
  return data;
}

/** A data de publicação: a "issued" do Crossref; se faltar, a impressa, a geral e a eletrônica. Nunca a data em que o registro foi criado. */
const CHAVES_DE_DATA = ["issued", "published-print", "published", "published-online"] as const;

function dataDaObra(m: Record<string, unknown>): Data | undefined {
  for (const chave of CHAVES_DE_DATA) {
    const d = converterData(m[chave]);
    if (d) return d;
  }
  return undefined;
}

/** "9–30" e "9 - 30" viram "9-30", a forma do Apud. */
const hifenizar = (p: string) => p.replace(/\s*[–—‒-]\s*/g, "-");

// ---------------------------------------------------------------------------
// A conversão

export type ResultadoDaConversao =
  | { ok: true; referencia: Referencia; avisos: string[] }
  | { ok: false; motivo: "fora-do-esperado" };

export interface OpcoesDaConversao {
  /** Os códigos que já existem no trabalho, para o código novo não repetir. */
  existentes: Iterable<string>;
  /** O DOI que a pessoa pediu, na forma do Apud: usado se a ficha vier sem DOI. */
  doiPedido?: string;
  sorteio?: () => number;
}

/** A parte "message" da resposta, se a resposta for de uma obra do Crossref. */
function fichaDaObra(resposta: unknown): Record<string, unknown> | null {
  if (!objeto(resposta)) return null;
  if (resposta.status !== undefined && resposta.status !== "ok") return null;
  if (resposta["message-type"] !== undefined && resposta["message-type"] !== "work") return null;
  const m = resposta.message;
  if (!objeto(m) || typeof m.type !== "string") return null;
  return m;
}

/**
 * Converte a resposta do Crossref (https://api.crossref.org/works/{doi}) numa
 * referência do Apud, com avisos para a pessoa conferir. Nunca lança erro: uma
 * resposta que não é uma ficha de obra devolve { ok: false }.
 */
export function converterCrossref(resposta: unknown, opcoes: OpcoesDaConversao): ResultadoDaConversao {
  const m = fichaDaObra(resposta);
  if (!m) return { ok: false, motivo: "fora-do-esperado" };

  const avisos: string[] = [];
  const { tipo, aproximado } = tipoDoApud(m.type as string);
  if (aproximado) {
    const nome = NOME_DO_TIPO_DO_CROSSREF[m.type as string] ?? `“${m.type}”`;
    avisos.push(
      `O Crossref classifica esta fonte como ${nome}, um tipo que o Apud ainda não tem. Escolhi “${NOME_DO_TIPO_NA_TELA[tipo]}”, o mais parecido. Confira o tipo e os campos.`,
    );
  }

  const soNomes: string[] = [];
  let autores = converterAutores(m.author, soNomes);
  const editores = converterAutores(m.editor, soNomes);
  // Livro organizado: o Crossref só lista organizadores. Eles entram como autores e a caixa
  // "São os organizadores do livro" fica marcada: a norma põe o "(org.)" ou "(Org.)" sozinha.
  let livroOrganizado = false;
  if (tipo === "livro" && autores.length === 0 && editores.length > 0) {
    autores = editores;
    livroOrganizado = true;
    avisos.push("Esta obra tem organizadores, e não autores. Marquei “São os organizadores do livro”: o Apud põe o “(org.)” na norma. Confira os nomes.");
  }
  if (soNomes.length > 0) {
    const quem = soNomes.map((n) => `“${n}”`).join(", ");
    avisos.push(
      soNomes.length === 1
        ? `Um autor veio só com um nome (${quem}). Coloquei no lugar do sobrenome: confira.`
        : `Alguns autores vieram só com um nome (${quem}). Coloquei no lugar do sobrenome: confira.`,
    );
  }

  const titulo = texto(m.title) ?? "";
  let subtitulo = texto(m.subtitle);
  // Alguns registros repetem o subtítulo dentro do título.
  if (subtitulo && titulo.toLowerCase().includes(subtitulo.toLowerCase())) subtitulo = undefined;
  if (estaTodoEmMaiusculas(titulo) || (subtitulo !== undefined && estaTodoEmMaiusculas(subtitulo))) {
    avisos.push("O título veio todo em maiúsculas. O Apud não mexe nele: corrija se quiser.");
  }

  const doi = normalizarDoi(texto(m.DOI)) ?? opcoes.doiPedido;
  const instituicao = Array.isArray(m.institution) && objeto(m.institution[0]) ? m.institution[0] : undefined;
  const editora = texto(m.publisher);
  const cidadeDaEditora = texto(m["publisher-location"]);
  const nomeDaInstituicao = instituicao ? texto(instituicao.name) : undefined;
  const cidadeDaInstituicao = instituicao ? texto(instituicao.place) : undefined;
  const pagina = texto(m.page);
  const maior = texto(m["container-title"]);

  const r: Record<string, unknown> = {
    id: novoIdDeReferencia(opcoes.existentes, opcoes.sorteio),
    tipo,
    autores,
    titulo,
  };
  const colocar = (chave: string, valor: unknown) => {
    if (valor !== undefined && valor !== "") r[chave] = valor;
  };
  if (livroOrganizado) r.autoresOrganizadores = true;
  colocar("subtitulo", subtitulo);
  colocar("data", dataDaObra(m));
  colocar("doi", doi);

  // Só entram os campos que o tipo usa (o formulário só mostra esses).
  switch (tipo) {
    case "artigo": {
      // Uma pré-publicação não tem revista: o repositório (a "editora") ocupa o lugar dela.
      const revista = maior ?? (m.type === "posted-content" ? editora : undefined);
      if (revista) {
        r.publicacao = semVazios({ titulo: revista, volume: texto(m.volume), numero: texto(m.issue) });
      }
      if (pagina) {
        // Intervalo de páginas ("45-60", "S1-S10") ou página só com números; o resto é o número do artigo ("e2024017").
        if (/^\d+$/.test(pagina) || /^[A-Za-z]*\d+\s*[–—‒-]\s*[A-Za-z]*\d+$/.test(pagina)) r.paginas = hifenizar(pagina);
        else r.numeroEletronico = pagina;
      } else colocar("numeroEletronico", texto(m["article-number"]));
      break;
    }
    case "livro":
      colocar("edicao", texto(m["edition-number"]));
      colocar("cidade", cidadeDaEditora);
      colocar("editora", editora);
      break;
    case "capitulo": {
      if (maior) r.publicacao = semVazios({ titulo: maior, organizadores: editores.length > 0 ? editores : undefined });
      colocar("edicao", texto(m["edition-number"]));
      colocar("cidade", cidadeDaEditora);
      colocar("editora", editora);
      colocar("paginas", pagina && hifenizar(pagina));
      break;
    }
    case "evento": {
      const ev = objeto(m.event) ? m.event : undefined;
      const nomeDoEvento = ev ? texto(ev.name) : undefined;
      if (nomeDoEvento && ev) {
        const comecou = converterData(ev.start);
        r.evento = semVazios({ nome: nomeDoEvento, numero: texto(ev.number), ano: comecou && String(comecou.ano), cidade: texto(ev.location) });
      }
      if (maior) r.publicacao = semVazios({ titulo: maior, organizadores: editores.length > 0 ? editores : undefined });
      colocar("cidade", cidadeDaEditora);
      colocar("editora", editora);
      colocar("paginas", pagina && hifenizar(pagina));
      break;
    }
    case "tese":
      colocar("editora", nomeDaInstituicao ?? editora);
      colocar("cidade", cidadeDaInstituicao ?? cidadeDaEditora);
      break;
    case "relatorio":
      colocar("editora", nomeDaInstituicao ?? editora);
      colocar("cidade", cidadeDaInstituicao ?? cidadeDaEditora);
      break;
    default: // site (e o que caiu nele)
      colocar("editora", editora);
      colocar("cidade", cidadeDaEditora);
  }

  const referencia = conferirReferencia(r);
  if (!referencia) return { ok: false, motivo: "fora-do-esperado" };
  return { ok: true, referencia, avisos };
}
