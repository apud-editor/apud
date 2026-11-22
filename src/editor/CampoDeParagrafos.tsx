import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Superscript from "@tiptap/extension-superscript";
import type { TrechoDeTexto } from "../documento/modelo";
import { campoParaParagrafos, paragrafosParaCampo } from "./campo";

interface Props {
  id: string;
  /** O nome do campo, para quem usa leitor de tela. */
  rotulo: string;
  /** O texto de quando o campo abre. Depois, o campo é da pessoa: mudar esta propriedade não troca o que está escrito. */
  inicial: TrechoDeTexto[][];
  aoMudar: (paragrafos: TrechoDeTexto[][]) => void;
  /** Um parágrafo só (o resumo da ABNT). Enter não cria outro. */
  unico?: boolean;
  dica?: string;
}

/** Só texto com negrito, itálico e sobrescrito: nada de títulos, listas ou citações. */
const EXTENSOES = [
  StarterKit.configure({
    blockquote: false,
    bulletList: false,
    code: false,
    codeBlock: false,
    hardBreak: false,
    heading: false,
    horizontalRule: false,
    link: false,
    listItem: false,
    listKeymap: false,
    orderedList: false,
    strike: false,
    underline: false,
  }),
  Superscript,
];

/** Um campo de texto pequeno, com negrito, itálico e sobrescrito, para a "Abertura do trabalho". */
export default function CampoDeParagrafos({ id, rotulo, inicial, aoMudar, unico, dica }: Props) {
  const campo = useEditor({
    extensions: EXTENSOES,
    immediatelyRender: false,
    content: paragrafosParaCampo(inicial),
    editorProps: {
      attributes: { id, class: "campo-da-abertura", "aria-label": rotulo, spellcheck: "true", lang: "pt-BR" },
      handleKeyDown: (_v, ev) => {
        if (unico && ev.key === "Enter") {
          ev.preventDefault();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => aoMudar(campoParaParagrafos(editor.getJSON(), unico)),
  });

  const botao = (nome: string, titulo: string, ativo: boolean, fazer: () => void, conteudo: React.ReactNode) => (
    <button
      type="button"
      className={`btn quadrado ${ativo ? "on" : ""}`}
      aria-label={nome}
      title={titulo}
      aria-pressed={ativo}
      onMouseDown={(ev) => {
        ev.preventDefault();
        fazer();
      }}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ev.stopPropagation();
          fazer();
        }
      }}
    >
      {conteudo}
    </button>
  );

  return (
    <div className="campo-abertura">
      <div className="ferramentas-da-nota" role="toolbar" aria-label={`Formatação: ${rotulo}`}>
        {botao("Negrito", "Negrito (Ctrl+B)", !!campo?.isActive("bold"), () => campo?.chain().focus().toggleBold().run(), <b>B</b>)}
        {botao("Itálico", "Itálico (Ctrl+I)", !!campo?.isActive("italic"), () => campo?.chain().focus().toggleItalic().run(), <i>I</i>)}
        {botao(
          "Sobrescrito",
          "Sobrescrito",
          !!campo?.isActive("superscript"),
          () => campo?.chain().focus().toggleSuperscript().run(),
          <span>
            x<sup>2</sup>
          </span>,
        )}
      </div>
      <EditorContent editor={campo} className="area-da-nota" />
      {dica && <p className="dica-form">{dica}</p>}
    </div>
  );
}
