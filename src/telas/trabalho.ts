// O trabalho novo e os dados do trabalho, em funções puras (testadas sem navegador).
//
// O assistente de "Novo trabalho" e as Configurações usam estas funções: elas
// decidem quais elementos ligam sozinhos para cada tipo e norma, limpam o que a
// pessoa digitou e montam o trabalho que vai para o arquivo. A forma de cada
// elemento na página não está aqui: vem do modelo da norma.

import type { Trabalho } from "../arquivos/formato";
import {
  aberturaVazia,
  adicionarAAbertura,
  documentoVazio,
  ordenarAbertura,
  type Abertura,
  type DadosDoTrabalho,
  type Data,
  type Resumo,
  type TipoDeTrabalho,
} from "../documento/modelo";
import { existeNoModelo, type ElementoDaAbertura } from "../conversor/abertura";
import type { ModeloResolvido } from "../modelos/tipos";

/** O nome de cada tipo e uma frase que o explica, como aparecem no assistente. */
export const TIPOS: Array<{ tipo: TipoDeTrabalho; nome: string; explicacao: string }> = [
  { tipo: "disciplina", nome: "Trabalho de disciplina", explicacao: "Um trabalho entregue ao professor de uma disciplina." },
  { tipo: "estagio", nome: "Relatório de estágio", explicacao: "O relato do que você viveu e aprendeu no estágio." },
  { tipo: "artigo", nome: "Artigo", explicacao: "Um texto curto para uma revista ou um evento." },
  { tipo: "tcc", nome: "Trabalho de conclusão de curso", explicacao: "O trabalho final do curso (TCC)." },
];

export const nomeDoTipo = (tipo: TipoDeTrabalho) => TIPOS.find((t) => t.tipo === tipo)?.nome ?? tipo;

/**
 * Quais elementos ligam sozinhos num trabalho novo. É só o ponto de partida:
 * a pessoa liga e desliga o que quiser nas Configurações.
 *   - ABNT: trabalho de disciplina, estágio e TCC começam com capa e folha de
 *     rosto; estágio e TCC também com sumário. O artigo começa sem nenhum.
 *   - APA: a página de título liga em todos os tipos.
 * Só liga o que a norma tem (a APA não tem capa nem sumário).
 */
export function aberturaPadrao(tipo: TipoDeTrabalho, modelo: ModeloResolvido): Abertura {
  const tem = existeNoModelo(modelo);
  let a = aberturaVazia();
  const completo = tipo !== "artigo";
  if (completo && tem("capa")) a = adicionarAAbertura(a, "capa");
  if (completo && tem("folhaDeRosto")) a = adicionarAAbertura(a, "folhaDeRosto");
  if (tem("paginaDeTitulo")) a = adicionarAAbertura(a, "paginaDeTitulo");
  if ((tipo === "estagio" || tipo === "tcc") && tem("sumario")) a = adicionarAAbertura(a, "sumario");
  return a;
}

/** Os elementos que a norma tem (o que as Configurações podem ligar). */
export function elementosDaNorma(modelo: ModeloResolvido): Record<ElementoDaAbertura["tipo"], boolean> {
  const tem = existeNoModelo(modelo);
  return {
    capa: tem("capa"),
    folhaDeRosto: tem("folhaDeRosto"),
    paginaDeTitulo: tem("paginaDeTitulo"),
    dedicatoria: tem("dedicatoria"),
    agradecimentos: tem("agradecimentos"),
    epigrafe: tem("epigrafe"),
    resumo: tem("resumo"),
    sumario: tem("sumario"),
  };
}

/** Tira espaços sobrando; texto vazio vira undefined. */
const limpo = (s: string | undefined): string | undefined => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t ? t : undefined;
};

/**
 * Os dados como a pessoa digitou, arrumados: sem espaços sobrando, sem autor
 * em branco, campos vazios saem do objeto (o arquivo guarda só o que existe).
 * A natureza mantém as quebras e só perde os espaços das pontas.
 */
export function limparDados(d: DadosDoTrabalho): DadosDoTrabalho {
  const saida: DadosDoTrabalho = {
    tipo: d.tipo,
    idioma: d.idioma,
    titulo: limpo(d.titulo) ?? "",
    autores: d.autores.map((a) => limpo(a)).filter((a): a is string => !!a),
  };
  const texto = { subtitulo: d.subtitulo, curso: d.curso, instituicao: d.instituicao, orientador: d.orientador, cidade: d.cidade, disciplina: d.disciplina } as const;
  for (const [chave, valor] of Object.entries(texto)) {
    const v = limpo(valor);
    if (v) (saida as unknown as Record<string, unknown>)[chave] = v;
  }
  if (d.ano !== undefined && Number.isInteger(d.ano)) saida.ano = d.ano;
  if (d.dataDeEntrega) saida.dataDeEntrega = d.dataDeEntrega;
  const natureza = d.natureza?.trim();
  if (natureza) saida.natureza = natureza;
  return saida;
}

