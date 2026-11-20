// A lista de fontes da gaveta: resumo legível de cada uma, busca, ordem e
// contagem de citações. Funções puras, sem tela.
//
// A forma exata da norma ("SILVA, João. Psicologia clínica…") é montada pelo
// Typst e aparece na prévia e no PDF. A gaveta mostra um resumo (decisão de
// 20/11/2026: o Typst do navegador não devolve o texto da lista sozinho).

import { citacoesDoTexto } from "../citacoes/motor";
import { ehInstituicao, obrasDaCitacao, type Autor, type Bloco, type Referencia } from "../documento/modelo";
import { NOME_DO_TIPO_NA_TELA } from "./formulario";

export interface ResumoDaReferencia {
  /** "Silva", "Silva e Costa", "Lima, Costa e Reis", "Lima et al.", "(sem autor)". */
  autores: string;
  /** "2019", "[2019?]" ou "s.d.". */
  ano: string;
  /** O título, com o subtítulo depois de dois-pontos. */
  titulo: string;
  /** "Livro", "Artigo de revista"… */
  tipo: string;
}

const nomeDoAutor = (a: Autor) => (ehInstituicao(a) ? a.instituicao : a.sobrenome);

/** Os autores como o resumo mostra: até três pelo sobrenome; mais que isso, o primeiro e et al. */
export function autoresDoResumo(autores: Autor[]): string {
  const nomes = autores.map(nomeDoAutor);
  if (nomes.length === 0) return "(sem autor)";
  if (nomes.length === 1) return nomes[0];
  if (nomes.length <= 3) return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  return `${nomes[0]} et al.`;
}

export function resumoDaReferencia(r: Referencia): ResumoDaReferencia {
  return {
    autores: autoresDoResumo(r.autores),
    ano: r.data ? String(r.data.ano) : (r.dataIncerta ?? "s.d."),
    titulo: r.subtitulo ? `${r.titulo}: ${r.subtitulo}` : r.titulo,
    tipo: NOME_DO_TIPO_NA_TELA[r.tipo],
  };
}

/** Minúsculas e sem acento, para a busca achar "psicologia" em "Psicólogo". */
const simplificar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Tudo em que a busca procura: autores (e organizadores), título, subtítulo, ano e onde foi publicada. */
function textoDeBusca(r: Referencia): string {
  const nomes = (autores: Autor[] = []) => autores.map((a) => (ehInstituicao(a) ? a.instituicao : `${a.sobrenome} ${a.prenomes ?? ""}`));
  return simplificar(
    [
      ...nomes(r.autores),
      ...nomes(r.publicacao?.organizadores),
      r.titulo,
      r.subtitulo ?? "",
      r.publicacao?.titulo ?? "",
      r.data ? String(r.data.ano) : (r.dataIncerta ?? ""),
    ].join(" "),
  );
}

/** Quando a consulta está vazia, todas. Senão, só as fontes que têm todas as palavras digitadas (em qualquer ordem). */
export function buscarReferencias(referencias: Referencia[], consulta: string): Referencia[] {
  const palavras = simplificar(consulta).split(" ").filter(Boolean);
  if (palavras.length === 0) return referencias;
  return referencias.filter((r) => {
    const texto = textoDeBusca(r);
    return palavras.every((p) => texto.includes(p));
  });
}

/** Ordem da gaveta: por autor, depois por ano e por título. Não muda a lista que o Apud guarda. */
export function ordenarParaGaveta(referencias: Referencia[]): Referencia[] {
  const chave = (r: Referencia) => [simplificar(r.autores.map(nomeDoAutor).join(" ")), r.data?.ano ?? 9999, simplificar(r.titulo)] as const;
  return [...referencias].sort((a, b) => {
    const [x, y] = [chave(a), chave(b)];
    return x[0].localeCompare(y[0], "pt-BR") || x[1] - y[1] || x[2].localeCompare(y[2], "pt-BR");
  });
}

/** Quantas vezes cada fonte é citada no texto (uma citação com duas obras conta uma vez para cada). */
export function contarCitacoes(blocos: Bloco[]): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const c of citacoesDoTexto(blocos)) {
    for (const o of obrasDaCitacao(c)) contagem.set(o.referencia, (contagem.get(o.referencia) ?? 0) + 1);
  }
  return contagem;
}

/** O que a confirmação de apagar diz. Sem citações, não precisa de confirmação (devolve null). */
export function avisoDeApagar(vezes: number): string | null {
  if (vezes <= 0) return null;
  const quantas = vezes === 1 ? "citada 1 vez" : `citada ${vezes} vezes`;
  const marcadas = vezes === 1 ? "A citação fica marcada" : "As citações ficam marcadas";
  return `Esta fonte é ${quantas} no texto. ${marcadas} como referência apagada.`;
}
