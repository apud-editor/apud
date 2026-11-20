// Os perfis que vêm dentro do programa (pasta perfis/ do repositório).
// O Vite junta os arquivos de texto na montagem; o Apud os confere ao abrir.

import { conferirPerfis, type Arquivo, type PerfilResolvido, type ResultadoDaConferencia } from "./index";
import { normaDoTrabalho, type NormaDoTrabalho } from "./norma";

const textos = import.meta.glob("../../perfis/*.txt", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const estilos = import.meta.glob("../../perfis/estilos/*.csl", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

const comoArquivos = (m: Record<string, string>): Arquivo[] =>
  Object.entries(m).map(([caminho, conteudo]) => ({ nome: caminho.split("/").pop()!, conteudo }));

let cache: ResultadoDaConferencia[] | null = null;

function conferidos(): ResultadoDaConferencia[] {
  if (!cache) cache = conferirPerfis(comoArquivos(textos), comoArquivos(estilos));
  return cache;
}

/** Os perfis embutidos que passaram na conferência, pelo nome do arquivo ("abnt.txt"). */
export function perfisEmbutidos(): Map<string, PerfilResolvido> {
  return new Map(conferidos().flatMap((r) => (r.perfil ? [[r.arquivo, r.perfil] as const] : [])));
}

/** O perfil ABNT embutido. */
export function perfilAbnt(): PerfilResolvido {
  const p = perfisEmbutidos().get("abnt.txt");
  if (!p) throw new Error("o perfil ABNT embutido tem erros (rode npm run conferir-perfis)");
  return p;
}

/**
 * A norma de um trabalho, pelo nome do perfil ("ABNT", "APA"), com os ajustes
 * que o trabalho guarda para essa norma.
 */
export function normaEmbutida(nome: string, ajustes: Record<string, string> = {}): NormaDoTrabalho {
  const r = conferidos().find((x) => x.perfil?.identificacao.perfil === nome && !x.perfil.identificacao.herdaDe);
  if (!r) throw new Error(`o Apud não tem o perfil ${nome}`);
  return normaDoTrabalho(r, comoArquivos(estilos), ajustes);
}
