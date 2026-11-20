// A norma de um trabalho: o perfil (com os ajustes do trabalho) e o estilo CSL
// já ligado às regras do perfil. É o que o conversor precisa para montar o PDF.
//
// Serve para os perfis embutidos no programa (embutidos.ts) e para os perfis
// lidos de uma pasta (testes e documento de prova).

import { aplicarPerfilNoCsl } from "./csl";
import { ajustarParaTrabalho } from "./ajustes";
import type { Arquivo, ResultadoDaConferencia } from "./conferir";
import type { Mensagem, PerfilResolvido } from "./tipos";

export interface NormaDoTrabalho {
  perfil: PerfilResolvido;
  /** O estilo CSL da lista de referências, já com as escolhas do perfil e do trabalho. */
  csl: string;
  /** Ajustes do trabalho que não puderam ser aplicados (o perfil segue sem eles). */
  problemas: Mensagem[];
}

/**
 * Monta a norma a partir de um perfil conferido. Ajustes com erro não são
 * aplicados: o trabalho continua com os valores do perfil, e os problemas
 * voltam para a tela avisar.
 */
export function normaDoTrabalho(
  conferido: ResultadoDaConferencia,
  estilos: Arquivo[],
  ajustes: Record<string, string> = {},
): NormaDoTrabalho {
  if (!conferido.perfil || !conferido.esquema) throw new Error(`o perfil ${conferido.arquivo} tem erros`);
  let perfil = conferido.perfil;
  let problemas: Mensagem[] = [];
  if (Object.keys(ajustes).length) {
    const ajustado = ajustarParaTrabalho(perfil, conferido.esquema, ajustes);
    if (ajustado.perfil) perfil = ajustado.perfil;
    else problemas = ajustado.mensagens;
  }
  const nomeDoCsl = perfil.regras.get("estilo csl")?.texto;
  const base = estilos.find((e) => e.nome === nomeDoCsl);
  if (!base) throw new Error(`não achei o estilo ${nomeDoCsl} do perfil ${conferido.arquivo}`);
  return { perfil, csl: aplicarPerfilNoCsl(base.conteudo, perfil, conferido.esquema), problemas };
}
