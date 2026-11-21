// Prepara as referências para o Typst conforme o perfil da norma.
//
// O CSL (formato de estilos do Zotero) não tem campos para algumas regras da
// ABNT, como o subtítulo sem destaque e a data incerta. Aqui o Apud arruma os
// dados antes de chamar o estilo. Cada ajuste só acontece se o perfil tiver a
// regra correspondente, então o mesmo código serve para ABNT e APA.
//
// Este é o primeiro pedaço do motor de citações. A etapa do motor vai
// completá-lo (cadastro de referências, DOI, ISBN etc.).

import { niveisDaInstituicao } from "../documento/referencias";
import type { PerfilResolvido } from "../perfis";
import { semAcentos } from "../perfis/texto";

/** Uma referência no formato que o Typst lê (hayagriva), com os campos extras do Apud. */
export type Referencia = Record<string, unknown>;

/** Artigos e palavras de uma sílaba que, no início do título, vão junto com a palavra seguinte. */
const PALAVRAS_QUE_VAO_JUNTO = new Set([
  "o", "a", "os", "as", "um", "uma", "uns", "umas",
  "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
  "por", "com", "sem", "sob", "e", "que", "se", "ao", "aos", "à", "às",
]);

/** As palavras que formam a "primeira palavra" do título na ABNT (com o artigo, se houver). */
export function primeirasPalavras(titulo: string): { inicio: string; resto: string } {
  const palavras = titulo.trim().split(/\s+/);
  let n = 1;
  while (n < palavras.length && PALAVRAS_QUE_VAO_JUNTO.has(palavras[n - 1].toLowerCase())) n++;
  return { inicio: palavras.slice(0, n).join(" "), resto: palavras.slice(n).join(" ") };
}

const temRegra = (perfil: PerfilResolvido, chave: string) => {
  const r = perfil.regras.get(chave);
  return r !== undefined && r.situacao.tipo !== "desligada";
};

function primeiraMaiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase("pt-BR") + texto.slice(1);
}

/** "[201-?]" vira o ano 2010, só para ordenar a lista. */
function anoDaDataIncerta(texto: string): number | undefined {
  const digitos = texto.match(/\d[\d-]{3}/)?.[0];
  return digitos ? Number(digitos.replace(/-/g, "0")) : undefined;
}

/** Partículas que ficam no fim dos prenomes: "Oliveira, Lucas Freitas de". */
export const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e", "d'"]);

/**
 * "Oliveira, Lucas Freitas de" vira um nome com a partícula separada. Sem
 * isso, a APA abrevia a partícula como se fosse prenome (L. F. d.). Com ela
 * separada, sai "Oliveira, L. F. de" na APA e "OLIVEIRA, Lucas Freitas de" na ABNT.
 */
function separarParticula(nome: unknown): unknown {
  if (typeof nome !== "string" || !nome.includes(",")) return nome;
  const [sobrenome, prenomes = ""] = nome.split(",").map((p) => p.trim());
  const palavras = prenomes.split(/\s+/);
  let n = palavras.length;
  while (n > 1 && PARTICULAS.has(palavras[n - 1])) n--;
  if (n === palavras.length) return nome;
  return { name: sobrenome, "given-name": palavras.slice(0, n).join(" "), prefix: palavras.slice(n).join(" ") };
}

/** Nome como texto, "Sobrenome, Prenomes", também para os nomes já separados. */
export function nomeComoTexto(nome: unknown): string {
  if (typeof nome === "string") return nome;
  const n = nome as { name: string; "given-name"?: string; prefix?: string };
  const prenomes = [n["given-name"], n.prefix].filter(Boolean).join(" ");
  return prenomes ? `${n.name}, ${prenomes}` : n.name;
}

/**
 * "Anais do Seminário de Diamantina" vira "Anais": a ABNT mostra só a
 * designação, seguida de [...] (NBR 6023:2025, 7.8.4).
 */
export function designacaoDosAnais(titulo: string): { designacao: string; cortou: boolean } {
  const partes = titulo.split(/\s+(?=d[oa]s?\s)/);
  return { designacao: partes[0], cortou: partes.length > 1 };
}

/** Tipos cujo título sai sem destaque na ABNT (o destaque vai na obra maior). */
const TIPOS_COM_TITULO_SEM_DESTAQUE = new Set(["chapter", "article", "legislation"]);

const maiusculas = (s: string) => s.toLocaleUpperCase("pt-BR");

