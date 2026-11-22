// As peças do editor para os blocos da fase 3: citação longa, nota de rodapé,
// figura e tabela.
//
// Parte 1 da fase 3: a forma de cada peça (o que ela guarda e o que pode ter
// dentro). Parte 3: como cada uma aparece e se comporta na tela (o número da
// nota, a imagem da figura, o aviso de imagem que sumiu). Quem abre a janela
// da nota e quem guarda as imagens é a tela do trabalho, por `ControlesDosNos`.
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
import { ImagensNoEditor, enderecoDaImagem } from "./imagens";
import { ControleDaNota, notaSelecionada } from "./notas";

/** O que as peças precisam da tela do trabalho. Sem isto, elas só mostram (como nos testes). */
export interface ControlesDosNos {
  imagens: ImagensNoEditor;
  nota: ControleDaNota;
}

const controlesVazios = (): ControlesDosNos => ({ imagens: new ImagensNoEditor(() => [], () => {}), nota: new ControleDaNota() });

const textoDaNota = (nota: NotaDeRodape | null) => nota?.trechos.map((t) => t.texto).join("") ?? "";

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

/**
 * Nota de rodapé: um nó no ponto do número, com o texto da nota guardado nele.
 * O número aparece pela contagem do navegador (a ordem das notas no texto),
 * sem guardar número nenhum: apagar ou mover uma nota renumera as outras.
 */
const notaNoTexto = (controles: ControlesDosNos) =>
  Node.create({
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
      return ["sup", { ...HTMLAttributes, class: "nota-de-rodape", title: textoDaNota(node.attrs.dados as NotaDeRodape | null) }];
    },
    // Ao copiar para fora do Apud, a nota não vira texto no meio da frase.
    renderText() {
      return "";
    },
    addKeyboardShortcuts() {
      return {
        // Com a nota selecionada (clique ou setas), Enter abre a janela para editar.
        Enter: ({ editor }) => {
          const sel = notaSelecionada(editor.state);
          if (!sel) return false;
          controles.nota.abrirParaEditar(sel.pos, sel.nota);
          return true;
        },
      };
    },
    addNodeView() {
      return ({ node, getPos }) => {
        let atual = node;
        const dom = document.createElement("sup");
        dom.setAttribute("role", "button");
        dom.tabIndex = -1;
        const desenhar = () => {
          const texto = textoDaNota(atual.attrs.dados as NotaDeRodape | null);
          dom.className = "nota-de-rodape";
          dom.title = `${texto || "(nota vazia)"}\nClique para editar ou apagar esta nota`;
          dom.setAttribute("aria-label", `Nota de rodapé: ${texto}. Enter para editar.`);
        };
        desenhar();
        dom.addEventListener("click", () => {
          const pos = getPos();
          const dados = atual.attrs.dados as NotaDeRodape | null;
          if (typeof pos === "number" && dados) controles.nota.abrirParaEditar(pos, dados);
        });
        return {
          dom,
          update(novo) {
            if (novo.type !== atual.type) return false;
            atual = novo;
            desenhar();
            return true;
          },
        };
      };
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

/**
 * Figura: a imagem (pelo código) e as três partes de texto, na ordem do PDF.
 * Na tela, a imagem aparece em cima, na largura escolhida; se ela não está no
 * arquivo, a figura avisa e pede a imagem de novo.
 */
const figura = (controles: ControlesDosNos) =>
  Node.create({
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
    addNodeView() {
      return ({ node, getPos, editor }) => {
        let atual = node;
        const dom = document.createElement("figure");
        dom.className = "figura";
        const quadro = document.createElement("div");
        quadro.contentEditable = "false";
        const partes = document.createElement("div");
        partes.className = "figura-partes";
        dom.append(quadro, partes);

        // A imagem é refeita só quando muda (o código ou a largura), para digitar no título não custar nada.
        let desenhada = "";
        const desenhar = () => {
          const id = String(atual.attrs.imagem ?? "");
          const largura = Number(atual.attrs.largura) || 0;
          const imagem = controles.imagens.buscar(id);
          const chave = `${id}|${largura}|${imagem ? "sim" : "nao"}`;
          if (chave === desenhada) return;
          desenhada = chave;
          quadro.replaceChildren();
          if (imagem) {
            quadro.className = "figura-imagem";
            const el = document.createElement("img");
            el.src = enderecoDaImagem(imagem);
            el.alt = imagem.nome ?? "Imagem da figura";
            if (largura) el.style.width = `${largura}%`;
            quadro.append(el);
          } else {
            quadro.className = "figura-imagem sem-imagem";
            quadro.textContent = id
              ? "Atenção: a imagem desta figura não está no arquivo. Use “Trocar imagem”, na faixa azul acima do texto, para escolher de novo."
              : "Esta figura ainda não tem imagem. Use “Trocar imagem”, na faixa azul acima do texto.";
          }
        };
        desenhar();
        const aoMudarImagens = () => desenhar();
        controles.imagens.addEventListener("mudou", aoMudarImagens);
        // Clicar na imagem leva o cursor para a figura (e mostra as opções dela).
        quadro.addEventListener("click", () => {
          const pos = getPos();
          if (typeof pos === "number") editor.chain().focus().setTextSelection(pos + 2).run();
        });
        return {
          dom,
          contentDOM: partes,
          update(novo) {
            if (novo.type !== atual.type) return false;
            atual = novo;
            desenhar();
            return true;
          },
          // A imagem é nossa: o editor não precisa ler o que mexemos nela nem os cliques nela.
          ignoreMutation: (m) => !partes.contains(m.target),
          stopEvent: (ev) => quadro.contains(ev.target as globalThis.Node),
          destroy: () => controles.imagens.removeEventListener("mudou", aoMudarImagens),
        };
      };
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

export const nosDaFase3 = (controles: ControlesDosNos = controlesVazios()) => [
  CitacaoLonga,
  notaNoTexto(controles),
  TituloDaIlustracao,
  FonteDaIlustracao,
  NotaDaIlustracao,
  figura(controles),
  TabelaDoApud,
  Grade,
  TableRow,
  Celula,
  CelulaDeCabecalho,
];
