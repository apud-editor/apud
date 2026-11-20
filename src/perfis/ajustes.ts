// Ajustes do trabalho: as regras marcadas "faculdade" ou "escolha" podem ser
// trocadas nas configurações de cada trabalho, sem mexer no arquivo do perfil.

import type { EsquemaNorma } from "./esquema";
import { listarComE, normalizar } from "./texto";
import type { Mensagem, PerfilResolvido } from "./tipos";

/** As regras que aparecem nas configurações do trabalho. */
export function regrasAjustaveis(perfil: PerfilResolvido) {
  return [...perfil.regras.values()].filter(
    (r) => r.situacao.tipo === "faculdade" || r.situacao.tipo === "escolha",
  );
}

/**
 * Aplica os ajustes de um trabalho sobre o perfil. Devolve o perfil ajustado,
 * ou só as mensagens de erro se algum ajuste não for aceito.
 */
export function ajustarParaTrabalho(
  perfil: PerfilResolvido,
  esquema: EsquemaNorma,
  ajustes: Record<string, string>,
): { perfil?: PerfilResolvido; mensagens: Mensagem[] } {
  const mensagens: Mensagem[] = [];
  const definicoes = new Map(esquema.regras.map((d) => [d.chave, d]));
  const regras = new Map(perfil.regras);

  for (const [nome, valor] of Object.entries(ajustes)) {
    const chave = normalizar(nome);
    const regra = perfil.regras.get(chave);
    const definicao = definicoes.get(chave);
    const erro = (texto: string) => mensagens.push({ gravidade: "erro", texto: `“${nome}”: ${texto}` });
    if (!regra || !definicao) {
      erro("essa regra não existe no perfil.");
      continue;
    }
    if (regra.situacao.tipo !== "faculdade" && regra.situacao.tipo !== "escolha") {
      erro("essa regra é fixa na norma e não pode ser trocada nas configurações do trabalho.");
      continue;
    }
    const lido = definicao.tipo.ler(valor, nome);
    if (!lido.ok) {
      erro(lido.erro);
      continue;
    }
    if (regra.situacao.tipo === "escolha" && !regra.situacao.opcoes.includes(lido.texto)) {
      erro(`escolha uma das opções: ${listarComE(regra.situacao.opcoes)}.`);
      continue;
    }
    regras.set(chave, { ...regra, valor: lido.valor, texto: lido.texto, origem: "configurações do trabalho" });
  }

  if (mensagens.length) return { mensagens };
  return { perfil: { ...perfil, regras }, mensagens };
}