/**
 * O sobrenome em maiúsculas: "Silva, João" vira "SILVA, João". Instituição:
 * o nome inteiro, ou só a entidade principal (BRASIL. Ministério da Saúde).
 */
function emMaiusculas(nome: unknown, soAPrincipal: boolean): unknown {
  if (typeof nome === "string") {
    const virgula = nome.indexOf(",");
    return virgula < 0 ? maiusculas(nome) : maiusculas(nome.slice(0, virgula)) + nome.slice(virgula);
  }
  const n = nome as { name: string; "given-name"?: string };
  if (n["given-name"] !== undefined) return { ...n, name: maiusculas(n.name) };
  // Instituição ({ name }), como em hayagriva.ts.
  if (!soAPrincipal) return { ...n, name: maiusculas(n.name) };
  const [principal, ...subordinadas] = niveisDaInstituicao(n.name);
  return { ...n, name: [maiusculas(principal), ...subordinadas].join(". ") };
}

function temAutor(ref: Referencia): boolean {
  return ref.author !== undefined || ref.editor !== undefined;
}

function prepararUma(original: Referencia, perfil: PerfilResolvido): Referencia {
  const ref: Referencia = structuredClone(original);
  const pai = (ref.parent ?? undefined) as Referencia | undefined;
  // ABNT: a rede social não leva o tipo de postagem ([Vídeo] é da APA).
  if (ref.type === "post" && perfil.identificacao.norma === "ABNT") delete ref.genre;
  // O tipo do trabalho (Tese, Nota Técnica), antes de o subtítulo ocupar o campo genre.
  const tipoDoTrabalho = ref.genre;
  const subtituloSemDestaque = temRegra(perfil, "referências, destaque do subtítulo");
  const tituloComMaiusculaSoNoInicio = temRegra(perfil, "referências, título da obra");

  // Obra sem autor (ABNT): entra pelo título, com a primeira palavra em
  // maiúsculas, e a chamada usa a primeira palavra e [...].
  if (!temAutor(ref) && temRegra(perfil, "citação, obra sem autor")) {
    const completo = ref.subtitle ? `${ref.title}: ${ref.subtitle}` : String(ref.title);
    delete ref.subtitle;
    const { inicio, resto } = primeirasPalavras(completo);
    ref.title = {
      value: [inicio.toLocaleUpperCase("pt-BR"), resto].filter(Boolean).join(" "),
      short: `${inicio} [...]`,
    };
  }

  // Subtítulo: na ABNT, o de um título com destaque vai para "genre", que o
  // estilo escreve sem destaque (**Psicologia clínica**: fundamentos). O de
  // capítulos, artigos, trabalhos em evento, notícias e leis, cujo título já
  // sai sem destaque, junta ao título depois de dois-pontos: assim ele não se
  // confunde com o subtítulo do livro ou da revista. Nas outras normas, sempre junta.
  for (const alvo of [ref, pai]) {
    if (!alvo || alvo.subtitle === undefined) continue;
    const tituloSemDestaque = alvo === ref && TIPOS_COM_TITULO_SEM_DESTAQUE.has(String(ref.type));
    if (subtituloSemDestaque && !tituloSemDestaque) {
      alvo.genre = alvo.subtitle;
    } else {
      const sub = tituloComMaiusculaSoNoInicio ? primeiraMaiuscula(String(alvo.subtitle)) : alvo.subtitle;
      alvo.title = `${alvo.title}: ${sub}`;
    }
    delete alvo.subtitle;
  }

  // Data incerta: na ABNT sai como escrita ([201-?]); na APA, sem data (s.d.).
  if (ref["uncertain-date"] !== undefined) {
    const escrita = String(ref["uncertain-date"]);
    delete ref["uncertain-date"];
    if (temRegra(perfil, "referências, data provável")) {
      ref["call-number"] = escrita;
      const ano = anoDaDataIncerta(escrita);
      if (ano) ref.date = ano;
    }
  }

  // Número eletrônico do artigo sem página.
  if (ref["e-number"] !== undefined) {
    ref["serial-number"] = { ...((ref["serial-number"] as object) ?? {}), serial: String(ref["e-number"]) };
    delete ref["e-number"];
  }

  // Cidade da revista.
  if (pai?.location !== undefined) {
    pai.publisher = { ...((pai.publisher as object) ?? {}), location: pai.location };
    delete pai.location;
  }

  // Partícula no fim dos prenomes (de, da, dos...), e o sobrenome em maiúsculas
  // (ABNT). O Apud escreve as maiúsculas, e não o estilo, por causa da
  // instituição com subordinação: só a entidade principal vai em maiúsculas
  // (BRASIL. Ministério da Saúde), e o estilo só sabe pôr o nome inteiro.
  const sobrenomeEmMaiusculas = perfil.regras.get("referências, sobrenome")?.texto === "maiúsculas";
  const soAPrincipal = temRegra(perfil, "referências, entidade subordinada");
  for (const alvo of [ref, pai]) {
    for (const papel of ["author", "editor"]) {
      if (!alvo || alvo[papel] === undefined) continue;
      const nomes = alvo[papel];
      const arrumar = (n: unknown) => {
        const separado = separarParticula(n);
        return sobrenomeEmMaiusculas ? emMaiusculas(separado, soAPrincipal) : separado;
      };
      alvo[papel] = Array.isArray(nomes) ? nomes.map(arrumar) : arrumar(nomes);
    }
  }

  const abnt = perfil.identificacao.norma === "ABNT";

  // Tese, dissertação, TCC: tipo do trabalho e grau.
  // ABNT: "Tese (Doutorado em Psicologia)", no campo archive (genre já guarda o
  // subtítulo). APA: "Tese de doutorado", no campo genre.
  if (ref.type === "thesis" && ref.degree !== undefined) {
    const tipo = String(tipoDoTrabalho ?? "Tese");
    const grau = String(ref.degree);
    if (abnt) {
      ref.archive = `${tipo} (${grau})`;
      if (ref.genre === tipoDoTrabalho) delete ref.genre;
    } else {
      ref.genre = `${tipo} de ${grau.split(/\s+/)[0].toLocaleLowerCase("pt-BR")}`;
    }
    delete ref.degree;
  }

  // Relatório ou nota técnica de uma série: "(Nota Técnica, n. 103)" na ABNT.
  // A ABNT lê o nome da série em archive (genre já guarda o subtítulo).
  if (ref.type === "report" && abnt && tipoDoTrabalho !== undefined) {
    ref.archive = tipoDoTrabalho;
    if (ref.genre === tipoDoTrabalho) delete ref.genre;
  }

  // Trabalho em evento. O evento é campo do Apud: o Typst não o passa ao CSL.
  // ABNT: "SEMINÁRIO DE DIAMANTINA, 20., 2024, Diamantina" em archive, e os
  // anais só pela designação ("Anais [...]"). APA: o título completo dos anais.
  if (ref.event !== undefined) {
    const evento = ref.event as { name: string; number?: number | string; date?: number | string; location?: string };
    if (abnt) {
      ref.archive = [
        evento.name.toLocaleUpperCase("pt-BR"),
        evento.number !== undefined ? `${evento.number}.` : undefined,
        evento.date,
        evento.location,
      ]
        .filter((x) => x !== undefined && x !== "")
        .join(", ");
      if (pai?.title !== undefined) {
        const { designacao, cortou } = designacaoDosAnais(String(pai.title));
        pai.title = designacao;
        if (cortou) ref["archive-location"] = "[...]";
      }
    }
    delete ref.event;
  }

  // Rede social: o perfil (@jupavan). Vai em archive-location, que os dois
  // estilos leem: "Instagram: @jupavan" na ABNT, "Pavan, J. [@jupavan]" na APA.
  if (ref.handle !== undefined) {
    ref["archive-location"] = String(ref.handle);
    delete ref.handle;
  }

  // APA, quando a revista pede a cidade da editora: "São Paulo: Cortez".
  // Só em livros, relatórios e no livro de um capítulo ou dos anais.
  if (perfil.regras.get("referências, cidade da editora")?.texto === "mostrar") {
    const comEditora = [
      ["book", "anthology", "report"].includes(String(ref.type)) ? ref : undefined,
      pai && ["book", "anthology", "proceedings"].includes(String(pai.type)) ? pai : undefined,
    ];
    for (const alvo of comEditora) {
      const editora = alvo?.publisher as { name?: string; location?: string } | undefined;
      if (editora?.name && editora.location) alvo!.publisher = { name: `${editora.location}: ${editora.name}` };
    }
  }

  // APA: com DOI, o endereço não aparece.
  if (tituloComMaiusculaSoNoInicio) {
    const doi = (ref["serial-number"] as Record<string, unknown> | undefined)?.doi;
    if (doi) delete ref.url;
  }

  return ref;
}

