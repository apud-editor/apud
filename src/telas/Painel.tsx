import { useEffect, useState } from "react";
import { armazenamento, rodandoNoPrograma } from "../arquivos/armazenamento";
import { escreverArquivo, lerArquivo, type Trabalho } from "../arquivos/formato";
import Assistente from "./Assistente";
import SeletorDeTema from "../tema/SeletorDeTema";
import { Logo } from "../marca/Marca";
import type { EscolhaDeTema } from "../tema/tema";
import SeletorDeIcone from "../icone/SeletorDeIcone";
import type { IdDoIcone } from "../icone/icone";

interface Linha {
  arquivo: string;
  modificado: number;
  trabalho?: Trabalho;
  erro?: string;
}

interface Props {
  aoAbrir: (arquivo: string, trabalho: Trabalho, novo: boolean) => void;
  temaEscolhido: EscolhaDeTema;
  aoEscolherTema: (escolha: EscolhaDeTema) => void;
  iconeEscolhido: IdDoIcone;
  aoEscolherIcone: (id: IdDoIcone) => void;
}

export default function Painel({ aoAbrir, temaEscolhido, aoEscolherTema, iconeEscolhido, aoEscolherIcone }: Props) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [pasta, setPasta] = useState("");
  const [problema, setProblema] = useState<string | null>(null);
  const [assistente, setAssistente] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        setPasta(await armazenamento.pasta());
        const lista = await armazenamento.listar();
        if (!ativo) return;
        setLinhas(
          lista.map((a) => {
            if (a.erro !== undefined || a.conteudo === undefined) return { arquivo: a.arquivo, modificado: a.modificado, erro: a.erro };
            const r = lerArquivo(a.conteudo);
            return r.ok
              ? { arquivo: a.arquivo, modificado: a.modificado, trabalho: r.trabalho }
              : { arquivo: a.arquivo, modificado: a.modificado, erro: r.erro };
          }),
        );
      } catch (e) {
        if (ativo) setProblema(`Não consegui ler a pasta dos trabalhos: ${(e as Error).message}.`);
        if (ativo) setLinhas([]);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  /** O assistente terminou: grava o trabalho e abre. */
  const criarTrabalho = async (trabalho: Trabalho) => {
    try {
      const arquivo = await armazenamento.criar(trabalho.nome, escreverArquivo(trabalho));
      aoAbrir(arquivo, trabalho, false);
    } catch (e) {
      setAssistente(false);
      setProblema(`Não consegui criar o trabalho: ${(e as Error).message}.`);
    }
  };

  const abrir = async (l: Linha) => {
    if (l.erro) {
      setProblema(`Não consegui abrir ${l.arquivo}: ${l.erro}. O arquivo não foi alterado.`);
      return;
    }
    // Lê de novo na hora de abrir: o arquivo pode ter mudado desde a lista.
    try {
      const r = lerArquivo(await armazenamento.ler(l.arquivo));
      if (!r.ok) setProblema(`Não consegui abrir ${l.arquivo}: ${r.erro}. O arquivo não foi alterado.`);
      else aoAbrir(l.arquivo, r.trabalho, false);
    } catch (e) {
      setProblema(`Não consegui abrir ${l.arquivo}: ${(e as Error).message}.`);
    }
  };

  if (assistente) return <Assistente aoCriar={criarTrabalho} aoCancelar={() => setAssistente(false)} />;

  return (
    <div className="tela">
      <header className="topo" data-tauri-drag-region>
        <span className="topo-logo mk-gatilho" data-tauri-drag-region>
          <Logo altura={32} />
        </span>
        <span style={{ flex: 1 }} data-tauri-drag-region />
        <SeletorDeIcone escolhido={iconeEscolhido} aoEscolher={aoEscolherIcone} />
        <SeletorDeTema escolha={temaEscolhido} aoEscolher={aoEscolherTema} />
      </header>
      <main className="painel">
        <div className="painel-conteudo">
          <div className="painel-cabecalho">
            <div style={{ flex: 1, minWidth: 240 }}>
              <h1>Seus trabalhos</h1>
              <p className="dica-grande">Você escreve o conteúdo, e o Apud aplica a norma.</p>
            </div>
            {rodandoNoPrograma && (
              <button type="button" className="btn grande" onClick={() => armazenamento.mostrarPasta().catch(() => {})}>
                Abrir a pasta
              </button>
            )}
            <button type="button" className="btn grande primario" onClick={() => setAssistente(true)}>
              Novo trabalho
            </button>
          </div>

          {problema && (
            <div className="faixa-erro caixa" role="alert">
              <span>{problema}</span>
              <span style={{ flex: 1 }} />
              <button type="button" className="btn" onClick={() => setProblema(null)}>
                Fechar aviso
              </button>
            </div>
          )}

          <div className="tabela">
            <div className="linha cabecalho">
              <span>Nome</span>
              <span>Norma</span>
              <span>Última edição</span>
            </div>
            {linhas === null ? (
              <p className="vazio">Procurando os trabalhos…</p>
            ) : linhas.length === 0 ? (
              <p className="vazio">Nenhum trabalho ainda. Clique em “Novo trabalho” para começar.</p>
            ) : (
              linhas.map((l, _i, todas) => (
                <button key={l.arquivo} type="button" className="linha" onClick={() => abrir(l)}>
                  {l.trabalho ? (
                    <>
                      <span className="nome">
                        {l.trabalho.nome}
                        {/* Dois trabalhos com o mesmo nome: mostra o arquivo para diferenciar. */}
                        {todas.some((o) => o !== l && o.trabalho?.nome === l.trabalho!.nome) && (
                          <span className="arquivo-linha">{l.arquivo}</span>
                        )}
                      </span>
                      <span>
                        <span className="selo-norma">{l.trabalho.perfil.perfil}</span>
                      </span>
                      <span className="data">{quando(l.trabalho.modificadoEm, l.modificado)}</span>
                    </>
                  ) : (
                    <>
                      <span className="nome">
                        {l.arquivo}
                        <span className="erro-linha">Não consegui ler este arquivo</span>
                      </span>
                      <span />
                      <span className="data">{quando("", l.modificado)}</span>
                    </>
                  )}
                </button>
              ))
            )}
          </div>

          <p className="dica-grande rodape-painel">
            Os trabalhos ficam {rodandoNoPrograma ? <>na pasta <b>{pasta}</b></> : <>na {pasta}</>}, como arquivos .apud, e
            funcionam sem internet. Salvar é automático.
          </p>
        </div>
      </main>
    </div>
  );
}

function quando(iso: string, ms: number): string {
  const d = iso ? new Date(iso) : new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return mesmoDia ? `hoje, ${hora}` : d.toLocaleDateString("pt-BR");
}
