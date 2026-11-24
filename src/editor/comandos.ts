// O que a tela do trabalho pode pedir ao editor (os menus do cabeçalho usam isto).
// O editor preenche este "controle remoto" quando fica pronto.

export type PedidoDeInsercao = "imagem" | "tabela" | "nota" | "quebra" | "citacao";

export interface ComandosDoEditor {
  desfazer: () => void;
  refazer: () => void;
  inserir: (o: PedidoDeInsercao) => void;
  /** Sem referências cadastráveis a tela não tem "Citar @". */
  podeCitar: boolean;
}
