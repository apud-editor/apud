// Testes da gaveta de referências: o formulário, a lista e as escolhas do autor.
// São funções puras, testadas sem tela.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { carregarNorma, carregarPerfil, PASTA_PROVA } from "../../scripts/prova-lib";
import { conferirReferencia } from "../arquivos/formato";
import { criarMotor, pedacosComoTexto } from "../citacoes/motor";
import { TIPOS_DE_REFERENCIA, type Bloco, type Citacao, type Documento, type Referencia, type TipoDeReferencia } from "../documento/modelo";
import {
  CAMPOS_DE_TEXTO,
  camposDoTipo,
  DESCRICAO_DOS_TIPOS,
  escreverDataIncerta,
  formularioParaReferencia,
  formularioVazio,
  instituicaoVazia,
  NOME_DO_TIPO_NA_TELA,
  pessoaVazia,
  referenciaParaFormulario,
  TIPOS_NO_FORMULARIO,
  type Formulario,
} from "./formulario";
import { autoresDoResumo, avisoDeApagar, buscarReferencias, contarCitacoes, ordenarParaGaveta, resumoDaReferencia } from "./lista";
import { ajustesComEscolha, escolhasDoAutor } from "./escolhas";

const provas = JSON.parse(readFileSync(join(PASTA_PROVA, "referencias.json"), "utf8")) as Referencia[];

// ---------------------------------------------------------------------------
// Formulário

/** Os campos de nível de cima que cada tipo usa, além dos de todos (conforme o comentário de Referencia). */
const CAMPOS_DO_TIPO: Record<TipoDeReferencia, string[]> = {
  livro: ["subtitulo", "edicao", "cidade", "editora"],
  capitulo: ["publicacao", "edicao", "cidade", "editora", "paginas"],
  artigo: ["subtitulo", "publicacao", "paginas", "numeroEletronico"],
  site: ["editora", "cidade"],
  lei: ["ementa", "cidade", "editora"],
  tese: ["subtitulo", "tipoDoTrabalho", "grau", "editora", "cidade", "folhas"],
  relatorio: ["serie", "numeroNaSerie", "cidade", "editora"],
  evento: ["evento", "publicacao", "cidade", "editora", "paginas"],
  noticia: ["publicacao"],
  "rede-social": ["perfil", "tipoDaPostagem", "publicacao", "cidade"],
};
const DE_TODOS = ["id", "tipo", "autores", "titulo", "data", "url", "acesso"];

/** Um formulário com tudo preenchido, para o tipo. */
function completo(tipo: TipoDeReferencia): Formulario {
  const f = formularioVazio(tipo);
  for (const campo of CAMPOS_DE_TEXTO) f.texto[campo] = `valor de ${campo}`;
  f.autores = [
    { tipo: "pessoa", sobrenome: "Silva", prenomes: "João Pedro" },
    { tipo: "instituicao", nome: "IBGE" },
  ];
  if (DESCRICAO_DOS_TIPOS[tipo].rotuloDosOrganizadores) f.organizadores = [{ tipo: "pessoa", sobrenome: "Melo", prenomes: "Rui" }];
  f.data = { ano: "2019", mes: "5", dia: "2" };
  f.acesso = { ano: "2025", mes: "5", dia: "15" };
  return f;
}
const aceitar = (f: Formulario, existentes: string[] = []) => {
  const r = formularioParaReferencia(f, { existentes });
  if (!r.ok) throw new Error(JSON.stringify(r.erros));
  return r.referencia;
};
const erros = (f: Formulario) => {
  const r = formularioParaReferencia(f, { existentes: [] });
  if (r.ok) throw new Error("devia recusar");
  return Object.fromEntries(r.erros.map((e) => [e.campo, e.mensagem]));
};
/** Um formulário mínimo e válido. */
const simples = (mudar: (f: Formulario) => void = () => {}) => {
  const f = formularioVazio("livro");
  f.texto.titulo = "Psicologia clínica";
  mudar(f);
  return f;
};

