// As duas heranças dos modelos.
//
// 1. Entre modelos (resolver): começa pelo Em branco e, por cima, os valores
//    de cada modelo da cadeia (ABNT, depois o modelo de uma faculdade ou revista...). O último a dizer
//    vale. Cada valor guarda de que modelo veio.
// 2. Entre elementos (valorEfetivo): o Nível 2 que não diz a fonte usa a de
//    Títulos; Títulos que não diz usa a do Texto.
//
// O "só este" da etapa 2 vai ser uma terceira camada, por cima das duas: a
// exceção de um bloco só.

import { atalho as definicaoDoAtalho, linhagem } from "./elementos";
import type { Modelo, ModeloResolvido, ValorNoModelo, ValoresPorElemento } from "./tipos";
import { COMO_NO_TEXTO } from "./valores";

function copiar(v: ValoresPorElemento): ValoresPorElemento {
  return new Map([...v].map(([e, props]) => [e, new Map(props)]));
}

/** Põe um valor por cima, desfazendo o atalho que tinha escrito a mesma propriedade. */
function porCima(valores: ValoresPorElemento, atalhos: ValoresPorElemento, elemento: string, propriedade: string, v: ValorNoModelo) {
  if (!valores.has(elemento)) valores.set(elemento, new Map());
  valores.get(elemento)!.set(propriedade, v);
  const doElemento = atalhos.get(elemento);
  if (!doElemento) return;
  for (const [nome, valorDoAtalho] of doElemento) {
    // O valor que veio do próprio atalho, na mesma camada, não o desfaz.
    if (v.atalho === nome && v.de === valorDoAtalho.de) continue;
    const def = definicaoDoAtalho(elemento, nome);
    if (def?.expandir(valorDoAtalho.valor, valorDoAtalho.texto).some(([p]) => p === propriedade)) doElemento.delete(nome);
  }
}

/**
 * Soma um modelo aos modelos de onde ele vem. `cadeia` vai da raiz (Em branco)
 * até o próprio modelo.
 */
export function resolver(cadeia: Modelo[]): ModeloResolvido {
  if (!cadeia.length) throw new Error("a cadeia de modelos está vazia");
  const valores: ValoresPorElemento = new Map();
  const atalhos: ValoresPorElemento = new Map();
  for (const modelo of cadeia) {
    for (const [elemento, props] of modelo.atalhos) {
      if (!atalhos.has(elemento)) atalhos.set(elemento, new Map());
      for (const [nome, v] of props) atalhos.get(elemento)!.set(nome, v);
    }
    for (const [elemento, props] of modelo.diferencas) {
      for (const [propriedade, v] of props) porCima(valores, atalhos, elemento, propriedade, v);
    }
  }
  return {
    identificacao: cadeia[cadeia.length - 1].identificacao,
    cadeia: cadeia.map((m) => m.identificacao),
    valores: copiar(valores),
    atalhos: copiar(atalhos),
  };
}

/** O valor que o próprio elemento tem no modelo, sem olhar os elementos de cima. */
export function valorProprio(modelo: ModeloResolvido, elemento: string, propriedade: string): ValorNoModelo | undefined {
  return modelo.valores.get(elemento)?.get(propriedade);
}

/**
 * O valor que vale para o elemento: o dele, ou o do elemento de cima mais
 * perto que tiver. Um recuo "como no texto" vira o recuo do Texto.
 */
export function valorEfetivo(modelo: ModeloResolvido, elemento: string, propriedade: string): ValorNoModelo | undefined {
  for (const e of linhagem(elemento)) {
    const v = modelo.valores.get(e.id)?.get(propriedade);
    if (!v) continue;
    if (v.valor.tipo === "opcao" && v.valor.valor === COMO_NO_TEXTO && e.id !== "texto") {
      return valorEfetivo(modelo, "texto", propriedade);
    }
    return v;
  }
  return undefined;
}

/** De qual elemento vem o valor que vale para este (o próprio, ou um de cima). */
export function deOndeVem(modelo: ModeloResolvido, elemento: string, propriedade: string): string | undefined {
  return linhagem(elemento).find((e) => modelo.valores.get(e.id)?.has(propriedade))?.id;
}
