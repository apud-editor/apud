// Testes do motor de citações: os casos difíceis, nas duas normas, com os
// perfis de verdade (perfis/abnt.txt e perfis/apa.txt).

import { describe, expect, it } from "vitest";
import { carregarNorma } from "../../scripts/prova-lib";
import { criarMotor, pedacosComoTexto, type Aviso } from "./motor";
import { posicionarEnfase } from "../conversor/typst";
import { documentoVazio, type Autor, type Citacao, type Documento, type ObraCitada, type Referencia } from "../documento/modelo";

const pessoa = (nome: string): Autor => {
  const [sobrenome, prenomes] = nome.split(",").map((s) => s.trim());
  return prenomes ? { sobrenome, prenomes } : { sobrenome };
};
const livro = (id: string, autores: string[], ano: number | undefined, titulo = `Obra ${id}`, extra: Partial<Referencia> = {}): Referencia => ({
  id,
  tipo: "livro",
  autores: autores.map(pessoa),
  titulo,
  ...(ano ? { data: { ano } } : {}),
  editora: "Vozes",
  cidade: "Petrópolis",
  ...extra,
});
const obra = (referencia: string, pagina?: string): ObraCitada =>
  pagina ? { referencia, localizador: { tipo: "pagina", valor: pagina } } : { referencia };
const par = (...obras: ObraCitada[]): Citacao => ({ tipo: "parenteses", obras });
const narr = (o: ObraCitada): Citacao => ({ tipo: "narrativa", obra: o });

/** Monta as citações na ordem dada, num documento com estas referências, e devolve o texto de cada uma. */
function montar(norma: "abnt.txt" | "apa.txt", referencias: Referencia[], citacoes: Citacao[], ajustes: Record<string, string> = {}) {
  const { perfil } = carregarNorma(norma, ajustes);
  const doc: Documento = {
    ...documentoVazio(),
    referencias,
    blocos: [{ tipo: "paragrafo", trechos: citacoes.map((citacao) => ({ citacao })) }],
  };
  const motor = criarMotor(doc, perfil);
  const avisos: Aviso[] = [];
  const textos = citacoes.map((c) => {
    const m = motor.montar(c);
    avisos.push(...m.avisos);
    return pedacosComoTexto(m.pedacos);
  });
  return { textos, avisos, motor };
}

describe("citação narrativa", () => {
  const refs = [livro("lima", ["Lima, Ana", "Costa, Bruno", "Reis, Carla"], 2018), livro("dias", ["Dias, Eva", "Lopes, Ivo"], 2025)];
  it("ABNT: vírgula e “e” entre os nomes, ano e página entre parênteses", () => {
    expect(montar("abnt.txt", refs, [narr(obra("lima")), narr(obra("dias", "4"))]).textos).toEqual([
      "Lima, Costa e Reis (2018)",
      "Dias e Lopes (2025, p. 4)",
    ]);
  });
  it("APA: et al. com três autores e “e” com dois", () => {
    expect(montar("apa.txt", refs, [narr(obra("lima")), narr(obra("dias", "4"))]).textos).toEqual([
      "Lima et al. (2018)",
      "Dias e Lopes (2025, p. 4)",
    ]);
  });
});

describe("várias obras na mesma citação", () => {
  const refs = [
    livro("silva", ["Silva, Ana"], 2007),
    livro("ferreira", ["Ferreira, Rui"], 2006),
    livro("rudio2", ["Rudio, Franz"], 2003),
    livro("rudio1", ["Rudio, Franz"], 2002),
  ];
  it("ABNT: ordem alfabética, ponto e vírgula entre autores e vírgula entre anos do mesmo autor", () => {
    expect(montar("abnt.txt", refs, [par(obra("silva"), obra("rudio2"), obra("ferreira"), obra("rudio1"))]).textos).toEqual([
      "(Ferreira, 2006; Rudio, 2002, 2003; Silva, 2007)",
    ]);
  });
  it("APA: a mesma ordem, com a página de cada obra", () => {
    expect(montar("apa.txt", refs, [par(obra("silva", "3"), obra("ferreira"))]).textos).toEqual([
      "(Ferreira, 2006; Silva, 2007, p. 3)",
    ]);
  });
  it("a ordem alfabética ignora acentos: Ávila vem antes de Zé", () => {
    const comAcento = [livro("ze", ["Zé, Maria"], 2020), livro("avila", ["Ávila, João"], 2020), livro("bento", ["Bento, Luís"], 2020)];
    expect(montar("abnt.txt", comAcento, [par(obra("ze"), obra("bento"), obra("avila"))]).textos).toEqual([
      "(Ávila, 2020; Bento, 2020; Zé, 2020)",
    ]);
  });
});