describe("tipos no formulário", () => {
  it("os 10 tipos aparecem, uma vez cada, com os mais comuns primeiro", () => {
    expect([...TIPOS_NO_FORMULARIO].sort()).toEqual([...TIPOS_DE_REFERENCIA].sort());
    expect(TIPOS_NO_FORMULARIO.slice(0, 4)).toEqual(["artigo", "livro", "capitulo", "tese"]);
    expect(Object.keys(NOME_DO_TIPO_NA_TELA).sort()).toEqual([...TIPOS_DE_REFERENCIA].sort());
  });

  it("o formulário vazio começa pelo primeiro tipo da lista", () => {
    expect(formularioVazio().tipo).toBe(TIPOS_NO_FORMULARIO[0]);
  });
});

describe("do formulário para a referência: os 10 tipos", () => {
  for (const tipo of TIPOS_DE_REFERENCIA) {
    it(`${tipo}: usa só os campos do tipo e passa na conferência do .apud`, () => {
      const r = aceitar(completo(tipo), ["r000001"]);
      expect(Object.keys(r).sort()).toEqual([...DE_TODOS, ...CAMPOS_DO_TIPO[tipo]].sort());
      expect(conferirReferencia(r)).toEqual(r);
      expect(r.tipo).toBe(tipo);
      expect(r.id).toMatch(/^r[0-9a-z]{6}$/);
      expect(r.id).not.toBe("r000001");
      expect(r.data).toEqual({ ano: 2019, mes: 5, dia: 2 });
      expect(r.acesso).toEqual({ ano: 2025, mes: 5, dia: 15 });
      expect(r.autores).toEqual([{ sobrenome: "Silva", prenomes: "João Pedro" }, { instituicao: "IBGE" }]);
    });
  }

  it("capítulo e trabalho em evento guardam os organizadores dentro da publicação", () => {
    expect(aceitar(completo("capitulo")).publicacao?.organizadores).toEqual([{ sobrenome: "Melo", prenomes: "Rui" }]);
    expect(aceitar(completo("evento")).publicacao?.organizadores).toEqual([{ sobrenome: "Melo", prenomes: "Rui" }]);
    // Os outros tipos não têm organizadores: o que sobrou no formulário não entra.
    const livro = completo("livro");
    livro.organizadores = [{ tipo: "pessoa", sobrenome: "Melo", prenomes: "Rui" }];
    expect(aceitar(livro).publicacao).toBeUndefined();
  });

  it("o artigo guarda a revista dentro da publicação, e o evento dentro de evento", () => {
    const artigo = aceitar(completo("artigo"));
    expect(artigo.publicacao).toEqual({
      titulo: "valor de publicacao.titulo",
      cidade: "valor de publicacao.cidade",
      volume: "valor de publicacao.volume",
      numero: "valor de publicacao.numero",
    });
    const evento = aceitar(completo("evento"));
    expect(evento.evento).toEqual({
      nome: "valor de evento.nome",
      numero: "valor de evento.numero",
      ano: "valor de evento.ano",
      cidade: "valor de evento.cidade",
    });
  });

  it("só pede o que o tipo usa: cada tipo tem o título e o endereço, e nenhum campo repete", () => {
    for (const tipo of TIPOS_DE_REFERENCIA) {
      const chaves = camposDoTipo(tipo).map((c) => c.chave);
      expect(new Set(chaves).size).toBe(chaves.length);
      expect(chaves).toContain("titulo");
      expect(chaves.at(-1)).toBe("url");
      expect(chaves).not.toContain("doi"); // o DOI fica para a parte 5
    }
    expect(camposDoTipo("livro").map((c) => c.chave)).not.toContain("folhas");
    expect(camposDoTipo("tese").map((c) => c.chave)).toContain("folhas");
  });

  it("limpa espaços sobrando e esquece campos em branco", () => {
    const r = aceitar(
      simples((f) => {
        f.texto.titulo = "  Psicologia   clínica ";
        f.texto.editora = "   ";
        f.texto.cidade = " Petrópolis ";
        f.autores = [pessoaVazia(), { tipo: "pessoa", sobrenome: "  Silva ", prenomes: " João   Pedro " }, instituicaoVazia()];
      }),
    );
    expect(r.titulo).toBe("Psicologia clínica");
    expect(r.cidade).toBe("Petrópolis");
    expect("editora" in r).toBe(false);
    expect(r.autores).toEqual([{ sobrenome: "Silva", prenomes: "João Pedro" }]);
  });

  it("obra sem autor é aceita (entra pelo título); autor só com sobrenome também", () => {
    expect(aceitar(simples((f) => (f.autores = []))).autores).toEqual([]);
    expect(aceitar(simples((f) => (f.autores = [{ tipo: "pessoa", sobrenome: "Silva", prenomes: "" }]))).autores).toEqual([{ sobrenome: "Silva" }]);
  });

  it("a ordem dos autores é a ordem da tela", () => {
    const r = aceitar(
      simples((f) => {
        f.autores = [
          { tipo: "pessoa", sobrenome: "Reis", prenomes: "Carla" },
          { tipo: "pessoa", sobrenome: "Lima", prenomes: "Ana" },
        ];
      }),
    );
    expect(r.autores.map((a) => ("sobrenome" in a ? a.sobrenome : a.instituicao))).toEqual(["Reis", "Lima"]);
  });
});

