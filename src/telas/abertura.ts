// A Abertura em blocos (etapa 3, parte 3a), em funções puras: o nome de cada
// bloco, o que aparece nele (as peças da capa, da folha de rosto e da página
// de título), o que dá para adicionar e como uma peça editada muda os dados.
// A tela (AberturaEmBlocos.tsx) só desenha.
//
// As peças mostram os dados do trabalho (decisão do Francisco, 24/11/2026: um
// dado só). Mudar o autor na capa muda na folha de rosto e nas Configurações ›
// Dados, porque é o mesmo dado. As peças que aparecem seguem os "campos" do
// modelo, como o PDF.

import {
  ORDEM_DA_ABERTURA,
  type Abertura,
  type BlocoDaAbertura,
  type DadosDoTrabalho,
  type TipoDaAbertura,
} from "../documento/modelo";
import {
  anoDoTrabalho,
  comecaEmPaginaNovaNaAbertura,
  dataPorExtenso,
  existeNoModelo,
  naturezaDoTrabalho,
  paginaNovaPodeSair,
  PODEM_FICAR_SEM_PAGINA_NOVA,
} from "../conversor/abertura";
import { valorEfetivo } from "../modelos/herdar";
import type { ModeloResolvido } from "../modelos/tipos";
import { IDIOMAS_DO_RESUMO, dataDoCampo, dataParaCampo, lerAno, nomeDoIdioma } from "./trabalho";

/** O nome de cada bloco, como aparece na etiqueta e nos menus. */
export const NOMES_DA_ABERTURA: Record<TipoDaAbertura, string> = {
  capa: "Capa",
  folhaDeRosto: "Folha de rosto",
  paginaDeTitulo: "Página de título",
  dedicatoria: "Dedicatória",
  agradecimentos: "Agradecimentos",
  epigrafe: "Epígrafe",
  resumo: "Resumo",
  sumario: "Sumário",
};

/** "Resumo (Inglês)"; os outros, só o nome. */
export function nomeDoBlocoDaAbertura(b: BlocoDaAbertura): string {
  return b.tipo === "resumo" ? `Resumo (${nomeDoIdioma(b.idioma)})` : NOMES_DA_ABERTURA[b.tipo];
}

/**
 * Uma chave que não muda enquanto o bloco existe, para a tela não trocar o
 * texto de um bloco pelo de outro quando um sai: o tipo e, nos resumos, o
 * idioma e quantos do mesmo idioma vêm antes.
 */
export function chaveDoBloco(blocos: BlocoDaAbertura[], indice: number): string {
  const b = blocos[indice];
  if (b.tipo !== "resumo") return b.tipo;
  const antes = blocos.slice(0, indice).filter((x) => x.tipo === "resumo" && x.idioma === b.idioma).length;
  return `resumo-${b.idioma}-${antes}`;
}

/**
 * O aviso do bloco, quando ele não vai sair no PDF: a norma não tem o elemento
 * ("A APA não tem: não sai no PDF") ou o bloco ainda está vazio.
 */
export function situacaoDoBloco(b: BlocoDaAbertura, modelo: ModeloResolvido, nomeDaNorma: string): string | null {
  if (!existeNoModelo(modelo)(b.tipo)) {
    const nome = `${artigo(b.tipo)} ${NOMES_DA_ABERTURA[b.tipo].toLowerCase()}`;
    return b.tipo === "agradecimentos"
      ? `A ${nomeDaNorma} não tem ${nome}: ficam guardados no trabalho, mas não saem no PDF.`
      : `A ${nomeDaNorma} não tem ${nome}: fica guardad${genero(b.tipo)} no trabalho, mas não sai no PDF.`;
  }
  const vazio = (ps: { texto: string }[][]) => !ps.some((p) => p.some((t) => t.texto.trim()));
  if ((b.tipo === "dedicatoria" || b.tipo === "agradecimentos" || b.tipo === "epigrafe") && vazio(b.paragrafos)) return "Vazio: só sai no PDF depois de ter texto.";
  if (b.tipo === "resumo" && vazio([b.trechos])) return "Vazio: só sai no PDF depois de ter texto.";
  return null;
}

const FEMININOS = new Set<TipoDaAbertura>(["capa", "folhaDeRosto", "paginaDeTitulo", "dedicatoria", "epigrafe"]);
const genero = (t: TipoDaAbertura) => (FEMININOS.has(t) ? "a" : "o");
const artigo = (t: TipoDaAbertura) => (t === "agradecimentos" ? "os" : FEMININOS.has(t) ? "a" : "o");

