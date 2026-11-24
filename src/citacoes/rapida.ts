// Citar sem parar de escrever (etapa 1.5): a parte que não depende do editor.
//
//  1. O "@" rápido: "@silva, p. 15" vira a obra a procurar ("silva") e o
//     localizador ("p. 15"); a citação nasce já pronta, sem janela.
//  2. O reconhecimento: "(Silva, 2019, p. 15)" e "Silva (2019)", escritos à mão,
//     são comparados com as obras cadastradas. Só vale quando a obra é única;
//     na dúvida, o Apud não sugere nada (e nunca troca nada sozinho).
//
// Nada de norma fica aqui: quem escreve a citação na ABNT ou na APA continua
// sendo o motor de citações. Funções puras, sem tela, para testar sem navegador.

import { ehInstituicao, niveisDaInstituicao, type Autor, type Citacao, type Localizador, type Referencia } from "../documento/modelo";
import { buscarReferencias, ordenarParaGaveta, simplificar } from "../referencias/lista";
import { formularioNovo, formularioParaCitacao, obraVazia, TEMPO, type ObraNoFormulario } from "./janela";

// ---------------------------------------------------------------------------
// Localizador escrito à mão: "p. 15", "15", "pp. 15-16", "cap. 3", "1:56"

/** Lê o que veio depois da vírgula. Devolve null se não parecer um localizador. */
export function localizadorDoTexto(texto: string): Localizador | null {
  const t = texto.trim().replace(/[,;]+$/, "").trim();
  if (!t) return null;
  if (TEMPO.test(t)) return { tipo: "outro", rotulo: "", valor: t };
  const pagina = t.match(/^(?:pp?\.?\s*)?(\d+(?:\s*[-–]\s*\d+)?)$/i);
  if (pagina) return { tipo: "pagina", valor: pagina[1].replace(/\s*[-–]\s*/, "-") };
  const outro = t.match(/^(\p{L}+\.?|§)\s*(\d\S*)$/u);
  if (outro) {
    const rotulo = outro[1] === "§" || outro[1].endsWith(".") ? outro[1] : `${outro[1]}.`;
    return { tipo: "outro", rotulo, valor: outro[2] };
  }
  return null;
}

function obraNoFormulario(referencia: string, l?: Localizador, grifo = false, traducao = false): ObraNoFormulario {
  const base = { ...obraVazia(), referencia, grifo, traducao };
  if (!l) return base;
  if (l.tipo === "pagina") return { ...base, onde: "pagina", valor: l.valor };
  if (!l.rotulo.trim() && TEMPO.test(l.valor.trim())) return { ...base, onde: "tempo", valor: l.valor };
  return { ...base, onde: "outro", rotulo: l.rotulo, valor: l.valor };
}

/** Uma citação de uma obra só, pela mesma conferência da janela. */
export function citacaoRapida(referencia: string, localizador?: Localizador, autorNoTexto = false): Citacao {
  const f = { ...formularioNovo(), autorNoTexto, obras: [obraNoFormulario(referencia, localizador)] };
  const r = formularioParaCitacao(f);
  if (!r.ok) throw new Error(r.erros.map((e) => e.mensagem).join(" "));
  return r.citacao;
}

// ---------------------------------------------------------------------------
// O "@": o que a pessoa digitou depois dele

export interface ConsultaRapida {
  /** O que procurar nas obras ("silva 2019"). */
  busca: string;
  /** O localizador depois da vírgula, se foi escrito e se entendi. */
  localizador?: Localizador;
  /** Depois da vírgula veio algo que não entendi como localizador. */
  localizadorNaoEntendido?: string;
}

/** "silva, p. 15" → procurar "silva", página 15. Sem vírgula, tudo é busca. */
export function consultaRapida(texto: string): ConsultaRapida {
  const i = texto.indexOf(",");
  if (i < 0) return { busca: texto.trim() };
  const busca = texto.slice(0, i).trim();
  const resto = texto.slice(i + 1).trim();
  if (!resto) return { busca };
  const localizador = localizadorDoTexto(resto);
  return localizador ? { busca, localizador } : { busca, localizadorNaoEntendido: resto };
}

/** As obras que a listinha mostra: as que combinam com a busca, na ordem da gaveta. */
export function obrasDoArroba(referencias: Referencia[], busca: string): Referencia[] {
  return ordenarParaGaveta(buscarReferencias(referencias, busca));
}

// ---------------------------------------------------------------------------
// Reconhecer a citação escrita à mão

