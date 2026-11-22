// O que vem antes do texto (capa, folha de rosto, página de título, resumos,
// dedicatória, epígrafe, agradecimentos e sumário): as decisões que não são
// medidas da norma. Quais elementos saem e em que ordem, a frase da natureza
// do trabalho, os rótulos de cada idioma e a data por extenso. Funções puras.
//
// A forma de cada elemento na página (medidas, destaques, rótulos da norma)
// vem do perfil e fica em typst.ts.

import { ehTexto, type Abertura, type Bloco, type DadosDoTrabalho, type Data, type Resumo } from "../documento/modelo";

// ---------------------------------------------------------------------------
// Quais elementos saem, e em que ordem

export type ElementoDaAbertura =
  | { tipo: "capa" }
  | { tipo: "folhaDeRosto" }
  | { tipo: "paginaDeTitulo" }
  | { tipo: "dedicatoria" }
  | { tipo: "agradecimentos" }
  | { tipo: "epigrafe" }
  | { tipo: "resumo"; resumo: Resumo }
  | { tipo: "sumario" };

export type Norma = "abnt" | "apa";

/** As regras que o perfil precisa ter para a norma ter o elemento (uma delas basta). */
const REGRAS_DOS_ELEMENTOS: Record<ElementoDaAbertura["tipo"], string[]> = {
  capa: ["capa"],
  folhaDeRosto: ["folha de rosto"],
  paginaDeTitulo: ["página de título (estudante), campos"],
  dedicatoria: ["dedicatória"],
  agradecimentos: ["agradecimentos"],
  epigrafe: ["epígrafe"],
  resumo: ["resumo", "rótulo do resumo"],
  sumario: ["sumário"],
};

/**
 * Se a norma tem o elemento: o perfil precisa ter a regra dele. `tem` diz se o
 * perfil tem uma regra. Serve ao PDF (o que sai) e às telas (o que a norma oferece).
 */
export function existeNaNorma(tem: (regra: string) => boolean) {
  return (e: ElementoDaAbertura["tipo"]) => REGRAS_DOS_ELEMENTOS[e].some(tem);
}

/**
 * Os elementos ligados, na ordem da norma:
 *   - ABNT (NBR 14724): capa, folha de rosto, dedicatória, agradecimentos,
 *     epígrafe, resumos (na ordem da lista) e sumário (sempre o último);
 *   - APA 7: página de título e resumos. A APA não tem capa, folha de rosto,
 *     dedicatória, epígrafe, agradecimentos nem sumário: eles ficam guardados,
 *     mas não saem (vale a norma).
 * Um elemento só sai se o perfil tem a regra dele (`existe`): um perfil de
 * faculdade pode desligar um elemento, e a APA não tem as regras dos outros.
 * Elemento de texto ligado mas vazio (dedicatória sem texto) não sai.
 */
export function elementosDaAbertura(abertura: Abertura, existe: (elemento: ElementoDaAbertura["tipo"]) => boolean): ElementoDaAbertura[] {
  const temTexto = (paragrafos: { texto: string }[][]) => paragrafos.some((p) => p.some((t) => t.texto.trim()));
  const resumos = abertura.resumos
    .filter((r) => r.trechos.some((t) => ehTexto(t) && t.texto.trim()))
    .map((resumo): ElementoDaAbertura => ({ tipo: "resumo", resumo }));
  const lista: ElementoDaAbertura[] = [
    ...(abertura.capa ? [{ tipo: "capa" as const }] : []),
    ...(abertura.folhaDeRosto ? [{ tipo: "folhaDeRosto" as const }] : []),
    ...(abertura.paginaDeTitulo ? [{ tipo: "paginaDeTitulo" as const }] : []),
    ...(abertura.dedicatoria.incluir && temTexto(abertura.dedicatoria.paragrafos) ? [{ tipo: "dedicatoria" as const }] : []),
    ...(abertura.agradecimentos.incluir && temTexto(abertura.agradecimentos.paragrafos) ? [{ tipo: "agradecimentos" as const }] : []),
    ...(abertura.epigrafe.incluir && temTexto(abertura.epigrafe.paragrafos) ? [{ tipo: "epigrafe" as const }] : []),
    ...resumos,
    ...(abertura.sumario ? [{ tipo: "sumario" as const }] : []),
  ];
  return lista.filter((e) => existe(e.tipo));
}

