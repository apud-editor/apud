// A conversão do Crossref para o modelo do Apud, com respostas de exemplo
// (src/referencias/crossref-exemplos): sem internet, como o ambiente de testes.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { conferirReferencia } from "../arquivos/formato";
import { montarTodas, textoDaCitacao } from "../citacoes/todas";
import { VERSAO_DO_FORMATO, type Documento, type Referencia, type TipoDeReferencia } from "../documento/modelo";
import { carregarPerfil } from "../../scripts/prova-lib";
import { converterCrossref, estaTodoEmMaiusculas, limparTextoDoCrossref, tipoDoApud } from "./crossref";
import { formularioParaReferencia, referenciaParaFormulario } from "./formulario";

const PASTA = join(import.meta.dirname, "crossref-exemplos");
const exemplo = (nome: string): unknown => JSON.parse(readFileSync(join(PASTA, `${nome}.json`), "utf8"));
const sorteio = () => 0.5;

/** Converte e espera que dê certo. */
function converter(resposta: unknown, existentes: string[] = []) {
  const r = converterCrossref(resposta, { existentes, sorteio });
  if (!r.ok) throw new Error("a conversão devia ter dado certo");
  return r;
}

/** Uma ficha mínima do Crossref, com o que o teste quiser por cima. */
const ficha = (message: Record<string, unknown>) => ({
  status: "ok",
  "message-type": "work",
  message: { DOI: "10.1234/teste", type: "journal-article", title: ["Um título"], ...message },
});

describe("os quatro exemplos do Crossref", () => {
  it("artigo: revista, volume, número, páginas, mês, DOI normalizado, título sem marcação", () => {
    const { referencia, avisos } = converter(exemplo("artigo"));
    expect(referencia).toEqual({
      id: referencia.id,
      tipo: "artigo",
      autores: [
        { sobrenome: "Lima", prenomes: "Ana" },
        { sobrenome: "Costa", prenomes: "Bruno" },
        { sobrenome: "Reis", prenomes: "Carla" },
      ],
      titulo: "Supervisão no estágio em saúde mental: um estudo com Grounded Theory & diários de campo",
      data: { ano: 2018, mes: 5 },
      doi: "10.1234/rpa.2018.0012",
      publicacao: { titulo: "Revista de Psicologia Aplicada", volume: "12", numero: "2" },
      paginas: "45-60",
    });
    expect(avisos).toEqual([]);
  });

  it("livro: subtítulo, edição, cidade e editora", () => {
    const { referencia, avisos } = converter(exemplo("livro"));
    expect(referencia).toEqual({
      id: referencia.id,
      tipo: "livro",
      autores: [{ sobrenome: "Silva", prenomes: "João" }],
      titulo: "Psicologia clínica",
      subtitulo: "fundamentos e prática",
      data: { ano: 2019 },
      doi: "10.1234/livro.2019.7",
      edicao: "2",
      cidade: "Rio de Janeiro",
      editora: "Editora Exemplo",
    });
    expect(avisos).toEqual([]);
  });

  it("capítulo: o livro com os organizadores, a editora, a cidade e as páginas (travessão vira hífen)", () => {
    const { referencia, avisos } = converter(exemplo("capitulo"));
    expect(referencia).toEqual({
      id: referencia.id,
      tipo: "capitulo",
      autores: [
        { sobrenome: "Costa", prenomes: "Helena" },
        { sobrenome: "Souza", prenomes: "Marina" },
      ],
      titulo: "O diário de campo na formação do psicólogo",
      data: { ano: 2020, mes: 3, dia: 15 },
      doi: "10.1234/cap.2020.03",
      publicacao: {
        titulo: "Psicologia e saúde coletiva: práticas no SUS",
        organizadores: [
          { sobrenome: "Melo", prenomes: "Rui" },
          { sobrenome: "Nunes", prenomes: "Sara" },
        ],
      },
      cidade: "Porto Alegre",
      editora: "Artmed",
      paginas: "9-30",
    });
    expect(avisos).toEqual([]);
  });

  it("trabalho em evento: o evento (nome, número, ano, cidade), os anais, a editora e uma instituição como autora", () => {
    const { referencia, avisos } = converter(exemplo("evento"));
    expect(referencia).toEqual({
      id: referencia.id,
      tipo: "evento",
      autores: [{ sobrenome: "Matos", prenomes: "Paula" }, { instituicao: "Associação Brasileira de Ensino de Psicologia" }],
      titulo: "Políticas públicas de saúde mental: um balanço",
      data: { ano: 2024, mes: 11 },
      doi: "10.1234/sem.2024.15",
      evento: { nome: "Seminário de Políticas Públicas", numero: "20", ano: "2024", cidade: "Florianópolis, Brasil" },
      publicacao: { titulo: "Anais do 20º Seminário de Políticas Públicas" },
      cidade: "Florianópolis",
      editora: "Universidade Exemplo",
      paginas: "15-30",
    });
    expect(avisos).toEqual([]);
  });

  for (const nome of ["artigo", "livro", "capitulo", "evento"]) {
    describe(nome, () => {
      it("passa pela conferência do arquivo .apud sem mudar nada", () => {
        const { referencia } = converter(exemplo(nome));
        expect(conferirReferencia(referencia)).toEqual(referencia);
      });

      it("abre no formulário e volta igual: tudo o que veio aparece na tela, e nada se perde ao salvar", () => {
        const { referencia } = converter(exemplo(nome));
        const volta = formularioParaReferencia(referenciaParaFormulario(referencia), { existentes: [], base: referencia });
        expect(volta).toEqual({ ok: true, referencia });
      });

      it("o DOI fica guardado, sem 'https://doi.org/' e em minúsculas", () => {
        const { referencia } = converter(exemplo(nome));
        expect(referencia.doi).toMatch(/^10\.1234\/[^A-Z\s]+$/);
      });
    });
  }

  it("o código da referência é novo (nunca repete os que já existem)", () => {
    const existentes = Array.from({ length: 50 }, (_, i) => `r${i}`);
    const r = converterCrossref(exemplo("livro"), { existentes });
    expect(r.ok && existentes.includes(r.referencia.id)).toBe(false);
  });
});

