// A janela da citação ("@"): o que a pessoa preenche, e como isso vira uma
// citação do modelo do Apud (documento/referencias.ts). Funções puras, sem
// tela, para poderem ser testadas sem navegador.
//
// Nada de norma fica aqui. A janela só junta os dados da citação (quais obras,
// qual página, se é direta...). Quem escreve "(Silva, 2019, p. 15)" na forma da
// ABNT ou da APA é o motor de citações (motor.ts), com as regras do perfil.

import { conferirCitacao } from "../arquivos/formato";
import type { Citacao, Localizador, ObraCitada } from "../documento/modelo";

/** O que a pessoa está citando. */
export type OQueSeCita =
  /** Uma ou mais obras da lista de referências. */
  | "obra"
  /** Citação de citação (apud): a obra original você não leu. */
  | "apud"
  /** Fala de paciente, de participante ou comunicação pessoal: não entra na lista. */
  | "fala";

/** Uma obra na janela. */
export interface ObraNoFormulario {
  /** O código da referência ("" enquanto a pessoa não escolheu). */
  referencia: string;
  /** "pagina": só o número ("15", "4-5"). "outro": com o tipo ("cap.", "local.", "min"). */
  onde: "pagina" | "outro";
  rotulo: string;
  valor: string;
  /** Grifo nosso (ênfase adicionada, na APA). */
  grifo: boolean;
  /** Tradução nossa. */
  traducao: boolean;
}

export interface FormularioDeCitacao {
  oQue: OQueSeCita;
  /** Autor no texto: "Silva (2019)". Só com uma obra. */
  autorNoTexto: boolean;
  /** Citação direta (transcrição do trecho): a norma pede a página. */
  direta: boolean;
  /** Em "obra": uma ou mais. Em "apud": só a primeira (a obra que você leu). */
  obras: ObraNoFormulario[];
  /** Só em "apud": a obra original, escrita por você ("Freud, 1915"). */
  original: string;
  /** Só em "fala": quem fala ("Usuária A"). */
  fala: string;
}

export interface ErroDoFormulario {
  /** "obras.0", "original", "fala"... para a tela pôr o erro no lugar certo. */
  campo: string;
  mensagem: string;
}

export const obraVazia = (): ObraNoFormulario => ({
  referencia: "",
  onde: "pagina",
  rotulo: "",
  valor: "",
  grifo: false,
  traducao: false,
});

export const formularioNovo = (): FormularioDeCitacao => ({
  oQue: "obra",
  autorNoTexto: false,
  direta: false,
  obras: [obraVazia()],
  original: "",
  fala: "",
});

// ---------------------------------------------------------------------------
// Da citação para a janela (editar uma citação que já está no texto)

function obraParaFormulario(o: ObraCitada): ObraNoFormulario {
  const l = o.localizador;
  return {
    referencia: o.referencia,
    onde: l?.tipo === "outro" ? "outro" : "pagina",
    rotulo: l?.tipo === "outro" ? l.rotulo : "",
    valor: l?.valor ?? "",
    grifo: !!o.grifo,
    traducao: !!o.traducao,
  };
}

export function citacaoParaFormulario(c: Citacao): FormularioDeCitacao {
  const base = formularioNovo();
  switch (c.tipo) {
    case "parenteses":
      return { ...base, direta: !!c.direta, obras: c.obras.map(obraParaFormulario) };
    case "narrativa":
      return { ...base, autorNoTexto: true, direta: !!c.direta, obras: [obraParaFormulario(c.obra)] };
    case "apud":
      return { ...base, oQue: "apud", direta: !!c.direta, original: c.original, obras: [obraParaFormulario(c.obra)] };
    case "sem-referencia":
      return { ...base, oQue: "fala", fala: c.texto };
  }
}

// ---------------------------------------------------------------------------
// Da janela para a citação

