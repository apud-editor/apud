import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "../editor/Editor";
import { VERSAO_DO_FORMATO, type Bloco, type Citacao, type Documento, type Referencia } from "../documento/modelo";
import { armazenamento, rodandoNoPrograma } from "../arquivos/armazenamento";
import { escreverArquivo, type Trabalho } from "../arquivos/formato";
import { SalvamentoAutomatico, type SituacaoDoSalvamento } from "../arquivos/salvamento";
import { registrarAntesDeSair } from "./sair";
import Previa from "./Previa";
import { documentoParaTypst } from "../conversor/typst";
import { motor } from "../conversor/motor";
import { normaEmbutida, normasEmbutidas, perfilEmbutido } from "../perfis/embutidos";
import { AparenciaDaNorma } from "../editor/extensoes";
import { CitacoesNoTexto } from "../editor/citacoes";
import { montarTodas, previaDaCitacao } from "../citacoes/todas";
import type { NormaDoTrabalho } from "../perfis/norma";
import Gaveta from "./Gaveta";
import { ajustesComEscolha, escolhasDoAutor, type EscolhaDoAutor } from "../referencias/escolhas";

interface Props {
  arquivo: string;
  trabalho: Trabalho;
  /** O trabalho acabou de ser criado: o nome já vem selecionado para trocar. */
  novo?: boolean;
  aoVoltar: () => void;
}

