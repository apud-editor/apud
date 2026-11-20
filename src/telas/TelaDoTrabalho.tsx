import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "../editor/Editor";
import type { Documento } from "../documento/modelo";
import { armazenamento } from "../arquivos/armazenamento";
import { escreverArquivo, type Trabalho } from "../arquivos/formato";
import { SalvamentoAutomatico, type SituacaoDoSalvamento } from "../arquivos/salvamento";
import { registrarAntesDeSair } from "./sair";

interface Props {
  arquivo: string;
  trabalho: Trabalho;
  /** O trabalho acabou de ser criado: o nome já vem selecionado para trocar. */
  novo?: boolean;
  aoVoltar: () => void;
}

export default function TelaDoTrabalho({ arquivo, trabalho, novo, aoVoltar }: Props) {
  const lerTexto = useRef<(() => Documento) | null>(null);
  const ultimoTexto = useRef<Documento>(trabalho.documento);
  const nomeSalvo = useRef(trabalho.nome);
  const [nome, setNome] = useState(trabalho.nome);
  const [situacao, setSituacao] = useState<SituacaoDoSalvamento>({ tipo: "salvo", quando: null });
  const [problema, setProblema] = useState<string | null>(null);
  const campoDoNome = useRef<HTMLInputElement>(null);

  const salvamento = useMemo(
    () =>
      new SalvamentoAutomatico({
        armazenamento,
        arquivo,
        conteudo: () => {
          // Se o editor não estiver disponível, usa o último texto lido: nunca grava um texto vazio por engano.
          if (lerTexto.current) ultimoTexto.current = lerTexto.current();
          return escreverArquivo({
            ...trabalho,
            nome: nomeSalvo.current,
            modificadoEm: new Date().toISOString(),
            documento: ultimoTexto.current,
          });
        },
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
      </header>
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
        inicial={trabalho.documento}
        aoMudar={() => salvamento.houveMudanca()}
        lerTexto={lerTexto}
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