function localizadorDaObra(o: ObraNoFormulario, indice: number, erros: ErroDoFormulario[]): Localizador | undefined {
  const valor = o.valor.trim();
  if (o.onde === "outro") {
    const rotulo = o.rotulo.trim();
    if (!valor && !rotulo) return undefined;
    if (!rotulo) {
      erros.push({ campo: `obras.${indice}.rotulo`, mensagem: "Escreva o tipo do localizador, como cap. ou local." });
      return undefined;
    }
    if (!valor) {
      erros.push({ campo: `obras.${indice}.valor`, mensagem: `Escreva o número depois de “${rotulo}”.` });
      return undefined;
    }
    return { tipo: "outro", rotulo, valor };
  }
  return valor ? { tipo: "pagina", valor } : undefined;
}

function obraDoFormulario(o: ObraNoFormulario, indice: number, erros: ErroDoFormulario[]): ObraCitada | null {
  if (!o.referencia) {
    erros.push({ campo: `obras.${indice}`, mensagem: "Escolha a obra na lista." });
    return null;
  }
  const obra: ObraCitada = { referencia: o.referencia };
  const localizador = localizadorDaObra(o, indice, erros);
  if (localizador) obra.localizador = localizador;
  if (o.grifo) obra.grifo = true;
  if (o.traducao) obra.traducao = true;
  return obra;
}

/** Uma linha que a pessoa abriu com "+ outra obra" e não usou: não conta. */
const linhaEmBranco = (o: ObraNoFormulario) => !o.referencia && !o.valor.trim() && !o.rotulo.trim() && !o.grifo && !o.traducao;

export type ResultadoDaJanela = { ok: true; citacao: Citacao } | { ok: false; erros: ErroDoFormulario[] };

/**
 * Confere a janela e monta a citação. Só barra o que não dá para montar (falta
 * a obra, falta quem fala). O que a norma pede e falta (a página de uma
 * citação direta, por exemplo) NÃO barra: o motor avisa, o PDF sai assim mesmo.
 */
export function formularioParaCitacao(f: FormularioDeCitacao): ResultadoDaJanela {
  const erros: ErroDoFormulario[] = [];
  const direta = f.direta ? { direta: true as const } : {};
  let citacao: Citacao | null = null;

  if (f.oQue === "fala") {
    const texto = f.fala.trim();
    if (!texto) erros.push({ campo: "fala", mensagem: "Escreva quem fala, como Usuária A." });
    else citacao = { tipo: "sem-referencia", texto };
  } else if (f.oQue === "apud") {
    const original = f.original.trim();
    if (!original) erros.push({ campo: "original", mensagem: "Escreva a obra original, como Freud, 1915." });
    const lida = obraDoFormulario(f.obras[0] ?? obraVazia(), 0, erros);
    if (original && lida) citacao = { tipo: "apud", ...direta, original, obra: lida };
  } else {
    // Os números dos erros são os da tela: as linhas em branco são puladas, mas não renumeradas.
    const usadas = f.obras.map((o, i) => ({ o, i })).filter(({ o, i }) => i === 0 || !linhaEmBranco(o));
    const obras = usadas.map(({ o, i }) => obraDoFormulario(o, i, erros));
    const repetida = usadas.find(({ o }, k) => o.referencia && usadas.findIndex((x) => x.o.referencia === o.referencia) !== k);
    if (repetida) {
      erros.push({
        campo: `obras.${repetida.i}`,
        mensagem: "Esta obra já está na citação. Para duas páginas da mesma obra, escreva as duas na página (4, 9).",
      });
    }
    if (obras.every((o): o is ObraCitada => !!o) && !repetida) {
      const lista = obras as ObraCitada[];
      // Autor no texto só vale com uma obra; com várias, a citação fica entre parênteses.
      citacao =
        lista.length === 1 && f.autorNoTexto
          ? { tipo: "narrativa", ...direta, obra: lista[0] }
          : { tipo: "parenteses", ...direta, obras: lista };
    }
  }

  if (erros.length || !citacao) return { ok: false, erros: erros.length ? erros : [{ campo: "", mensagem: "Falta preencher a citação." }] };
  // Cinto e suspensório: o que a janela monta tem de passar pela mesma conferência do arquivo.
  const conferida = conferirCitacao(citacao);
  if (!conferida) return { ok: false, erros: [{ campo: "", mensagem: "Não consegui montar esta citação. Confira os campos." }] };
  return { ok: true, citacao: conferida };
}