describe("datas", () => {
  it("ano, mês e dia; só o ano basta", () => {
    expect(aceitar(simples((f) => (f.data = { ano: "2019", mes: "", dia: "" }))).data).toEqual({ ano: 2019 });
    expect(aceitar(simples((f) => (f.data = { ano: "2019", mes: "3", dia: "" }))).data).toEqual({ ano: 2019, mes: 3 });
    expect(aceitar(simples((f) => (f.data = { ano: "2020", mes: "2", dia: "29" }))).data).toEqual({ ano: 2020, mes: 2, dia: 29 });
    expect("data" in aceitar(simples())).toBe(false);
  });

  it("recusa data impossível, dizendo onde", () => {
    expect(erros(simples((f) => (f.data = { ano: "2019", mes: "13", dia: "" })))["data.mes"]).toMatch(/1 a 12/);
    expect(erros(simples((f) => (f.data = { ano: "2019", mes: "2", dia: "30" })))["data.dia"]).toMatch(/1 a 28/);
    expect(erros(simples((f) => (f.data = { ano: "2019", mes: "", dia: "5" })))["data.mes"]).toMatch(/mês/);
    expect(erros(simples((f) => (f.data = { ano: "", mes: "3", dia: "" })))["data.ano"]).toMatch(/ano/);
    expect(erros(simples((f) => (f.data = { ano: "dois mil", mes: "", dia: "" })))["data.ano"]).toMatch(/números/);
  });

  it("data incerta: entra entre colchetes, como a ABNT pede", () => {
    expect(escreverDataIncerta("2019?")).toBe("[2019?]");
    expect(escreverDataIncerta("[201-]")).toBe("[201-]");
    expect(escreverDataIncerta("  ")).toBe("");
    const r = aceitar(simples((f) => (f.dataIncerta = "201-?")));
    expect(r.dataIncerta).toBe("[201-?]");
    expect(r.data).toBeUndefined();
  });

  it("data incerta e ano juntos não passam; data incerta sem número também não", () => {
    expect(erros(simples((f) => ((f.dataIncerta = "[2019?]"), (f.data = { ano: "2019", mes: "", dia: "" }))))["dataIncerta"]).toMatch(/não os dois/);
    expect(erros(simples((f) => (f.dataIncerta = "sem data")))["dataIncerta"]).toMatch(/\[2019\?\]/);
  });

  it("data de acesso: mesmas regras", () => {
    expect(aceitar(simples((f) => (f.acesso = { ano: "2025", mes: "5", dia: "15" }))).acesso).toEqual({ ano: 2025, mes: 5, dia: 15 });
    expect(erros(simples((f) => (f.acesso = { ano: "", mes: "5", dia: "15" })))["acesso.ano"]).toMatch(/ano/);
  });
});

