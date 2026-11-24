// As escolhas de um trabalho: as regras "ajustáveis" e as "escolhas" podem ser
// trocadas nas Configurações de cada trabalho, sem mexer no modelo. Elas são
// mais uma camada por cima do modelo (Em branco › ABNT › este trabalho).
//
// No .apud, cada escolha tem o caminho do elemento e o nome da propriedade:
//   "Texto › fonte": "Arial", "Títulos › Nível 2 › destaque": "negrito".
// As de Citações e referências (as Escolhas do autor) vão só com o nome da
// regra: "referências, prenomes": "abreviados".

import { listarComE, normalizar } from "../perfis/texto";
import { atalho, elementoPeloCaminho, propriedade } from "./elementos";
import { somar, valorProprio } from "./herdar";
import type { Mensagem, ModeloResolvido, ValorNoModelo, ValoresPorElemento } from "./tipos";

interface Destino {
  elemento: string;
  propriedade: string;
}

/** "Títulos › Nível 2 › destaque" → Títulos › Nível 2, destaque; "referências, prenomes" → Citações e referências. */
export function destinoDaEscolha(chave: string): Destino | undefined {
  const partes = chave.split(/\s*›\s*/);
  if (partes.length === 1) return { elemento: "citacoes", propriedade: normalizar(chave) };
  const nome = partes.pop()!;
  const el = elementoPeloCaminho(partes.join(" › "));
  return el ? { elemento: el.id, propriedade: normalizar(nome) } : undefined;
}

/** De onde vem o valor que o trabalho escolheu. */
export const ORIGEM_DO_AJUSTE = "configurações do trabalho";

/** O valor que o modelo dá ao destino: o da propriedade, ou o do atalho, como escrito. */
function atual(modelo: ModeloResolvido, d: Destino): ValorNoModelo | undefined {
  if (!propriedade(d.elemento, d.propriedade) && atalho(d.elemento, d.propriedade)) return modelo.atalhos.get(d.elemento)?.get(d.propriedade);
  return valorProprio(modelo, d.elemento, d.propriedade);
}

/**
 * Aplica as escolhas de um trabalho sobre o modelo. Devolve o modelo com as
 * escolhas, ou só as mensagens de erro, se alguma não for aceita (aí nada se
 * aplica: o trabalho continua com os valores do modelo).
 */
export function aplicarAjustes(modelo: ModeloResolvido, ajustes: Record<string, string>): { modelo?: ModeloResolvido; mensagens: Mensagem[] } {
  const mensagens: Mensagem[] = [];
  const diferencas: ValoresPorElemento = new Map();
  const atalhos: ValoresPorElemento = new Map();
  const por = (mapa: ValoresPorElemento, elemento: string) => {
    if (!mapa.has(elemento)) mapa.set(elemento, new Map());
    return mapa.get(elemento)!;
  };

  for (const [nome, escrito] of Object.entries(ajustes)) {
    const erro = (texto: string) => mensagens.push({ gravidade: "erro", texto: `“${nome}”: ${texto}` });
    const d = destinoDaEscolha(nome);
    const def = d && propriedade(d.elemento, d.propriedade);
    const at = d && !def ? atalho(d.elemento, d.propriedade) : undefined;
    const v = d && (def || at) ? atual(modelo, { elemento: d.elemento, propriedade: (def?.nome ?? at?.nome)! }) : undefined;
    if (!d || !v) {
      erro("essa regra não existe no modelo.");
      continue;
    }
    if (v.situacao.tipo !== "ajustavel" && v.situacao.tipo !== "escolha") {
      erro("essa regra é fixa na norma e não pode ser trocada nas configurações do trabalho.");
      continue;
    }
    const lido = (def?.tipo ?? at!.tipo).ler(escrito, nome);
    if (!lido.ok) {
      erro(lido.erro);
      continue;
    }
    if (v.situacao.tipo === "escolha" && !v.situacao.opcoes.includes(lido.texto)) {
      erro(`escolha uma das opções: ${listarComE(v.situacao.opcoes)}.`);
      continue;
    }
    const novo: ValorNoModelo = { valor: lido.valor, texto: lido.texto, origem: ORIGEM_DO_AJUSTE, situacao: v.situacao, de: "este trabalho" };
    if (def) {
      por(diferencas, d.elemento).set(def.nome, novo);
      continue;
    }
    // Um atalho (a fonte e o tamanho da APA): escreve as propriedades dele.
    por(atalhos, d.elemento).set(at!.nome, { ...novo, atalho: at!.nome });
    for (const [prop, t] of at!.expandir(lido.valor, lido.texto)) {
      const lidoProp = propriedade(d.elemento, prop)!.tipo.ler(t, prop);
      if (lidoProp.ok) por(diferencas, d.elemento).set(prop, { ...novo, valor: lidoProp.valor, texto: lidoProp.texto, situacao: { tipo: "confirmada" }, atalho: at!.nome });
    }
  }

  if (mensagens.length) return { mensagens };
  return { modelo: somar(modelo, { diferencas, atalhos }), mensagens };
}