describe("desempate de autores com o mesmo sobrenome", () => {
  const refs = [livro("jose", ["Silva, José"], 2021), livro("marta", ["Silva, Marta"], 2021), livro("joao", ["Silva, João Pedro"], 2019)];
  it("ABNT: iniciais depois do sobrenome, só quando o ano é o mesmo", () => {
    expect(montar("abnt.txt", refs, [par(obra("jose"), obra("marta")), par(obra("joao"))]).textos).toEqual([
      "(Silva, J., 2021; Silva, M., 2021)",
      "(Silva, 2019)",
    ]);
  });
  it("APA: iniciais antes do sobrenome, em qualquer ano", () => {
    expect(montar("apa.txt", refs, [par(obra("jose"), obra("marta")), par(obra("joao"))]).textos).toEqual([
      "(J. Silva, 2021; M. Silva, 2021)",
      "(J. P. Silva, 2019)",
    ]);
  });
  it("só conta quem é citado: uma obra cadastrada e não citada não força as iniciais", () => {
    expect(montar("apa.txt", refs, [par(obra("joao"))]).textos).toEqual(["(Silva, 2019)"]);
  });
  it("as partículas (de, da) ficam fora das iniciais", () => {
    const dois = [livro("a", ["Freitas, Lucas Moreira de"], 2017), livro("b", ["Freitas, Ana"], 2017)];
    expect(montar("apa.txt", dois, [par(obra("a")), par(obra("b"))]).textos).toEqual(["(L. M. Freitas, 2017)", "(A. Freitas, 2017)"]);
  });
});

describe("mesmo autor e mesmo ano", () => {
  const refs = [livro("b", ["Souza, Maria"], 2020, "Escuta qualificada"), livro("a", ["Souza, Maria"], 2020, "Clínica ampliada")];
  it("letras pela ordem dos títulos, agrupadas na mesma citação", () => {
    expect(montar("abnt.txt", refs, [par(obra("b"), obra("a"))]).textos).toEqual(["(Souza, 2020a, 2020b)"]);
    expect(montar("apa.txt", refs, [narr(obra("b"))]).textos).toEqual(["Souza (2020)"]);
  });
  it("as letras só entram quando as duas obras são citadas", () => {
    expect(montar("apa.txt", refs, [narr(obra("b")), narr(obra("a"))]).textos).toEqual(["Souza (2020b)", "Souza (2020a)"]);
  });
});

describe("et al.", () => {
  const quatro = livro("alves", ["Alves, Ana", "Brito, Bruno", "Cunha, Carla", "Dias, Davi"], 2022);
  it("ABNT: todos os autores por padrão; et al. (em itálico) quando é a escolha", () => {
    expect(montar("abnt.txt", [quatro], [par(obra("alves"))]).textos).toEqual(["(Alves; Brito; Cunha; Dias, 2022)"]);
    expect(montar("abnt.txt", [quatro], [par(obra("alves"))], { "autores, quatro ou mais": "primeiro com et al." }).textos).toEqual([
      "(Alves *et al.*, 2022)",
    ]);
  });
  it("APA: quando duas obras ficariam iguais com et al., entram os nomes até diferenciar", () => {
    const refs = [
      livro("k1", ["Kapoor, A", "Bloom, B", "Montez, C", "Lee, D"], 2017),
      livro("k2", ["Kapoor, A", "Bloom, B", "Zucker, E", "Ito, F"], 2017),
      livro("k3", ["Kapoor, A", "Ruiz, G", "Lima, H"], 2015),
    ];
    expect(montar("apa.txt", refs, [par(obra("k1")), narr(obra("k2")), par(obra("k3"))]).textos).toEqual([
      "(Kapoor, Bloom, Montez, et al., 2017)",
      "Kapoor, Bloom, Zucker, et al. (2017)",
      "(Kapoor et al., 2015)",
    ]);
  });
  it("APA, quando a revista pede: todos os autores na primeira citação, et al. depois", () => {
    const tres = livro("m", ["Monzelli, Ana", "Navarro, Bia", "Cagnin, Caio"], 2023);
    expect(
      montar("apa.txt", [tres], [par(obra("m")), narr(obra("m"))], { "citação, primeira vez com três a cinco autores": "todos os autores" }).textos,
    ).toEqual(["(Monzelli, Navarro, & Cagnin, 2023)", "Monzelli et al. (2023)"]);
  });
});

