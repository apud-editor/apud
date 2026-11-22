import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Superscript from "@tiptap/extension-superscript";
import type { NotaDeRodape } from "../documento/modelo";
import { campoParaNota, notaParaCampo, type EstadoDaJanelaDaNota } from "./notas";
import { prenderTab } from "./foco";

interface Props {
  estado: EstadoDaJanelaDaNota;
  aoConfirmar: (nota: NotaDeRodape) => void;
  aoRemover: () => void;
  aoFechar: () => void;
}

/** A nota é uma frase (ou um trecho) com negrito, itálico e sobrescrito: nada de títulos, listas ou citações. */
const EXTENSOES_DA_NOTA = [
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

/** A janela da nota de rodapé: abre pela barra "/", pelo botão "Nota de rodapé" ou ao clicar no número de uma nota. */
export default function JanelaDaNota({ estado, aoConfirmar, aoRemover, aoFechar }: Props) {
  const [erro, setErro] = useState<string | null>(null);
  const janela = useRef<HTMLFormElement>(null);
  const editando = estado.modo === "editar";

  const confirmarRef = useRef<() => void>(() => {});
  const campo = useEditor({
    extensions: EXTENSOES_DA_NOTA,
    content: notaParaCampo(estado.nota),
    autofocus: "end",
    editorProps: {
      attributes: { class: "campo-da-nota", "aria-label": "Texto da nota de rodapé", spellcheck: "true", lang: "pt-BR" },
      // Enter confirma (a nota é um parágrafo só).
      handleKeyDown: (_v, ev) => {
        if (ev.key !== "Enter") return false;
        ev.preventDefault();
        confirmarRef.current();
        return true;
      },
    },
    onUpdate: () => setErro(null),
  });

  const confirmar = () => {
    if (!campo) return;
    const nota = campoParaNota(campo.getJSON());
    if (!nota) {
      setErro("Escreva o texto da nota. Para apagar a nota, use “Remover nota”.");
      return;
    }
    aoConfirmar(nota);
  };
  confirmarRef.current = confirmar;

  useEffect(() => {
    const aoApertar = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        aoFechar();
      }
    };
    document.addEventListener("keydown", aoApertar);
    return () => document.removeEventListener("keydown", aoApertar);
  }, [aoFechar]);

  // O Tab dá a volta dentro da janela (mesma regra da janela da citação).
  useEffect(() => {
    const aoApertarTab = (ev: KeyboardEvent) => {
      if (ev.key !== "Tab" || ev.altKey || ev.ctrlKey || ev.metaKey || !janela.current) return;
      if (prenderTab(janela.current, ev.shiftKey)) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    };
    document.addEventListener("keydown", aoApertarTab, true);
    return () => document.removeEventListener("keydown", aoApertarTab, true);
  }, []);

  const botao = (rotulo: string, titulo: string, ativo: boolean, fazer: () => void, conteudo: React.ReactNode) => (
    <button
      type="button"
      className={`btn quadrado ${ativo ? "on" : ""}`}
      aria-label={rotulo}
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
    <div className="janela-fundo">
      <form
        ref={janela}
        className="janela-citacao"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-da-nota"
        onSubmit={(ev) => {
          ev.preventDefault();
          confirmar();
        }}
      >
        <h2 id="titulo-da-nota">{editando ? "Editar nota de rodapé" : "Nota de rodapé"}</h2>
        <p className="dica" style={{ margin: 0 }}>
          O número é do Apud: ele conta as notas na ordem do texto. Você escreve só o que vai no pé da página.
        </p>
        <div className="ferramentas-da-nota" role="toolbar" aria-label="Formatação da nota">
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
        {erro && <p className="erro-form">{erro}</p>}
        <div className="acoes-form janela-acoes">
          {editando && (
            <button type="button" className="btn perigo" onClick={aoRemover}>
              Remover nota
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="btn primario">
            {editando ? "Salvar" : "Inserir nota"}
          </button>
        </div>
      </form>
    </div>
  );
}