// ---------------------------------------------------------------------------
// A página nova entre os blocos (como a linha "Página nova" acima dos títulos)

export interface LinhaDePaginaNova {
  /** A linha some com Delete (vira "só este: sem página nova"). */
  podeSair: boolean;
}

/**
 * A linha "Página nova" acima de cada bloco que começa numa página nova no PDF.
 * O primeiro bloco não tem (a abertura já começa numa página), nem um bloco que
 * a norma não tem (ele não sai no PDF). Depois de um elemento que ocupa a folha
 * inteira, a linha aparece, mas não sai (a página nova vem de qualquer jeito).
 */
export function linhasDePaginaNova(blocos: BlocoDaAbertura[], modelo: ModeloResolvido): Array<LinhaDePaginaNova | null> {
  const tem = existeNoModelo(modelo);
  let anterior: TipoDaAbertura | undefined;
  return blocos.map((b) => {
    if (!tem(b.tipo)) return null;
    const antes = anterior;
    anterior = b.tipo;
    if (!antes || !comecaEmPaginaNovaNaAbertura(modelo, b.tipo, b.excecoes)) return null;
    return { podeSair: paginaNovaPodeSair(antes, b.tipo) };
  });
}

/** Se o ⚙ do bloco oferece "Começar em página nova" (agradecimentos, resumos e sumário). */
export const temEscolhaDePaginaNova = (b: BlocoDaAbertura) => PODEM_FICAR_SEM_PAGINA_NOVA.has(b.tipo);

/**
 * O bloco com ou sem página nova, como "só este": igual ao modelo, a exceção
 * sai; diferente, fica escrita no bloco ("página nova": "não").
 */
export function comPaginaNova<T extends BlocoDaAbertura>(b: T, modelo: ModeloResolvido, quer: boolean): T {
  const padrao = comecaEmPaginaNovaNaAbertura(modelo, b.tipo, undefined);
  const excecoes = { ...(b.excecoes ?? {}) };
  delete excecoes["página nova"];
  if (quer !== padrao) excecoes["página nova"] = quer ? "sim" : "não";
  const novo = { ...b };
  if (Object.keys(excecoes).length) novo.excecoes = excecoes;
  else delete novo.excecoes;
  return novo;
}

// ---------------------------------------------------------------------------
// "Adicionar à abertura"

export interface OpcaoDeAdicionar {
  tipo: TipoDaAbertura;
  /** Só nos resumos. */
  idioma?: string;
  rotulo: string;
  /** Há texto guardado: o bloco volta com ele. */
  guardado: boolean;
  /** A norma não tem: o bloco entra, mas não sai no PDF. */
  foraDaNorma: boolean;
}

/**
 * O que dá para pôr na abertura: os elementos que o modelo tem e que o
 * trabalho ainda não tem (um resumo para cada idioma que falta), mais o que
 * estiver guardado (mesmo que a norma não tenha: o texto é da pessoa). Na
 * ordem da norma.
 */
export function opcoesDeAdicionar(abertura: Abertura, modelo: ModeloResolvido): OpcaoDeAdicionar[] {
  const tem = existeNoModelo(modelo);
  const saida: OpcaoDeAdicionar[] = [];
  for (const tipo of ORDEM_DA_ABERTURA) {
    if (tipo === "resumo") {
      const usados = new Set(abertura.blocos.flatMap((b) => (b.tipo === "resumo" ? [b.idioma] : [])));
      const guardados = new Set(abertura.guardados.flatMap((g) => (g.tipo === "resumo" ? [g.idioma] : [])));
      for (const { codigo } of IDIOMAS_DO_RESUMO) {
        if (usados.has(codigo) || !(tem("resumo") || guardados.has(codigo))) continue;
        saida.push({ tipo, idioma: codigo, rotulo: `Resumo (${nomeDoIdioma(codigo)})`, guardado: guardados.has(codigo), foraDaNorma: !tem("resumo") });
      }
      // Um resumo guardado num idioma que a lista não tem (veio de outro lugar) também volta.
      for (const g of abertura.guardados) {
        if (g.tipo === "resumo" && !usados.has(g.idioma) && !IDIOMAS_DO_RESUMO.some((i) => i.codigo === g.idioma)) {
          saida.push({ tipo, idioma: g.idioma, rotulo: `Resumo (${nomeDoIdioma(g.idioma)})`, guardado: true, foraDaNorma: !tem("resumo") });
        }
      }
      continue;
    }
    if (abertura.blocos.some((b) => b.tipo === tipo)) continue;
    const guardado = abertura.guardados.some((g) => g.tipo === tipo);
    if (!tem(tipo) && !guardado) continue;
    saida.push({ tipo, rotulo: NOMES_DA_ABERTURA[tipo], guardado, foraDaNorma: !tem(tipo) });
  }
  return saida;
}