export default function TelaDoTrabalho({ arquivo, trabalho, novo, aoVoltar }: Props) {
  const lerTexto = useRef<(() => Bloco[]) | null>(null);
  const ultimoTexto = useRef<Bloco[]>(trabalho.documento.blocos);
  // As referências não passam pelo editor: ficam aqui, e o documento é montado
  // na hora de gravar. Assim, nada que aconteça no editor apaga uma referência.
  const referencias = useRef<Referencia[]>(trabalho.documento.referencias);
  // A norma do trabalho, com os ajustes que ele guarda para ela (escolhas do
  // autor). Trocar a norma muda o perfil do trabalho; os ajustes de cada norma
  // ficam guardados, e voltar para a anterior encontra as escolhas como estavam.
  const perfilAtual = useRef(trabalho.perfil);
  const ajustes = useRef(trabalho.ajustes);
  const [nomeDaNorma, setNomeDaNorma] = useState(trabalho.perfil.perfil);
  const norma = useRef<NormaDoTrabalho | null>(null);
  const lerNorma = useRef<() => NormaDoTrabalho>(() => {
    if (!norma.current) {
      const nome = perfilAtual.current.perfil;
      norma.current = normaEmbutida(nome, ajustes.current[nome] ?? {});
    }
    return norma.current;
  });
  const rotuloDaLista = () => lerNorma.current().perfil.regras.get("rótulo das referências")?.texto ?? "Referências";
  const aparencia = useMemo(() => new AparenciaDaNorma(rotuloDaLista()), []);
  // O texto de cada citação na norma: o motor monta todas juntas, na ordem do
  // texto, depois de uma pausa, e refaz quando as referências, a norma ou as
  // escolhas do autor mudam.
  const citacoes = useMemo(
    () =>
      new CitacoesNoTexto((blocos) =>
        montarTodas({ versao: VERSAO_DO_FORMATO, blocos, referencias: referencias.current }, lerNorma.current().perfil),
      ),
    [],
  );
  /** O documento inteiro, como vai para o arquivo e para o PDF. */
  const lerDocumento = useRef<() => Documento>(() => {
    // Se o editor não estiver disponível, usa o último texto lido: nunca grava um texto vazio por engano.
    if (lerTexto.current) ultimoTexto.current = lerTexto.current();
    return { versao: VERSAO_DO_FORMATO, blocos: ultimoTexto.current, referencias: referencias.current };
  });
  const nomeSalvo = useRef(trabalho.nome);
  const [nome, setNome] = useState(trabalho.nome);
  const [situacao, setSituacao] = useState<SituacaoDoSalvamento>({ tipo: "salvo", quando: null });
  const [problema, setProblema] = useState<string | null>(null);
  const campoDoNome = useRef<HTMLInputElement>(null);
  const mudancas = useMemo(() => new EventTarget(), []);
  // O painel da direita: a prévia do PDF ou a gaveta de referências. Um de cada vez, como no protótipo.
  const [painel, setPainel] = useState<"previa" | "referencias" | null>(null);
  const alternarPainel = (qual: "previa" | "referencias") => setPainel((atual) => (atual === qual ? null : qual));
  // Sobe quando as referências ou os ajustes mudam, para a gaveta se redesenhar (os dados ficam nos refs).
  const [versaoDosDados, setVersaoDosDados] = useState(0);
  const [exportando, setExportando] = useState(false);
  const [exportado, setExportado] = useState<string | null>(null);

  const salvamento = useMemo(
    () =>
      new SalvamentoAutomatico({
        armazenamento,
        arquivo,
        conteudo: () =>
          escreverArquivo({
            ...trabalho,
            nome: nomeSalvo.current,
            modificadoEm: new Date().toISOString(),
            perfil: perfilAtual.current,
            ajustes: ajustes.current,
            documento: lerDocumento.current(),
          }),
      }),
    // Um salvamento por trabalho aberto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [arquivo],
  );

  useEffect(() => {
    const parar = salvamento.ouvir(setSituacao);
    // Ao fechar o programa: grava o que faltar. Se não conseguir, não deixa fechar sem avisar.
    const desregistrar = registrarAntesDeSair(async () => {
      try {
        await salvamento.salvarAgora();
        return true;
      } catch (e) {
        setProblema(
          `Não consegui salvar antes de fechar: ${(e as Error).message}. Para sair mesmo assim, perdendo as últimas mudanças, feche a janela de novo.`,
        );
        return false;
      }
    });
    return () => {
      parar();
      desregistrar();
      salvamento.encerrar();
    };
  }, [salvamento]);

  useEffect(() => {
    if (novo) campoDoNome.current?.select();
  }, [novo]);

  const confirmarNome = async () => {
    const limpo = nome.replace(/\s+/g, " ").trim();
    if (!limpo) {
      setNome(nomeSalvo.current);
      return;
    }
    if (limpo === nomeSalvo.current) return;
    nomeSalvo.current = limpo;
    setNome(limpo);
    salvamento.houveMudanca();
    try {
      await salvamento.renomear(limpo);
    } catch (e) {
      setProblema(`Não consegui trocar o nome do arquivo: ${(e as Error).message}.`);
    }
  };

  const exportar = async () => {
    setExportando(true);
    setProblema(null);
    setExportado(null);
    try {
      const { perfil, csl } = lerNorma.current();
      const pdf = await motor.pdf(documentoParaTypst(lerDocumento.current(), perfil, { titulo: nomeSalvo.current, csl }));
      const onde = await armazenamento.exportarPdf(`${nomeSalvo.current}.pdf`, pdf);
      if (onde) setExportado(onde);
    } catch (e) {
      setProblema(`Não consegui exportar o PDF: ${(e as Error).message}.`);
    } finally {
      setExportando(false);
    }
  };

  const trocarNorma = (nome: string) => {
    if (nome === perfilAtual.current.perfil) return;
    try {
      const { identificacao: id } = normaEmbutida(nome, ajustes.current[nome] ?? {}).perfil;
      perfilAtual.current = { perfil: id.perfil, versao: id.versao, revisao: id.revisao };
      norma.current = null;
      setNomeDaNorma(id.perfil);
      aparencia.mudar(rotuloDaLista());
      citacoes.agendar(0);
      salvamento.houveMudanca();
      mudancas.dispatchEvent(new Event("mudou"));
    } catch (e) {
      setProblema(`Não consegui trocar a norma: ${(e as Error).message}.`);
    }
  };

  /** Fonte nova ou editada (o código é o mesmo). O PDF e as citações se refazem. */
  const salvarReferencia = (r: Referencia) => {
    const existe = referencias.current.some((x) => x.id === r.id);
    referencias.current = existe ? referencias.current.map((x) => (x.id === r.id ? r : x)) : [...referencias.current, r];
    depoisDeMudarOsDados();
  };

  /** As citações dessa fonte continuam no texto: o motor as marca como referência apagada. */
  const apagarReferencia = (id: string) => {
    referencias.current = referencias.current.filter((x) => x.id !== id);
    depoisDeMudarOsDados();
  };

  const depoisDeMudarOsDados = () => {
    setVersaoDosDados((v) => v + 1);
    citacoes.agendar(0);
    salvamento.houveMudanca();
    mudancas.dispatchEvent(new Event("mudou"));
  };

  /** Uma escolha do autor: grava em ajustes[norma] só o que difere do padrão do perfil. */
  const escolher = (e: EscolhaDoAutor, valor: string) => {
    const nome = perfilAtual.current.perfil;
    const novos = ajustesComEscolha(ajustes.current, nome, e.chave, valor, e.padrao);
    try {
      // Confere antes de guardar: um ajuste que a norma não aceita nunca chega ao arquivo.
      const { problemas } = normaEmbutida(nome, novos[nome] ?? {});
      if (problemas.length) throw new Error(problemas.map((p) => p.texto).join(" "));
    } catch (erro) {
      setProblema(`Não consegui aplicar essa escolha: ${(erro as Error).message}`);
      return;
    }
    ajustes.current = novos;
    norma.current = null;
    aparencia.mudar(rotuloDaLista());
    depoisDeMudarOsDados();
  };

  const lerBlocos = useCallback(() => lerDocumento.current().blocos, []);
  const lerReferencias = useCallback(() => referencias.current, []);
  /** Como uma citação ficaria na norma, para a janela do "@". */
  const previa = useCallback(
    (c: Citacao) => previaDaCitacao(lerDocumento.current().blocos, referencias.current, lerNorma.current().perfil, c),
    [],
  );

  const escolhas = useMemo(
    () => escolhasDoAutor(perfilEmbutido(nomeDaNorma), ajustes.current[nomeDaNorma]),
    // As escolhas mudam com a norma e com os ajustes (versaoDosDados sobe a cada mudança).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nomeDaNorma, versaoDosDados],
  );

  const voltar = async (mesmoSemSalvar = false) => {
    if (!mesmoSemSalvar) {
      try {
        await salvamento.salvarAgora();
      } catch (e) {
        setProblema(`Não consegui salvar: ${(e as Error).message}.`);
        return;
      }
    }
    aoVoltar();
  };

  return (
    <div className="tela">
      <header className="topo">
        <button type="button" className="marca botao-marca" onClick={() => voltar()} aria-label="Voltar para a lista de trabalhos">
          Apud
        </button>
        <span className="barra" aria-hidden="true">
          /
        </span>
        <label className="oculto" htmlFor="nome-do-trabalho">
          Nome do trabalho
        </label>
        <input
          id="nome-do-trabalho"
          ref={campoDoNome}
          className="campo-nome"
          value={nome}
          size={Math.max(12, Math.min(nome.length + 1, 60))}
          onChange={(e) => setNome(e.target.value)}
          onBlur={confirmarNome}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setNome(nomeSalvo.current);
              setTimeout(() => campoDoNome.current?.blur());
            }
          }}
        />
        <Situacao s={situacao} />
        <span style={{ flex: 1 }} />
        <div className="seletor-norma" role="group" aria-label="Norma do trabalho">
          {normasEmbutidas().map((n) => (
            <button
              key={n}
              type="button"
              className={`seg ${n === nomeDaNorma ? "on" : ""}`}
              aria-pressed={n === nomeDaNorma}
              title={n === nomeDaNorma ? `${perfilAtual.current.perfil} ${perfilAtual.current.versao}, revisão ${perfilAtual.current.revisao}` : `Trocar para ${n}`}
              onClick={() => trocarNorma(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <button type="button" className="btn primario" onClick={exportar} disabled={exportando}>
          {exportando ? "Montando o PDF…" : "Exportar PDF"}
        </button>
      </header>
      {exportado && (
        <div className="faixa-ok" role="status">
          <span>
            PDF salvo em <b>{exportado}</b>
          </span>
          <span style={{ flex: 1 }} />
          {rodandoNoPrograma && (
            <button type="button" className="btn" onClick={() => armazenamento.abrirPdfExportado().catch((e) => setProblema((e as Error).message))}>
              Abrir o PDF
            </button>
          )}
          <button type="button" className="btn" onClick={() => setExportado(null)}>
            Fechar aviso
          </button>
        </div>
      )}
      {problema && (
        <div className="faixa-erro" role="alert">
          <span>{problema} O texto continua aqui na tela.</span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="btn"
            onClick={async () => {
              setProblema(null);
              try {
                await salvamento.salvarAgora();
              } catch (e) {
                setProblema(`Não consegui salvar: ${(e as Error).message}.`);
              }
            }}
          >
            Tentar de novo
          </button>
          <button type="button" className="btn" onClick={() => setProblema(null)}>
            Fechar aviso
          </button>
        </div>
      )}
      <Editor
        inicial={trabalho.documento.blocos}
        aparencia={aparencia}
        citacoes={citacoes}
        lerReferencias={lerReferencias}
        previaDaCitacao={previa}
        aoCadastrarReferencia={() => setPainel("referencias")}
        aoMudar={() => {
          salvamento.houveMudanca();
          mudancas.dispatchEvent(new Event("mudou"));
        }}
        lerTexto={lerTexto}
        extrasDaBarra={
          <>
            <button
              type="button"
              className={`btn ${painel === "referencias" ? "on" : ""}`}
              aria-pressed={painel === "referencias"}
              onClick={() => alternarPainel("referencias")}
            >
              Referências
            </button>
            <button
              type="button"
              className={`btn ${painel === "previa" ? "on" : ""}`}
              aria-pressed={painel === "previa"}
              onClick={() => alternarPainel("previa")}
            >
              Prévia
            </button>
          </>
        }
        lateral={
          painel === "previa" ? (
            <Previa lerTexto={lerDocumento} lerNorma={lerNorma} mudancas={mudancas} nome={nome} aoFechar={() => setPainel(null)} />
          ) : painel === "referencias" ? (
            <Gaveta
              referencias={referencias.current}
              escolhas={escolhas}
              nomeDaNorma={nomeDaNorma}
              lerBlocos={lerBlocos}
              mudancas={mudancas}
              aoSalvar={salvarReferencia}
              aoApagar={apagarReferencia}
              aoEscolher={escolher}
              aoFechar={() => setPainel(null)}
            />
          ) : null
        }
      />
    </div>
  );
}

function Situacao({ s }: { s: SituacaoDoSalvamento }) {
  if (s.tipo === "erro") return <span className="aviso aviso-erro">Não salvo: tentando de novo</span>;
  if (s.tipo === "salvo") {
    const hora = s.quando?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return <span className="aviso">{hora ? `Salvo às ${hora}` : "Salvo"}</span>;
  }
  return <span className="aviso">Salvando…</span>;
}
