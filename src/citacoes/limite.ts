// Aviso de citação direta curta que passou do limite da norma (decisão de
// 20/11/2026: o Apud avisa e deixa a pessoa decidir; nunca troca sozinho por
// citação longa/em bloco). Funções puras.
//
// O Apud não sabe qual parte do parágrafo é a transcrição: a citação não carrega
// o trecho transcrito. Ele procura o trecho entre aspas ao lado da citação,
// do jeito que as duas normas pedem: “texto” (Autor, 2020, p. 5) ou
// Autor (2020, p. 5): “texto”. Trecho sem aspas não é visto.

import type { PerfilResolvido } from "../perfis";
import { ehCitacao, ehTexto, type Trecho } from "../documento/modelo";
import type { Aviso } from "./motor";

/** O limite da norma, já entendido: a ABNT conta linhas; a APA, palavras. */
export type Limite = { tipo: "linhas"; ate: number } | { tipo: "palavras"; apartirDe: number };

/**
 * Quantos caracteres cabem numa linha de texto corrido: Times 12 em 16 cm
 * (A4 com margens de 3 e 2 cm). É uma estimativa: o aviso diz "cerca de".
 */
export const CARACTERES_POR_LINHA = 85;

/** O limite do perfil, ou null se a norma não tem a regra ou o aviso está desligado. */
export function limiteDoPerfil(perfil: PerfilResolvido): Limite | null {
  const avisar = perfil.regras.get("citação curta, passou do limite");
  if (!avisar || avisar.situacao.tipo === "desligada" || avisar.valor.tipo !== "opcao" || avisar.valor.valor !== "avisar") return null;
  const linhas = perfil.regras.get("citação curta, até");
  if (linhas && linhas.situacao.tipo !== "desligada" && linhas.valor.tipo === "quantidade") return { tipo: "linhas", ate: linhas.valor.numero };
  const palavras = perfil.regras.get("citação em bloco, a partir de");
  if (palavras && palavras.situacao.tipo !== "desligada" && palavras.valor.tipo === "quantidade") {
    return { tipo: "palavras", apartirDe: palavras.valor.numero };
  }
  return null;
}

const ABRE_OU_FECHA = '“”"';
const ANTES = new RegExp(`[“"]([^${ABRE_OU_FECHA}]+)[”"][\\s.,;:!?)]*$`);
const DEPOIS = new RegExp(`^[\\s,:]*[“"]([^${ABRE_OU_FECHA}]+)[”"]`);

/** O texto de trechos de texto seguidos, parando na primeira citação ou nota (que quebra o trecho). */
function textoAteAQuebra(trechos: Trecho[], de: number, passo: 1 | -1): string {
  let texto = "";
  for (let i = de; i >= 0 && i < trechos.length; i += passo) {
    const t = trechos[i];
    if (!ehTexto(t)) break;
    texto = passo === 1 ? texto + t.texto : t.texto + texto;
  }
  return texto;
}

/**
 * O trecho entre aspas que a citação em `trechos[indice]` acompanha: o que
 * vem logo antes dela ou, nas citações narrativas ("Autor (2020) diz: “...”"),
 * o que vem logo depois. Null se não houver trecho entre aspas ao lado.
 */
export function passagemDaCitacao(trechos: Trecho[], indice: number): string | null {
  const c = trechos[indice];
  if (!c || !ehCitacao(c)) return null;
  const antes = () => ANTES.exec(textoAteAQuebra(trechos, indice - 1, -1))?.[1] ?? null;
  const depois = () => DEPOIS.exec(textoAteAQuebra(trechos, indice + 1, 1))?.[1] ?? null;
  return c.citacao.tipo === "narrativa" ? (depois() ?? antes()) : (antes() ?? depois());
}

const palavrasDe = (texto: string) => texto.split(/\s+/).filter(Boolean).length;

/** O aviso, se a passagem passou do limite. Só vale para citação direta (a indireta não tem aspas). */
export function avisoDeLimite(trechos: Trecho[], indice: number, limite: Limite): Aviso | null {
  const c = trechos[indice];
  if (!c || !ehCitacao(c) || c.citacao.tipo === "sem-referencia" || !c.citacao.direta) return null;
  const passagem = passagemDaCitacao(trechos, indice);
  if (passagem === null) return null;
  const aviso = (mensagem: string): Aviso => ({ tipo: "citacao-curta-longa", mensagem });
  if (limite.tipo === "palavras") {
    const n = palavrasDe(passagem);
    if (n < limite.apartirDe) return null;
    return aviso(
      `o trecho citado tem ${n} palavras. A norma pede citação em bloco a partir de ${limite.apartirDe}. Digite / e escolha “Citação longa” se quiser trocar (o Apud não troca sozinho).`,
    );
  }
  const linhas = Math.ceil((passagem.length + 2) / CARACTERES_POR_LINHA);
  if (linhas <= limite.ate) return null;
  return aviso(
    `o trecho citado ocupa cerca de ${linhas} linhas. A norma pede citação longa (bloco recuado, sem aspas) acima de ${limite.ate} linhas. Digite / e escolha “Citação longa” se quiser trocar (o Apud não troca sozinho).`,
  );
}