describe("a fonte vinda do DOI funciona no motor, nas duas normas", () => {
  const documento = (referencia: Referencia): Documento => ({
    versao: VERSAO_DO_FORMATO,
    referencias: [referencia],
    blocos: [
      { tipo: "paragrafo", trechos: [{ citacao: { tipo: "narrativa", obra: { referencia: referencia.id } } }] },
      { tipo: "paragrafo", trechos: [{ citacao: { tipo: "parenteses", obras: [{ referencia: referencia.id }] } }] },
    ],
  });

  for (const nome of ["artigo", "livro", "capitulo", "evento"]) {
    it(`${nome}: monta a citação sem aviso`, () => {
      const { referencia } = converter(exemplo(nome));
      const sobrenome = (referencia.autores[0] as { sobrenome: string }).sobrenome;
      for (const arquivo of ["abnt.txt", "apa.txt"]) {
        const montadas = montarTodas(documento(referencia), carregarPerfil(arquivo).perfil);
        expect(montadas).toHaveLength(2);
        for (const m of montadas) {
          expect(textoDaCitacao(m).toLowerCase(), arquivo).toContain(sobrenome.toLowerCase());
          expect(m.avisos, arquivo).toEqual([]);
          expect(m.obras).toEqual([referencia.id]);
        }
      }
    });
  }
});

