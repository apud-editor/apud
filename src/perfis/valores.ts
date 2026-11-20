// Os tipos de valor que uma regra pode ter, e como cada um é lido e conferido.
// Cada função devolve o valor entendido ou uma mensagem de erro em português.

import type { Valor } from "./tipos";
import { listarComE, normalizar, semAcentos, sugerir } from "./texto";

export type Leitura =
  | { ok: true; valor: Valor; texto: string }
  | { ok: false; erro: string };

export interface TipoValor {
  /** Como o tipo é descrito para a pessoa, por exemplo "uma medida em cm". */
  descricao: string;
  ler(texto: string, regra: string): Leitura;
  /**
   * Se a regra pode ser uma "escolha: a, b, c". Listas não podem,
   * porque a vírgula já separa os itens da lista.
   */
  permiteEscolha: boolean;
}

const igual = (a: string, b: string) => semAcentos(normalizar(a)) === semAcentos(normalizar(b));

/** "1.25" ou "1,25" viram 1.25; o texto final sempre usa vírgula. */
function lerNumero(texto: string): number | undefined {
  if (!/^\d+(?:[.,]\d+)?$/.test(texto)) return undefined;
  return Number(texto.replace(",", "."));
}

export function escreverNumero(n: number): string {
  return String(n).replace(".", ",");
}

/** Medida em cm ou pt: "3 cm", "1,25 cm", "12 pt". */
export function medida(unidade: "cm" | "pt", minimo: number, maximo: number): TipoValor {
  const exemplo = unidade === "cm" ? "1,25 cm" : "12 pt";
  return {
    descricao: `uma medida em ${unidade}`,
    permiteEscolha: true,
    ler(texto, regra) {
      const partes = texto.trim().match(/^(\S+?)\s*([a-zA-Z]+)?\.?$/);
      const numero = partes ? lerNumero(partes[1]) : undefined;
      if (!partes || numero === undefined) {
        return { ok: false, erro: `“${regra}” precisa ser uma medida em ${unidade}, como ${exemplo}.` };
      }
      const escrita = partes[2]?.toLowerCase();
      if (!escrita) {
        return {
          ok: false,
          erro: `falta a unidade em “${regra}”: escreva ${escreverNumero(numero)} ${unidade}.`,
        };
      }
      if (escrita !== unidade) {
        return {
          ok: false,
          erro: `“${regra}” precisa estar em ${unidade} (ex.: ${exemplo}), e não em ${escrita}.`,
        };
      }
      if (numero < minimo || numero > maximo) {
        return {
          ok: false,
          erro: `“${regra}” precisa ficar entre ${escreverNumero(minimo)} e ${escreverNumero(maximo)} ${unidade}.`,
        };
      }
      return {
        ok: true,
        valor: { tipo: "medida", numero, unidade },
        texto: `${escreverNumero(numero)} ${unidade}`,
      };
    },
  };
}

/** Número inteiro com uma palavra de unidade: "3 linhas", "40 palavras", "1 linha". */
export function quantidade(
  singular: string,
  plural: string,
  minimo: number,
  maximo: number,
): TipoValor {
  return {
    descricao: `um número de ${plural}`,
    permiteEscolha: true,
    ler(texto, regra) {
      const partes = normalizar(texto).match(/^(\d+)\s+(.+)$/);
      if (!partes || !(igual(partes[2], singular) || igual(partes[2], plural))) {
        return {
          ok: false,
          erro: `“${regra}” precisa ser um número de ${plural}, como “3 ${plural}”.`,
        };
      }
      const numero = Number(partes[1]);
      if (numero < minimo || numero > maximo) {
        return {
          ok: false,
          erro: `“${regra}” precisa ficar entre ${minimo} e ${maximo} ${plural}.`,
        };
      }
      return {
        ok: true,
        valor: { tipo: "quantidade", numero, unidade: plural },
        texto: `${numero} ${numero === 1 ? singular : plural}`,
      };
    },
  };
}

