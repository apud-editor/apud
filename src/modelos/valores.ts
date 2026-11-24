// Tipos de valor que só os modelos usam. Os tipos comuns (medida, opção,
// texto, lista, destaque...) são os mesmos dos perfis da versão 1
// (perfis/valores.ts), para cada valor ser lido e conferido do mesmo jeito.

import { listarComE, normalizar, semAcentos } from "../perfis/texto";
import { medida, quantidade, type Leitura, type TipoValor } from "../perfis/valores";

const igual = (a: string, b: string) => semAcentos(normalizar(a)) === semAcentos(normalizar(b));

/** Aceita o primeiro tipo que conseguir ler o texto; o erro é o do primeiro. */
export function ou(descricao: string, ...tipos: TipoValor[]): TipoValor {
  return {
    descricao,
    permiteEscolha: tipos.every((t) => t.permiteEscolha),
    ler(texto, regra): Leitura {
      let primeiroErro: Leitura | undefined;
      for (const t of tipos) {
        const lido = t.ler(texto, regra);
        if (lido.ok) return lido;
        primeiroErro ??= lido;
      }
      return { ok: false, erro: `“${regra}” precisa ser ${descricao}.` };
    },
  };
}

/** Palavras que valem por um valor fixo: "nenhuma" vale 0 linha. */
function palavra(escritas: string[], leitura: Extract<Leitura, { ok: true }>): TipoValor {
  return {
    descricao: listarComE(escritas),
    permiteEscolha: true,
    ler(texto, regra) {
      return escritas.some((e) => igual(e, texto)) ? leitura : { ok: false, erro: `“${regra}” precisa ser ${listarComE(escritas)}.` };
    },
  };
}

/** Linhas em branco: "1 linha", "2 linhas", "1 linha em branco" ou "nenhuma" (que é 0). */
export function linhasEmBranco(maximo = 5): TipoValor {
  return ou(
    `um número de linhas, como “1 linha”, ou “nenhuma”`,
    quantidade("linha", "linhas", 0, maximo),
    quantidade("linha em branco", "linhas em branco", 0, maximo),
    palavra(["nenhuma"], { ok: true, valor: { tipo: "quantidade", numero: 0, unidade: "linhas" }, texto: "nenhuma" }),
  );
}

/** A palavra que, num recuo, quer dizer "o mesmo recuo do texto". */
export const COMO_NO_TEXTO = "como no texto";

/**
 * Um recuo: uma medida em cm, "nenhum" (que é 0) ou "como no texto" (o mesmo
 * recuo de parágrafo do Texto, mesmo que ele mude depois).
 */
export function recuo(maximo = 5): TipoValor {
  return ou(
    `uma medida em cm, “nenhum” ou “${COMO_NO_TEXTO}”`,
    medida("cm", 0, maximo),
    palavra(["nenhum"], { ok: true, valor: { tipo: "medida", numero: 0, unidade: "cm" }, texto: "nenhum" }),
    palavra([COMO_NO_TEXTO], { ok: true, valor: { tipo: "opcao", valor: COMO_NO_TEXTO }, texto: COMO_NO_TEXTO }),
  );
}

/** A palavra que, na distância do número da página, quer dizer "alinhado à margem". */
export const NA_MARGEM = "na margem";

/** Distância da borda lateral: uma medida em cm ou "na margem" (alinhado à margem do texto). */
export function distanciaLateral(): TipoValor {
  return ou(
    `uma medida em cm ou “${NA_MARGEM}”`,
    medida("cm", 0, 6),
    palavra([NA_MARGEM], { ok: true, valor: { tipo: "opcao", valor: NA_MARGEM }, texto: NA_MARGEM }),
  );
}

/** Texto que também aceita "nenhuma" (por exemplo, nada a escrever quando a fonte é sua). */
export function textoOuNenhum(): TipoValor {
  return {
    descricao: "um texto ou “nenhuma”",
    permiteEscolha: true,
    ler(valor, regra) {
      const t = valor.trim().replace(/\s+/g, " ");
      if (!t) return { ok: false, erro: `“${regra}” está sem valor. Escreva “nenhuma” se não houver texto.` };
      if (igual(t, "nenhuma")) return { ok: true, valor: { tipo: "texto", valor: "" }, texto: "nenhuma" };
      return { ok: true, valor: { tipo: "texto", valor: t }, texto: t };
    },
  };
}