describe("o tipo", () => {
  const casos: [string, TipoDeReferencia][] = [
    ["journal-article", "artigo"],
    ["book", "livro"],
    ["monograph", "livro"],
    ["edited-book", "livro"],
    ["reference-book", "livro"],
    ["book-chapter", "capitulo"],
    ["book-section", "capitulo"],
    ["book-part", "capitulo"],
    ["reference-entry", "capitulo"],
    ["proceedings-article", "evento"],
    ["dissertation", "tese"],
    ["report", "relatorio"],
    ["report-component", "relatorio"],
  ];
  for (const [crossref, apud] of casos) {
    it(`${crossref} vira ${apud}, sem aviso de tipo`, () => {
      expect(tipoDoApud(crossref)).toEqual({ tipo: apud, aproximado: false });
      const { referencia, avisos } = converter(ficha({ type: crossref }));
      expect(referencia.tipo).toBe(apud);
      expect(avisos).toEqual([]);
    });
  }

  it("pré-publicação (preprint) vira artigo, com aviso, e o repositório ocupa o lugar da revista", () => {
    const { referencia, avisos } = converter(ficha({ type: "posted-content", publisher: "SciELO Preprints" }));
    expect(referencia.tipo).toBe("artigo");
    expect(referencia.publicacao).toEqual({ titulo: "SciELO Preprints" });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain("pré-publicação");
    expect(avisos[0]).toContain("Artigo de revista");
  });

  it("conjunto de dados vira site, com aviso que diz o tipo do Crossref e o escolhido", () => {
    const { referencia, avisos } = converter(ficha({ type: "dataset", publisher: "Repositório Aberto" }));
    expect(referencia.tipo).toBe("site");
    expect(referencia.editora).toBe("Repositório Aberto");
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain("conjunto de dados");
    expect(avisos[0]).toContain("Site");
  });

  it("um tipo que o Apud nunca viu vira site, com aviso com o nome que o Crossref deu", () => {
    const { referencia, avisos } = converter(ficha({ type: "tipo-novo-de-2030" }));
    expect(referencia.tipo).toBe("site");
    expect(avisos[0]).toContain("tipo-novo-de-2030");
  });

  it("número de revista e anais inteiros caem no mais parecido, com aviso", () => {
    expect(converter(ficha({ type: "journal-issue" })).referencia.tipo).toBe("artigo");
    expect(converter(ficha({ type: "proceedings" })).referencia.tipo).toBe("livro");
    expect(converter(ficha({ type: "standard" })).referencia.tipo).toBe("relatorio");
    expect(converter(ficha({ type: "proceedings" })).avisos).toHaveLength(1);
  });

  it("o resultado de um tipo aproximado também passa na conferência e abre no formulário", () => {
    const { referencia } = converter(ficha({ type: "dataset", publisher: "X", author: [{ given: "A", family: "B" }] }));
    expect(conferirReferencia(referencia)).toEqual(referencia);
    expect(formularioParaReferencia(referenciaParaFormulario(referencia), { existentes: [], base: referencia })).toEqual({ ok: true, referencia });
  });
});

describe("o que o Crossref não traz: fica em branco, e o Apud não inventa", () => {
  it("sem autor: a lista de autores fica vazia (a obra entra pelo título)", () => {
    const { referencia } = converter(ficha({ author: undefined }));
    expect(referencia.autores).toEqual([]);
    expect(conferirReferencia(referencia)).not.toBeNull();
  });

  it("sem data: a referência fica sem data (o motor avisa)", () => {
    const { referencia } = converter(ficha({}));
    expect(referencia.data).toBeUndefined();
    expect("data" in referencia).toBe(false);
  });

  it("a data de criação do registro no Crossref nunca é usada como data da obra", () => {
    const { referencia } = converter(ficha({ created: { "date-parts": [[2021, 1, 1]] }, indexed: { "date-parts": [[2022, 2, 2]] }, deposited: { "date-parts": [[2023, 3, 3]] } }));
    expect(referencia.data).toBeUndefined();
  });

  it("sem páginas, sem revista, sem volume: só o que veio", () => {
    const { referencia } = converter(ficha({}));
    expect(referencia.paginas).toBeUndefined();
    expect(referencia.publicacao).toBeUndefined();
    expect(referencia.numeroEletronico).toBeUndefined();
  });

  it("revista só com o nome: sem volume nem número", () => {
    const { referencia } = converter(ficha({ "container-title": ["Revista X"] }));
    expect(referencia.publicacao).toEqual({ titulo: "Revista X" });
  });

  it("sem título: título vazio, para a pessoa preencher no formulário (que cobra o título ao salvar)", () => {
    const { referencia } = converter(ficha({ title: [] }));
    expect(referencia.titulo).toBe("");
    const formulario = referenciaParaFormulario(referencia);
    const salvo = formularioParaReferencia(formulario, { existentes: [], base: referencia });
    expect(salvo.ok).toBe(false);
  });

  it("campos vazios ou em branco no Crossref não viram campos vazios na referência", () => {
    const { referencia } = converter(ficha({ type: "book", publisher: "  ", "publisher-location": "", "edition-number": "" }));
    expect(referencia).not.toHaveProperty("editora");
    expect(referencia).not.toHaveProperty("cidade");
    expect(referencia).not.toHaveProperty("edicao");
  });

  it("artigo: a cidade e a editora do registro não viram cidade da revista nem editora", () => {
    const { referencia } = converter(ficha({ "publisher-location": "São Paulo", publisher: "Editora Y" }));
    expect(referencia).not.toHaveProperty("cidade");
    expect(referencia).not.toHaveProperty("editora");
  });
});

