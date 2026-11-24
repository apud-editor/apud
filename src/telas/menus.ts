// Os menus do cabeçalho do editor (Arquivo, Editar, Inserir, Modelo, Referências).
// Aqui fica só a lógica, sem tela: o que cada menu tem e como o teclado anda
// entre os itens. A tela (BarraDeMenus.tsx) apenas desenha isto.

import { ESCOLHAS_DE_TEMA, type EscolhaDeTema } from "../tema/tema";
import { ATALHOS_DOS_PAINEIS } from "./atalhos";
import type { AbaDasConfiguracoes } from "./Configuracoes";

export type ItemDeMenu =
  | { tipo: "acao"; id: string; rotulo: string; atalho?: string; desativado?: boolean; aoEscolher: () => void }
  /** Uma escolha entre várias (a norma, o tema): mostra qual está marcada. */
  | { tipo: "opcao"; id: string; rotulo: string; marcado: boolean; aoEscolher: () => void }
  | { tipo: "titulo"; id: string; rotulo: string }
  | { tipo: "separador"; id: string };

export interface Menu {
  id: string;
  rotulo: string;
  itens: ItemDeMenu[];
}

/** O item pode ser escolhido (e recebe o foco do teclado)? */
export function ehEscolhivel(item: ItemDeMenu): boolean {
  return (item.tipo === "acao" && !item.desativado) || item.tipo === "opcao";
}

/** O próximo item escolhível andando `passo` (1 ou -1) a partir de `atual` (-1 = nenhum), dando a volta. -1 se não há nenhum. */
export function proximoItem(itens: ItemDeMenu[], atual: number, passo: 1 | -1): number {
  const n = itens.length;
  if (n === 0) return -1;
  let i = atual;
  for (let volta = 0; volta < n; volta++) {
    i = atual === -1 && passo === -1 && volta === 0 ? n - 1 : (i + passo + n) % n;
    if (ehEscolhivel(itens[i])) return i;
  }
  return -1;
}

export function primeiroItem(itens: ItemDeMenu[]): number {
  return itens.findIndex(ehEscolhivel);
}

export function ultimoItem(itens: ItemDeMenu[]): number {
  for (let i = itens.length - 1; i >= 0; i--) if (ehEscolhivel(itens[i])) return i;
  return -1;
}

/** O menu vizinho da barra, dando a volta (Seta direita e esquerda). */
export function menuVizinho(total: number, atual: number, passo: 1 | -1): number {
  if (total === 0) return -1;
  return (atual + passo + total) % total;
}

/** O que a tela do trabalho oferece aos menus. */
export interface ContextoDosMenus {
  /** A norma do trabalho e as que existem. */
  norma: string;
  normas: string[];
  temaEscolhido: EscolhaDeTema;
  /** O painel que está aberto, para o texto do item (abrir ou fechar). */
  painelAberto: "previa" | "referencias" | null;
  podeCitar: boolean;
  exportando: boolean;
  temEscolhasDoAutor: boolean;
  aoVoltar: () => void;
  aoExportar: () => void;
  aoAbrirConfiguracoes: (aba: AbaDasConfiguracoes) => void;
  aoEscolherTema: (e: EscolhaDeTema) => void;
  aoTrocarNorma: (n: string) => void;
  aoAlternarPainel: (p: "previa" | "referencias") => void;
  desfazer: () => void;
  refazer: () => void;
  inserir: (o: "imagem" | "tabela" | "nota" | "quebra" | "citacao") => void;
}

