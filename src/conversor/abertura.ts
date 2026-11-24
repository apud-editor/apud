// O que vem antes do texto (capa, folha de rosto, página de título, resumos,
// dedicatória, epígrafe, agradecimentos e sumário): as decisões que não são
// medidas da norma. Quais elementos saem e em que ordem, a frase da natureza
// do trabalho, os rótulos de cada idioma e a data por extenso. Funções puras.
//
// A forma de cada elemento na página (medidas, destaques, rótulos da norma)
// vem do modelo e fica em typst.ts.

import {
  ehTexto,
  ordenarAbertura,
  type Abertura,
  type Bloco,
  type DadosDoTrabalho,
  type Data,
  type Epigrafe,
  type Excecoes,
  type Resumo,
  type TextoDaAbertura,
  type TipoDaAbertura,
} from "../documento/modelo";
import { valorNoBloco } from "../modelos/excecoes";
import { valorEfetivo } from "../modelos/herdar";
import type { ModeloResolvido } from "../modelos/tipos";

// ---------------------------------------------------------------------------
// Quais elementos saem, e em que ordem

export type ElementoDaAbertura =
  | { tipo: "capa" }
  | { tipo: "folhaDeRosto" }
  | { tipo: "paginaDeTitulo" }
  | { tipo: "dedicatoria"; bloco: TextoDaAbertura }
  | { tipo: "agradecimentos"; bloco: TextoDaAbertura }
  | { tipo: "epigrafe"; bloco: Epigrafe }
  | { tipo: "resumo"; resumo: Resumo }
  | { tipo: "sumario"; excecoes?: Excecoes };

/** O elemento da árvore de cada parte da abertura. */
export const ELEMENTO_DA_ABERTURA: Record<ElementoDaAbertura["tipo"], string> = {
  capa: "abertura.capa",
  folhaDeRosto: "abertura.folhaDeRosto",
  paginaDeTitulo: "abertura.paginaDeTitulo",
  dedicatoria: "abertura.dedicatoria",
  agradecimentos: "abertura.agradecimentos",
  epigrafe: "abertura.epigrafe",
  resumo: "abertura.resumo",
  sumario: "abertura.sumario",
};

/**
 * Se o modelo tem o elemento ("existe: sim"). Serve ao PDF (o que sai) e às
 * telas (o que a norma oferece). A ABNT não tem página de título; a APA não
 * tem capa, folha de rosto, dedicatória, epígrafe, agradecimentos nem sumário.
 */
export function existeNoModelo(modelo: ModeloResolvido) {
  return (e: ElementoDaAbertura["tipo"]) => {
    const v = valorEfetivo(modelo, ELEMENTO_DA_ABERTURA[e], "existe")?.valor;
    return v?.tipo === "simnao" && v.valor;
  };
}

/**
 * Os blocos da abertura que saem no PDF, na ordem da norma:
 *   - ABNT (NBR 14724): capa, folha de rosto, dedicatória, agradecimentos,
 *     epígrafe, resumos (na ordem dos blocos) e sumário (sempre o último);
 *   - APA 7: página de título e resumos. A APA não tem capa, folha de rosto,
 *     dedicatória, epígrafe, agradecimentos nem sumário: os blocos ficam no
 *     trabalho, mas não saem (vale a norma).
 * Um bloco só sai se o modelo tem o elemento (`existe`): o modelo de uma
 * faculdade pode desligar um elemento, e a APA não tem os outros.
 * Bloco de texto vazio (dedicatória sem texto, resumo sem texto) não sai.
 */
export function elementosDaAbertura(abertura: Abertura, existe: (elemento: ElementoDaAbertura["tipo"]) => boolean): ElementoDaAbertura[] {
  const temTexto = (paragrafos: { texto: string }[][]) => paragrafos.some((p) => p.some((t) => t.texto.trim()));
  const lista: ElementoDaAbertura[] = [];
  for (const b of ordenarAbertura(abertura.blocos)) {
    switch (b.tipo) {
      case "dedicatoria":
      case "agradecimentos":
        if (temTexto(b.paragrafos)) lista.push({ tipo: b.tipo, bloco: b });
        break;
      case "epigrafe":
        if (temTexto(b.paragrafos)) lista.push({ tipo: "epigrafe", bloco: b });
        break;
      case "resumo":
        if (b.trechos.some((t) => ehTexto(t) && t.texto.trim())) lista.push({ tipo: "resumo", resumo: b });
        break;
      case "sumario":
        lista.push(b.excecoes ? { tipo: "sumario", excecoes: b.excecoes } : { tipo: "sumario" });
        break;
      default:
        lista.push({ tipo: b.tipo });
    }
  }
  return lista.filter((e) => existe(e.tipo));
}

// ---------------------------------------------------------------------------
// Página nova entre os elementos

/**
 * Os elementos que ocupam a folha inteira (a capa, a dedicatória no pé da
 * página...): o que vem depois deles começa sempre numa página nova.
 */
export const OCUPAM_A_FOLHA: ReadonlySet<TipoDaAbertura> = new Set(["capa", "folhaDeRosto", "paginaDeTitulo", "dedicatoria", "epigrafe"]);

/** Os elementos que podem ficar sem página nova ("só este"), por exemplo dois resumos na mesma página. */
export const PODEM_FICAR_SEM_PAGINA_NOVA: ReadonlySet<TipoDaAbertura> = new Set(["agradecimentos", "resumo", "sumario"]);

/** Se o elemento começa numa página nova: o modelo diz (Abertura › página nova) e o bloco pode ter um "só este". */
export function comecaEmPaginaNovaNaAbertura(modelo: ModeloResolvido, tipo: TipoDaAbertura, excecoes?: Excecoes): boolean {
  if (!PODEM_FICAR_SEM_PAGINA_NOVA.has(tipo)) return true;
  const v = valorNoBloco(modelo, ELEMENTO_DA_ABERTURA[tipo], "página nova", excecoes)?.valor;
  return v?.tipo === "simnao" ? v.valor : true;
}

/**
 * Se a página nova antes de um elemento pode sair: ele aceita, e o anterior não
 * ocupa a folha inteira (depois da capa, a página nova vem de qualquer jeito).
 * O primeiro elemento não tem página nova antes.
 */
export function paginaNovaPodeSair(anterior: TipoDaAbertura | undefined, tipo: TipoDaAbertura): boolean {
  return !!anterior && PODEM_FICAR_SEM_PAGINA_NOVA.has(tipo) && !OCUPAM_A_FOLHA.has(anterior);
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

/** "pt-BR" → "pt". */
export const lingua = (idioma: string) => idioma.toLowerCase().split(/[-_]/)[0];

const IDIOMAS_NO_MODELO: Record<string, string> = { pt: "português", en: "inglês", es: "espanhol", fr: "francês", it: "italiano", de: "alemão" };

/**
 * O nome do idioma nas propriedades do modelo ("título em espanhol"). Os
 * rótulos de cada idioma (Resumo, Abstract, Resumen...) ficam no modelo Em
 * branco, e a norma pode trocar; um idioma sem rótulo usa os do inglês.
 */
export function nomeDoIdiomaNoModelo(idioma: string): string {
  return IDIOMAS_NO_MODELO[lingua(idioma)] ?? "inglês";
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
 * As palavras-chave como saem: separadas pelo separador do modelo, com ou sem
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
