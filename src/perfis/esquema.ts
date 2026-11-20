// O "esquema" é a lista de regras que o Apud sabe aplicar, com o tipo de valor
// de cada uma. O perfil (arquivo de texto) dá os valores; o esquema diz o que
// é aceito. Mudar um valor é editar o perfil. Criar um tipo novo de regra
// exige mudar o esquema e o programa.

import type { TipoValor } from "./valores";

/**
 * Como uma regra comanda o estilo CSL. No CSL, a marca <!-- apud: chave -->
 * fica logo antes do elemento que a regra ajusta.
 */
export type LigacaoCsl =
  /** Troca o atributo value="..." do elemento pelo valor da regra. */
  | { tipo: "valor" }
  /** Cada opção liga ou desliga atributos do elemento (null = remover). */
  | { tipo: "atributos"; porOpcao: Record<string, Record<string, string | null>> }
  /** Troca as abreviaturas dos meses no bloco <terms>. */
  | { tipo: "meses" };

export interface DefinicaoRegra {
  chave: string;
  tipo: TipoValor;
  secao: string;
  /** As linhas do checklist que esta regra cobre (para conferir a cobertura). */
  checklist: string[];
  csl?: LigacaoCsl;
}

export interface EsquemaNorma {
  /** Nome da família de regras, igual ao campo "perfil" do perfil original. */
  norma: string;
  regras: DefinicaoRegra[];
}

/**
 * Ajuda a escrever o esquema em blocos: cada seção do checklist com as suas
 * regras, e cada regra com a linha do checklist que cobre.
 */
export function secao(
  nome: string,
  regras: Array<[chave: string, tipo: TipoValor, checklist: string | string[], csl?: LigacaoCsl]>,
): DefinicaoRegra[] {
  return regras.map(([chave, tipo, checklist, csl]) => ({
    chave,
    tipo,
    secao: nome,
    checklist: Array.isArray(checklist) ? checklist : [checklist],
    csl,
  }));
}
