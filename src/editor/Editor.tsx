import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { EditorContent, useEditor, useEditorState, type Editor as EditorTipTap } from "@tiptap/react";
import { blocosDoEditor, editorDosBlocos } from "../documento/tiptap";
import { avisosDeNumeracao, estrutura } from "../documento/estrutura";
import type { Bloco, Citacao, Referencia } from "../documento/modelo";
import type { CitacaoMontada } from "../citacoes/motor";
import { blocoAtual, TIPOS_DE_BLOCO } from "./blocos";
import { AparenciaDaNorma, ControleDaBarra, extensoesDoApud, inserirQuebra } from "./extensoes";
import { CitacoesNoTexto, ControleDaJanela } from "./citacoes";
import { escreverArroba, inserirCitacao, trocarCitacao } from "./citar";
import JanelaDeCitacao from "./JanelaDeCitacao";
import JanelaDaNota from "./JanelaDaNota";
import { ControleDaNota, inserirNota, trocarNota } from "./notas";
import { ImagensNoEditor, ImagemRecusada, TIPOS_ACEITOS, lerImagemDoArquivo } from "./imagens";
import { apagarIlustracao, ilustracaoDoCursor, inserirFigura, inserirTabela, mudarIlustracao } from "./ilustracoes";
import type { ControlesDosNos } from "./nos";
import type { ComandosDoEditor } from "./comandos";

interface Props {
  /** Os blocos do texto. As referências não passam pelo editor: a tela do trabalho as guarda. */
  inicial: Bloco[];
  /** Chamado na hora, a cada mudança no texto. */
  aoMudar?: () => void;
  /** Recebe a função que lê o texto atual, para quem precisa dele (o salvamento e a prévia). */
  lerTexto?: React.MutableRefObject<(() => Bloco[]) | null>;
  /** O cursor mudou de bloco (a posição do bloco no texto), para a prévia acompanhar. */
  aoMoverCursor?: (indice: number) => void;
  /** Botões a mais, no lado direito da barra de ferramentas (como "Prévia"). */
  extrasDaBarra?: React.ReactNode;
  /** Um painel ao lado do texto (como a prévia do PDF). */
  lateral?: React.ReactNode;
  /** O que vem acima do texto, dentro da folha (a "Abertura do trabalho"). */
  antes?: React.ReactNode;
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
  /** As imagens do trabalho (as figuras buscam e guardam aqui). Sem isto, o editor não aceita figuras novas. */
  imagens?: ImagensNoEditor;
  /** Recebe o "controle remoto" do editor (desfazer, inserir...), para os menus do cabeçalho. */
  comandos?: React.MutableRefObject<ComandosDoEditor | null>;
}