describe("autores", () => {
  it("a ordem do Crossref é mantida, mesmo que a 'sequence' diga outra coisa", () => {
    const { referencia } = converter(
      ficha({
        author: [
          { given: "Zélia", family: "Zanini", sequence: "additional" },
          { given: "Aldo", family: "Abreu", sequence: "first" },
        ],
      }),
    );
    expect(referencia.autores).toEqual([
      { sobrenome: "Zanini", prenomes: "Zélia" },
      { sobrenome: "Abreu", prenomes: "Aldo" },
    ]);
  });

  it("autor só com sobrenome: sem prenomes", () => {
    const { referencia, avisos } = converter(ficha({ author: [{ family: "Oliveira" }] }));
    expect(referencia.autores).toEqual([{ sobrenome: "Oliveira" }]);
    expect(avisos).toEqual([]);
  });

  it("autor só com nome próprio: vai no lugar do sobrenome, com aviso que diz quem", () => {
    const { referencia, avisos } = converter(ficha({ author: [{ given: "Sócrates" }, { given: "Ana", family: "Lima" }] }));
    expect(referencia.autores).toEqual([{ sobrenome: "Sócrates" }, { sobrenome: "Lima", prenomes: "Ana" }]);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain("Sócrates");
    expect(avisos[0]).toContain("só com um nome");
  });

  it("instituição (campo 'name') vira instituição", () => {
    const { referencia } = converter(ficha({ author: [{ name: "Organização Mundial da Saúde", sequence: "first" }] }));
    expect(referencia.autores).toEqual([{ instituicao: "Organização Mundial da Saúde" }]);
  });

  it("entradas vazias ou estragadas na lista são ignoradas", () => {
    const { referencia } = converter(ficha({ author: [{}, null, "texto", { given: " ", family: " " }, { given: "Ana", family: "Lima" }] }));
    expect(referencia.autores).toEqual([{ sobrenome: "Lima", prenomes: "Ana" }]);
  });

  it("muitos autores: todos entram (o motor decide o 'et al.')", () => {
    const author = Array.from({ length: 40 }, (_, i) => ({ given: `N${i}`, family: `S${i}` }));
    expect(converter(ficha({ author })).referencia.autores).toHaveLength(40);
  });

  it("nomes escritos em maiúsculas pelo Crossref não são mexidos", () => {
    const { referencia, avisos } = converter(ficha({ author: [{ given: "JOÃO", family: "SILVA" }] }));
    expect(referencia.autores).toEqual([{ sobrenome: "SILVA", prenomes: "JOÃO" }]);
    expect(avisos).toEqual([]);
  });

  it("livro só com organizadores: eles entram como autores, com aviso", () => {
    const { referencia, avisos } = converter(ficha({ type: "edited-book", editor: [{ given: "Rui", family: "Melo" }] }));
    expect(referencia.autores).toEqual([{ sobrenome: "Melo", prenomes: "Rui" }]);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain("organizadores");
  });

  it("livro com autores e organizadores: os organizadores não entram no lugar dos autores", () => {
    const { referencia, avisos } = converter(ficha({ type: "book", author: [{ given: "Ana", family: "Lima" }], editor: [{ given: "Rui", family: "Melo" }] }));
    expect(referencia.autores).toEqual([{ sobrenome: "Lima", prenomes: "Ana" }]);
    expect(avisos).toEqual([]);
  });
});

