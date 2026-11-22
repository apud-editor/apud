// As citações do trabalho montadas de uma vez, para o editor mostrar cada uma
// já na norma, e os avisos sobre o texto como um todo. Funções puras.
//
// Por que "de uma vez": o texto de uma citação pode depender das outras
// (a ordem da primeira citação, as letras 2020a e 2020b, o desempate de
// sobrenomes iguais, a APA que pede todos os autores na primeira vez). Então
// nunca se monta uma citação sozinha dentro do texto: monta-se o texto todo,
// na ordem, com o mesmo motor que faz o PDF.

import type { PerfilResolvido } from "../perfis";
import {
  documentoVazio,
  ehCitacao,
  obrasDaCitacao,
  textosDosBlocos,
  type Bloco,
  type Citacao,
  type Documento,
  type Referencia,
} from "../documento/modelo";
import { avisoDeLimite, limiteDoPerfil } from "./limite";
import { citacoesDoTexto, criarMotor, pedacosComoTexto, type CitacaoMontada } from "./motor";

/**
 * Todas as citações do documento, na ordem do texto, escritas na norma do
 * perfil. A citação direta com trecho entre aspas acima do limite da norma
 * ganha um aviso (sem trocar nada).
 */
export function montarTodas(doc: Documento, perfil: PerfilResolvido): CitacaoMontada[] {
  const motor = criarMotor(doc, perfil);
  const limite = limiteDoPerfil(perfil);
  const montadas: CitacaoMontada[] = [];
  // A mesma ordem de citacoesDoTexto (o motor depende dela).
  for (const trechos of textosDosBlocos(doc.blocos)) {
    trechos.forEach((t, i) => {
      if (!ehCitacao(t)) return;
      const m = motor.montar(t.citacao);
      const aviso = limite ? avisoDeLimite(trechos, i, limite) : null;
      montadas.push(aviso ? { ...m, avisos: [...m.avisos, aviso] } : m);
    });
  }
  return montadas;
}

/**
 * Como ficaria uma citação nova (ou editada) no fim do texto: para a janela
 * mostrar "Na norma: (Silva, 2019, p. 15)" enquanto a pessoa preenche. As
 * letras e os desempates podem mudar quando a citação entra no lugar dela.
 */
export function previaDaCitacao(blocos: Bloco[], referencias: Referencia[], perfil: PerfilResolvido, c: Citacao): CitacaoMontada {
  const doc: Documento = {
    ...documentoVazio(),
    referencias,
    blocos: [...blocos, { tipo: "paragrafo", trechos: [{ citacao: c }] }],
  };
  const todas = montarTodas(doc, perfil);
  return todas[todas.length - 1];
}

/** O texto da citação sem itálico, para copiar e para os testes. */
export const textoDaCitacao = (m: CitacaoMontada): string => pedacosComoTexto(m.pedacos, false);

// ---------------------------------------------------------------------------
// Avisos sobre o texto como um todo (nada disso impede o PDF)

export interface AvisoDoTexto {
  tipo: "sem-lista" | "lista-repetida";
  mensagem: string;
}

/**
 * - há citações de obras e nenhum bloco "Lista de referências": as obras
 *   não aparecem no PDF;
 * - há mais de um bloco "Lista de referências": a lista sai repetida.
 * Fala sem referência não conta: ela não vai para a lista.
 */
export function avisosDoTexto(blocos: Bloco[]): AvisoDoTexto[] {
  const listas = blocos.filter((b) => b.tipo === "referencias").length;
  const citaObras = citacoesDoTexto(blocos).some((c) => obrasDaCitacao(c).length > 0);
  const avisos: AvisoDoTexto[] = [];
  if (citaObras && listas === 0) {
    avisos.push({
      tipo: "sem-lista",
      mensagem: "O texto tem citações, mas falta a lista de referências. Digite / e escolha “Lista de referências” onde ela deve sair.",
    });
  }
  if (listas > 1) {
    avisos.push({
      tipo: "lista-repetida",
      mensagem: `A lista de referências aparece ${listas} vezes. Deixe só uma: apague as outras.`,
    });
  }
  return avisos;
}