export interface CitacaoReconhecida {
  /** Onde começa e onde termina, no texto do bloco (um caractere por peça que não é texto). */
  de: number;
  ate: number;
  citacao: Citacao;
}

const NOME = String.raw`\p{L}[\p{L}'’\-]*`;
const NOME_VALIDO = new RegExp(String.raw`^${NOME}(?: ${NOME}){0,9}$`, "u");
const ANO = String.raw`\d{4}[a-z]?|s\.\s?d\.`;

/** Os nomes de uma chamada: "Silva e Costa", "SILVA; COSTA", "Silva, Costa & Reis", "Silva et al.". */
function nomesDaChamada(texto: string): { nomes: string[]; etAl: boolean } | null {
  let t = texto.trim();
  let etAl = false;
  const m = t.match(/^(.*?)\s*,?\s*et al\.?$/i);
  if (m) {
    etAl = true;
    t = m[1];
  }
  const nomes = t.split(/\s*(?:[,;&]|\be\b|\band\b)\s*/i).filter(Boolean);
  if (!nomes.length || !nomes.every((n) => NOME_VALIDO.test(n))) return null;
  return { nomes, etAl };
}

const nomesDoAutor = (a: Autor): string[] =>
  ehInstituicao(a) ? [simplificar(a.instituicao), simplificar(niveisDaInstituicao(a.instituicao)[0])] : [simplificar(a.sobrenome)];

/** Procura a obra de um grupo de nomes e um ano. Só devolve se for uma só. */
class Indice {
  private porAno = new Map<number | "sd", Referencia[]>();
  constructor(referencias: Referencia[]) {
    for (const r of referencias) {
      const k = r.data ? r.data.ano : r.dataIncerta ? null : "sd";
      if (k === null) continue;
      this.porAno.set(k, [...(this.porAno.get(k) ?? []), r]);
    }
  }
  obra(nomes: string[], etAl: boolean, ano: string): string | null {
    const sd = /^s\.\s?d\.$/.test(ano);
    const candidatas = (sd ? this.porAno.get("sd") : this.porAno.get(Number(ano.slice(0, 4)))) ?? [];
    const alvo = nomes.map(simplificar);
    const achadas = candidatas.filter((r) => {
      if (etAl ? r.autores.length < 2 || r.autores.length < alvo.length : r.autores.length !== alvo.length) return false;
      return alvo.every((n, i) => nomesDoAutor(r.autores[i]).includes(n));
    });
    return achadas.length === 1 ? achadas[0].id : null;
  }
}

/** A obra citada: nomes, ano e, se houver, o que vem depois do ano (página, grifo...). */
interface ObraLida {
  referencia: string;
  localizador?: Localizador;
  grifo: boolean;
  traducao: boolean;
}

/** O que vem depois do ano: ", p. 15", ", p. 15, grifo nosso", ", tradução nossa". */
function restoDaObra(texto: string | undefined): { localizador?: Localizador; grifo: boolean; traducao: boolean } | null {
  const saida: { localizador?: Localizador; grifo: boolean; traducao: boolean } = { grifo: false, traducao: false };
  for (const parte of (texto ?? "").split(",").map((p) => p.trim()).filter(Boolean)) {
    if (/^grifo (nosso|meu|seu)$/i.test(parte)) saida.grifo = true;
    else if (/^tradu[çc][ãa]o (nossa|minha)$/i.test(parte)) saida.traducao = true;
    else if (!saida.localizador && localizadorDoTexto(parte)) saida.localizador = localizadorDoTexto(parte)!;
    else return null;
  }
  return saida;
}

function obraLida(indice: Indice, nomes: string, ano: string, resto: string | undefined): ObraLida | null {
  const n = nomesDaChamada(nomes);
  if (!n) return null;
  // Um nome de instituição pode ter "e" ou vírgula ("Ministério da Saúde e Cultura"): tenta também inteiro.
  const referencia = indice.obra(n.nomes, n.etAl, ano) ?? (NOME_VALIDO.test(nomes.trim()) ? indice.obra([nomes.trim()], false, ano) : null);
  const extra = restoDaObra(resto);
  return referencia && extra ? { referencia, ...extra } : null;
}

/** Uma obra entre parênteses: "Silva, 2019, p. 15". */
function obraEntreParenteses(indice: Indice, texto: string): ObraLida | null {
  const m = texto.trim().match(new RegExp(String.raw`^(.+?)\s*,?\s+(${ANO})(?:\s*,\s*(.+))?$`, "iu"));
  return m ? obraLida(indice, m[1], m[2].toLowerCase(), m[3]) : null;
}

