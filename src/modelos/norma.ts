// A norma de um trabalho: o modelo (com as escolhas do trabalho), as regras
// de citação na forma que o motor lê e o estilo CSL já ligado a elas. É o que
// o conversor e as telas precisam para montar o PDF e as citações.

import { aplicarPerfilNoCsl } from "../perfis/csl";
import type { PerfilResolvido } from "../perfis/tipos";
import { aplicarAjustes } from "./ajustes";
import { esquemaDeCitacoes, perfilDeCitacoes } from "./ponte";
import type { Mensagem, ModeloResolvido } from "./tipos";

export interface Estilo {
  /** Nome do arquivo, como "abnt.csl". */
  nome: string;
  conteudo: string;
}

export interface NormaDoTrabalho {
  /** O modelo, já com as escolhas do trabalho: o que o conversor lê. */
  modelo: ModeloResolvido;
  /** As regras de citações e referências, na forma que o motor de citações lê (até a etapa 5). */
  perfil: PerfilResolvido;
  /** O estilo CSL da lista de referências, já com as escolhas do modelo e do trabalho. */
  csl: string;
  /** Escolhas do trabalho que não puderam ser aplicadas (o modelo segue sem elas). */
  problemas: Mensagem[];
}

/**
 * Monta a norma a partir de um modelo conferido. Escolhas com erro não são
 * aplicadas: o trabalho continua com os valores do modelo, e os problemas
 * voltam para a tela avisar.
 */
export function normaDoTrabalho(base: ModeloResolvido, estilos: Estilo[], ajustes: Record<string, string> = {}): NormaDoTrabalho {
  let modelo = base;
  let problemas: Mensagem[] = [];
  if (Object.keys(ajustes).length) {
    const ajustado = aplicarAjustes(base, ajustes);
    if (ajustado.modelo) modelo = ajustado.modelo;
    else problemas = ajustado.mensagens;
  }
  const perfil = perfilDeCitacoes(modelo);
  const nomeDoCsl = perfil.regras.get("estilo csl")?.texto;
  const estilo = estilos.find((e) => e.nome === nomeDoCsl);
  const esquema = esquemaDeCitacoes(modelo);
  if (!estilo || !esquema) throw new Error(`não achei o estilo de citação ${nomeDoCsl ?? "(nenhum)"} do modelo ${modelo.identificacao.nome}`);
  return { modelo, perfil, csl: aplicarPerfilNoCsl(estilo.conteudo, perfil, esquema), problemas };
}

/** "ABNT 2025, revisão 10" ou "ABNT – Universidade X, revisão 2". */
export function nomeDoModelo(modelo: ModeloResolvido): string {
  const id = modelo.identificacao;
  return id.versao ? `${id.nome} ${id.versao}, revisão ${id.revisao}` : `${id.nome}, revisão ${id.revisao}`;
}