/** O que falta para o assistente seguir (nomes e frases em português simples). Vazio: pode seguir. */
export function problemasDosDados(d: DadosDoTrabalho): string[] {
  const problemas: string[] = [];
  if (!limpo(d.titulo)) problemas.push("Escreva o título do trabalho.");
  if (!d.autores.some((a) => limpo(a))) problemas.push("Escreva o nome de pelo menos um autor.");
  if (d.ano !== undefined && (!Number.isInteger(d.ano) || d.ano < 1900 || d.ano > 2200)) problemas.push("O ano parece errado. Escreva com quatro números, como 2026.");
  return problemas;
}

/** O ano de agora, para o trabalho novo já vir com ele. */
export const anoDeHoje = (agora = new Date()) => agora.getFullYear();

/** Lê o ano digitado: vazio vira undefined; texto que não é número vira NaN (e o problema aparece). */
export function lerAno(texto: string): number | undefined {
  const t = texto.trim();
  if (!t) return undefined;
  return /^\d{1,4}$/.test(t) ? Number(t) : Number.NaN;
}

/** Palavras-chave digitadas: separadas por ponto e vírgula, vírgula ou linha nova. */
export function palavrasChaveDoTexto(texto: string): string[] {
  return texto
    .split(/[;,\n]/)
    .map((p) => p.replace(/\s+/g, " ").trim().replace(/\.$/, ""))
    .filter(Boolean);
}

/** O resumo do assistente (um parágrafo, no idioma do trabalho), ou null se a pessoa pulou. */
export function resumoDoAssistente(idioma: string, texto: string, palavras: string): Resumo | null {
  const t = texto.replace(/\s+/g, " ").trim();
  const chaves = palavrasChaveDoTexto(palavras);
  if (!t && chaves.length === 0) return null;
  return { tipo: "resumo", idioma, trechos: t ? [{ texto: t }] : [], palavrasChave: chaves };
}

/** O texto de um resumo de volta para o campo (palavras separadas por ponto e vírgula). */
export const palavrasChaveParaTexto = (p: string[]) => p.join("; ");

export interface RespostasDoAssistente {
  dados: DadosDoTrabalho;
  resumo: Resumo | null;
}

/**
 * O trabalho novo, com o que o assistente coletou. O nome do arquivo é o título.
 * O texto começa com um parágrafo vazio, como sempre.
 */
export function trabalhoNovo(r: RespostasDoAssistente, modelo: ModeloResolvido, agora = new Date()): Trabalho {
  const dados = limparDados(r.dados);
  const iso = agora.toISOString();
  const documento = documentoVazio();
  documento.dados = dados;
  documento.abertura = aberturaPadrao(dados.tipo, modelo);
  if (r.resumo) documento.abertura = { ...documento.abertura, blocos: ordenarAbertura([...documento.abertura.blocos, r.resumo]) };
  return {
    nome: dados.titulo.slice(0, 80) || "Trabalho sem título",
    modelo,
    ajustes: {},
    criadoEm: iso,
    modificadoEm: iso,
    documento,
  };
}

/** Uma data digitada no campo de data do navegador ("2026-11-22") e de volta. */
export function dataDoCampo(texto: string): Data | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  return m ? { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) } : undefined;
}

export function dataParaCampo(d: Data | undefined): string {
  if (!d?.mes || !d.dia) return "";
  return `${String(d.ano).padStart(4, "0")}-${String(d.mes).padStart(2, "0")}-${String(d.dia).padStart(2, "0")}`;
}

/** Os idiomas que o resumo pode ter (os que o conversor sabe rotular). */
export const IDIOMAS_DO_RESUMO: Array<{ codigo: string; nome: string }> = [
  { codigo: "pt-BR", nome: "Português" },
  { codigo: "en", nome: "Inglês" },
  { codigo: "es", nome: "Espanhol" },
  { codigo: "fr", nome: "Francês" },
  { codigo: "it", nome: "Italiano" },
  { codigo: "de", nome: "Alemão" },
];

export const nomeDoIdioma = (codigo: string) => IDIOMAS_DO_RESUMO.find((i) => i.codigo === codigo)?.nome ?? codigo;

/** Um resumo novo, num idioma que o trabalho ainda não tem (ou o primeiro da lista, se todos já têm). */
export function idiomaDoProximoResumo(jaTem: string[]): string {
  return IDIOMAS_DO_RESUMO.find((i) => !jaTem.includes(i.codigo))?.codigo ?? IDIOMAS_DO_RESUMO[0].codigo;
}