/** As obras de um parêntese: "Silva, 2019; Costa, 2020" ou "SILVA; COSTA, 2019" (autores separados por ;). */
function obrasDoParentese(indice: Indice, texto: string): ObraLida[] | null {
  const obras: ObraLida[] = [];
  let pendentes: string[] = [];
  for (const parte of texto.split(";")) {
    pendentes.push(parte);
    if (!new RegExp(String.raw`(?:^|[\s,])(?:${ANO})(?:\s*,|\s*$)`, "iu").test(parte)) continue;
    const obra = obraEntreParenteses(indice, pendentes.join(";").replace(/;/g, " e "));
    if (!obra) return null;
    obras.push(obra);
    pendentes = [];
  }
  return pendentes.length || !obras.length ? null : obras;
}

const obraCitada = (o: ObraLida) => ({
  referencia: o.referencia,
  ...(o.localizador ? { localizador: o.localizador } : {}),
  ...(o.grifo ? { grifo: true as const } : {}),
  ...(o.traducao ? { traducao: true as const } : {}),
});

const PARENTESE = /\(([^()]{3,200})\)/gu;
const NARRATIVA = new RegExp(String.raw`\((${ANO})(?:\s*,\s*([^()]+))?\)`, "giu");

/**
 * Quem reconhece as citações escritas à mão. Monte uma vez para cada lista de
 * obras (o índice por ano é o trabalho caro) e use em cada bloco de texto.
 */
export function criarReconhecedor(referencias: Referencia[]): (texto: string) => CitacaoReconhecida[] {
  const indice = new Indice(referencias);
  return (texto) => {
    const achadas: CitacaoReconhecida[] = [];

    // (Silva, 2019, p. 15) · (Silva, 2019; Costa, 2020) · (Freud, 1915 apud Silva, 2019)
    for (const m of texto.matchAll(PARENTESE)) {
      const dentro = m[1];
      const de = m.index!;
      const apud = dentro.split(/\s+apud\s+/i);
      let citacao: Citacao | null = null;
      if (apud.length === 2 && apud[0].trim()) {
        const obras = obrasDoParentese(indice, apud[1]);
        if (obras?.length === 1) citacao = { tipo: "apud", original: apud[0].trim(), obra: obraCitada(obras[0]) };
      } else if (apud.length === 1) {
        const obras = obrasDoParentese(indice, dentro);
        if (obras) citacao = { tipo: "parenteses", obras: obras.map(obraCitada) };
      }
      if (citacao) achadas.push({ de, ate: de + m[0].length, citacao });
    }

    // Silva (2019) · Silva e Costa (2019, p. 15): o autor faz parte da frase
    for (const m of texto.matchAll(NARRATIVA)) {
      const antes = texto.slice(0, m.index!);
      if (!/\s$/.test(antes)) continue;
      // As palavras antes do parêntese, até o fim da frase: do nome mais longo para o mais curto.
      const palavras = [...antes.matchAll(/\S+/g)].map((p) => ({ texto: p[0], de: p.index! }));
      let inicio = palavras.length;
      while (inicio > 0 && palavras.length - inicio < 8) {
        inicio--;
        // A palavra de trás fecha outra frase ("et al." não fecha): esta frase começa aqui.
        const atras = palavras[inicio - 1]?.texto;
        if (atras && /[.!?;:]$/.test(atras) && !/\bal\.$/i.test(atras)) break;
      }
      for (let i = inicio; i < palavras.length; i++) {
        if (!/^\p{Lu}/u.test(palavras[i].texto)) continue;
        // "E Costa (2021)": o "E" é da frase, não do nome (sem isto o texto perderia o "E" ao virar citação).
        if (/^(e|and|et)$/i.test(palavras[i].texto)) continue;
        const nomes = antes.slice(palavras[i].de).trim();
        const obra = obraLida(indice, nomes, m[1].toLowerCase(), m[2]);
        if (!obra) continue;
        achadas.push({ de: palavras[i].de, ate: m.index! + m[0].length, citacao: { tipo: "narrativa", obra: obraCitada(obra) } });
        break;
      }
    }

    achadas.sort((a, b) => a.de - b.de);
    return achadas.filter((a, i) => i === 0 || a.de >= achadas[i - 1].ate);
  };
}
