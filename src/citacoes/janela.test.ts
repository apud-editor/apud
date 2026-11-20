// A janela do "@": o que a pessoa preenche vira a citação certa, que passa na
// mesma conferência do arquivo (conferirCitacao) e que o motor escreve na
// norma, nas duas normas.

import { describe, expect, it } from "vitest";
import { carregarNorma } from "../../scripts/prova-lib";
import { conferirCitacao } from "../arquivos/formato";
import type { Citacao, Referencia } from "../documento/modelo";
import { citacaoParaFormulario, formularioNovo, formularioParaCitacao, obraVazia, type FormularioDeCitacao } from "./janela";
import { previaDaCitacao, textoDaCitacao } from "./todas";

const livro = (id: string, autores: string[], ano: number, titulo = `Obra ${id}`): Referencia => ({
  id,
  tipo: "livro",
  autores: autores.map((a) => {
    const [sobrenome, prenomes] = a.split(",").map((s) => s.trim());
    return prenomes ? { sobrenome, prenomes } : { sobrenome };
  }),
  titulo,
  data: { ano },
  editora: "Vozes",
  cidade: "Petrópolis",
});
const refs = [
  livro("silva", ["Silva, Ana"], 2019, "Psicologia clínica"),
  livro("lima", ["Lima, Ana", "Costa, Bruno", "Reis, Carla"], 2018),
  livro("costa", ["Costa, Eva"], 2021),
  livro("rudio", ["Rudio, Franz"], 2002),
];

const com = (parcial: Partial<FormularioDeCitacao>, obra: Partial<ReturnType<typeof obraVazia>> = {}): FormularioDeCitacao => ({
  ...formularioNovo(),
  ...parcial,
  obras: [{ ...obraVazia(), ...obra }],
});

function citacaoDe(f: FormularioDeCitacao): Citacao {
  const r = formularioParaCitacao(f);
  if (!r.ok) throw new Error(`a janela recusou: ${r.erros.map((e) => e.mensagem).join(" | ")}`);
  return r.citacao;
}

/** O texto da citação nas duas normas, como o editor vai mostrar. */
function naNorma(c: Citacao) {
  const abnt = carregarNorma("abnt.txt").perfil;
  const apa = carregarNorma("apa.txt").perfil;
  return { abnt: textoDaCitacao(previaDaCitacao([], refs, abnt, c)), apa: textoDaCitacao(previaDaCitacao([], refs, apa, c)) };
}

describe("janela do @: cada forma vira a citação certa", () => {
  it("uma obra, indireta, só com a página", () => {
    const c = citacaoDe(com({}, { referencia: "silva", valor: "15" }));
    expect(c).toEqual({ tipo: "parenteses", obras: [{ referencia: "silva", localizador: { tipo: "pagina", valor: "15" } }] });
    expect(conferirCitacao(c)).toEqual(c);
    expect(naNorma(c)).toEqual({ abnt: "(Silva, 2019, p. 15)", apa: "(Silva, 2019, p. 15)" });
  });

  it("citação direta leva a marca direta", () => {
    const c = citacaoDe(com({ direta: true }, { referencia: "silva", valor: "15" }));
    expect(c).toEqual({ tipo: "parenteses", direta: true, obras: [{ referencia: "silva", localizador: { tipo: "pagina", valor: "15" } }] });
    expect(conferirCitacao(c)).toEqual(c);
  });

  it("autor no texto: narrativa", () => {
    const c = citacaoDe(com({ autorNoTexto: true }, { referencia: "lima" }));
    expect(c).toEqual({ tipo: "narrativa", obra: { referencia: "lima" } });
    expect(conferirCitacao(c)).toEqual(c);
    expect(naNorma(c)).toEqual({ abnt: "Lima, Costa e Reis (2018)", apa: "Lima et al. (2018)" });
  });

  it("várias obras: cada uma com a sua página, em ordem alfabética na norma", () => {
    const f = { ...formularioNovo(), obras: [
      { ...obraVazia(), referencia: "silva", valor: "15" },
      { ...obraVazia(), referencia: "costa", valor: "3-4" },
    ] };
    const c = citacaoDe(f);
    expect(c).toEqual({
      tipo: "parenteses",
      obras: [
        { referencia: "silva", localizador: { tipo: "pagina", valor: "15" } },
        { referencia: "costa", localizador: { tipo: "pagina", valor: "3-4" } },
      ],
    });
    expect(conferirCitacao(c)).toEqual(c);
    expect(naNorma(c)).toEqual({ abnt: "(Costa, 2021, p. 3-4; Silva, 2019, p. 15)", apa: "(Costa, 2021, pp. 3–4; Silva, 2019, p. 15)" });
  });

  it("autor no texto não vale com várias obras: a citação fica entre parênteses", () => {
    const f = { ...formularioNovo(), autorNoTexto: true, obras: [{ ...obraVazia(), referencia: "silva" }, { ...obraVazia(), referencia: "costa" }] };
    expect(citacaoDe(f).tipo).toBe("parenteses");
  });

  it("grifo e tradução: marcas na obra, escritas pela norma", () => {
    const c = citacaoDe(com({ direta: true }, { referencia: "silva", valor: "15", grifo: true, traducao: true }));
    expect(c).toEqual({
      tipo: "parenteses",
      direta: true,
      obras: [{ referencia: "silva", localizador: { tipo: "pagina", valor: "15" }, grifo: true, traducao: true }],
    });
    expect(conferirCitacao(c)).toEqual(c);
    expect(naNorma(c).abnt).toBe("(Silva, 2019, p. 15, grifo nosso, tradução nossa)");
  });

  it("outro localizador (cap., local.) guarda o tipo", () => {
    const c = citacaoDe(com({}, { referencia: "silva", onde: "outro", rotulo: "local.", valor: "7" }));
    expect(c).toEqual({ tipo: "parenteses", obras: [{ referencia: "silva", localizador: { tipo: "outro", rotulo: "local.", valor: "7" } }] });
    expect(conferirCitacao(c)).toEqual(c);
    expect(naNorma(c).abnt).toBe("(Silva, 2019, local. 7)");
  });

  it("apud: a obra original escrita por você e a obra lida da lista", () => {
    const c = citacaoDe({ ...com({ oQue: "apud", original: "Freud, 1915" }, { referencia: "costa", valor: "12" }) });
    expect(c).toEqual({ tipo: "apud", original: "Freud, 1915", obra: { referencia: "costa", localizador: { tipo: "pagina", valor: "12" } } });
    expect(conferirCitacao(c)).toEqual(c);
    expect(naNorma(c)).toEqual({ abnt: "(Freud, 1915 apud Costa, 2021, p. 12)", apa: "(Freud, 1915, como citado em Costa, 2021, p. 12)" });
  });

  it("fala sem referência: só quem fala, sem obra e sem lista", () => {
    const c = citacaoDe({ ...formularioNovo(), oQue: "fala", fala: "  Usuária A " });
    expect(c).toEqual({ tipo: "sem-referencia", texto: "Usuária A" });
    expect(conferirCitacao(c)).toEqual(c);
    expect(naNorma(c)).toEqual({ abnt: "(Usuária A)", apa: "(Usuária A)" });
  });
});