// ---------------------------------------------------------------------------
// As peças da capa, da folha de rosto e da página de título

/** Os dados que uma peça mostra e muda. */
export type CampoDaPeca = "instituicao" | "curso" | "autores" | "titulo" | "subtitulo" | "natureza" | "orientador" | "cidade" | "ano" | "disciplina" | "dataDeEntrega";

export interface Peca {
  campo: CampoDaPeca;
  rotulo: string;
  /** Como a peça aparece agora (o que sai no PDF). Vazio quando falta o dado. */
  valor: string;
  /** O que vai no campo ao editar (autores, um por linha; a data como no campo de data). */
  editavel: string;
  /** Frase curta embaixo do campo, quando ajuda. */
  dica?: string;
  /** O dado não sai no PDF (versão sem identificação). */
  escondido?: boolean;
  /** A peça é uma frase montada pelo Apud, que a pessoa pode trocar (a natureza). */
  montada?: boolean;
  /** Campo de várias linhas. */
  linhas?: boolean;
}

export interface Faixa {
  nome: "Topo" | "Meio" | "Pé";
  pecas: Peca[];
}

export type FolhaComPecas = "capa" | "folhaDeRosto" | "paginaDeTitulo";

/** Os campos do modelo para a folha ("instituição (opcional)" vira "instituição"). Vazio: todos. */
function camposDoModelo(modelo: ModeloResolvido, elemento: string, propriedade = "campos"): string[] {
  const v = valorEfetivo(modelo, elemento, propriedade)?.valor;
  return v?.tipo === "lista" ? v.itens.map((c) => c.replace(" (opcional)", "")) : [];
}

/**
 * As peças de cada folha, em três faixas, na ordem em que saem no PDF. Só
 * aparecem as peças que o modelo põe na folha (os "campos" dele), como no PDF.
 */
export function faixasDaFolha(tipo: FolhaComPecas, dados: DadosDoTrabalho, modelo: ModeloResolvido, semIdentificacao: boolean): Faixa[] {
  const p = (campo: CampoDaPeca, rotulo: string, extra: Partial<Peca> = {}): Peca => ({ campo, rotulo, ...valorDaPeca(campo, dados), ...extra });
  const autoria = p("autores", dados.autores.length > 1 ? "Autores" : "Autoria", {
    linhas: true,
    dica: "Um nome completo por linha, na ordem em que devem sair.",
    ...(semIdentificacao ? { escondido: true } : {}),
  });
  const titulo = p("titulo", "Título");
  const subtitulo = p("subtitulo", "Subtítulo", { dica: "Sai depois do título, separado por dois-pontos." });
  const cidade = p("cidade", "Cidade");
  const ano = p("ano", "Ano", { dica: "Com quatro números, como 2026." });
  const faixas = (topo: Peca[], meio: Peca[], pe: Peca[]): Faixa[] =>
    (
      [
        { nome: "Topo", pecas: topo },
        { nome: "Meio", pecas: meio },
        { nome: "Pé", pecas: pe },
      ] as Faixa[]
    ).filter((f) => f.pecas.length);

  if (tipo === "capa") {
    const c = camposDoModelo(modelo, "abertura.capa");
    const quer = (x: string) => c.length === 0 || c.includes(x);
    return faixas(
      [...(quer("instituição") ? [p("instituicao", "Instituição"), p("curso", "Curso")] : []), ...(quer("autor") ? [autoria] : [])],
      quer("título") ? [titulo, subtitulo] : [],
      [...(quer("cidade") ? [cidade] : []), ...(quer("ano") ? [ano] : [])],
    );
  }
  if (tipo === "folhaDeRosto") {
    const c = camposDoModelo(modelo, "abertura.folhaDeRosto");
    const quer = (x: string) => c.length === 0 || c.includes(x);
    const rotulo = valorEfetivo(modelo, "abertura.folhaDeRosto", dados.tipo === "disciplina" ? "rótulo do professor" : "rótulo do orientador")?.texto ?? "";
    const orientador = p("orientador", rotulo.replace(/:\s*$/, "") || "Orientação", semIdentificacao ? { escondido: true } : {});
    const natureza = p("natureza", "Natureza do trabalho", {
      linhas: true,
      montada: !dados.natureza?.trim(),
      dica: "Deixe em branco: o Apud monta a frase com o tipo, a disciplina, o curso e a instituição. Se você escrever a sua, vale a sua.",
    });
    return faixas(
      quer("autor") ? [autoria] : [],
      [...(quer("título") ? [titulo, subtitulo] : []), ...(quer("natureza") ? [natureza] : []), ...(quer("orientador") ? [orientador] : [])],
      [...(quer("cidade") ? [cidade] : []), ...(quer("ano") ? [ano] : [])],
    );
  }
  // Página de título (APA): tudo centralizado no alto da página.
  const profissional = dados.tipo === "artigo" && valorEfetivo(modelo, "abertura.paginaDeTitulo", "modo quando o trabalho é artigo")?.texto === "profissional";
  const c = camposDoModelo(modelo, "abertura.paginaDeTitulo", profissional ? "campos no modo profissional" : "campos no modo estudante");
  const quer = (x: string) => c.length === 0 || c.includes(x);
  return faixas(
    [
      ...(quer("título") ? [titulo, subtitulo] : []),
      ...(quer("autor") || quer("autores") ? [autoria] : []),
      ...(quer("departamento e universidade") || quer("afiliação") ? [p("curso", "Curso"), p("instituicao", "Instituição")] : []),
      ...(quer("código e nome da disciplina") ? [p("disciplina", "Disciplina")] : []),
      ...(quer("professor") ? [p("orientador", "Professor(a)", semIdentificacao ? { escondido: true } : {})] : []),
      ...(quer("data de entrega") ? [p("dataDeEntrega", "Data de entrega")] : []),
    ],
    [],
    [],
  );
}