describe("o que o formulário recusa", () => {
  it("sem título", () => {
    expect(erros(simples((f) => (f.texto.titulo = "  ")))["titulo"]).toMatch(/título/);
  });

  it("autor sem sobrenome, apontando a linha", () => {
    const e = erros(
      simples((f) => {
        f.autores = [
          { tipo: "pessoa", sobrenome: "Silva", prenomes: "João" },
          { tipo: "pessoa", sobrenome: "", prenomes: "Ana" },
        ];
      }),
    );
    expect(e["autores.1.sobrenome"]).toMatch(/sobrenome/);
  });

  it("revista, livro ou anais sem nome quando há outros dados dele", () => {
    const artigo = formularioVazio("artigo");
    artigo.texto.titulo = "Vínculo terapêutico";
    artigo.texto["publicacao.volume"] = "10";
    expect(erros(artigo)["publicacao.titulo"]).toMatch(/revista/);

    const capitulo = formularioVazio("capitulo");
    capitulo.texto.titulo = "Acolhimento";
    capitulo.organizadores = [{ tipo: "pessoa", sobrenome: "Melo", prenomes: "Rui" }];
    expect(erros(capitulo)["publicacao.titulo"]).toMatch(/título do livro/);

    const evento = formularioVazio("evento");
    evento.texto.titulo = "Categorizações";
    evento.texto["evento.numero"] = "20";
    expect(erros(evento)["evento.nome"]).toMatch(/nome do evento/);
  });

  it("mostra todos os problemas de uma vez", () => {
    const f = formularioVazio("artigo");
    f.data = { ano: "x", mes: "", dia: "" };
    expect(Object.keys(erros(f)).sort()).toEqual(["data.ano", "titulo"]);
  });
});

describe("editar uma referência", () => {
  it("ida e volta: as 27 obras do documento de prova saem iguais do formulário, em todos os tipos", () => {
    expect(new Set(provas.map((r) => r.tipo))).toEqual(new Set(TIPOS_DE_REFERENCIA));
    for (const original of provas) {
      // O código não muda, e nada se perde (o DOI, que o formulário não mostra, continua).
      const comBase = formularioParaReferencia(referenciaParaFormulario(original), { existentes: [], base: original });
      expect(comBase.ok && comBase.referencia, original.id).toEqual(original);
    }
  });

  it("mantém o código e o DOI, que o formulário não mostra", () => {
    const original = provas.find((r) => r.doi)!;
    const f = referenciaParaFormulario(original);
    f.texto.titulo = "Outro título";
    const r = formularioParaReferencia(f, { existentes: [original.id], base: original });
    expect(r.ok && r.referencia).toMatchObject({ id: original.id, doi: original.doi, titulo: "Outro título" });
  });

  it("campo que o formulário não conhece é mantido (nunca se perde dado)", () => {
    const original = { ...provas[0], campoDeOutraVersao: { x: 1 } } as Referencia;
    const r = formularioParaReferencia(referenciaParaFormulario(original), { existentes: [], base: original });
    expect(r.ok && (r.referencia as unknown as Record<string, unknown>).campoDeOutraVersao).toEqual({ x: 1 });
  });

  it("trocar o tipo ao editar tira o que o novo tipo não usa", () => {
    const livro = provas.find((r) => r.tipo === "livro" && r.edicao)!;
    const f = referenciaParaFormulario(livro);
    f.tipo = "site";
    const r = formularioParaReferencia(f, { existentes: [], base: livro });
    expect(r.ok && r.referencia).toMatchObject({ tipo: "site", id: livro.id });
    expect(r.ok && "edicao" in r.referencia).toBe(false);
    expect(r.ok && r.referencia.editora).toBe(livro.editora);
  });

  it("os códigos novos nunca repetem os que existem", () => {
    const sorteios = [0, 0, 0.5];
    let i = 0;
    const primeiro = "r" + "0".repeat(6);
    const r = formularioParaReferencia(simples(), { existentes: [primeiro], sorteio: () => sorteios[i++] });
    expect(r.ok && r.referencia.id).not.toBe(primeiro);
  });
});

