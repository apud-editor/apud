import { useEffect, useMemo, useRef, useState } from "react";
import type { Citacao, Referencia } from "../documento/modelo";
import type { CitacaoMontada } from "../citacoes/motor";
import {
  citacaoParaFormulario,
  formularioNovo,
  formularioParaCitacao,
  obraVazia,
  type ErroDoFormulario,
  type FormularioDeCitacao,
  type ObraNoFormulario,
  type OndeNaObra,
  type OQueSeCita,
} from "../citacoes/janela";
import { buscarReferencias, ordenarParaGaveta, resumoDaReferencia } from "../referencias/lista";
import type { EstadoDaJanela } from "./citacoes";
import { prenderTab } from "./foco";

interface Props {
  estado: EstadoDaJanela;
  referencias: Referencia[];
  /** Como a citação ficaria na norma (o motor de citações). Devolve null se não der para montar. */
  previa: (c: Citacao) => CitacaoMontada | null;
  aoConfirmar: (c: Citacao) => void;
  aoRemover: () => void;
  aoFechar: () => void;
  /** Quando a janela abriu pelo "@": escrever o @ no texto, sem citar. */
  aoEscreverArroba: () => void;
  /** Abre a gaveta de referências para cadastrar uma fonte. */
  aoCadastrar?: () => void;
}

const FORMAS: { id: OQueSeCita; nome: string; dica: string }[] = [
  { id: "obra", nome: "Uma obra da lista", dica: "Uma ou mais obras que você cadastrou." },
  { id: "apud", nome: "Citação de citação (apud)", dica: "Você leu uma obra que cita outra, e quer citar a outra." },
  { id: "fala", nome: "Fala sem referência", dica: "Fala de paciente ou participante, ou conversa pessoal. Não entra na lista." },
];

