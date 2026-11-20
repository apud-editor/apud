import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { EditorContent, useEditor, useEditorState, type Editor as EditorTipTap } from "@tiptap/react";
import { documentoDoEditor, editorDoDocumento } from "../documento/tiptap";
import { estrutura } from "../documento/estrutura";
import type { Documento } from "../documento/modelo";
import { blocoAtual, TIPOS_DE_BLOCO } from "./blocos";
import { ControleDaBarra, extensoesDoApud } from "./extensoes";

interface Props {
  inicial: Documento;
  /** Chamado (com uma pequena espera) sempre que o texto muda. */
  aoMudar?: (doc: Documento) => void;
}

export default function Editor({ inicial, aoMudar }: Props) {
  const controle = useMemo(() => new ControleDaBarra(), []);
  const [documento, setDocumento] = useState(inicial);
  const espera = useRef<number>(0);
  const aoMudarRef = useRef(aoMudar);
  aoMudarRef.current = aoMudar;

  const editor = useEditor({
    extensions: extensoesDoApud(controle),
    content: editorDoDocumento(inicial),
    editorProps: { attributes: { class: "texto", "aria-label": "Texto do trabalho", spellcheck: "true", lang: "pt-BR" } },
    onUpdate: ({ editor }) => {
      // Converte só depois de uma pausa na digitação, para não pesar em textos longos.
      window.clearTimeout(espera.current);
      espera.current = window.setTimeout(() => {
        const doc = documentoDoEditor(editor.getJSON());
        setDocumento(doc);
        aoMudarRef.current?.(doc);
      }, 300);
    },
  });

  useEffect(() => () => window.clearTimeout(espera.current), []);

  return (
    <div className="area">
      <BarraDeFerramentas editor={editor} />
      <div className="colunas">
        <Estrutura documento={documento} editor={editor} />
        <main className="folha">
          <EditorContent editor={editor} />
        </main>
      </div>
      <MenuDeBlocos controle={controle} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function BarraDeFerramentas({ editor }: { editor: EditorTipTap | null }) {
  const estado = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bloco: blocoAtual(e).id,
            negrito: e.isActive("bold"),
            italico: e.isActive("italic"),
            sobrescrito: e.isActive("superscript"),
          }
        : null,
  });
  if (!editor || !estado) return <div className="ferramentas" />;

  return (
    <div className="ferramentas" role="toolbar" aria-label="Formatação do texto">
      <label className="oculto" htmlFor="tipo-de-bloco">
        Tipo do bloco
      </label>
      <select
        id="tipo-de-bloco"
        className="seletor"
        value={estado.bloco}
        onChange={(ev) => {
          const t = TIPOS_DE_BLOCO.find((x) => x.id === ev.target.value);
          if (t) t.aplicar(editor.chain().focus()).run();
        }}
      >
        {TIPOS_DE_BLOCO.map((t) => (
          <option key={t.id} value={t.id}>
            {t.rotulo}
          </option>
        ))}
      </select>
      <span className="divisor" aria-hidden="true" />
      <Botao rotulo="Negrito (Ctrl+B)" ligado={estado.negrito} aoClicar={() => editor.chain().focus().toggleBold().run()}>
        <b>B</b>
      </Botao>
      <Botao rotulo="Itálico (Ctrl+I)" ligado={estado.italico} aoClicar={() => editor.chain().focus().toggleItalic().run()}>
        <i>I</i>
      </Botao>
      <Botao
        rotulo="Sobrescrito (Ctrl+.)"
        ligado={estado.sobrescrito}
        aoClicar={() => editor.chain().focus().toggleSuperscript().run()}
      >
        <span>
          x<sup>2</sup>
        </span>
      </Botao>
    </div>
  );
}

function Botao(p: { rotulo: string; ligado: boolean; aoClicar: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`btn quadrado ${p.ligado ? "on" : ""}`}
      aria-label={p.rotulo}
      title={p.rotulo}
      aria-pressed={p.ligado}
      // mousedown, e não click: assim o editor não perde a seleção.
      onMouseDown={(ev) => {
        ev.preventDefault();
        p.aoClicar();
      }}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          p.aoClicar();
        }
      }}
    >
      {p.children}
    </button>
  );
}

// ---------------------------------------------------------------------------

function Estrutura({ documento, editor }: { documento: Documento; editor: EditorTipTap | null }) {
  const titulos = estrutura(documento.blocos);

  const irPara = (indice: number) => {
    if (!editor) return;
    // O bloco número "indice" do documento é o filho número "indice" do editor.
    const dom = editor.view.dom.children[indice] as HTMLElement | undefined;
    if (!dom) return;
    dom.scrollIntoView({ behavior: "smooth", block: "center" });
    const pos = editor.view.posAtDOM(dom, 0);
    editor.chain().focus().setTextSelection(pos).run();
  };

  return (
    <nav className="estrutura" aria-label="Estrutura do trabalho">
      <p className="rotulo-secao">Estrutura</p>
      {titulos.length === 0 ? (
        <p className="dica">Os títulos que você escrever aparecem aqui, numerados como na ABNT.</p>
      ) : (
        titulos.map((t) => (
          <button
            key={t.indice}
            type="button"
            className="nav"
            style={{ paddingLeft: 8 + (t.nivel - 1) * 14 }}
            onClick={() => irPara(t.indice)}
          >
            {t.numero} {t.texto || <span className="dica">(título vazio)</span>}
          </button>
        ))
      )}
    </nav>
  );
}

// ---------------------------------------------------------------------------

function MenuDeBlocos({ controle }: { controle: ControleDaBarra }) {
  const estado = useSyncExternalStore(controle.ouvir, controle.ler);
  if (!estado.aberta || !estado.posicao) return null;

  return (
    <div
      className="menu-blocos"
      role="listbox"
      aria-label="Escolha o tipo de bloco"
      style={{ left: estado.posicao.x, top: estado.posicao.y }}
    >
      {estado.itens.length === 0 ? (
        <p className="dica" style={{ margin: 8 }}>
          Nenhum bloco com esse nome.
        </p>
      ) : (
        estado.itens.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="option"
            aria-selected={i === estado.selecionado}
            className={`opcao ${i === estado.selecionado ? "quente" : ""}`}
            onMouseDown={(ev) => {
              ev.preventDefault();
              controle.confirmar(i);
            }}
          >
            {t.rotulo}
          </button>
        ))
      )}
      <p className="dica rodape-menu">↑ ↓ para escolher · Enter para inserir · Esc para fechar</p>
    </div>
  );
}
