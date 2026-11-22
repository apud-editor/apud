// As peças do editor para os blocos da fase 3: citação longa, nota de rodapé,
// figura e tabela.
//
// Parte 1 da fase 3: aqui ficam só a forma de cada peça (o que ela guarda e o
// que pode ter dentro), para um trabalho com esses blocos abrir e salvar sem
// perder nada. A barra "/", a escolha da imagem, os botões da tabela e a
// janela da nota chegam na parte 3.
//
// A conversão com o modelo do Apud fica em documento/tiptap.ts.

import { Node } from "@tiptap/core";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import {
  NO_DA_CITACAO_LONGA,
  NO_DA_FIGURA,
  NO_DA_FONTE_DA_ILUSTRACAO,
  NO_DA_NOTA,
  NO_DA_NOTA_DA_ILUSTRACAO,
  NO_DA_TABELA,
  NO_DO_TITULO_DA_ILUSTRACAO,
} from "../documento/tiptap";
import type { NotaDeRodape } from "../documento/modelo";

/** Citação longa: um bloco de texto, como um parágrafo, com citações e notas dentro. */
const CitacaoLonga = Node.create({
  name: NO_DA_CITACAO_LONGA,
  group: "block",
  content: "inline*",
  defining: true,
  parseHTML() {
    return [{ tag: "blockquote[data-citacao-longa]" }];
  },
  renderHTML() {
    return ["blockquote", { "data-citacao-longa": "", class: "citacao-longa" }, 0];
  },
});

/** Nota de rodapé: um nó no ponto do número, com o texto da nota guardado nele. */
const NotaNoTexto = Node.create({
  name: NO_DA_NOTA,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      dados: {
        default: null,
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute("data-nota") ?? "null");
          } catch {
            return null;
          }
        },
        renderHTML: (attrs) => (attrs.dados ? { "data-nota": JSON.stringify(attrs.dados) } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "sup[data-nota]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const nota = node.attrs.dados as NotaDeRodape | null;
    const texto = nota?.trechos.map((t) => t.texto).join("") ?? "";
    return ["sup", { ...HTMLAttributes, class: "nota-de-rodape", title: texto }, "*"];
  },
  // Ao copiar para fora do Apud, a nota não vira texto no meio da frase.
  renderText() {
    return "";
  },
});

/** As partes de texto de uma figura ou tabela. Só existem dentro delas. */
const parteDaIlustracao = (name: string, classe: string, dica: string) =>
  Node.create({
    name,
    content: "inline*",
    defining: true,
    parseHTML() {
      return [{ tag: `div[data-${classe}]` }];
    },
    renderHTML() {
      return ["div", { [`data-${classe}`]: "", class: classe, "data-dica": dica }, 0];
    },
  });

const TituloDaIlustracao = parteDaIlustracao(NO_DO_TITULO_DA_ILUSTRACAO, "titulo-da-ilustracao", "Título");
const FonteDaIlustracao = parteDaIlustracao(NO_DA_FONTE_DA_ILUSTRACAO, "fonte-da-ilustracao", "Fonte");
const NotaDaIlustracao = parteDaIlustracao(NO_DA_NOTA_DA_ILUSTRACAO, "nota-da-ilustracao", "Nota (opcional)");

/** Figura: a imagem (pelo código) e as três partes de texto, na ordem do PDF. */
const Figura = Node.create({
  name: NO_DA_FIGURA,
  group: "block",
  content: `${NO_DO_TITULO_DA_ILUSTRACAO} ${NO_DA_FONTE_DA_ILUSTRACAO} ${NO_DA_NOTA_DA_ILUSTRACAO}`,
  isolating: true,
  defining: true,
  addAttributes() {
    return {
      imagem: { default: "" },
      especie: { default: null },
      largura: { default: null },
      fontePropria: { default: false },
    };
  },
  parseHTML() {
    return [{ tag: "figure[data-figura]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figure", { "data-figura": HTMLAttributes.imagem ?? "", class: "figura" }, 0];
  },
});

/** Tabela: título, grade, fonte e nota. A grade é a tabela do TipTap, só dentro deste bloco. */
const TabelaDoApud = Node.create({
  name: NO_DA_TABELA,
  group: "block",
  content: `${NO_DO_TITULO_DA_ILUSTRACAO} table ${NO_DA_FONTE_DA_ILUSTRACAO} ${NO_DA_NOTA_DA_ILUSTRACAO}`,
  isolating: true,
  defining: true,
  addAttributes() {
    return { fontePropria: { default: false } };
  },
  parseHTML() {
    return [{ tag: "div[data-tabela]" }];
  },
  renderHTML() {
    return ["div", { "data-tabela": "", class: "tabela" }, 0];
  },
});

/**
 * A grade da tabela: cada célula é um parágrafo só (o modelo guarda um texto
 * por célula). A grade não entra solta no texto: só dentro do bloco Tabela.
 */
const Grade = Table.extend({ group: "" }).configure({ resizable: false });
const Celula = TableCell.extend({ content: "paragraph" });
const CelulaDeCabecalho = TableHeader.extend({ content: "paragraph" });

export const nosDaFase3 = () => [
  CitacaoLonga,
  NotaNoTexto,
  TituloDaIlustracao,
  FonteDaIlustracao,
  NotaDaIlustracao,
  Figura,
  TabelaDoApud,
  Grade,
  TableRow,
  Celula,
  CelulaDeCabecalho,
];
