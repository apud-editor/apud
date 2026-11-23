// O e-mail que a pessoa dá para o Crossref (opcional).
//
// O Crossref pede um e-mail de contato nas consultas: quem se identifica cai no
// grupo de acesso "educado", mais estável e rápido. O e-mail é da própria
// pessoa, guardado só neste computador (não vai para o .apud), e só sai junto
// com a busca pelo DOI, para o Crossref. Sem e-mail, a busca funciona igual,
// no grupo comum.

export const CHAVE_DO_EMAIL = "apud:email-do-crossref";

/** Onde o e-mail fica guardado (o armazenamento do navegador; os testes trocam). */
export interface Armazem {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

/** O armazenamento do navegador, ou nada (ele pode faltar ou recusar). */
function armazemPadrao(): Armazem | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Um e-mail com cara de e-mail: algo@algo.algo, sem espaços. */
export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** O e-mail guardado, ou "" se não há (ou se o guardado não parece um e-mail). */
export function lerEmailDeContato(armazem: Armazem | null = armazemPadrao()): string {
  try {
    const e = armazem?.getItem(CHAVE_DO_EMAIL)?.trim() ?? "";
    return emailValido(e) ? e : "";
  } catch {
    return "";
  }
}

export type ResultadoDoEmail = { ok: true; email: string } | { ok: false; erro: string };

/** Guarda o e-mail. Vazio apaga. E-mail que não parece e-mail não é guardado. */
export function gravarEmailDeContato(email: string, armazem: Armazem | null = armazemPadrao()): ResultadoDoEmail {
  const e = email.trim();
  if (e && !emailValido(e)) return { ok: false, erro: "Esse e-mail parece incompleto. Confira, por exemplo: nome@exemplo.com." };
  if (!armazem) return { ok: false, erro: "Não consegui guardar o e-mail neste computador." };
  try {
    if (e) armazem.setItem(CHAVE_DO_EMAIL, e);
    else armazem.removeItem(CHAVE_DO_EMAIL);
    return { ok: true, email: e };
  } catch {
    return { ok: false, erro: "Não consegui guardar o e-mail neste computador." };
  }
}