/** O ano como sai na chamada e na lista: "2019", "[201-?]", ou vazio se não há data. */
export function anoDaReferencia(ref: Referencia): string {
  if (ref["call-number"] !== undefined) return String(ref["call-number"]);
  const ano = String(ref.date ?? "").match(/^\d{4}/)?.[0];
  return ano ?? "";
}

/** Identifica as pessoas autoras de uma obra, para saber se duas obras são do mesmo autor. */
export function chaveDosAutores(ref: Referencia, soAPrincipal = false): string {
  const autores = ([] as unknown[]).concat(ref.author ?? ref.editor ?? []);
  return JSON.stringify(
    autores.map((a) => {
      // Instituição com subordinação, na ABNT: a chamada só mostra a entidade principal, então é ela que conta.
      const instituicao = typeof a !== "string" && (a as { "given-name"?: string })["given-name"] === undefined;
      const nome = instituicao && soAPrincipal ? niveisDaInstituicao((a as { name: string }).name)[0] : nomeComoTexto(a);
      return nome.toLowerCase();
    }),
  );
}

function tituloParaOrdenar(ref: Referencia): string {
  const t = ref.title as string | { value: string };
  return (typeof t === "string" ? t : t.value).toLowerCase();
}

/**
 * Mesmo autor e mesmo ano: letras depois do ano (2020a, 2020b), na ordem dos
 * títulos. O Apud calcula as letras e passa o ano já escrito para o estilo
 * CSL, no campo call-number, para a chamada e a lista usarem as mesmas letras.
 */