/** Faixa: "150 a 500 palavras". */
export function faixa(unidade: string, minimo: number, maximo: number): TipoValor {
  return {
    descricao: `uma faixa de ${unidade}`,
    permiteEscolha: false,
    ler(texto, regra) {
      const partes = normalizar(texto).match(/^(\d+)\s+a\s+(\d+)\s+(.+)$/);
      if (!partes || !igual(partes[3], unidade)) {
        return {
          ok: false,
          erro: `“${regra}” precisa ser uma faixa de ${unidade}, como “150 a 500 ${unidade}”.`,
        };
      }
      const de = Number(partes[1]);
      const ate = Number(partes[2]);
      if (de >= ate) {
        return {
          ok: false,
          erro: `em “${regra}”, o primeiro número (${de}) precisa ser menor que o segundo (${ate}).`,
        };
      }
      if (de < minimo || ate > maximo) {
        return {
          ok: false,
          erro: `“${regra}” precisa ficar entre ${minimo} e ${maximo} ${unidade}.`,
        };
      }
      return {
        ok: true,
        valor: { tipo: "faixa", minimo: de, maximo: ate, unidade },
        texto: `${de} a ${ate} ${unidade}`,
      };
    },
  };
}

/** Entrelinhas: "simples", "1,5", "duplo". */
export function espacamento(): TipoValor {
  return {
    descricao: "um espaçamento (simples, 1,5 ou duplo)",
    permiteEscolha: true,
    ler(texto, regra) {
      const t = normalizar(texto);
      let numero: number | undefined;
      if (t === "simples") numero = 1;
      else if (t === "duplo") numero = 2;
      else numero = lerNumero(t);
      if (numero === undefined || numero < 1 || numero > 3) {
        return {
          ok: false,
          erro: `“${regra}” precisa ser “simples”, “1,5” ou “duplo”.`,
        };
      }
      const nome = numero === 1 ? "simples" : numero === 2 ? "duplo" : escreverNumero(numero);
      return { ok: true, valor: { tipo: "espacamento", numero }, texto: nome };
    },
  };
}

/**
 * Um valor entre os que o Apud sabe aplicar. Quando só há um, a regra
 * existe para documentar a norma, e mudar o valor exige mudar o programa.
 */
export function opcao(...valores: string[]): TipoValor {
  return {
    descricao: valores.length === 1 ? `“${valores[0]}”` : `um destes: ${listarComE(valores)}`,
    permiteEscolha: true,
    ler(texto, regra) {
      const achado = valores.find((v) => igual(v, texto));
      if (achado) return { ok: true, valor: { tipo: "opcao", valor: achado }, texto: achado };
      if (valores.length === 1) {
        return {
          ok: false,
          erro:
            `“${regra}” só aceita “${valores[0]}”, que é como o Apud aplica esta regra. ` +
            `Outro valor exige mudar o programa; anote o pedido e fale com quem programa.`,
        };
      }
      const parecido = sugerir(texto, valores);
      const dica = parecido ? ` Você quis dizer “${parecido}”?` : "";
      return {
        ok: false,
        erro: `“${texto.trim()}” não é um valor aceito para “${regra}”. Use ${listarComE(valores)}.${dica}`,
      };
    },
  };
}

export function simNao(): TipoValor {
  return {
    descricao: "sim ou não",
    permiteEscolha: true,
    ler(texto, regra) {
      if (igual(texto, "sim")) return { ok: true, valor: { tipo: "simnao", valor: true }, texto: "sim" };
      if (igual(texto, "não")) return { ok: true, valor: { tipo: "simnao", valor: false }, texto: "não" };
      return { ok: false, erro: `“${regra}” precisa ser “sim” ou “não”.` };
    },
  };
}

/** Texto livre: rótulos como "Palavras-chave:" ou termos como "[S. l.]". */
export function texto(): TipoValor {
  return {
    descricao: "um texto",
    permiteEscolha: true,
    ler(valor, regra) {
      const t = valor.trim().replace(/\s+/g, " ");
      if (!t) return { ok: false, erro: `“${regra}” está sem valor.` };
      return { ok: true, valor: { tipo: "texto", valor: t }, texto: t };
    },
  };
}

/**
 * Lista separada por vírgulas. Com vocabulário, cada item precisa ser um
 * dos conhecidos; "(opcional)" depois do item é aceito quando permitido.
 */
