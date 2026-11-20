// Os tipos de bloco que a pessoa pode escolher, usados pelo seletor da barra
// de ferramentas e pela barra "/". Um lugar só, para os dois mostrarem o mesmo.

import type { ChainedCommands, Editor } from "@tiptap/core";
import { NO_DA_LISTA_DE_REFERENCIAS } from "../documento/tiptap";

export interface TipoDeBloco {
  id: string;
  rotulo: string;
  /** Outras palavras que encontram este bloco na barra "/". */
  buscas: string[];
  /** Muda o bloco onde está o cursor para este tipo. */
  aplicar: (c: ChainedCommands) => ChainedCommands;
  ativo: (e: Editor) => boolean;
  /** Só aparece na barra "/", não no seletor de tipo do bloco (porque insere, em vez de mudar o bloco). */
  soNaBarra?: boolean;
}

const titulo = (nivel: 1 | 2 | 3 | 4 | 5): TipoDeBloco => ({
  id: `titulo${nivel}`,
  rotulo: `Título ${nivel}`,
  buscas: ["titulo", "seção", "secao", `t${nivel}`, `nivel ${nivel}`],
  aplicar: (c) => c.setHeading({ level: nivel }),
  ativo: (e) => e.isActive("heading", { level: nivel }),
});

export const TIPOS_DE_BLOCO: TipoDeBloco[] = [
  {
    id: "paragrafo",
    rotulo: "Parágrafo",
    buscas: ["paragrafo", "texto"],
    aplicar: (c) => c.setParagraph(),
    ativo: (e) => e.isActive("paragraph") && !e.isActive("listItem"),
  },
  titulo(1),
  titulo(2),
  titulo(3),
  titulo(4),
  titulo(5),
  {
    id: "lista",
    rotulo: "Lista",
    buscas: ["lista", "alinea", "alínea", "itens", "topicos"],
    aplicar: (c) => (c.toggleBulletList as () => ChainedCommands)(),
    ativo: (e) => e.isActive("bulletList"),
  },
  {
    id: "lista-sequencia",
    rotulo: "Lista em sequência",
    buscas: ["lista", "numerada", "passos", "sequencia", "ordem"],
    aplicar: (c) => (c.toggleOrderedList as () => ChainedCommands)(),
    ativo: (e) => e.isActive("orderedList"),
  },
  {
    id: "quebra",
    rotulo: "Quebra de página",
    buscas: ["quebra", "pagina", "página", "nova pagina", "salto"],
    aplicar: (c) => (c.setHorizontalRule as () => ChainedCommands)(),
    ativo: () => false,
    soNaBarra: true,
  },
  {
    id: "referencias",
    rotulo: "Lista de referências",
    buscas: ["referencias", "referências", "bibliografia", "lista final"],
    aplicar: (c) => c.insertContent({ type: NO_DA_LISTA_DE_REFERENCIAS }),
    ativo: () => false,
    soNaBarra: true,
  },
];

/** Tira acentos e maiúsculas, para "titulo" achar "Título". */
export function simplificar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function buscarBlocos(consulta: string): TipoDeBloco[] {
  const q = simplificar(consulta.trim());
  if (!q) return TIPOS_DE_BLOCO;
  return TIPOS_DE_BLOCO.filter((t) => [t.rotulo, ...t.buscas].some((p) => simplificar(p).includes(q)));
}

export function blocoAtual(e: Editor): TipoDeBloco {
  // Listas primeiro: o parágrafo dentro de um item também é "paragraph".
  const ordem = [...TIPOS_DE_BLOCO.slice(6), ...TIPOS_DE_BLOCO.slice(0, 6)].filter((t) => !t.soNaBarra);
  return ordem.find((t) => t.ativo(e)) ?? TIPOS_DE_BLOCO[0];
}