describe("título", () => {
  it("tira <i>, <sub>, <sup> e as marcas JATS, e mantém o texto", () => {
    expect(limparTextoDoCrossref("Uso de <i>Homo sapiens</i> em H<sub>2</sub>O")).toBe("Uso de Homo sapiens em H2O");
    expect(limparTextoDoCrossref("<jats:italic>In vivo</jats:italic> e <jats:bold>in vitro</jats:bold>")).toBe("In vivo e in vitro");
    expect(limparTextoDoCrossref("<b><i>Só marcas</i></b>")).toBe("Só marcas");
  });

  it("decodifica as entidades comuns e as numéricas", () => {
    expect(limparTextoDoCrossref("Pais &amp; filhos &lt;3 &quot;aspas&quot; &#233; &#xe9; &nbsp;fim")).toBe('Pais & filhos <3 "aspas" é é fim');
  });

  it("'&lt;i&gt;' escrito como texto fica como texto (não é marca)", () => {
    expect(limparTextoDoCrossref("A tag &lt;i&gt; do HTML")).toBe("A tag <i> do HTML");
  });

  it("entidade desconhecida ou número impossível ficam como vieram", () => {
    expect(limparTextoDoCrossref("a &naoexiste; b")).toBe("a &naoexiste; b");
    expect(limparTextoDoCrossref("a &#99999999; b")).toBe("a &#99999999; b");
  });

  it("símbolos e letras gregas ficam como estão", () => {
    expect(limparTextoDoCrossref("Efeito de α e β na razão p < 0,05 (±3%) — um teste")).toBe("Efeito de α e β na razão p < 0,05 (±3%) — um teste");
  });

  it("espaços repetidos e quebras de linha viram um espaço só", () => {
    expect(limparTextoDoCrossref("  um \n  título\t  longo ")).toBe("um título longo");
  });

  it("o título que chega com HTML sai limpo na referência", () => {
    const { referencia } = converter(ficha({ title: ["Sobre o <i>self</i> &amp; o outro: <sup>uma</sup> revisão"] }));
    expect(referencia.titulo).toBe("Sobre o self & o outro: uma revisão");
  });

  it("subtítulo do Crossref vai para o subtítulo; se já está dentro do título, não repete", () => {
    expect(converter(ficha({ title: ["Psicologia"], subtitle: ["uma introdução"] })).referencia.subtitulo).toBe("uma introdução");
    expect(converter(ficha({ title: ["Psicologia: uma introdução"], subtitle: ["Uma introdução"] })).referencia.subtitulo).toBeUndefined();
  });

  it("título em lista: usa o primeiro que não está vazio", () => {
    expect(converter(ficha({ title: ["", "  ", "O de verdade", "Outro"] })).referencia.titulo).toBe("O de verdade");
  });

  describe("título todo em maiúsculas", () => {
    it("avisa, e não muda o título", () => {
      const { referencia, avisos } = converter(ficha({ title: ["SUPERVISÃO NO ESTÁGIO EM SAÚDE MENTAL"] }));
      expect(referencia.titulo).toBe("SUPERVISÃO NO ESTÁGIO EM SAÚDE MENTAL");
      expect(avisos).toHaveLength(1);
      expect(avisos[0]).toContain("maiúsculas");
    });

    it("avisa também quando só o subtítulo vem em maiúsculas", () => {
      const { avisos } = converter(ficha({ title: ["Psicologia"], subtitle: ["FUNDAMENTOS E PRÁTICA CLÍNICA"] }));
      expect(avisos).toHaveLength(1);
    });

    it("não avisa para siglas curtas nem para título normal", () => {
      expect(estaTodoEmMaiusculas("DSM-5")).toBe(false);
      expect(estaTodoEmMaiusculas("WAIS-IV e a avaliação")).toBe(false);
      expect(estaTodoEmMaiusculas("Supervisão no estágio")).toBe(false);
      expect(estaTodoEmMaiusculas("SUPERVISÃO NO ESTÁGIO")).toBe(true);
      expect(converter(ficha({ title: ["DSM-5"] })).avisos).toEqual([]);
    });

    it("não conta números e símbolos como minúsculas", () => {
      expect(estaTodoEmMaiusculas("NBR 6023: 2025 — REFERÊNCIAS")).toBe(true);
    });
  });
});