function marcarLetras(referencias: Record<string, Referencia>, soAPrincipal: boolean) {
  const grupos = new Map<string, Referencia[]>();
  for (const ref of Object.values(referencias)) {
    const ano = anoDaReferencia(ref);
    if (!ano) continue;
    const chave = `${chaveDosAutores(ref, soAPrincipal)}|${ano}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), ref]);
  }
  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue;
    grupo.sort((a, b) => tituloParaOrdenar(a).localeCompare(tituloParaOrdenar(b), "pt-BR"));
    grupo.forEach((ref, i) => {
      ref["call-number"] = `${anoDaReferencia(ref)}${String.fromCharCode(97 + i)}`;
    });
  }
}

/**
 * Chave de ordem alfabética sem acentos, que o estilo CSL usa para ordenar a
 * lista (campo note). Sem ela, o Typst põe "Ávila" depois de "Zé".
 * Ordem: sobrenomes e prenomes (por extenso na ABNT, iniciais na APA), ano e título.
 */
function chaveDeOrdem(ref: Referencia, perfil: PerfilResolvido): string {
  const comIniciais = perfil.regras.get("referências, prenomes")?.texto !== "por extenso";
  const autores = ([] as unknown[]).concat(ref.author ?? ref.editor ?? []).map((a) => {
    if (typeof a !== "string" && !(a as { "given-name"?: string })["given-name"]) return (a as { name: string }).name;
    const [sobrenome, prenomes = ""] = nomeComoTexto(a).split(",").map((p) => p.trim());
    const dados = comIniciais ? prenomes.split(/\s+/).map((p) => p.charAt(0)).join(" ") : prenomes;
    return `${sobrenome} ${dados}`;
  });
  // Na APA, leis entram na lista pelo título, e não pelo autor (Brasil).
  const lei = ref.type === "legislation" && temRegra(perfil, "referências, título da obra");
  const partes = autores.length && !lei ? autores : [tituloParaOrdenar(ref)];
  partes.push(anoDaReferencia(ref) || "0000", tituloParaOrdenar(ref));
  // O separador \u0001 vem antes de qualquer letra: "Silva, J." fica antes de "Silva, J. P.".
  return semAcentos(partes.join("\u0001").toLowerCase());
}

/** Prepara todas as referências citadas no trabalho. */
export function prepararReferencias(
  referencias: Record<string, Referencia>,
  perfil: PerfilResolvido,
): Record<string, Referencia> {
  const preparadas = Object.fromEntries(
    Object.entries(referencias).map(([chave, ref]) => [chave, prepararUma(ref, perfil)]),
  );
  if (temRegra(perfil, "citação, mesmo autor e ano")) marcarLetras(preparadas, temRegra(perfil, "citação, entidade subordinada"));
  for (const ref of Object.values(preparadas)) ref.note = chaveDeOrdem(ref, perfil);
  return preparadas;
}
