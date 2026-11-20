import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { EditorContent, useEditor, useEditorState, type Editor as EditorTipTap } from "@tiptap/react";
import { blocosDoEditor, editorDosBlocos } from "../documento/tiptap";
import { estrutura } from "../documento/estrutura";
import type { Bloco, Citacao, Referencia } from "../documento/modelo";
import type { CitacaoMontada } from "../citacoes/motor";
import { blocoAtual, TIPOS_DE_BLOCO } from "./blocos";
import { AparenciaDaNorma, ControleDaBarra, extensoesDoApud, inserirQuebra } from "./extensoes";
import { CitacoesNoTexto, ControleDaJanela } from "./citacoes";
import { escreverArroba, inserirCitacao, trocarCitacao } from "./citar";
import JanelaDeCitacao from "./JanelaDeCitacao";

interface Props {
  /** Os blocos do texto. As referências não passam pelo editor: a tela do trabalho as guarda. */
  inicial: Bloco[];
  /** Chamado na hora, a cada mudança no texto. */
  aoMudar?: () => void;
  /** Recebe a função que lê o texto atual, para quem precisa dele (o salvamento e a prévia). */
  lerTexto?: React.MutableRefObject<(() => Bloco[]) | null>;
  /** Botões a mais, no lado direito da barra de ferramentas (como "Prévia"). */
  extrasDaBarra?: React.ReactNode;
  /** Um painel ao lado do texto (como a prévia do PDF). */
  lateral?: React.ReactNode;
  /** O que depende da norma do trabalho (o título da lista de referências). */
  aparencia?: AparenciaDaNorma;
  /** Quem sabe escrever as citações na norma (o texto mostrado em cada citação e os avisos do texto). */
  citacoes?: CitacoesNoTexto;
  /** As referências do trabalho, para a janela da citação. Sem isto, não há "@" nem "Citar @". */
  lerReferencias?: () => Referencia[];
  /** Como uma citação ficaria na norma, para a janela. */
  previaDaCitacao?: (c: Citacao) => CitacaoMontada | null;
  /** A janela da citação pede para cadastrar uma referência: abre a gaveta. */
  aoCadastrarReferencia?: () => void;
}

export default function Editor({
  inicial,
  aoMudar,
  lerTexto,
  extrasDaBarra,
  lateral,
  aparencia: aparenciaDada,
  citacoes: citacoesDadas,
  lerReferencias,
  previaDaCitacao,
  aoCadastrarReferencia,
}: Props) {
  const controle = useMemo(() => new ControleDaBarra(), []);
  const janela = useMemo(() => new ControleDaJanela(), []);
  const aparencia = useMemo(() => aparenciaDada ?? new AparenciaDaNorma(), [aparenciaDada]);
  const citacoes = useMemo(() => citacoesDadas ?? new CitacoesNoTexto(() => []), [citacoesDadas]);
  const podeCitar = !!lerReferencias;
  const [blocos, setBlocos] = useState(inicial);
  const espera = useRef<number>(0);
  const aoMudarRef = useRef(aoMudar);
  aoMudarRef.current = aoMudar;

  const editor = useEditor({
    extensions: extensoesDoApud(controle, undefined, aparencia, citacoes, janela),
    content: editorDosBlocos(inicial),
    editorProps: { attributes: { class: "texto", "aria-label": "Texto do trabalho", spellcheck: "true", lang: "pt-BR" } },
    onUpdate: ({ editor }) => {
      aoMudarRef.current?.();
      // As citações na norma dependem do texto todo: refeitas depois de uma pausa.
      citacoes.agendar();
      // A estrutura da esquerda só é refeita depois de uma pausa, para não pesar em textos longos.
      window.clearTimeout(espera.current);
      espera.current = window.setTimeout(() => setBlocos(blocosDoEditor(editor.getJSON())), 300);
    },
  });

  useEffect(() => {
    if (!lerTexto || !editor) return;
    lerTexto.current = () => blocosDoEditor(editor.getJSON());
    return () => {
      lerTexto.current = null;
    };
  }, [editor, lerTexto]);

  useEffect(() => () => window.clearTimeout(espera.current), []);

  // O texto das citações na norma: monta a primeira vez ao abrir e depois a cada pausa.
  useEffect(() => {
    if (!editor) return;
    citacoes.ligar(editor);
    citacoes.agendar(0);
    return () => citacoes.ligar(null);
  }, [editor, citacoes]);

  const fecharJanela = () => {
    janela.fechar();
    editor?.commands.focus();
  };
  const estadoDaJanela = useSyncExternalStore(janela.ouvir, janela.ler);

  /** Aplica o que a janela decidiu e refaz as citações já. */
  const aplicar = (fazer: (e: NonNullable<typeof editor>) => void) => {
    if (!editor) return;
    fazer(editor);
    janela.fechar();
    editor.commands.focus();
    citacoes.agendar(0);
  };

  return (
    <div className="area">
      <BarraDeFerramentas editor={editor} extras={extrasDaBarra} janela={podeCitar ? janela : undefined} />
      <AvisosDoTexto citacoes={citacoes} />
      <div className="colunas">
        <Estrutura blocos={blocos} editor={editor} aparencia={aparencia} />
        <main className="folha">
          <EditorContent editor={editor} />
        </main>
        {lateral}
      </div>
      <MenuDeBlocos controle={controle} />
      {podeCitar && estadoDaJanela.aberta && (
        <JanelaDeCitacao
          key={estadoDaJanela.chave}
          estado={estadoDaJanela}
          referencias={lerReferencias!()}
          previa={previaDaCitacao ?? (() => null)}
          aoFechar={fecharJanela}
          aoCadastrar={
            aoCadastrarReferencia &&
            (() => {
              fecharJanela();
              aoCadastrarReferencia();
            })
          }
          aoConfirmar={(c) =>
            aplicar((e) => {
              const tr =
                estadoDaJanela.modo === "editar"
                  ? trocarCitacao(e.state, estadoDaJanela.de, c)
                  : inserirCitacao(e.state, estadoDaJanela.de, estadoDaJanela.ate, c);
              if (tr) e.view.dispatch(tr);
            })
          }
          aoRemover={() =>
            aplicar((e) => {
              const tr = trocarCitacao(e.state, estadoDaJanela.de, null);
              if (tr) e.view.dispatch(tr);
            })
          }
          aoEscreverArroba={() => aplicar((e) => e.view.dispatch(escreverArroba(e.state, estadoDaJanela.de, estadoDaJanela.ate)))}
        />
      )}
    </div>
  );
}