/** O valor que a peça mostra e o que vai no campo ao editar. */
function valorDaPeca(campo: CampoDaPeca, d: DadosDoTrabalho): { valor: string; editavel: string } {
  switch (campo) {
    case "autores": {
      const nomes = d.autores.map((a) => a.trim()).filter(Boolean);
      return { valor: nomes.join("; "), editavel: nomes.join("\n") };
    }
    case "ano": {
      const ano = anoDoTrabalho(d);
      return { valor: ano ? String(ano) : "", editavel: d.ano !== undefined && Number.isFinite(d.ano) ? String(d.ano) : "" };
    }
    case "dataDeEntrega":
      return { valor: d.dataDeEntrega ? dataPorExtenso(d.dataDeEntrega) : "", editavel: dataParaCampo(d.dataDeEntrega) };
    case "natureza":
      return { valor: naturezaDoTrabalho(d), editavel: d.natureza ?? "" };
    default: {
      const v = (d[campo] ?? "").trim();
      return { valor: v, editavel: d[campo] ?? "" };
    }
  }
}

export type MudancaDaPeca = { ok: true; dados: DadosDoTrabalho } | { ok: false; erro: string };

/**
 * Os dados com a peça mudada: os autores, um por linha; o ano conferido; a
 * data como vem do campo de data. Texto em branco tira o dado (a natureza em
 * branco volta a ser montada pelo Apud). O título não pode ficar vazio.
 */
export function mudarPeca(d: DadosDoTrabalho, campo: CampoDaPeca, escrito: string): MudancaDaPeca {
  const limpo = escrito.replace(/[ \t]+/g, " ").trim();
  switch (campo) {
    case "autores":
      return { ok: true, dados: { ...d, autores: escrito.split("\n").map((a) => a.replace(/\s+/g, " ").trim()).filter(Boolean) } };
    case "titulo":
      if (!limpo) return { ok: false, erro: "O título do trabalho não pode ficar vazio." };
      return { ok: true, dados: { ...d, titulo: limpo.replace(/\s+/g, " ") } };
    case "ano": {
      const ano = lerAno(limpo);
      if (ano !== undefined && (Number.isNaN(ano) || ano < 1900 || ano > 2200)) return { ok: false, erro: "Escreva o ano com quatro números, como 2026." };
      const novo = { ...d };
      if (ano === undefined) delete novo.ano;
      else novo.ano = ano;
      return { ok: true, dados: novo };
    }
    case "dataDeEntrega": {
      const novo = { ...d };
      const data = dataDoCampo(limpo);
      if (data) novo.dataDeEntrega = data;
      else delete novo.dataDeEntrega;
      return { ok: true, dados: novo };
    }
    case "natureza": {
      const novo = { ...d };
      const t = escrito.trim();
      if (t) novo.natureza = t;
      else delete novo.natureza;
      return { ok: true, dados: novo };
    }
    default: {
      const novo = { ...d };
      if (limpo) novo[campo] = limpo.replace(/\s+/g, " ");
      else delete novo[campo];
      return { ok: true, dados: novo };
    }
  }
}
