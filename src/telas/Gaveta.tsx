import { useEffect, useMemo, useState } from "react";
import type { Bloco, Referencia } from "../documento/modelo";
import { avisoDeApagar, buscarReferencias, contarCitacoes, ordenarParaGaveta, resumoDaReferencia } from "../referencias/lista";
import { comInicialMaiuscula, type EscolhaDoAutor } from "../referencias/escolhas";
import FormularioDeReferencia from "./FormularioDeReferencia";

interface Props {
  referencias: Referencia[];
  /** As regras de escolha da norma atual, com o que vale hoje. */
  escolhas: EscolhaDoAutor[];
  nomeDaNorma: string;
  /** Lê o texto de agora, para contar quantas vezes cada fonte é citada. */
  lerBlocos: () => Bloco[];
  /** Avisa quando o texto muda (a contagem espera uma pausa). */
  mudancas: EventTarget;
  /** Fonte nova, ou a editada (o código é o mesmo). */
  aoSalvar: (r: Referencia) => void;
  aoApagar: (id: string) => void;
  aoEscolher: (e: EscolhaDoAutor, valor: string) => void;
  aoFechar: () => void;
}

/** A gaveta lateral "Referências": as fontes do trabalho e as escolhas do autor. */
export default function Gaveta({ referencias, escolhas, nomeDaNorma, lerBlocos, mudancas, aoSalvar, aoApagar, aoEscolher, aoFechar }: Props) {
  const [busca, setBusca] = useState("");
  const [formulario, setFormulario] = useState<{ base?: Referencia } | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [citacoes, setCitacoes] = useState(() => contarCitacoes(lerBlocos()));

  // A contagem de citações acompanha o texto, depois de uma pausa.
  useEffect(() => {
    let relogio: ReturnType<typeof setTimeout> | undefined;
    const atualizar = () => {
      clearTimeout(relogio);
      relogio = setTimeout(() => setCitacoes(contarCitacoes(lerBlocos())), 400);
    };
    mudancas.addEventListener("mudou", atualizar);
    return () => {
      clearTimeout(relogio);
      mudancas.removeEventListener("mudou", atualizar);
    };
  }, [lerBlocos, mudancas]);

  const vistas = useMemo(() => ordenarParaGaveta(buscarReferencias(referencias, busca)), [referencias, busca]);

  return (
    <aside className="gaveta" aria-label="Referências do trabalho">
      <div className="gaveta-topo">
        <span className="gaveta-titulo">Referências</span>
        <span className="dica-form">{referencias.length === 1 ? "1 fonte" : `${referencias.length} fontes`}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" style={{ minHeight: 32 }} onClick={aoFechar}>
          Fechar
        </button>
      </div>

      {formulario ? (
        <FormularioDeReferencia
          base={formulario.base}
          existentes={referencias.map((r) => r.id)}
          aoSalvar={(r) => {
            aoSalvar(r);
            setFormulario(null);
          }}
          aoCancelar={() => setFormulario(null)}
        />
      ) : (
        <>
          <div className="gaveta-secao-topo">
            <span className="gaveta-rotulo">Fontes cadastradas</span>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn" style={{ minHeight: 32 }} onClick={() => setFormulario({})}>
              Adicionar à mão
            </button>
          </div>

          <label className="oculto" htmlFor="busca-de-fontes">
            Buscar por autor ou título
          </label>
          <input
            id="busca-de-fontes"
            type="search"
            className="busca-de-fontes"
            placeholder="Buscar por autor ou título"
            value={busca}
            onChange={(ev) => setBusca(ev.target.value)}
          />

          {referencias.length === 0 ? (
            <p className="dica-form">Nenhuma fonte ainda. Use “Adicionar à mão” para cadastrar a primeira. Você cadastra cada fonte uma vez, e ela serve nas duas normas.</p>
          ) : vistas.length === 0 ? (
            <p className="dica-form">Nenhuma fonte com essa busca.</p>
          ) : (
            <ul className="fontes">
              {vistas.map((r) => {
                const resumo = resumoDaReferencia(r);
                const vezes = citacoes.get(r.id) ?? 0;
                return (
                  <li key={r.id} className="fonte">
                    <div className="fonte-linha">
                      <span className="fonte-texto">
                        <b>{resumo.autores}</b> ({resumo.ano})
                        <br />
                        {resumo.titulo}
                        <br />
                        <span className="dica-form">
                          {resumo.tipo} · {vezes === 0 ? "ainda não citada" : vezes === 1 ? "citada 1 vez" : `citada ${vezes} vezes`}
                        </span>
                      </span>
                      <button type="button" className="mini" onClick={() => setFormulario({ base: r })}>
                        Editar
                      </button>
                      <button type="button" className="mini" onClick={() => setApagando(apagando === r.id ? null : r.id)}>
                        Apagar
                      </button>
                    </div>
                    {apagando === r.id && (
                      <div className="confirmar-apagar" role="alertdialog" aria-label="Confirmar que vai apagar a fonte">
                        <p>{avisoDeApagar(vezes) ?? "Apagar esta fonte? Isso não pode ser desfeito."}</p>
                        <div className="acoes-form">
                          <button type="button" className="btn" onClick={() => setApagando(null)}>
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="btn perigo"
                            onClick={() => {
                              setApagando(null);
                              aoApagar(r.id);
                            }}
                          >
                            Apagar a fonte
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {escolhas.length > 0 && (
            <section className="escolhas" aria-label="Escolhas do autor">
              <p className="gaveta-rotulo">Escolhas do autor</p>
              <p className="dica-form">
                A {nomeDaNorma} aceita mais de uma forma nestes pontos. A escolha vale só para este trabalho, e a prévia e as citações mudam na hora.
              </p>
              {escolhas.map((e) => (
                <fieldset key={e.chave} className="escolha">
                  <legend>{e.nome}</legend>
                  {e.explicacao && <p className="dica-form">{e.explicacao}</p>}
                  {e.opcoes.map((o) => (
                    <label key={o} className="opcao-escolha">
                      <input type="radio" name={`escolha-${e.chave}`} checked={e.atual === o} onChange={() => aoEscolher(e, o)} />
                      <span>
                        {comInicialMaiuscula(o)}
                        {o === e.padrao && <span className="dica-form"> (padrão da norma)</span>}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </section>
          )}

          <p className="dica-form rodape-gaveta">A lista muda de forma sozinha quando você troca de norma. A forma exata de cada referência aparece na prévia e no PDF.</p>
        </>
      )}
    </aside>
  );
}
