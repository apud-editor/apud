// Os perfis que vêm dentro do programa (pasta perfis/ do repositório).
// O Vite junta os arquivos de texto na montagem; o Apud os confere ao abrir.

import { conferirPerfis, type Arquivo, type PerfilResolvido } from "./index";

const textos = import.meta.glob("../../perfis/*.txt", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const estilos = import.meta.glob("../../perfis/estilos/*.csl", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

const comoArquivos = (m: Record<string, string>): Arquivo[] =>
  Object.entries(m).map(([caminho, conteudo]) => ({ nome: caminho.split("/").pop()!, conteudo }));

let cache: Map<string, PerfilResolvido> | null = null;

/** Os perfis embutidos que passaram na conferência, pelo nome do arquivo ("abnt.txt"). */
export function perfisEmbutidos(): Map<string, PerfilResolvido> {
  if (!cache) {
    cache = new Map();
    for (const r of conferirPerfis(comoArquivos(textos), comoArquivos(estilos))) {
      if (r.perfil) cache.set(r.arquivo, r.perfil);
    }
  }
  return cache;
}

/** O perfil da fase 1: ABNT. */
export function perfilAbnt(): PerfilResolvido {
  const p = perfisEmbutidos().get("abnt.txt");
  if (!p) throw new Error("o perfil ABNT embutido tem erros (rode npm run conferir-perfis)");
  return p;
}