/** Só o que o programa faz hoje: cada item já existia, em botão, atalho ou tela. */
export function montarMenus(c: ContextoDosMenus): Menu[] {
  const temas = ESCOLHAS_DE_TEMA.map<ItemDeMenu>((e) => ({
    tipo: "opcao",
    id: `tema-${e.valor}`,
    rotulo: e.rotulo,
    marcado: e.valor === c.temaEscolhido,
    aoEscolher: () => c.aoEscolherTema(e.valor),
  }));
  return [
    {
      id: "arquivo",
      rotulo: "Arquivo",
      itens: [
        { tipo: "acao", id: "voltar", rotulo: "Voltar para a lista de trabalhos", aoEscolher: c.aoVoltar },
        { tipo: "acao", id: "exportar", rotulo: c.exportando ? "Montando o PDF…" : "Exportar PDF", desativado: c.exportando, aoEscolher: c.aoExportar },
        { tipo: "separador", id: "sep-config" },
        { tipo: "acao", id: "configuracoes", rotulo: "Configurações do trabalho…", aoEscolher: () => c.aoAbrirConfiguracoes("dados") },
        { tipo: "separador", id: "sep-pref" },
        { tipo: "titulo", id: "pref-tema", rotulo: "Preferências · Tema do programa" },
        ...temas,
      ],
    },
    {
      id: "editar",
      rotulo: "Editar",
      itens: [
        { tipo: "acao", id: "desfazer", rotulo: "Desfazer", atalho: "Ctrl+Z", aoEscolher: c.desfazer },
        { tipo: "acao", id: "refazer", rotulo: "Refazer", atalho: "Ctrl+Y", aoEscolher: c.refazer },
      ],
    },
    {
      id: "inserir",
      rotulo: "Inserir",
      itens: [
        ...(c.podeCitar ? [{ tipo: "acao", id: "citar", rotulo: "Citação (@)", aoEscolher: () => c.inserir("citacao") } as ItemDeMenu] : []),
        { tipo: "acao", id: "figura", rotulo: "Figura…", aoEscolher: () => c.inserir("imagem") },
        { tipo: "acao", id: "tabela", rotulo: "Tabela", aoEscolher: () => c.inserir("tabela") },
        { tipo: "acao", id: "nota", rotulo: "Nota de rodapé", aoEscolher: () => c.inserir("nota") },
        { tipo: "acao", id: "quebra", rotulo: "Quebra de página", atalho: "Ctrl+Enter", aoEscolher: () => c.inserir("quebra") },
      ],
    },
    {
      id: "modelo",
      rotulo: "Modelo",
      itens: [
        { tipo: "titulo", id: "norma", rotulo: "Norma do trabalho" },
        ...c.normas.map<ItemDeMenu>((n) => ({ tipo: "opcao", id: `norma-${n}`, rotulo: n, marcado: n === c.norma, aoEscolher: () => c.aoTrocarNorma(n) })),
        { tipo: "separador", id: "sep-elementos" },
        { tipo: "acao", id: "elementos", rotulo: "Elementos do trabalho…", aoEscolher: () => c.aoAbrirConfiguracoes("elementos") },
      ],
    },
    {
      id: "referencias",
      rotulo: "Referências",
      itens: [
        {
          tipo: "acao",
          id: "lista",
          rotulo: c.painelAberto === "referencias" ? "Fechar a lista de referências" : "Abrir a lista de referências",
          atalho: ATALHOS_DOS_PAINEIS.referencias.texto,
          aoEscolher: () => c.aoAlternarPainel("referencias"),
        },
        {
          tipo: "acao",
          id: "previa",
          rotulo: c.painelAberto === "previa" ? "Fechar a prévia do PDF" : "Abrir a prévia do PDF",
          atalho: ATALHOS_DOS_PAINEIS.previa.texto,
          aoEscolher: () => c.aoAlternarPainel("previa"),
        },
        ...(c.temEscolhasDoAutor
          ? ([
              { tipo: "separador", id: "sep-escolhas" },
              { tipo: "acao", id: "escolhas", rotulo: "Escolhas do autor…", aoEscolher: () => c.aoAbrirConfiguracoes("escolhas") },
            ] as ItemDeMenu[])
          : []),
      ],
    },
  ];
}
