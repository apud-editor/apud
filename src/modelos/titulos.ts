// Os títulos automáticos (decisão 10 da v2, etapa 2): numeração, maiúsculas e
// página nova, ligadas pelo modelo e desligadas título a título com "só este".
//
// Uma conta só serve ao PDF (conversor), ao número em cinza no editor e à
// Estrutura: os três nunca discordam.
//
//   - Numeração: 1, 1.1, 1.1.1... na ordem do texto. Um título sem número
//     (opção desligada no nível ou "só este") não gasta número nem zera os de
//     baixo. Um nível pulado sai com zero (1.0.1), como no Word.
//   - Maiúsculas: o "maiúsculas" do destaque do nível vale para as letras que
//     a pessoa escreveu, quando "maiúsculas sozinho" está ligado.
//   - Página nova: "sim", "não" ou "menos em artigo" (a NBR 14724 pede página
//     nova a cada seção primária; o artigo, pela NBR 6022, não).

import type { Excecoes, NivelDeTitulo, TipoDeTrabalho } from "../documento/modelo";
import { valorNoBloco } from "./excecoes";
import type { ModeloResolvido } from "./tipos";

export interface TituloParaContar {
  nivel: NivelDeTitulo;
  excecoes?: Excecoes;
}

export interface FormaDoTitulo {
  /** O número que o Apud dá ao título ("1.1"); undefined quando ele sai sem número. */
  numero?: string;
  /** O nível pulado, quando o número saiu com zero (1.0.1): o nível de cima que faltou. */
  nivelPulado?: NivelDeTitulo;
  paginaNova: boolean;
  /** As letras do título vão em maiúsculas no PDF. */
  maiusculas: boolean;
}

const sim = (modelo: ModeloResolvido, nivel: NivelDeTitulo, propriedade: string, excecoes?: Excecoes) => {
  const v = valorNoBloco(modelo, `titulos.nivel${nivel}`, propriedade, excecoes)?.valor;
  return v?.tipo === "simnao" && v.valor;
};

/** Se o título sai com número automático (sem contar a posição dele no texto). */
export function numeraSozinho(modelo: ModeloResolvido, nivel: NivelDeTitulo, excecoes?: Excecoes): boolean {
  return sim(modelo, nivel, "numerar sozinho", excecoes);
}

/** Se o título começa em página nova neste trabalho. */
export function comecaEmPaginaNova(modelo: ModeloResolvido, nivel: NivelDeTitulo, tipo: TipoDeTrabalho, excecoes?: Excecoes): boolean {
  const v = valorNoBloco(modelo, `titulos.nivel${nivel}`, "página nova", excecoes)?.texto;
  return v === "sim" || (v === "menos em artigo" && tipo !== "artigo");
}

/** Se as letras do título vão em maiúsculas no PDF: o destaque pede e o Apud pode mexer. */
export function vaiEmMaiusculas(modelo: ModeloResolvido, nivel: NivelDeTitulo, excecoes?: Excecoes): boolean {
  if (!sim(modelo, nivel, "maiúsculas sozinho", excecoes)) return false;
  const d = valorNoBloco(modelo, `titulos.nivel${nivel}`, "destaque", excecoes)?.valor;
  return d?.tipo === "destaque" && d.maiusculas;
}

/** A forma de cada título, na ordem do texto. */
export function formaDosTitulos(modelo: ModeloResolvido, titulos: TituloParaContar[], tipo: TipoDeTrabalho): FormaDoTitulo[] {
  const contagem = [0, 0, 0, 0, 0];
  return titulos.map(({ nivel, excecoes }) => {
    const forma: FormaDoTitulo = {
      paginaNova: comecaEmPaginaNova(modelo, nivel, tipo, excecoes),
      maiusculas: vaiEmMaiusculas(modelo, nivel, excecoes),
    };
    if (!numeraSozinho(modelo, nivel, excecoes)) return forma;
    contagem[nivel - 1]++;
    for (let i = nivel; i < 5; i++) contagem[i] = 0;
    const partes = contagem.slice(0, nivel);
    const pulado = partes.findIndex((n, i) => n === 0 && i < nivel - 1);
    return { ...forma, numero: partes.join("."), ...(pulado >= 0 ? { nivelPulado: (pulado + 1) as NivelDeTitulo } : {}) };
  });
}

/**
 * O número de seção que a pessoa escreveu no começo do título ("1.1 Contexto"),
 * para o Apud tirar quando numera sozinho. Mais estrito que o da v1: só partes
 * de 1 ou 2 algarismos, para "1964 e o golpe" não perder o ano.
 */
export function numeroEscritoNoTitulo(texto: string): { numero: string; resto: string } | undefined {
  const m = texto.match(/^\s*(\d{1,2}(?:\.\d{1,2})*\.?)\s+(?=\S)/);
  return m ? { numero: m[1], resto: texto.slice(m[0].length) } : undefined;
}