// ---------------------------------------------------------------------------
// Natureza do trabalho (folha de rosto)

const COMECO: Record<DadosDoTrabalho["tipo"], string> = {
  disciplina: "Trabalho apresentado",
  estagio: "Relatório de estágio apresentado",
  artigo: "Artigo apresentado",
  tcc: "Trabalho de Conclusão de Curso apresentado",
};

const FIM: Record<DadosDoTrabalho["tipo"], string> = {
  disciplina: "como requisito parcial para aprovação na disciplina",
  estagio: "como requisito parcial para aprovação no estágio",
  artigo: "como requisito parcial para aprovação",
  tcc: "como requisito parcial para a conclusão do curso",
};

/**
 * O gênero do nome da instituição, pela primeira palavra: "a" (Universidade,
 * Faculdade, Fundação), "o" (Instituto, Centro) ou "" quando não dá para saber
 * (uma sigla, por exemplo).
 */
export function generoDoNome(nome: string): "a" | "o" | "" {
  const primeira = nome.trim().split(/\s+/)[0] ?? "";
  if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}$/.test(primeira)) return "";
  const p = primeira.toLowerCase();
  if (/(a|dade|ção|são|gem)$/.test(p)) return "a";
  if (/(o|or)$/.test(p)) return "o";
  return "";
}

/** "da Universidade X" / "do Instituto Y" / "de UNIVALI". */
export const deNome = (nome: string) => ({ a: "da", o: "do", "": "de" })[generoDoNome(nome)] + " " + nome.trim();
/** "à Universidade X" / "ao Instituto Y" / "a UNIVALI". */
const aNome = (nome: string) => ({ a: "à", o: "ao", "": "a" })[generoDoNome(nome)] + " " + nome.trim();

/**
 * A frase da natureza que o Apud monta pelo tipo, a disciplina, o curso e a
 * instituição (decisão de 21/11/2026). Se a pessoa escreveu a dela, vale a
 * dela. Sem nenhum dado, devolve "" (a natureza não sai).
 *   Trabalho apresentado à disciplina de Psicopatologia, do curso de
 *   Psicologia da Universidade do Vale do Itajaí, como requisito parcial para
 *   aprovação na disciplina.
 */
export function naturezaDoTrabalho(d: DadosDoTrabalho): string {
  if (d.natureza?.trim()) return d.natureza.trim();
  const disciplina = d.disciplina?.trim();
  const curso = d.curso?.trim();
  const instituicao = d.instituicao?.trim();
  if (!disciplina && !curso && !instituicao) return "";
  const partes: string[] = [];
  if (disciplina && d.tipo === "disciplina") partes.push(`à disciplina de ${disciplina}`);
  if (curso) partes.push(`${partes.length ? "do" : "ao"} curso de ${curso}${instituicao ? ` ${deNome(instituicao)}` : ""}`);
  else if (instituicao) partes.push(partes.length ? deNome(instituicao) : aNome(instituicao));
  const fim = d.tipo === "disciplina" && !disciplina ? "como requisito parcial para aprovação" : FIM[d.tipo];
  return `${COMECO[d.tipo]} ${partes.join(", ")}, ${fim}.`;
}

// ---------------------------------------------------------------------------
// Rótulos de cada idioma

interface RotulosDoIdioma {
  resumo: string;
  palavrasChave: string;
}

/** Os rótulos do resumo em cada idioma. O perfil pode trocar os do português e os do inglês. */
const ROTULOS: Record<string, RotulosDoIdioma> = {
  pt: { resumo: "Resumo", palavrasChave: "Palavras-chave:" },
  en: { resumo: "Abstract", palavrasChave: "Keywords:" },
  es: { resumo: "Resumen", palavrasChave: "Palabras clave:" },
  fr: { resumo: "Résumé", palavrasChave: "Mots-clés :" },
  it: { resumo: "Riassunto", palavrasChave: "Parole chiave:" },
  de: { resumo: "Zusammenfassung", palavrasChave: "Schlüsselwörter:" },
};

