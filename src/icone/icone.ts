// O ícone do programa: a pessoa escolhe entre as variações do kit da marca.
//
// O ícone muda na janela e na barra de tarefas enquanto o Apud está aberto
// (o Windows deixa o programa trocar o ícone da própria janela). O ícone do
// atalho e do menu Iniciar fica o do instalador: o Windows não deixa o programa
// mexer nele. O padrão é o azul cobalto, o "uso prioritário" do kit.
// A escolha é da pessoa e fica só neste computador (como o tema).
// Aqui fica só a lógica, sem tela, para poder ser testada.

export type IdDoIcone =
  "cobalto" | "escuro" | "grafite" | "claro-grafite" | "claro-cobalto";

export const ICONES: { id: IdDoIcone; nome: string; descricao: string }[] = [
  {
    id: "cobalto",
    nome: "Azul cobalto",
    descricao: "Símbolo branco em azul cobalto (padrão)",
  },
  {
    id: "escuro",
    nome: "Escuro",
    descricao: "Grafite, com o símbolo branco e detalhes em azul claro",
  },
  {
    id: "grafite",
    nome: "Grafite",
    descricao: "Símbolo todo branco em grafite",
  },
  {
    id: "claro-cobalto",
    nome: "Claro, azul",
    descricao: "Fundo branco, grafite com detalhes em azul cobalto",
  },
  {
    id: "claro-grafite",
    nome: "Claro, grafite",
    descricao: "Fundo branco, símbolo todo grafite",
  },
];

export const CHAVE_DO_ICONE = "apud:icone";
export const ICONE_PADRAO: IdDoIcone = "cobalto";

export interface ArmazemDoIcone {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

function armazemPadrao(): ArmazemDoIcone | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function ehIdDeIcone(valor: unknown): valor is IdDoIcone {
  return ICONES.some((i) => i.id === valor);
}

/** O ícone guardado, ou o padrão (cobalto) se não há ou se o guardado não faz sentido. */
export function lerIcone(
  armazem: ArmazemDoIcone | null = armazemPadrao(),
): IdDoIcone {
  try {
    const guardado = armazem?.getItem(CHAVE_DO_ICONE);
    return ehIdDeIcone(guardado) ? guardado : ICONE_PADRAO;
  } catch {
    return ICONE_PADRAO;
  }
}

/** Guarda a escolha. Devolve false se o computador recusou (vale até fechar o programa). */
export function gravarIcone(
  id: IdDoIcone,
  armazem: ArmazemDoIcone | null = armazemPadrao(),
): boolean {
  try {
    if (!armazem) return false;
    armazem.setItem(CHAVE_DO_ICONE, id);
    return true;
  } catch {
    return false;
  }
}

/** Onde fica a imagem do ícone (pasta public/icones), para a janela e para a miniatura. */
export function arquivoDoIcone(id: IdDoIcone): string {
  return `/icones/${id}.png`;
}