describe("data", () => {
  it("usa a 'issued'; se faltar ou vier sem ano, a impressa, depois a geral e a eletrônica", () => {
    const issued = { "date-parts": [[2018, 5, 17]] };
    expect(converter(ficha({ issued })).referencia.data).toEqual({ ano: 2018, mes: 5, dia: 17 });
    expect(converter(ficha({ issued: { "date-parts": [[null]] }, "published-print": { "date-parts": [[2017, 3]] } })).referencia.data).toEqual({ ano: 2017, mes: 3 });
    expect(converter(ficha({ "published-print": { "date-parts": [[2016]] }, "published-online": { "date-parts": [[2015, 1, 1]] } })).referencia.data).toEqual({ ano: 2016 });
    expect(converter(ficha({ "published-online": { "date-parts": [[2015, 1, 1]] } })).referencia.data).toEqual({ ano: 2015, mes: 1, dia: 1 });
  });

  it("mês impossível: fica só o ano; dia impossível para o mês: fica ano e mês", () => {
    expect(converter(ficha({ issued: { "date-parts": [[2019, 13, 5]] } })).referencia.data).toEqual({ ano: 2019 });
    expect(converter(ficha({ issued: { "date-parts": [[2019, 2, 30]] } })).referencia.data).toEqual({ ano: 2019, mes: 2 });
    expect(converter(ficha({ issued: { "date-parts": [[2020, 2, 29]] } })).referencia.data).toEqual({ ano: 2020, mes: 2, dia: 29 });
  });

  it("datas estragadas viram 'sem data', sem quebrar", () => {
    for (const issued of [null, {}, { "date-parts": [] }, { "date-parts": [["2019"]] }, { "date-parts": [[0]] }, { "date-parts": "2019" }, { "date-parts": [[1.5]] }]) {
      const { referencia } = converter(ficha({ issued }));
      expect(referencia.data, JSON.stringify(issued)).toBeUndefined();
    }
  });
});

describe("páginas e número do artigo", () => {
  const artigo = (extra: Record<string, unknown>) => converter(ficha({ type: "journal-article", ...extra })).referencia;

  it("intervalo, com qualquer travessão, vira hífen", () => {
    expect(artigo({ page: "45–60" }).paginas).toBe("45-60");
    expect(artigo({ page: "45—60" }).paginas).toBe("45-60");
    expect(artigo({ page: "45 - 60" }).paginas).toBe("45-60");
    expect(artigo({ page: "45-60" }).paginas).toBe("45-60");
  });

  it("uma página só, e intervalos com letra (S1-S10)", () => {
    expect(artigo({ page: "123" }).paginas).toBe("123");
    expect(artigo({ page: "S1-S10" }).paginas).toBe("S1-S10");
  });

  it("'e12345' sem intervalo é número do artigo, não página", () => {
    const r = artigo({ page: "e2024017" });
    expect(r.numeroEletronico).toBe("e2024017");
    expect(r.paginas).toBeUndefined();
  });

  it("sem página, o 'article-number' vira número do artigo; com página, a página vale", () => {
    expect(artigo({ "article-number": "e0123" }).numeroEletronico).toBe("e0123");
    const r = artigo({ page: "10-20", "article-number": "e0123" });
    expect(r.paginas).toBe("10-20");
    expect(r.numeroEletronico).toBeUndefined();
  });
});