/** A janela da citação: abre com "@", com o botão "Citar @" ou ao clicar numa citação do texto. */
export default function JanelaDeCitacao({ estado, referencias, previa, aoConfirmar, aoRemover, aoFechar, aoEscreverArroba, aoCadastrar }: Props) {
  const [f, setF] = useState<FormularioDeCitacao>(() => (estado.citacao ? citacaoParaFormulario(estado.citacao) : formularioNovo()));
  const [ativaGuardada, setAtiva] = useState(0);
  const [busca, setBusca] = useState("");
  const [erros, setErros] = useState<ErroDoFormulario[]>([]);
  const campoDeBusca = useRef<HTMLInputElement>(null);

  const porId = useMemo(() => new Map(referencias.map((r) => [r.id, r])), [referencias]);
  const vistas = useMemo(() => ordenarParaGaveta(buscarReferencias(referencias, busca)), [referencias, busca]);
  const editando = estado.modo === "editar";
  const usaObras = f.oQue !== "fala";
  const linhas = f.oQue === "obra" ? f.obras : f.obras.slice(0, 1);
  // Ao trocar de forma, a linha ativa pode não existir mais (só a primeira vale no apud).
  const ativa = Math.min(ativaGuardada, linhas.length - 1);
  const usadas = new Set(linhas.map((o, i) => (i === ativa ? "" : o.referencia)).filter(Boolean));

  const mudar = (parcial: Partial<FormularioDeCitacao>) => {
    setF((atual) => ({ ...atual, ...parcial }));
    setErros([]);
  };
  const mudarObra = (indice: number, parcial: Partial<ObraNoFormulario>) => {
    setF((atual) => ({ ...atual, obras: atual.obras.map((o, i) => (i === indice ? { ...o, ...parcial } : o)) }));
    setErros([]);
  };
  const erroDe = (campo: string) => erros.find((e) => e.campo === campo)?.mensagem;

  const escolherObra = (id: string) => {
    mudarObra(ativa, { referencia: id });
    setBusca("");
    setTimeout(() => document.getElementById(`citacao-pagina-${ativa}`)?.focus());
  };

  const maisUmaObra = () => {
    setF((atual) => ({ ...atual, obras: [...atual.obras, obraVazia()], autorNoTexto: false }));
    setAtiva(f.obras.length);
    setBusca("");
    setTimeout(() => campoDeBusca.current?.focus());
  };

  const tirarObra = (indice: number) => {
    setF((atual) => ({ ...atual, obras: atual.obras.filter((_, i) => i !== indice) }));
    setAtiva(0);
    setErros([]);
  };

  const confirmar = () => {
    const r = formularioParaCitacao(f);
    if (r.ok) aoConfirmar(r.citacao);
    else setErros(r.erros);
  };

  // Como fica na norma, enquanto a pessoa preenche.
  const resultado = useMemo(() => {
    const r = formularioParaCitacao(f);
    if (!r.ok) return null;
    try {
      return previa(r.citacao);
    } catch {
      return null;
    }
  }, [f, previa]);

  const janela = useRef<HTMLFormElement>(null);

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

  // O Tab dá a volta dentro da janela e não sai para o texto de trás. Ouve
  // antes de todos (captura), para o editor de trás não usar a tecla.
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

  return (
    <div className="janela-fundo">
      <form
        ref={janela}
        className="janela-citacao"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-da-citacao"
        onSubmit={(ev) => {
          ev.preventDefault();
          confirmar();
        }}
      >
        <h2 id="titulo-da-citacao">{editando ? "Editar citação" : "Citar"}</h2>

        <fieldset className="janela-grupo">
          <legend>O que você está citando</legend>
          {FORMAS.map((forma) => (
            <label key={forma.id} className="opcao-escolha">
              <input type="radio" name="o-que-cita" checked={f.oQue === forma.id} onChange={() => mudar({ oQue: forma.id })} />
              <span>
                {forma.nome}
                <span className="dica-form"> — {forma.dica}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {f.oQue === "fala" && (
          <div className="campo-form">
            <label htmlFor="citacao-fala">Quem fala</label>
            <input
              id="citacao-fala"
              autoFocus
              value={f.fala}
              placeholder="Usuária A"
              onChange={(ev) => mudar({ fala: ev.target.value })}
              aria-invalid={!!erroDe("fala")}
            />
            {erroDe("fala") && <span className="erro-form">{erroDe("fala")}</span>}
            <span className="dica-form">Sai assim no texto: (Usuária A). Não vai para a lista de referências.</span>
          </div>
        )}

        {f.oQue === "apud" && (
          <div className="campo-form">
            <label htmlFor="citacao-original">Obra original (a que você não leu)</label>
            <input
              id="citacao-original"
              value={f.original}
              placeholder="Freud, 1915"
              onChange={(ev) => mudar({ original: ev.target.value })}
              aria-invalid={!!erroDe("original")}
            />
            {erroDe("original") && <span className="erro-form">{erroDe("original")}</span>}
            <span className="dica-form">Escreva autor e ano, como no texto. Só a obra que você leu entra na lista de referências.</span>
          </div>
        )}

        {usaObras && (
          <>
            <p className="janela-rotulo">{f.oQue === "apud" ? "Obra que você leu" : linhas.length > 1 ? "Obras citadas" : "Obra citada"}</p>
            {referencias.length === 0 && (
              <p className="dica-form">
                Você ainda não cadastrou nenhuma referência.{" "}
                {aoCadastrar && (
                  <button type="button" className="mini" onClick={aoCadastrar}>
                    Cadastrar uma referência
                  </button>
                )}
              </p>
            )}
            <ul className="janela-obras">
              {linhas.map((o, i) => {
                const ref = porId.get(o.referencia);
                const resumo = ref ? resumoDaReferencia(ref) : null;
                return (
                  <li key={i} className={`janela-obra ${i === ativa ? "ativa" : ""}`} onFocusCapture={() => setAtiva(i)} onClick={() => setAtiva(i)}>
                    <div className="janela-obra-topo">
                      <span className="janela-obra-nome">
                        {resumo ? (
                          <>
                            <b>{resumo.autores}</b> ({resumo.ano}) · {resumo.titulo}
                          </>
                        ) : o.referencia ? (
                          <span className="erro-form">Referência apagada. Escolha a obra de novo.</span>
                        ) : (
                          <span className="dica-form">Escolha a obra na lista abaixo.</span>
                        )}
                      </span>
                      {f.oQue === "obra" && linhas.length > 1 && (
                        <button type="button" className="mini" onClick={() => tirarObra(i)}>
                          Tirar
                        </button>
                      )}
                    </div>
                    {erroDe(`obras.${i}`) && <span className="erro-form">{erroDe(`obras.${i}`)}</span>}
                    <div className="janela-onde">
                      <label className="oculto" htmlFor={`citacao-tipo-${i}`}>
                        Onde na obra
                      </label>
                      <select id={`citacao-tipo-${i}`} value={o.onde} onChange={(ev) => mudarObra(i, { onde: ev.target.value as OndeNaObra })}>
                        <option value="pagina">Página</option>
                        <option value="tempo">Tempo do vídeo ou áudio</option>
                        <option value="outro">Outro (cap., local.…)</option>
                      </select>
                      {o.onde === "outro" && (
                        <>
                          <label className="oculto" htmlFor={`citacao-rotulo-${i}`}>
                            Tipo do localizador
                          </label>
                          <input
                            id={`citacao-rotulo-${i}`}
                            className="curto"
                            value={o.rotulo}
                            placeholder="cap."
                            onChange={(ev) => mudarObra(i, { rotulo: ev.target.value })}
                          />
                        </>
                      )}
                      <label className="oculto" htmlFor={`citacao-pagina-${i}`}>
                        {o.onde === "pagina" ? "Página" : o.onde === "tempo" ? "Tempo" : "Número do localizador"}
                      </label>
                      <input
                        id={`citacao-pagina-${i}`}
                        className="curto"
                        value={o.valor}
                        placeholder={o.onde === "pagina" ? "Página, ex.: 15 ou 4-5" : o.onde === "tempo" ? "Tempo, ex.: 1:56" : "7"}
                        onChange={(ev) => mudarObra(i, { valor: ev.target.value })}
                      />
                    </div>
                    {(erroDe(`obras.${i}.rotulo`) || erroDe(`obras.${i}.valor`)) && (
                      <span className="erro-form">{erroDe(`obras.${i}.rotulo`) ?? erroDe(`obras.${i}.valor`)}</span>
                    )}
                    <div className="janela-marcas">
                      <label className="opcao-escolha">
                        <input type="checkbox" checked={o.grifo} onChange={(ev) => mudarObra(i, { grifo: ev.target.checked })} />
                        <span>Grifo meu (destaquei no trecho)</span>
                      </label>
                      <label className="opcao-escolha">
                        <input type="checkbox" checked={o.traducao} onChange={(ev) => mudarObra(i, { traducao: ev.target.checked })} />
                        <span>Tradução minha</span>
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>

            {f.oQue === "obra" && (
              <button type="button" className="mini" onClick={maisUmaObra}>
                + outra obra
              </button>
            )}

            <label className="oculto" htmlFor="citacao-busca">
              Buscar por autor ou título
            </label>
            <input
              id="citacao-busca"
              ref={campoDeBusca}
              type="search"
              className="busca-de-fontes"
              autoFocus={f.oQue !== "fala"}
              placeholder="Buscar por autor ou título"
              value={busca}
              onChange={(ev) => setBusca(ev.target.value)}
              onKeyDown={(ev) => {
                // Enter escolhe a primeira da lista, em vez de enviar a janela.
                if (ev.key !== "Enter") return;
                ev.preventDefault();
                const primeira = vistas.find((r) => !usadas.has(r.id));
                if (primeira) escolherObra(primeira.id);
              }}
            />
            {referencias.length > 0 &&
              (vistas.length === 0 ? (
                <p className="dica-form">Nenhuma fonte com essa busca.</p>
              ) : (
                <ul className="fontes janela-fontes" aria-label="Fontes cadastradas">
                  {vistas.map((r) => {
                    const resumo = resumoDaReferencia(r);
                    const jaNaCitacao = usadas.has(r.id);
                    return (
                      <li key={r.id} className="fonte">
                        <button
                          type="button"
                          className={`fonte-escolha ${linhas[ativa]?.referencia === r.id ? "quente" : ""}`}
                          disabled={jaNaCitacao}
                          onClick={() => escolherObra(r.id)}
                        >
                          <b>{resumo.autores}</b> ({resumo.ano})
                          <br />
                          {resumo.titulo}
                          {jaNaCitacao && <span className="dica-form"> · já está na citação</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ))}
          </>
        )}

        {f.oQue !== "fala" && (
          <fieldset className="janela-grupo">
            <legend>Tipo de citação</legend>
            <label className="opcao-escolha">
              <input type="radio" name="direta" checked={!f.direta} onChange={() => mudar({ direta: false })} />
              <span>
                Indireta <span className="dica-form">— você conta a ideia com as suas palavras</span>
              </span>
            </label>
            <label className="opcao-escolha">
              <input type="radio" name="direta" checked={f.direta} onChange={() => mudar({ direta: true })} />
              <span>
                Direta <span className="dica-form">— você copia o trecho; a norma pede a página</span>
              </span>
            </label>
            {f.oQue === "obra" && (
              <label className="opcao-escolha">
                <input
                  type="checkbox"
                  checked={f.autorNoTexto && linhas.length === 1}
                  disabled={linhas.length > 1}
                  onChange={(ev) => mudar({ autorNoTexto: ev.target.checked })}
                />
                <span>
                  Autor no texto <span className="dica-form">— o nome entra na frase: Silva (2019). {linhas.length > 1 ? "Só com uma obra." : ""}</span>
                </span>
              </label>
            )}
          </fieldset>
        )}

        <div className="janela-previa" aria-live="polite">
          <span className="janela-rotulo">Na norma</span>
          {resultado ? (
            <>
              <span className="janela-texto">
                {resultado.pedacos.map((p, i) => (p.italico ? <i key={i}>{p.texto}</i> : <span key={i}>{p.texto}</span>))}
              </span>
              {resultado.avisos.map((a, i) => (
                <span key={i} className="aviso-form">
                  Atenção: {a.mensagem}
                </span>
              ))}
            </>
          ) : (
            <span className="dica-form">
              {f.oQue === "fala" ? "Escreva quem fala para ver como fica." : "Escolha a obra para ver como fica na norma."}
            </span>
          )}
        </div>

        {erros.some((e) => e.campo === "") && <p className="erro-form">{erros.find((e) => e.campo === "")?.mensagem}</p>}

        <div className="acoes-form janela-acoes">
          {editando && (
            <button type="button" className="btn perigo" onClick={aoRemover}>
              Remover citação
            </button>
          )}
          <span style={{ flex: 1 }} />
          {estado.origem === "arroba" && (
            <button type="button" className="btn" onClick={aoEscreverArroba} title="Escreve o sinal @ no texto, sem citar">
              Escrever só o @
            </button>
          )}
          <button type="button" className="btn" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="btn primario">
            {editando ? "Salvar citação" : "Inserir citação"}
          </button>
        </div>
      </form>
    </div>
  );
}