describe("páginas", () => {
  const refs = [livro("s", ["Silva, Ana"], 2019)];
  it("intervalo: ABNT “p. 4-5”; APA “pp. 4–5” (com o traço da APA)", () => {
    expect(montar("abnt.txt", refs, [par(obra("s", "4-5"))]).textos).toEqual(["(Silva, 2019, p. 4-5)"]);
    expect(montar("apa.txt", refs, [par(obra("s", "4-5")), par(obra("s", "12"))]).textos).toEqual([
      "(Silva, 2019, pp. 4–5)",
      "(Silva, 2019, p. 12)",
    ]);
  });
  it("outros localizadores saem como escritos", () => {
    const c = par({ referencia: "s", localizador: { tipo: "outro", rotulo: "local.", valor: "7" } });
    expect(montar("abnt.txt", refs, [c]).textos).toEqual(["(Silva, 2019, local. 7)"]);
  });
});

describe("obra sem autor, lei e instituição", () => {
  const refs: Referencia[] = [
    { id: "guia", tipo: "livro", autores: [], titulo: "Guia de normalização", data: { ano: 2025 } },
    { id: "noticia", tipo: "noticia", autores: [], titulo: "Abrigo amplia vagas", data: { ano: 2024 }, publicacao: { titulo: "Jornal" } },
    { id: "lei", tipo: "lei", autores: [{ instituicao: "Brasil" }], titulo: "Lei nº 10.216, de 6 de abril de 2001", data: { ano: 2001 } },
    { id: "abep", tipo: "livro", autores: [{ instituicao: "Associação Brasileira de Ensino de Psicologia" }], titulo: "Diretrizes", data: { ano: 2023 } },
  ];
  const citacoes = refs.map((r) => par(obra(r.id)));
  it("ABNT: primeira palavra do título e [...]; lei e instituição pelo autor", () => {
    expect(montar("abnt.txt", refs, citacoes).textos).toEqual([
      "(Guia [...], 2025)",
      "(Abrigo [...], 2024)",
      "(Brasil, 2001)",
      "(Associação Brasileira de Ensino de Psicologia, 2023)",
    ]);
  });
  it("APA: título em itálico (obra sozinha) ou entre aspas (parte de outra); lei pelo título", () => {
    expect(montar("apa.txt", refs, citacoes).textos).toEqual([
      "(*Guia de normalização*, 2025)",
      "(“Abrigo amplia vagas”, 2024)",
      "(Lei nº 10.216, 2001)",
      "(Associação Brasileira de Ensino de Psicologia, 2023)",
    ]);
  });
});

