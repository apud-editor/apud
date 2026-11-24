import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Superscript from "@tiptap/extension-superscript";
import Placeholder from "@tiptap/extension-placeholder";
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
  /** O texto cinza do campo vazio. */
  convite?: string;
}

/** Só texto com negrito, itálico e sobrescrito: nada de títulos, listas ou citações. */
const extensoes = (convite: string) => [
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
  Placeholder.configure({ placeholder: convite }),
];

/**
 * Um texto da Abertura (dedicatória, epígrafe, agradecimentos, resumo), direto
 * no fluxo do texto, sem moldura de formulário (etapa 3, parte 3a). Negrito,
 * itálico e sobrescrito pelos atalhos (Ctrl+B, Ctrl+I, Ctrl+.).
 */
export default function CampoDeParagrafos({ id, rotulo, inicial, aoMudar, unico, convite = "" }: Props) {
  const campo = useEditor({
    extensions: extensoes(convite),
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

  return <EditorContent editor={campo} className="area-da-abertura" />;
}