// ---------------------------------------------------------------------------
// Lista

const sobrenomes = (...nomes: string[]) => nomes.map((sobrenome) => ({ sobrenome }));
const obra = (id: string, autores: Referencia["autores"], titulo: string, ano?: number, extra: Partial<Referencia> = {}): Referencia => ({
  id,
  tipo: "livro",
  autores,
  titulo,
  ...(ano ? { data: { ano } } : {}),
  ...extra,
});

describe("resumo de cada fonte", () => {
  it("autores: até três pelo sobrenome; mais que isso, o primeiro com et al.; instituição como está", () => {
    expect(autoresDoResumo([])).toBe("(sem autor)");
    expect(autoresDoResumo(sobrenomes("Silva"))).toBe("Silva");
    expect(autoresDoResumo(sobrenomes("Silva", "Costa"))).toBe("Silva e Costa");
    expect(autoresDoResumo(sobrenomes("Lima", "Costa", "Reis"))).toBe("Lima, Costa e Reis");
    expect(autoresDoResumo(sobrenomes("Lima", "Costa", "Reis", "Souza"))).toBe("Lima et al.");
    expect(autoresDoResumo([{ instituicao: "IBGE" }])).toBe("IBGE");
  });

  it("autor, ano, título (com subtítulo) e tipo", () => {
    expect(resumoDaReferencia(obra("a", sobrenomes("Silva"), "Psicologia clínica", 2019, { subtitulo: "fundamentos" }))).toEqual({
      autores: "Silva",
      ano: "2019",
      titulo: "Psicologia clínica: fundamentos",
      tipo: "Livro",
    });
    expect(resumoDaReferencia(obra("b", [], "Sem data")).ano).toBe("s.d.");
    expect(resumoDaReferencia(obra("c", [], "Incerta", undefined, { dataIncerta: "[201-?]" })).ano).toBe("[201-?]");
  });
});

describe("busca por autor ou título", () => {
  const lista = [
    obra("lima", sobrenomes("Lima", "Costa", "Reis"), "Supervisão no estágio em saúde mental", 2018),
    obra("silva", [{ sobrenome: "Silva", prenomes: "João" }], "Psicologia clínica", 2019),
    obra("souza", sobrenomes("Souza"), "O diário de campo na formação do psicólogo", 2020),
    obra("ibge", [{ instituicao: "IBGE" }], "Censo", 2022),
  ];
  const achar = (q: string) => buscarReferencias(lista, q).map((r) => r.id);

  it("sem consulta mostra todas", () => {
    expect(achar("")).toEqual(["lima", "silva", "souza", "ibge"]);
    expect(achar("   ")).toEqual(["lima", "silva", "souza", "ibge"]);
  });

  it("acha por autor, por título, sem acento e sem maiúscula", () => {
    expect(achar("silva")).toEqual(["silva"]);
    expect(achar("COSTA")).toEqual(["lima"]);
    expect(achar("psicologo")).toEqual(["souza"]);
    expect(achar("supervisao estagio")).toEqual(["lima"]);
    expect(achar("ibge")).toEqual(["ibge"]);
  });

  it("todas as palavras precisam estar, em qualquer ordem, e o ano também vale", () => {
    expect(achar("clinica silva")).toEqual(["silva"]);
    expect(achar("silva diario")).toEqual([]);
    expect(achar("silva 2019")).toEqual(["silva"]);
    expect(achar("joao")).toEqual(["silva"]);
  });
});

describe("ordem da gaveta", () => {
  it("por autor, depois ano e título, sem mexer na lista original", () => {
    const original = [
      obra("c", sobrenomes("Souza"), "B", 2020),
      obra("a2", sobrenomes("Álvares"), "Z", 2021),
      obra("a1", sobrenomes("Álvares"), "Z", 2018),
      obra("b", sobrenomes("Lima"), "A"),
    ];
    expect(ordenarParaGaveta(original).map((r) => r.id)).toEqual(["a1", "a2", "b", "c"]);
    expect(original.map((r) => r.id)).toEqual(["c", "a2", "a1", "b"]);
  });
});