export function lista(
  vocabulario?: readonly string[],
  opcoes: { aceitaOpcional?: boolean; quantidadeExata?: number } = {},
): TipoValor {
  return {
    descricao: "uma lista separada por vírgulas",
    permiteEscolha: false,
    ler(valor, regra) {
      const itens = valor
        .split(",")
        .map((i) => i.trim().replace(/\s+/g, " "))
        .filter((i) => i.length > 0);
      if (itens.length === 0) return { ok: false, erro: `“${regra}” está sem valor.` };
      if (opcoes.quantidadeExata !== undefined && itens.length !== opcoes.quantidadeExata) {
        return {
          ok: false,
          erro: `“${regra}” precisa ter ${opcoes.quantidadeExata} itens separados por vírgula; há ${itens.length}.`,
        };
      }
      if (!vocabulario) {
        return { ok: true, valor: { tipo: "lista", itens }, texto: itens.join(", ") };
      }
      const canonicos: string[] = [];
      for (const item of itens) {
        let nome = item;
        let sufixo = "";
        if (opcoes.aceitaOpcional && /\s*\(opcional\)$/i.test(item)) {
          nome = item.replace(/\s*\(opcional\)$/i, "");
          sufixo = " (opcional)";
        }
        const achado = vocabulario.find((v) => igual(v, nome));
        if (!achado) {
          const parecido = sugerir(nome, vocabulario);
          const dica = parecido ? ` Você quis dizer “${parecido}”?` : ` Itens aceitos: ${listarComE(vocabulario)}.`;
          return { ok: false, erro: `não conheço o item “${nome}” em “${regra}”.${dica}` };
        }
        if (canonicos.some((c) => c.replace(" (opcional)", "") === achado)) {
          return { ok: false, erro: `o item “${achado}” aparece duas vezes em “${regra}”.` };
        }
        canonicos.push(achado + sufixo);
      }
      return { ok: true, valor: { tipo: "lista", itens: canonicos }, texto: canonicos.join(", ") };
    },
  };
}

const PARTES_DO_DESTAQUE = ["maiúsculas", "negrito", "itálico", "sublinhado"] as const;

/** Destaque de título: "maiúsculas, negrito", "itálico" ou "normal". */
export function destaque(): TipoValor {
  return {
    descricao: "um destaque (maiúsculas, negrito, itálico, sublinhado ou normal)",
    permiteEscolha: false,
    ler(valor, regra) {
      if (igual(valor, "normal")) {
        return {
          ok: true,
          valor: { tipo: "destaque", maiusculas: false, negrito: false, italico: false, sublinhado: false },
          texto: "normal",
        };
      }
      const pedacos = normalizar(valor)
        .split(/\s*,\s*|\s+e\s+/)
        .filter(Boolean);
      const usados = new Set<string>();
      for (const p of pedacos) {
        const achado = PARTES_DO_DESTAQUE.find((d) => igual(d, p));
        if (!achado) {
          return {
            ok: false,
            erro:
              `“${p}” não é um destaque que o Apud conheça, em “${regra}”. ` +
              `Use ${listarComE(PARTES_DO_DESTAQUE)} (pode juntar com vírgula) ou “normal”.`,
          };
        }
        usados.add(achado);
      }
      const ordem = PARTES_DO_DESTAQUE.filter((d) => usados.has(d));
      return {
        ok: true,
        valor: {
          tipo: "destaque",
          maiusculas: usados.has("maiúsculas"),
          negrito: usados.has("negrito"),
          italico: usados.has("itálico"),
          sublinhado: usados.has("sublinhado"),
        },
        texto: ordem.join(", "),
      };
    },
  };
}

/** As abreviaturas dos 12 meses, de janeiro a dezembro. */
export function meses(): TipoValor {
  const base = lista(undefined, { quantidadeExata: 12 });
  return {
    descricao: "as abreviaturas dos 12 meses",
    permiteEscolha: false,
    ler(valor, regra) {
      const lido = base.ler(valor, regra);
      if (!lido.ok || lido.valor.tipo !== "lista") return lido;
      return { ok: true, valor: { tipo: "meses", itens: lido.valor.itens }, texto: lido.texto };
    },
  };
}

/** Nome de um arquivo de estilo de citações, que fica na pasta perfis/estilos. */
export function arquivoCsl(): TipoValor {
  return {
    descricao: "o nome de um arquivo .csl",
    permiteEscolha: false,
    ler(valor, regra) {
      const t = valor.trim();
      if (!/^[\w.-]+\.csl$/i.test(t)) {
        return {
          ok: false,
          erro: `“${regra}” precisa ser o nome de um arquivo da pasta estilos, terminado em .csl (ex.: abnt.csl).`,
        };
      }
      return { ok: true, valor: { tipo: "texto", valor: t }, texto: t };
    },
  };
}

/**
 * Modelo de referência (como "SOBRENOME, Prenome. **Título**..."). Serve para
 * conferência: quem monta a referência é o estilo CSL. Negrito vai entre ** **
 * e itálico entre * *.
 */
export function modelo(): TipoValor {
  const t = texto();
  return { ...t, descricao: "um modelo de referência", permiteEscolha: false };
}
