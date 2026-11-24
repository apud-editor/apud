// Os modelos que vêm dentro do programa (pasta modelos/ do repositório) e os
// estilos CSL das listas de referências. O Vite junta os arquivos de texto na
// montagem; o Apud os confere ao abrir.

import { conferirModelos, type ResultadoDaConferencia } from "./conferir";
import { valorEfetivo } from "./herdar";
import { normaDoTrabalho, type NormaDoTrabalho } from "./norma";
import { perfilDeCitacoes } from "./ponte";
import type { PerfilResolvido } from "../perfis/tipos";
import type { ModeloResolvido } from "./tipos";

const textos = import.meta.glob("../../modelos/*.txt", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const estilos = import.meta.glob("../../perfis/estilos/*.csl", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const comoArquivos = (m: Record<string, string>) => Object.entries(m).map(([caminho, conteudo]) => ({ nome: caminho.split("/").pop()!, conteudo }));

let cache: ResultadoDaConferencia[] | null = null;
function conferidos(): ResultadoDaConferencia[] {
  if (!cache) cache = conferirModelos(comoArquivos(textos));
  return cache;
}

/** As normas que vêm no programa, para a escolha da norma do trabalho ("ABNT", "APA"): os modelos que herdam do Em branco. */
export function normasEmbutidas(): string[] {
  return conferidos().flatMap((r) => (r.resolvido && r.resolvido.cadeia.length === 2 ? [r.resolvido.identificacao.nome] : []));
}

/** O modelo de uma norma embutida, sem as escolhas do trabalho: o padrão da norma. */
export function modeloEmbutido(nome: string): ModeloResolvido {
  const r = conferidos().find((x) => x.resolvido?.identificacao.nome === nome);
  if (!r?.resolvido) throw new Error(`o Apud não tem o modelo ${nome}`);
  return r.resolvido;
}

/** As regras de citação de uma norma embutida, sem as escolhas do trabalho (para as Escolhas do autor). */
export function perfilEmbutido(nome: string): PerfilResolvido {
  return perfilDeCitacoes(modeloEmbutido(nome));
}

/** A norma de um trabalho, pelo nome do modelo ("ABNT", "APA"), com as escolhas que o trabalho guarda para ela. */
export function normaEmbutida(nome: string, ajustes: Record<string, string> = {}): NormaDoTrabalho {
  return normaDoTrabalho(modeloEmbutido(nome), comoArquivos(estilos), ajustes);
}

/** O texto de uma propriedade do modelo, para as telas (ex.: a fonte do texto, para o aviso de fonte faltando). */
export function textoNoModelo(modelo: ModeloResolvido, elemento: string, propriedade: string): string | undefined {
  return valorEfetivo(modelo, elemento, propriedade)?.texto;
}