describe("apagar uma fonte citada", () => {
  const citacao = (...ids: string[]): Citacao => ({ tipo: "parenteses", obras: ids.map((referencia) => ({ referencia })) });
  const blocos: Bloco[] = [
    { tipo: "paragrafo", trechos: [{ texto: "a " }, { citacao: citacao("r1") }, { texto: " b " }, { citacao: citacao("r1", "r2") }] },
    { tipo: "titulo", nivel: 1, trechos: [{ citacao: { tipo: "narrativa", obra: { referencia: "r1" } } }] },
    { tipo: "lista", sequencia: false, itens: [{ trechos: [{ citacao: { tipo: "apud", original: "Freud, 1915", obra: { referencia: "r3" } } }], subitens: [{ trechos: [{ citacao: citacao("r2") }] }] }] },
    { tipo: "paragrafo", trechos: [{ citacao: { tipo: "sem-referencia", texto: "Usuária A" } }] },
  ];

  it("conta as citações em parágrafos, títulos e listas (também nos subitens)", () => {
    const n = contarCitacoes(blocos);
    expect(n.get("r1")).toBe(3);
    expect(n.get("r2")).toBe(2);
    expect(n.get("r3")).toBe(1);
    expect(n.get("r9")).toBeUndefined();
  });

  it("a confirmação diz quantas vezes; sem citações, não pede nada", () => {
    expect(avisoDeApagar(0)).toBeNull();
    expect(avisoDeApagar(1)).toBe("Esta fonte é citada 1 vez no texto. A citação fica marcada como referência apagada.");
    expect(avisoDeApagar(3)).toBe("Esta fonte é citada 3 vezes no texto. As citações ficam marcadas como referência apagada.");
  });

  it("depois de apagar, o motor avisa referência apagada (a citação continua no texto)", () => {
    const { perfil } = carregarPerfil("abnt.txt");
    const doc: Documento = { versao: 3, referencias: [], blocos: [{ tipo: "paragrafo", trechos: [{ citacao: citacao("r1") }] }] };
    const montada = criarMotor(doc, perfil).montar(citacao("r1"));
    expect(montada.avisos.map((a) => a.tipo)).toEqual(["referencia-apagada"]);
  });
});

// ---------------------------------------------------------------------------
// Escolhas do autor