describe("apud, grifo, tradução e fala sem referência", () => {
  const refs = [livro("costa", ["Costa, Helena"], 2021), livro("smith", ["Smith, John"], 2019)];
  const apud: Citacao = { tipo: "apud", original: "Freud, 1915", obra: obra("costa", "12") };
  const grifo: Citacao = { tipo: "parenteses", direta: true, obras: [{ ...obra("costa", "47"), grifo: true }] };
  const traducao: Citacao = { tipo: "parenteses", direta: true, obras: [{ ...obra("smith", "4"), traducao: true }] };
  const fala: Citacao = { tipo: "sem-referencia", texto: "Usuária A" };
  it("ABNT", () => {
    expect(montar("abnt.txt", refs, [apud, grifo, traducao, fala]).textos).toEqual([
      "(Freud, 1915 *apud* Costa, 2021, p. 12)",
      "(Costa, 2021, p. 47, grifo nosso)",
      "(Smith, 2019, p. 4, tradução nossa)",
      "(Usuária A)",
    ]);
  });
  it("APA: “como citado em”; o destaque vai dentro do texto citado, não na chamada", () => {
    expect(montar("apa.txt", refs, [apud, grifo, traducao, fala]).textos).toEqual([
      "(Freud, 1915, como citado em Costa, 2021, p. 12)",
      "(Costa, 2021, p. 47)",
      "(Smith, 2019, p. 4, tradução nossa)",
      "(Usuária A)",
    ]);
  });
  it("APA: “[ênfase adicionada]” entra logo depois do último trecho em itálico antes da citação", () => {
    const trechos = posicionarEnfase(
      [
        { texto: "“o cuidado " },
        { texto: "não é uma etapa", marcas: ["italico"] },
        { texto: ", é uma postura” " },
        { citacao: grifo },
        { texto: " e " },
        { citacao: par(obra("smith")) },
      ],
      "[ênfase adicionada]",
    );
    expect(trechos.slice(0, 4)).toEqual([
      { texto: "“o cuidado " },
      { texto: "não é uma etapa", marcas: ["italico"] },
      { texto: " [ênfase adicionada]" },
      { texto: ", é uma postura” " },
    ]);
    expect(posicionarEnfase([{ texto: "sem itálico " }, { citacao: grifo }], "[ênfase adicionada]")).toEqual([
      { texto: "sem itálico " },
      { citacao: grifo },
    ]);
  });
  it("ABNT: a escolha “grifo próprio” muda a expressão", () => {
    expect(montar("abnt.txt", refs, [grifo], { "citação, destaque seu": "grifo próprio" }).textos).toEqual([
      "(Costa, 2021, p. 47, grifo próprio)",
    ]);
  });
});

describe("dado faltando: o Apud monta e avisa", () => {
  it("citação direta sem página", () => {
    const refs = [livro("s", ["Silva, Ana"], 2019)];
    const { textos, avisos } = montar("abnt.txt", refs, [{ tipo: "parenteses", direta: true, obras: [obra("s")] }]);
    expect(textos).toEqual(["(Silva, 2019)"]);
    expect(avisos.map((a) => a.tipo)).toEqual(["direta-sem-pagina"]);
  });
  it("obra sem data: ABNT avisa (pede a data provável); APA usa s.d. sem aviso", () => {
    const refs = [livro("s", ["Silva, Ana"], undefined)];
    const abnt = montar("abnt.txt", refs, [par(obra("s"))]);
    expect(abnt.textos).toEqual(["(Silva, s.d.)"]);
    expect(abnt.avisos.map((a) => a.tipo)).toEqual(["sem-data"]);
    const apa = montar("apa.txt", refs, [par(obra("s"))]);
    expect(apa.textos).toEqual(["(Silva, s.d.)"]);
    expect(apa.avisos).toEqual([]);
  });
  it("data provável na ABNT: sai como escrita; na APA, s.d.", () => {
    const refs = [livro("m", ["Moura, Lúcia"], undefined, "Memórias", { dataIncerta: "[201-?]" })];
    expect(montar("abnt.txt", refs, [par(obra("m"))]).textos).toEqual(["(Moura, [201-?])"]);
    expect(montar("apa.txt", refs, [par(obra("m"))]).textos).toEqual(["(Moura, s.d.)"]);
  });
  it("referência apagada: a citação mostra o problema, avisa, e não entra na lista", () => {
    const refs = [livro("s", ["Silva, Ana"], 2019)];
    const { textos, avisos, motor } = montar("abnt.txt", refs, [par(obra("apagada")), par(obra("s"), obra("apagada"))]);
    expect(textos).toEqual(["(referência apagada)", "(Silva, 2019; referência apagada)"]);
    expect(avisos.map((a) => a.tipo)).toEqual(["referencia-apagada", "referencia-apagada"]);
    expect(motor.citadas).toEqual(["s"]);
  });
});

describe("lista de referências", () => {
  it("só entram as obras citadas", () => {
    const refs = [livro("a", ["Alves, Ana"], 2020), livro("b", ["Brito, Bia"], 2021)];
    const { motor } = montar("abnt.txt", refs, [par(obra("b"))]);
    expect(Object.keys(motor.referenciasDoTypst)).toEqual(["b"]);
  });
});
