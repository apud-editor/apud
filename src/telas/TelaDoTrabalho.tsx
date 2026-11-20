import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "../editor/Editor";
import { VERSAO_DO_FORMATO, type Bloco, type Documento, type Referencia } from "../documento/modelo";
import { armazenamento, rodandoNoPrograma } from "../arquivos/armazenamento";
import { escreverArquivo, type Trabalho } from "../arquivos/formato";
import { SalvamentoAutomatico, type SituacaoDoSalvamento } from "../arquivos/salvamento";
import { registrarAntesDeSair } from "./sair";
import Previa from "./Previa";
import { documentoParaTypst } from "../conversor/typst";
import { motor } from "../conversor/motor";
import { perfilAbnt } from "../perfis/embutidos";

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
  const [previaAberta, setPreviaAberta] = useState(false);
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
      const pdf = await motor.pdf(documentoParaTypst(lerDocumento.current(), perfilAbnt(), { titulo: nomeSalvo.current }));
      const onde = await armazenamento.exportarPdf(`${nomeSalvo.current}.pdf`, pdf);
      if (onde) setExportado(onde);
    } catch (e) {
      setProblema(`Não consegui exportar o PDF: ${(e as Error).message}.`);
    } finally {
      setExportando(false);
    }
  };

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
        <span className="selo-norma" title={`${trabalho.perfil.perfil} ${trabalho.perfil.versao}, revisão ${trabalho.perfil.revisao}`}>
          {trabalho.perfil.perfil}
        </span>
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
        aoMudar={() => {
          salvamento.houveMudanca();
          mudancas.dispatchEvent(new Event("mudou"));
        }}
        lerTexto={lerTexto}
        extrasDaBarra={
          <button
            type="button"
            className={`btn ${previaAberta ? "on" : ""}`}
            aria-pressed={previaAberta}
            onClick={() => setPreviaAberta((a) => !a)}
          >
            Prévia
          </button>
        }
        lateral={
          previaAberta ? <Previa lerTexto={lerDocumento} mudancas={mudancas} nome={nome} aoFechar={() => setPreviaAberta(false)} /> : null
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
