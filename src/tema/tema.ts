// O tema do programa: Claro, Escuro ou Sistema.
//
// "Sistema" segue o tema do Windows e muda junto com ele, com o programa aberto.
// A escolha é da pessoa e fica só neste computador (como o e-mail do Crossref):
// não vai para o arquivo .apud nem muda de um trabalho para outro.
// Aqui fica só a lógica, sem tela, para poder ser testada.

export type EscolhaDeTema = "claro" | "escuro" | "sistema";
export type TemaAplicado = "claro" | "escuro";

export const CHAVE_DO_TEMA = "apud:tema";
export const TEMA_PADRAO: EscolhaDeTema = "sistema";

export const ESCOLHAS_DE_TEMA: { valor: EscolhaDeTema; rotulo: string }[] = [
  { valor: "claro", rotulo: "Claro" },
  { valor: "escuro", rotulo: "Escuro" },
  { valor: "sistema", rotulo: "Sistema" },
];

/** Onde a escolha fica guardada (o armazenamento do navegador; os testes trocam). */
export interface ArmazemDoTema {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

/** O armazenamento do navegador, ou nada (ele pode faltar ou recusar). */
function armazemPadrao(): ArmazemDoTema | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function ehEscolhaDeTema(valor: unknown): valor is EscolhaDeTema {
  return valor === "claro" || valor === "escuro" || valor === "sistema";
}

/** A escolha guardada, ou o padrão (Sistema) se não há ou se o guardado não faz sentido. */
export function lerEscolhaDeTema(armazem: ArmazemDoTema | null = armazemPadrao()): EscolhaDeTema {
  try {
    const guardado = armazem?.getItem(CHAVE_DO_TEMA);
    return ehEscolhaDeTema(guardado) ? guardado : TEMA_PADRAO;
  } catch {
    return TEMA_PADRAO;
  }
}

/** Guarda a escolha. Devolve false se o computador recusou (a escolha vale até fechar o programa). */
export function gravarEscolhaDeTema(escolha: EscolhaDeTema, armazem: ArmazemDoTema | null = armazemPadrao()): boolean {
  try {
    if (!armazem) return false;
    armazem.setItem(CHAVE_DO_TEMA, escolha);
    return true;
  } catch {
    return false;
  }
}

/** O tema que aparece de verdade: "Sistema" vira o do Windows. */
export function temaAplicado(escolha: EscolhaDeTema, sistemaEscuro: boolean): TemaAplicado {
  if (escolha === "sistema") return sistemaEscuro ? "escuro" : "claro";
  return escolha;
}

/** A pergunta ao navegador: o Windows está no tema escuro? */
export const CONSULTA_ESCURO = "(prefers-color-scheme: dark)";

export function sistemaEstaEscuro(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia(CONSULTA_ESCURO).matches;
  } catch {
    return false;
  }
}

/** Põe o tema na página: o CSS lê o atributo data-tema. */
export function aplicarTema(tema: TemaAplicado, raiz: { setAttribute(nome: string, valor: string): void }): void {
  raiz.setAttribute("data-tema", tema);
}

/** Antes de a tela aparecer (evita um clarão branco para quem usa o escuro). */
export function aplicarTemaInicial(): void {
  if (typeof document === "undefined") return;
  aplicarTema(temaAplicado(lerEscolhaDeTema(), sistemaEstaEscuro()), document.documentElement);
}