describe("escolhas do autor", () => {
  const abnt = carregarPerfil("abnt.txt").perfil;
  const apa = carregarPerfil("apa.txt").perfil;

  it("ABNT: as 5 regras de escolha que mexem em citações e referências, com o padrão do perfil", () => {
    const e = escolhasDoAutor(abnt);
    expect(e.map((x) => x.chave)).toEqual([
      "citação, destaque seu",
      "citação, tradução sua",
      "autores, quatro ou mais",
      "referências, prenomes",
      "referências, destaque do título",
    ]);
    expect(e.map((x) => x.padrao)).toEqual(["grifo nosso", "tradução nossa", "todos", "por extenso", "negrito"]);
    expect(e.every((x) => x.atual === x.padrao)).toBe(true);
    expect(e.find((x) => x.chave === "referências, destaque do título")!.opcoes).toEqual(["negrito", "itálico", "sublinhado"]);
  });

  it("APA: as 3 escolhas de revista", () => {
    const e = escolhasDoAutor(apa);
    expect(e.map((x) => x.chave)).toEqual([
      "citação, primeira vez com três a cinco autores",
      "referências, prenomes",
      "referências, cidade da editora",
    ]);
    expect(e.map((x) => x.padrao)).toEqual(["primeiro autor e et al.", "iniciais", "não mostrar"]);
  });

  it("não traz regras de outros assuntos (fonte, impressão) nem as fixas da norma", () => {
    for (const perfil of [abnt, apa]) {
      for (const x of escolhasDoAutor(perfil)) expect(/^(citação|referências|autores)/.test(x.chave)).toBe(true);
    }
    expect(escolhasDoAutor(apa).map((x) => x.chave)).not.toContain("fonte");
    expect(escolhasDoAutor(abnt).map((x) => x.chave)).not.toContain("impressão");
  });

  it("todas têm nome e explicação em português", () => {
    for (const perfil of [abnt, apa]) {
      for (const x of escolhasDoAutor(perfil)) {
        expect(x.nome.length, x.chave).toBeGreaterThan(5);
        expect(x.explicacao.length, x.chave).toBeGreaterThan(20);
      }
    }
  });

  it("o ajuste do trabalho vale como escolha atual; ajuste que não é uma opção é ignorado", () => {
    const e = escolhasDoAutor(abnt, { "referências, prenomes": "abreviados", "autores, quatro ou mais": "qualquer coisa" });
    expect(e.find((x) => x.chave === "referências, prenomes")!.atual).toBe("abreviados");
    expect(e.find((x) => x.chave === "autores, quatro ou mais")!.atual).toBe("todos");
  });

  it("escolher grava só o que difere do padrão, e não mexe nas outras normas", () => {
    const antes = { ABNT: { "referências, prenomes": "abreviados" }, APA: { "referências, cidade da editora": "mostrar" } };
    const copia = structuredClone(antes);
    const a = ajustesComEscolha(antes, "ABNT", "autores, quatro ou mais", "primeiro com et al.", "todos");
    expect(a).toEqual({
      ABNT: { "referências, prenomes": "abreviados", "autores, quatro ou mais": "primeiro com et al." },
      APA: { "referências, cidade da editora": "mostrar" },
    });
    expect(antes).toEqual(copia);
    // Voltar ao padrão tira o ajuste; sem ajustes, a norma some do arquivo.
    const b = ajustesComEscolha(a, "ABNT", "autores, quatro ou mais", "todos", "todos");
    expect(b.ABNT).toEqual({ "referências, prenomes": "abreviados" });
    expect(ajustesComEscolha(b, "ABNT", "referências, prenomes", "por extenso", "por extenso")).toEqual({ APA: { "referências, cidade da editora": "mostrar" } });
  });

  it("toda opção de toda escolha é aceita pelo perfil (nenhum ajuste vira erro)", () => {
    for (const arquivo of ["abnt.txt", "apa.txt"]) {
      const { perfil } = carregarPerfil(arquivo);
      for (const e of escolhasDoAutor(perfil)) {
        for (const opcao of e.opcoes) {
          const ajustes = ajustesComEscolha({}, "X", e.chave, opcao, e.padrao).X ?? {};
          expect(() => carregarNorma(arquivo, ajustes), `${arquivo}: ${e.chave} = ${opcao}`).not.toThrow();
        }
      }
    }
  });

  it("a escolha muda a citação: quatro autores, na ABNT, saem todos ou só o primeiro com et al.", () => {
    const quatro: Referencia = {
      id: "r1",
      tipo: "livro",
      autores: ["Lima", "Costa", "Reis", "Souza"].map((sobrenome) => ({ sobrenome, prenomes: "Ana" })),
      titulo: "Obra",
      data: { ano: 2018 },
      editora: "Vozes",
      cidade: "Petrópolis",
    };
    const c: Citacao = { tipo: "parenteses", obras: [{ referencia: "r1" }] };
    const texto = (ajustes: Record<string, string>) => {
      const { perfil } = carregarNorma("abnt.txt", ajustes);
      const doc: Documento = { versao: 3, referencias: [quatro], blocos: [{ tipo: "paragrafo", trechos: [{ citacao: c }] }] };
      return pedacosComoTexto(criarMotor(doc, perfil).montar(c).pedacos);
    };
    const padrao = texto({});
    const comEtAl = texto({ "autores, quatro ou mais": "primeiro com et al." });
    expect(comEtAl).not.toBe(padrao);
    expect(comEtAl.toLowerCase()).toContain("et al.");
    expect(padrao.toLowerCase()).not.toContain("et al.");
  });
});