/** "pt-BR" → "pt". */
export const lingua = (idioma: string) => idioma.toLowerCase().split(/[-_]/)[0];

export function rotulosDoIdioma(idioma: string): RotulosDoIdioma {
  return ROTULOS[lingua(idioma)] ?? ROTULOS.en;
}

/** O código do idioma para o Typst (hifenização, aspas): "pt-BR" → lang "pt", region "BR". */
export function idiomaParaTypst(idioma: string): { lang: string; region?: string } {
  const [lang, region] = idioma.split(/[-_]/);
  return { lang: lang.toLowerCase(), ...(region ? { region: region.toUpperCase() } : {}) };
}

// ---------------------------------------------------------------------------
// Datas, nomes e palavras-chave

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "22 de novembro de 2026", "novembro de 2026" ou "2026", conforme o que se sabe da data. */
export function dataPorExtenso(d: Data): string {
  const mes = d.mes && d.mes >= 1 && d.mes <= 12 ? MESES[d.mes - 1] : undefined;
  if (mes && d.dia) return `${d.dia} de ${mes} de ${d.ano}`;
  if (mes) return `${mes} de ${d.ano}`;
  return String(d.ano);
}

/** O ano que sai na capa e na folha de rosto: o do trabalho ou, se faltar, o da data de entrega. */
export const anoDoTrabalho = (d: DadosDoTrabalho): number | undefined => d.ano ?? d.dataDeEntrega?.ano;

/** "Ana", "Ana e Bruno", "Ana, Bruno e Carla". */
export function juntarNomes(nomes: string[]): string {
  const n = nomes.map((x) => x.trim()).filter(Boolean);
  if (n.length <= 1) return n[0] ?? "";
  return `${n.slice(0, -1).join(", ")} e ${n[n.length - 1]}`;
}

/** "Título: subtítulo", como pedem a capa da ABNT e a página de título da APA. */
export function tituloCompleto(d: DadosDoTrabalho): { titulo: string; subtitulo: string } {
  return { titulo: d.titulo.trim(), subtitulo: d.subtitulo?.trim() ?? "" };
}

/**
 * As palavras-chave como saem: separadas pela regra do perfil, com ou sem
 * ponto no fim. As palavras ficam como a pessoa escreveu (o Apud não muda as
 * letras). Um ponto que a pessoa já pôs no fim não fica dobrado.
 */
export function palavrasChave(palavras: string[], separador: "ponto e vírgula" | "vírgula" | "ponto", final: "ponto" | "nenhum"): string {
  const sep = separador === "vírgula" ? ", " : separador === "ponto" ? ". " : "; ";
  const lista = palavras.map((p) => p.trim().replace(/[.;,]+$/, "")).filter(Boolean);
  if (!lista.length) return "";
  return lista.join(sep) + (final === "ponto" ? "." : "");
}

/**
 * APA: o título do trabalho se repete no começo do texto, menos quando o texto
 * já começa por ele (a pessoa escreveu o título como primeiro título do texto).
 */
export function repetirTituloNoTexto(d: DadosDoTrabalho, blocos: Bloco[]): boolean {
  const titulo = d.titulo.trim();
  if (!titulo) return false;
  const primeiro = blocos.find((b) => !(b.tipo === "paragrafo" && !b.trechos.some((t) => !ehTexto(t) || t.texto.trim())));
  if (primeiro?.tipo !== "titulo") return true;
  const texto = primeiro.trechos.map((t) => (ehTexto(t) ? t.texto : "")).join("").trim();
  const simples = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");
  const completo = d.subtitulo?.trim() ? `${titulo}: ${d.subtitulo.trim()}` : titulo;
  return simples(texto) !== simples(titulo) && simples(texto) !== simples(completo);
}
