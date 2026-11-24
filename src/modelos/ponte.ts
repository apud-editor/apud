// A ponte para as citações: até a etapa 5, o motor de citações, o estilo CSL,
// o aviso de citação longa e as escolhas do autor leem as regras como nos
// perfis da versão 1 (um nome e um valor). Esta ponte monta essa forma a
// partir do elemento "Citações e referências" do modelo, sem mudar nada.

import { ESQUEMAS } from "../perfis/normas";
import type { EsquemaNorma } from "../perfis/esquema";
import { normalizar } from "../perfis/texto";
import type { PerfilResolvido, Regra } from "../perfis/tipos";
import type { ModeloResolvido } from "./tipos";

/**
 * A norma de onde o modelo vem: o primeiro modelo depois do Em branco ("ABNT",
 * "APA"). Um modelo de faculdade que herda da ABNT segue a ABNT.
 */
export function normaDoModelo(modelo: ModeloResolvido): string | undefined {
  return modelo.cadeia[1]?.nome;
}

/** As regras de citações e referências do modelo, na forma que o motor e o CSL leem. */
export function perfilDeCitacoes(modelo: ModeloResolvido): PerfilResolvido {
  const id = modelo.identificacao;
  const norma = normaDoModelo(modelo) ?? id.nome;
  const regras = new Map<string, Regra>();
  const esquema = esquemaDeCitacoes(modelo);
  for (const [chave, v] of modelo.valores.get("citacoes") ?? []) {
    // Quando a ABNT e a APA tinham a mesma regra com tipos diferentes, o valor
    // é lido de novo pelo tipo da norma do modelo, como no perfil.
    const tipo = esquema?.regras.find((d) => d.chave === normalizar(chave))?.tipo;
    const relido = tipo?.ler(v.texto, chave);
    regras.set(normalizar(chave), {
      chave: normalizar(chave),
      valor: relido?.ok ? relido.valor : v.valor,
      texto: v.texto,
      origem: v.origem,
      situacao: v.situacao,
      arquivo: v.arquivo ?? "",
      linha: v.linha ?? 0,
    });
  }
  const herdaDe = modelo.cadeia.length > 2 ? modelo.cadeia[modelo.cadeia.length - 2] : undefined;
  return {
    identificacao: {
      perfil: id.nome,
      norma,
      versao: id.versao ?? modelo.cadeia[1]?.versao ?? "",
      revisao: id.revisao,
      dataDaRevisao: id.dataDaRevisao,
      notaDaRevisao: id.notaDaRevisao,
      ...(herdaDe ? { herdaDe: { perfil: herdaDe.nome, versao: herdaDe.versao ?? "", revisao: herdaDe.revisao } } : {}),
    },
    regras,
  };
}

/** O esquema da versão 1 que liga as regras de citação ao estilo CSL. */
export function esquemaDeCitacoes(modelo: ModeloResolvido): EsquemaNorma | undefined {
  const norma = normaDoModelo(modelo);
  return norma ? ESQUEMAS.get(normalizar(norma)) : undefined;
}