/** Avisos sobre o texto todo (falta a lista de referências, ou ela aparece mais de uma vez). Não impedem o PDF. */
function AvisosDoTexto({ citacoes }: { citacoes: CitacoesNoTexto }) {
  useSyncExternalStore(citacoes.ouvir, citacoes.ler);
  if (citacoes.avisosDoTexto.length === 0) return null;
  return (
    <div className="faixa-aviso" role="status">
      {citacoes.avisosDoTexto.map((a) => (
        <span key={a.tipo}>{a.mensagem}</span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function BarraDeFerramentas({ editor, extras, janela }: { editor: EditorTipTap | null; extras?: React.ReactNode; janela?: ControleDaJanela }) {
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
  if (!editor || !estado) return <div className="ferramentas">{extras}</div>;

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
        {TIPOS_DE_BLOCO.filter((t) => !t.soNaBarra).map((t) => (
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
      <span className="divisor" aria-hidden="true" />
      <button
        type="button"
        className="btn"
        title="O que vem depois começa numa página nova (Ctrl+Enter)"
        onMouseDown={(ev) => {
          ev.preventDefault();
          inserirQuebra(editor);
        }}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            inserirQuebra(editor);
          }
        }}
      >
        Quebra de página
      </button>
      {janela && (
        <button
          type="button"
          className="btn"
          title="Citar uma obra, uma fala ou uma citação de citação (ou digite @ no texto)"
          onMouseDown={(ev) => {
            ev.preventDefault();
            janela.abrirParaInserir("botao", editor.state.selection.to);
          }}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.preventDefault();
              janela.abrirParaInserir("botao", editor.state.selection.to);
            }
          }}
        >
          Citar @
        </button>
      )}
      <span style={{ flex: 1 }} />
      {extras}
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

function Estrutura({ blocos, editor, aparencia }: { blocos: Bloco[]; editor: EditorTipTap | null; aparencia: AparenciaDaNorma }) {
  const titulos = estrutura(blocos);
  const rotulo = useSyncExternalStore(
    (f) => {
      aparencia.addEventListener("mudou", f);
      return () => aparencia.removeEventListener("mudou", f);
    },
    () => aparencia.rotuloDasReferencias,
  );

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
        <p className="dica">Os títulos que você escrever aparecem aqui. Para numerar, escreva o número antes do título: 1.1 Contexto.</p>
      ) : (
        titulos.map((t) => (
          <button
            key={t.indice}
            type="button"
            className="nav"
            style={{ paddingLeft: 8 + (t.nivel - 1) * 14 }}
            onClick={() => irPara(t.indice)}
          >
            {t.referencias ? (
              <>
                {rotulo}
                <span className="dica" style={{ display: "block" }}>
                  lista montada pela norma
                </span>
              </>
            ) : (
              t.texto || <span className="dica">(título vazio)</span>
            )}
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