export default function Editor({
  inicial,
  aoMudar,
  lerTexto,
  aoMoverCursor,
  extrasDaBarra,
  lateral,
  antes,
  aparencia: aparenciaDada,
  citacoes: citacoesDadas,
  lerReferencias,
  previaDaCitacao,
  aoCadastrarReferencia,
  imagens: imagensDadas,
  comandos,
}: Props) {
  const controle = useMemo(() => new ControleDaBarra(), []);
  const janela = useMemo(() => new ControleDaJanela(), []);
  const aparencia = useMemo(() => aparenciaDada ?? new AparenciaDaNorma(), [aparenciaDada]);
  const citacoes = useMemo(() => citacoesDadas ?? new CitacoesNoTexto(() => []), [citacoesDadas]);
  const podeCitar = !!lerReferencias;
  const notaCtl = useMemo(() => new ControleDaNota(), []);
  const imagens = useMemo(() => imagensDadas ?? new ImagensNoEditor(() => [], () => {}), [imagensDadas]);
  const controlesDosNos = useMemo<ControlesDosNos>(() => ({ imagens, nota: notaCtl }), [imagens, notaCtl]);
  const [problemaDaImagem, setProblemaDaImagem] = useState<string | null>(null);
  /** Foto grande leva alguns segundos para ser preparada: a tela avisa. */
  const [preparandoImagem, setPreparandoImagem] = useState(false);
  const [blocos, setBlocos] = useState(inicial);
  const espera = useRef<number>(0);
  const aoMudarRef = useRef(aoMudar);
  aoMudarRef.current = aoMudar;
  const aoMoverCursorRef = useRef(aoMoverCursor);
  aoMoverCursorRef.current = aoMoverCursor;

  const editor = useEditor({
    extensions: extensoesDoApud(controle, undefined, aparencia, citacoes, janela, controlesDosNos),
    content: editorDosBlocos(inicial),
    editorProps: { attributes: { class: "texto", "aria-label": "Texto do trabalho", spellcheck: "true", lang: "pt-BR" } },
    // O bloco do cursor é o filho do editor em que ele está (o mesmo número do bloco no texto).
    onSelectionUpdate: ({ editor }) => aoMoverCursorRef.current?.(editor.state.selection.$head.index(0)),
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
  const estadoDaNota = useSyncExternalStore(notaCtl.ouvir, notaCtl.ler);

  /**
   * Abre o seletor de arquivo e coloca a imagem: numa figura nova (sem `pos`) ou
   * no lugar da imagem da figura que está em `pos`. O seletor só abre por um
   * clique ou tecla da pessoa (regra do navegador), e é o caso aqui.
   */
  const escolherImagem = (pos?: number) => {
    if (!editor) return;
    const campo = document.createElement("input");
    campo.type = "file";
    campo.accept = TIPOS_ACEITOS;
    campo.onchange = async () => {
      const arquivo = campo.files?.[0];
      if (!arquivo) return;
      setProblemaDaImagem(null);
      setPreparandoImagem(true);
      try {
        const imagem = await lerImagemDoArquivo(arquivo);
        imagens.adicionar(imagem);
        const tr = pos === undefined ? inserirFigura(editor.state, imagem.id) : mudarIlustracao(editor.state, pos, { imagem: imagem.id });
        if (tr) editor.view.dispatch(tr);
        editor.commands.focus();
        setProblemaDaImagem(null);
      } catch (e) {
        setProblemaDaImagem(e instanceof ImagemRecusada ? e.message : "Não consegui colocar essa imagem. Tente outro arquivo.");
      } finally {
        setPreparandoImagem(false);
      }
    };
    campo.click();
  };

  // Blocos da barra "/" e do botão que precisam de mais que mudar o tipo do bloco.
  useEffect(() => {
    if (!editor) return;
    controle.aoPedir = (o) => {
      if (o === "nota") notaCtl.abrirParaInserir(editor.state.selection.from, editor.state.selection.to);
      else if (o === "tabela") {
        editor.view.dispatch(inserirTabela(editor.state));
        editor.commands.focus();
      } else escolherImagem();
    };
    return () => {
      controle.aoPedir = null;
    };
    // escolherImagem só depende do editor e das imagens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, controle, notaCtl, imagens]);

  // O controle remoto para os menus do cabeçalho: faz o mesmo que os botões da barra.
  useEffect(() => {
    if (!comandos || !editor) return;
    comandos.current = {
      desfazer: () => void editor.chain().focus().undo().run(),
      refazer: () => void editor.chain().focus().redo().run(),
      inserir: (o) => {
        if (o === "quebra") inserirQuebra(editor);
        else if (o === "citacao") janela.abrirParaInserir("botao", editor.state.selection.to);
        else controle.aoPedir?.(o);
      },
      podeCitar,
    };
    return () => {
      comandos.current = null;
    };
  }, [editor, comandos, controle, janela, podeCitar]);

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
      <BarraDeFerramentas
        editor={editor}
        extras={extrasDaBarra}
        janela={podeCitar ? janela : undefined}
        aoInserir={(o) => controle.aoPedir?.(o)}
      />
      <BarraDaIlustracao editor={editor} aoEscolherImagem={escolherImagem} />
      {preparandoImagem && (
        <div className="faixa-aviso faixa-info" role="status">
          <span>Preparando a imagem… Fotos grandes são reduzidas ao tamanho de impressão, o que leva alguns segundos.</span>
        </div>
      )}
      {problemaDaImagem && (
        <div className="faixa-aviso" role="alert">
          <span>{problemaDaImagem}</span>
          <button type="button" className="btn" onClick={() => setProblemaDaImagem(null)}>
            Fechar
          </button>
        </div>
      )}
      <AvisosDoTexto citacoes={citacoes} />
      <div className="colunas">
        <Estrutura blocos={blocos} editor={editor} aparencia={aparencia} />
        <main className="folha">
          {antes}
          <EditorContent editor={editor} />
        </main>
        {lateral}
      </div>
      <MenuDeBlocos controle={controle} />
      {estadoDaNota.aberta && (
        <JanelaDaNota
          key={estadoDaNota.chave}
          estado={estadoDaNota}
          aoFechar={() => {
            notaCtl.fechar();
            editor?.commands.focus();
          }}
          aoConfirmar={(nota) => {
            if (!editor) return;
            const tr =
              estadoDaNota.modo === "editar" ? trocarNota(editor.state, estadoDaNota.de, nota) : inserirNota(editor.state, estadoDaNota.de, estadoDaNota.ate, nota);
            if (tr) editor.view.dispatch(tr);
            notaCtl.fechar();
            editor.commands.focus();
          }}
          aoRemover={() => {
            if (!editor) return;
            const tr = trocarNota(editor.state, estadoDaNota.de, null);
            if (tr) editor.view.dispatch(tr);
            notaCtl.fechar();
            editor.commands.focus();
          }}
        />
      )}
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

function BarraDeFerramentas({
  editor,
  extras,
  janela,
  aoInserir,
}: {
  editor: EditorTipTap | null;
  extras?: React.ReactNode;
  janela?: ControleDaJanela;
  aoInserir: (o: "imagem" | "tabela" | "nota") => void;
}) {
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
      <BotaoDeTexto rotulo="Figura" titulo="Inserir uma figura: escolha a imagem no computador" aoClicar={() => aoInserir("imagem")} />
      <BotaoDeTexto rotulo="Tabela" titulo="Inserir uma tabela (dá para colar da planilha)" aoClicar={() => aoInserir("tabela")} />
      <BotaoDeTexto rotulo="Nota de rodapé" titulo="Inserir uma nota de rodapé no ponto do cursor" aoClicar={() => aoInserir("nota")} />
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

function BotaoDeTexto(p: { rotulo: string; titulo: string; aoClicar: () => void }) {
  return (
    <button
      type="button"
      className="btn"
      title={p.titulo}
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
      {p.rotulo}
    </button>
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
// As opções da figura ou da tabela onde o cursor está

const LARGURAS_DA_FIGURA = [100, 80, 60, 50, 40, 30];

function BarraDaIlustracao({ editor, aoEscolherImagem }: { editor: EditorTipTap | null; aoEscolherImagem: (pos: number) => void }) {
  const estado = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const il = e ? ilustracaoDoCursor(e.state) : null;
      if (!il) return null;
      const primeiraLinha = il.no.firstChild && il.tipo === "tabela" ? il.no.child(1)?.firstChild : null;
      return {
        tipo: il.tipo,
        pos: il.pos,
        especie: (il.no.attrs.especie as string | null) ?? "figura",
        largura: il.no.attrs.largura ? Number(il.no.attrs.largura) : 0,
        fontePropria: !!il.no.attrs.fontePropria,
        cabecalho: primeiraLinha?.firstChild?.type.name === "tableHeader",
      };
    },
  });
  if (!editor || !estado) return null;

  const mudar = (parcial: Record<string, unknown>) => {
    const tr = mudarIlustracao(editor.state, estado.pos, parcial);
    if (tr) editor.view.dispatch(tr);
  };
  const apagar = () => {
    const tr = apagarIlustracao(editor.state, estado.pos);
    if (tr) editor.view.dispatch(tr);
    editor.commands.focus();
  };
  const botao = (rotulo: string, titulo: string, fazer: () => void, classe = "") => (
    <button
      key={rotulo}
      type="button"
      className={`btn ${classe}`}
      title={titulo}
      onMouseDown={(ev) => {
        ev.preventDefault();
        fazer();
      }}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          fazer();
        }
      }}
    >
      {rotulo}
    </button>
  );
  const fontePropria = (
    <label className="marcar-simples" title="Marque quando a figura ou tabela é sua. A norma escolhe como mostrar (na ABNT, “Fonte: Elaborado pelo próprio autor”).">
      <input type="checkbox" checked={estado.fontePropria} onChange={(ev) => mudar({ fontePropria: ev.target.checked })} />
      Elaborado pelo próprio autor
    </label>
  );

  if (estado.tipo === "figura") {
    const larguras = estado.largura && !LARGURAS_DA_FIGURA.includes(estado.largura) ? [...LARGURAS_DA_FIGURA, estado.largura].sort((a, b) => b - a) : LARGURAS_DA_FIGURA;
    return (
      <div className="ferramentas contexto" role="toolbar" aria-label="Opções da figura">
        <strong className="contexto-rotulo">Figura</strong>
        {botao("Trocar imagem", "Escolher outra imagem do computador", () => aoEscolherImagem(estado.pos))}
        <label className="campo-simples" title="Só a ABNT separa Figura, Gráfico e Quadro; na APA, tudo é Figura.">
          Chamar de
          <select className="seletor" value={estado.especie} onChange={(ev) => mudar({ especie: ev.target.value === "figura" ? null : ev.target.value })}>
            <option value="figura">Figura</option>
            <option value="grafico">Gráfico</option>
            <option value="quadro">Quadro</option>
          </select>
        </label>
        <label className="campo-simples">
          Largura
          <select className="seletor" value={estado.largura || ""} onChange={(ev) => mudar({ largura: ev.target.value ? Number(ev.target.value) : null })}>
            <option value="">Tamanho da imagem</option>
            {larguras.map((l) => (
              <option key={l} value={l}>
                {l}% do texto
              </option>
            ))}
          </select>
        </label>
        {fontePropria}
        <span style={{ flex: 1 }} />
        {botao("Apagar figura", "Apaga a figura inteira, com o título e a fonte", apagar, "perigo")}
      </div>
    );
  }

  const comando = (fazer: (c: ReturnType<EditorTipTap["chain"]>) => ReturnType<EditorTipTap["chain"]>) => () => fazer(editor.chain().focus()).run();
  return (
    <div className="ferramentas contexto" role="toolbar" aria-label="Opções da tabela">
      <strong className="contexto-rotulo">Tabela</strong>
      {botao("+ Linha", "Acrescenta uma linha abaixo da linha do cursor", comando((c) => c.addRowAfter()))}
      {botao("− Linha", "Apaga a linha do cursor", comando((c) => c.deleteRow()))}
      {botao("+ Coluna", "Acrescenta uma coluna à direita da coluna do cursor", comando((c) => c.addColumnAfter()))}
      {botao("− Coluna", "Apaga a coluna do cursor", comando((c) => c.deleteColumn()))}
      <label className="marcar-simples" title="A primeira linha vira o cabeçalho da tabela (os nomes das colunas).">
        <input type="checkbox" checked={estado.cabecalho} onChange={() => comando((c) => c.toggleHeaderRow())()} />
        Primeira linha é o cabeçalho
      </label>
      {fontePropria}
      <span style={{ flex: 1 }} />
      {botao("Apagar tabela", "Apaga a tabela inteira, com o título e a fonte", apagar, "perigo")}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Estrutura({ blocos, editor, aparencia }: { blocos: Bloco[]; editor: EditorTipTap | null; aparencia: AparenciaDaNorma }) {
  const titulos = estrutura(blocos);
  const avisos = avisosDeNumeracao(titulos);
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
              <>
                {t.texto || <span className="dica">(título vazio)</span>}
                {avisos.has(t.indice) && (
                  <span className="dica aviso-de-numero" style={{ display: "block" }} role="note">
                    {avisos.get(t.indice)}
                  </span>
                )}
              </>
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