describe("janela do @: o que impede e o que só avisa", () => {
  const erros = (f: FormularioDeCitacao) => {
    const r = formularioParaCitacao(f);
    return r.ok ? [] : r.erros;
  };

  it("sem obra escolhida, sem original ou sem quem fala, não monta", () => {
    expect(erros(formularioNovo()).map((e) => e.campo)).toEqual(["obras.0"]);
    expect(erros(com({ oQue: "apud" }, { referencia: "costa" })).map((e) => e.campo)).toEqual(["original"]);
    expect(erros(com({ oQue: "apud", original: "Freud, 1915" })).map((e) => e.campo)).toEqual(["obras.0"]);
    expect(erros({ ...formularioNovo(), oQue: "fala" }).map((e) => e.campo)).toEqual(["fala"]);
  });

  it("outro localizador precisa do tipo e do número", () => {
    expect(erros(com({}, { referencia: "silva", onde: "outro", valor: "7" })).map((e) => e.campo)).toEqual(["obras.0.rotulo"]);
    expect(erros(com({}, { referencia: "silva", onde: "outro", rotulo: "cap." })).map((e) => e.campo)).toEqual(["obras.0.valor"]);
  });

  it("a mesma obra duas vezes na citação é recusada, com o número da linha da tela", () => {
    const f = { ...formularioNovo(), obras: [{ ...obraVazia(), referencia: "silva" }, { ...obraVazia(), referencia: "silva" }] };
    expect(erros(f).map((e) => e.campo)).toEqual(["obras.1"]);
  });

  it("uma linha de “+ outra obra” que ficou em branco é ignorada, e as outras mantêm o número da tela", () => {
    const certa = { ...obraVazia(), referencia: "silva" };
    const f = { ...formularioNovo(), obras: [certa, obraVazia(), { ...obraVazia(), valor: "3" }] };
    // A terceira linha tem página mas não tem obra: o erro aponta a linha 2 (a terceira da tela).
    expect(erros(f).map((e) => e.campo)).toEqual(["obras.2"]);
    const g = { ...formularioNovo(), obras: [certa, obraVazia()] };
    expect(citacaoDe(g)).toEqual({ tipo: "parenteses", obras: [{ referencia: "silva" }] });
  });

  it("citação direta sem página NÃO barra: o motor avisa e o texto sai assim mesmo", () => {
    const c = citacaoDe(com({ direta: true }, { referencia: "silva" }));
    const m = previaDaCitacao([], refs, carregarNorma("abnt.txt").perfil, c);
    expect(textoDaCitacao(m)).toBe("(Silva, 2019)");
    expect(m.avisos.map((a) => a.tipo)).toEqual(["direta-sem-pagina"]);
  });
});

describe("janela do @: editar uma citação que já está no texto", () => {
  const citacoes: Citacao[] = [
    { tipo: "parenteses", obras: [{ referencia: "silva" }] },
    { tipo: "parenteses", direta: true, obras: [{ referencia: "silva", localizador: { tipo: "pagina", valor: "15" }, grifo: true }, { referencia: "costa", traducao: true }] },
    { tipo: "narrativa", direta: true, obra: { referencia: "lima", localizador: { tipo: "outro", rotulo: "cap.", valor: "3" } } },
    { tipo: "apud", original: "Freud, 1915", obra: { referencia: "costa", localizador: { tipo: "pagina", valor: "12" } } },
    { tipo: "sem-referencia", texto: "Usuária A" },
    // Referência que já não existe: abrir e salvar não pode perder o código dela.
    { tipo: "parenteses", obras: [{ referencia: "apagada" }] },
  ];
  it("abrir e confirmar sem mexer devolve a mesma citação (nada se perde)", () => {
    for (const c of citacoes) expect(citacaoDe(citacaoParaFormulario(c))).toEqual(c);
  });
  it("a janela abre na forma certa", () => {
    expect(citacoes.map((c) => citacaoParaFormulario(c).oQue)).toEqual(["obra", "obra", "obra", "apud", "fala", "obra"]);
    expect(citacaoParaFormulario(citacoes[2]).autorNoTexto).toBe(true);
    expect(citacaoParaFormulario(citacoes[1]).obras).toHaveLength(2);
  });
});
