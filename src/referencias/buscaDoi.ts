// A busca pelo DOI: da frase que a pessoa colou até uma fonte pronta para
// conferir. A chamada de rede é uma função à parte (consultarCrossref) que a
// tela e os testes podem trocar; o resto é lógica pura.
//
// O que acontece, na ordem:
//   1. o texto vira um DOI limpo (doi.ts); se não parece um DOI, avisa;
//   2. se o trabalho já tem esse DOI, mostra a fonte que existe (nada é repetido);
//   3. consulta o Crossref, sem travar a digitação (assíncrono, com cancelar);
//   4. converte a resposta (crossref.ts) e devolve a fonte e os avisos.
// Nada é salvo aqui: a tela abre o formulário preenchido e a pessoa confere.

import type { Referencia } from "../documento/modelo";
import { converterCrossref } from "./crossref";
import { acharPorDoi, normalizarDoi } from "./doi";
import { lerEmailDeContato } from "./contato";

/** Quanto esperar o Crossref responder, antes de desistir. */
export const LIMITE_DA_CONSULTA_MS = 15_000;

export type ErroDaConsulta = "sem-internet" | "nao-existe" | "servico" | "demorou" | "fora-do-esperado";

export type RespostaDaConsulta = { ok: true; json: unknown } | { ok: false; erro: ErroDaConsulta | "cancelada" };

/** Quem faz a consulta de verdade. A tela usa consultarCrossref; os testes usam respostas de exemplo. */
export type Consultador = (doi: string, sinal: AbortSignal) => Promise<RespostaDaConsulta>;

/**
 * O endereço da ficha do DOI. A barra do DOI fica como está; o resto é codificado.
 * Com o e-mail da pessoa (contato.ts), a consulta vai para o grupo "educado" do Crossref.
 */
export function enderecoDaConsulta(doi: string, email = ""): string {
  const caminho = doi.split("/").map(encodeURIComponent).join("/");
  const contato = email.trim() ? `?mailto=${encodeURIComponent(email.trim())}` : "";
  return `https://api.crossref.org/works/${caminho}${contato}`;
}

export interface OpcoesDaConsulta {
  /** Troca o "fetch" do navegador (testes). */
  buscar?: typeof fetch;
  /** O e-mail de contato; sem ele, vale o que a pessoa guardou (contato.ts). */
  email?: string;
  limiteMs?: number;
}

/**
 * Pergunta ao Crossref. Nunca lança erro: todo problema vira { ok: false } com
 * o motivo. O pedido é simples (só GET, sem cabeçalhos especiais), do tipo que o
 * Crossref aceita de qualquer página, e por isso não precisa de permissão
 * própria do programa.
 */
export async function consultarCrossref(doi: string, sinal: AbortSignal, opcoes: OpcoesDaConsulta = {}): Promise<RespostaDaConsulta> {
  if (sinal.aborted) return { ok: false, erro: "cancelada" };
  const controle = new AbortController();
  let demorou = false;
  const relogio = setTimeout(() => {
    demorou = true;
    controle.abort();
  }, opcoes.limiteMs ?? LIMITE_DA_CONSULTA_MS);
  const cancelar = () => controle.abort();
  sinal.addEventListener("abort", cancelar, { once: true });
  try {
    const resposta = await (opcoes.buscar ?? fetch)(enderecoDaConsulta(doi, opcoes.email ?? lerEmailDeContato()), {
      signal: controle.signal,
      headers: { Accept: "application/json" },
    });
    if (resposta.status === 404 || resposta.status === 400) return { ok: false, erro: "nao-existe" };
    if (!resposta.ok) return { ok: false, erro: "servico" };
    try {
      return { ok: true, json: await resposta.json() };
    } catch (e) {
      if (controle.signal.aborted) throw e;
      return { ok: false, erro: "fora-do-esperado" };
    }
  } catch {
    if (sinal.aborted) return { ok: false, erro: "cancelada" };
    if (demorou) return { ok: false, erro: "demorou" };
    // Sem internet, sem rota até o Crossref ou o pedido barrado: para a pessoa, é tudo "não consegui falar".
    return { ok: false, erro: "sem-internet" };
  } finally {
    clearTimeout(relogio);
    sinal.removeEventListener("abort", cancelar);
  }
}

// ---------------------------------------------------------------------------
// O que a tela mostra

const MENSAGENS: Record<ErroDaConsulta, string> = {
  "nao-existe":
    "O Crossref não achou esse DOI. Confira se ele está completo e sem erro de digitação. Alguns DOIs não estão no Crossref: nesse caso, use “Adicionar à mão”.",
  "sem-internet": "Não consegui falar com o Crossref. Confira a conexão com a internet e tente de novo.",
  servico: "O Crossref não está respondendo agora. Tente de novo daqui a pouco.",
  demorou: "O Crossref demorou demais para responder. Tente de novo.",
  "fora-do-esperado": "O Crossref respondeu de um jeito que o Apud não entendeu. Use “Adicionar à mão” para cadastrar esta fonte.",
};

export const MENSAGEM_DO_DOI_VAZIO = "Cole o DOI da fonte no campo.";
export const MENSAGEM_DO_DOI_INVALIDO =
  "Isso não parece um DOI. Ele começa com “10.” e tem uma barra no meio, como 10.1037/0033-295x.84.2.191. Também vale o endereço https://doi.org/….";

export type DesfechoDaBusca =
  /** Achou: a fonte vem para a pessoa conferir. Nada foi salvo. */
  | { tipo: "achou"; referencia: Referencia; avisos: string[] }
  /** O trabalho já tem esse DOI: mostra a fonte que existe. */
  | { tipo: "repetida"; existente: Referencia }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "cancelada" };

/**
 * A busca inteira. "consultar" é quem fala com o Crossref (consultarCrossref
 * na tela; respostas de exemplo nos testes).
 */
export async function buscarPorDoi(
  entrada: string,
  referencias: readonly Referencia[],
  sinal: AbortSignal,
  consultar: Consultador = (doi, s) => consultarCrossref(doi, s),
  sorteio?: () => number,
): Promise<DesfechoDaBusca> {
  if (!entrada.trim()) return { tipo: "erro", mensagem: MENSAGEM_DO_DOI_VAZIO };
  const doi = normalizarDoi(entrada);
  if (!doi) return { tipo: "erro", mensagem: MENSAGEM_DO_DOI_INVALIDO };

  // Já está no trabalho: nem precisa da internet.
  const jaTem = acharPorDoi(referencias, doi);
  if (jaTem) return { tipo: "repetida", existente: jaTem };

  const resposta = await consultar(doi, sinal);
  if (sinal.aborted) return { tipo: "cancelada" };
  if (!resposta.ok) return resposta.erro === "cancelada" ? { tipo: "cancelada" } : { tipo: "erro", mensagem: MENSAGENS[resposta.erro] };

  const convertida = converterCrossref(resposta.json, { existentes: referencias.map((r) => r.id), doiPedido: doi, sorteio });
  if (!convertida.ok) return { tipo: "erro", mensagem: MENSAGENS["fora-do-esperado"] };

  // O Crossref pode devolver o DOI em outra forma (um DOI antigo que aponta para o novo): confere de novo.
  const repetida = convertida.referencia.doi ? acharPorDoi(referencias, convertida.referencia.doi) : undefined;
  if (repetida) return { tipo: "repetida", existente: repetida };

  return { tipo: "achou", referencia: convertida.referencia, avisos: convertida.avisos };
}