describe("tese e relatório", () => {
  it("tese: a universidade e a cidade vêm da instituição, e o resto fica para a pessoa (grau e tipo em branco)", () => {
    const { referencia } = converter(
      ficha({
        type: "dissertation",
        institution: [{ name: "Universidade Estadual de Londrina", place: ["Londrina"] }],
        degree: ["Master of Science"],
        publisher: "Outro Nome",
      }),
    );
    expect(referencia).toMatchObject({ tipo: "tese", editora: "Universidade Estadual de Londrina", cidade: "Londrina" });
    expect(referencia).not.toHaveProperty("grau");
    expect(referencia).not.toHaveProperty("tipoDoTrabalho");
  });

  it("tese sem instituição: usa a editora do registro", () => {
    expect(converter(ficha({ type: "dissertation", publisher: "Repositório da Universidade", "publisher-location": "Maringá" })).referencia).toMatchObject({
      editora: "Repositório da Universidade",
      cidade: "Maringá",
    });
  });

  it("relatório: instituição ou editora", () => {
    expect(converter(ficha({ type: "report", publisher: "Instituto de Pesquisa Social", "publisher-location": "Brasília" })).referencia).toMatchObject({
      tipo: "relatorio",
      editora: "Instituto de Pesquisa Social",
      cidade: "Brasília",
    });
  });
});

describe("evento", () => {
  it("sem o nome do evento, não monta o grupo 'evento' (só os anais)", () => {
    const { referencia } = converter(ficha({ type: "proceedings-article", "container-title": ["Anais X"], event: { location: "Recife" } }));
    expect(referencia).not.toHaveProperty("evento");
    expect(referencia.publicacao).toEqual({ titulo: "Anais X" });
  });

  it("evento só com o nome", () => {
    expect(converter(ficha({ type: "proceedings-article", event: { name: "Congresso Y" } })).referencia.evento).toEqual({ nome: "Congresso Y" });
  });

  it("sem evento nenhum: só o que houver", () => {
    expect(converter(ficha({ type: "proceedings-article" })).referencia).not.toHaveProperty("evento");
  });
});

describe("DOI", () => {
  it("o DOI da ficha vem normalizado; sem DOI na ficha, vale o que a pessoa pediu", () => {
    expect(converter(ficha({ DOI: "10.1234/ABC.DEF" })).referencia.doi).toBe("10.1234/abc.def");
    const r = converterCrossref(ficha({ DOI: undefined }), { existentes: [], doiPedido: "10.9999/pedido", sorteio });
    expect(r.ok && r.referencia.doi).toBe("10.9999/pedido");
  });

  it("um DOI que não parece DOI na ficha é trocado pelo pedido", () => {
    const r = converterCrossref(ficha({ DOI: "isso-nao-e-doi" }), { existentes: [], doiPedido: "10.9999/pedido", sorteio });
    expect(r.ok && r.referencia.doi).toBe("10.9999/pedido");
  });
});

describe("respostas que não são uma ficha de obra", () => {
  const ruins: [string, unknown][] = [
    ["nulo", null],
    ["texto", "<html>erro</html>"],
    ["número", 404],
    ["lista", [ficha({})]],
    ["objeto vazio", {}],
    ["status de erro", { status: "failed", "message-type": "work", message: { type: "book" } }],
    ["outro tipo de resposta", { status: "ok", "message-type": "work-list", message: { items: [] } }],
    ["sem 'message'", { status: "ok", "message-type": "work" }],
    ["'message' que não é objeto", { status: "ok", "message-type": "work", message: "texto" }],
    ["sem o tipo da obra", { status: "ok", "message-type": "work", message: { DOI: "10.1234/x", title: ["T"] } }],
    ["tipo que não é texto", { status: "ok", "message-type": "work", message: { type: 3, title: ["T"] } }],
  ];
  for (const [nome, resposta] of ruins) {
    it(`${nome}: devolve 'fora do esperado' sem lançar erro`, () => {
      expect(converterCrossref(resposta, { existentes: [] })).toEqual({ ok: false, motivo: "fora-do-esperado" });
    });
  }

  it("campos do tamanho errado dentro de uma ficha boa não derrubam a conversão", () => {
    const r = converterCrossref(
      ficha({ title: 5, author: "ninguém", "container-title": { a: 1 }, editor: 7, institution: "x", event: [1], page: ["1", "2"], volume: {}, issue: null }),
      { existentes: [] },
    );
    expect(r.ok).toBe(true);
  });
});
