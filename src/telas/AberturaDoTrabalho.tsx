import { useState } from "react";
import type { Abertura, DadosDoTrabalho, ElementoDeTexto, Resumo } from "../documento/modelo";
import CampoDeParagrafos from "../editor/CampoDeParagrafos";
import type { PerfilResolvido } from "../perfis/tipos";
import type { AbaDasConfiguracoes } from "./Configuracoes";
import { IDIOMAS_DO_RESUMO, elementosDaNorma, idiomaDoProximoResumo, nomeDoIdioma, palavrasChaveDoTexto, palavrasChaveParaTexto } from "./trabalho";

interface Props {
  abertura: Abertura;
  dados: DadosDoTrabalho;
  nomeDaNorma: string;
  perfil: PerfilResolvido;
  /**
   * Muda a abertura. Com `redesenhar`, a área se desenha de novo (ligar, desligar,
   * trocar o idioma); escrever num campo não precisa, porque o campo já mostra o que foi escrito.
   */
  aoMudar: (fazer: (a: Abertura) => Abertura, redesenhar: boolean) => void;
  aoConfigurar: (aba: AbaDasConfiguracoes) => void;
}

type Cartao = "capa" | "folhaDeRosto" | "paginaDeTitulo" | "sumario";
type Texto = "dedicatoria" | "agradecimentos" | "epigrafe";

const NOMES: Record<Cartao | Texto, string> = {
  capa: "Capa",
  folhaDeRosto: "Folha de rosto",
  paginaDeTitulo: "Página de título",
  sumario: "Sumário",
  dedicatoria: "Dedicatória",
  agradecimentos: "Agradecimentos",
  epigrafe: "Epígrafe",
};

const temTexto = (e: ElementoDeTexto) => e.paragrafos.some((p) => p.some((t) => t.texto.trim()));

/** A "Abertura do trabalho": o que vem antes do texto, no topo do editor. */
export default function AberturaDoTrabalho({ abertura, dados, nomeDaNorma, perfil, aoMudar, aoConfigurar }: Props) {
  const naNorma = elementosDaNorma(perfil);
  const algoLigado =
    abertura.capa ||
    abertura.folhaDeRosto ||
    abertura.paginaDeTitulo ||
    abertura.sumario ||
    abertura.dedicatoria.incluir ||
    abertura.agradecimentos.incluir ||
    abertura.epigrafe.incluir ||
    abertura.resumos.length > 0;
  const [aberta, setAberta] = useState(algoLigado);
  const [removendo, setRemovendo] = useState<number | null>(null);

  const cartoes = (["capa", "folhaDeRosto", "paginaDeTitulo", "sumario"] as Cartao[]).filter((c) => naNorma[c] || abertura[c]);
  const textos = (["dedicatoria", "agradecimentos", "epigrafe"] as Texto[]).filter((t) => naNorma[t] || abertura[t].incluir || temTexto(abertura[t]));

  const situacao = (c: Cartao): string => {
    if (!abertura[c]) return "Desligado";
    if (!naNorma[c]) return `A ${nomeDaNorma} não tem: não sai no PDF`;
    if (c !== "sumario" && !dados.titulo.trim()) return "Falta o título: preencha os dados";
    if (c === "sumario") return "Montado com os títulos numerados";
    return "Entra no PDF";
  };

  const mudarResumo = (i: number, p: Partial<Resumo>, redesenhar = false) =>
    aoMudar((a) => ({ ...a, resumos: a.resumos.map((r, j) => (j === i ? { ...r, ...p } : r)) }), redesenhar);

  const textoDeElemento = (chave: Texto) => {
    const e = abertura[chave];
    return (
      <section key={chave} className="elemento-de-texto" aria-label={NOMES[chave]}>
        <div className="elemento-topo">
          <label className="marcar-form">
            <input
              type="checkbox"
              checked={e.incluir}
              onChange={(ev) => aoMudar((a) => ({ ...a, [chave]: { ...a[chave], incluir: ev.target.checked } }), true)}
            />
            <span>{NOMES[chave]}</span>
          </label>
          {!naNorma[chave] && <span className="dica-form">A {nomeDaNorma} não tem: fica guardado, não sai no PDF.</span>}
          {!e.incluir && temTexto(e) && <span className="dica-form">Desligado; o texto está guardado.</span>}
        </div>
        {e.incluir && (
          <>
            {chave === "epigrafe" && (
              <label className="campo-form" htmlFor="autoria-da-epigrafe">
                Quem escreveu a frase
                <input
                  id="autoria-da-epigrafe"
                  defaultValue={abertura.epigrafe.autoria}
                  autoComplete="off"
                  onChange={(ev) => aoMudar((a) => ({ ...a, epigrafe: { ...a.epigrafe, autoria: ev.target.value } }), false)}
                />
              </label>
            )}
            <CampoDeParagrafos
              id={`texto-${chave}`}
              rotulo={NOMES[chave]}
              inicial={e.paragrafos}
              aoMudar={(paragrafos) => aoMudar((a) => ({ ...a, [chave]: { ...a[chave], paragrafos } }), false)}
            />
          </>
        )}
      </section>
    );
  };

  return (
    <section className="abertura" aria-label="Abertura do trabalho">
      <button type="button" className="abertura-titulo" aria-expanded={aberta} onClick={() => setAberta(!aberta)}>
        <span aria-hidden="true">{aberta ? "▾" : "▸"}</span> Abertura do trabalho
        <span className="dica-form">{algoLigado ? "" : " — nada ligado ainda"}</span>
      </button>
      {aberta && (
        <div className="abertura-corpo">
          <p className="dica-form">O que vem antes do texto. Cada elemento sai na própria folha, na ordem da {nomeDaNorma}, e o texto começa na folha seguinte.</p>

          {cartoes.length > 0 && (
            <div className="cartoes-abertura">
              {cartoes.map((c) => (
                <div key={c} className={`cartao-abertura ${abertura[c] ? "ligado" : ""}`}>
                  <label className="marcar-form">
                    <input type="checkbox" checked={abertura[c]} onChange={(ev) => aoMudar((a) => ({ ...a, [c]: ev.target.checked }), true)} />
                    <span>
                      <b>{NOMES[c]}</b>
                    </span>
                  </label>
                  <span className="dica-form">{situacao(c)}</span>
                  <button type="button" className="mini" onClick={() => aoConfigurar(c === "sumario" ? "elementos" : "dados")}>
                    {c === "sumario" ? "Configurar" : "Editar dados"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {textos.map(textoDeElemento)}

          <div className="elemento-de-texto">
            <div className="elemento-topo">
              <b>Resumos</b>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  aoMudar((a) => ({ ...a, resumos: [...a.resumos, { idioma: idiomaDoProximoResumo(a.resumos.map((r) => r.idioma)), trechos: [], palavrasChave: [] }] }), true);
                }}
              >
                {abertura.resumos.length ? "Adicionar resumo em outro idioma" : "Adicionar resumo"}
              </button>
            </div>
            {abertura.resumos.length === 0 && <p className="dica-form">Nenhum resumo. Revistas costumam pedir o resumo em mais de um idioma.</p>}
            {abertura.resumos.map((r, i) => (
              <article key={`${i}-${r.idioma}`} className="resumo-da-abertura" aria-label={`Resumo em ${nomeDoIdioma(r.idioma)}`}>
                <div className="elemento-topo">
                  <label className="campo-form" htmlFor={`idioma-resumo-${i}`}>
                    Idioma do resumo
                    <select id={`idioma-resumo-${i}`} value={r.idioma} onChange={(ev) => mudarResumo(i, { idioma: ev.target.value }, true)}>
                      {IDIOMAS_DO_RESUMO.map((l) => (
                        <option key={l.codigo} value={l.codigo}>
                          {l.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="mini" onClick={() => setRemovendo(removendo === i ? null : i)}>
                    Remover
                  </button>
                </div>
                {removendo === i && (
                  <div className="confirmar-apagar" role="alertdialog" aria-label="Confirmar que vai remover o resumo">
                    <p>Remover este resumo? O texto dele será apagado.</p>
                    <div className="acoes-form">
                      <button type="button" className="btn" onClick={() => setRemovendo(null)}>
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn perigo"
                        onClick={() => {
                          setRemovendo(null);
                          aoMudar((a) => ({ ...a, resumos: a.resumos.filter((_, j) => j !== i) }), true);
                        }}
                      >
                        Remover o resumo
                      </button>
                    </div>
                  </div>
                )}
                <label className="campo-form" htmlFor={`titulo-resumo-${i}`}>
                  Título do trabalho neste idioma (se a revista pedir)
                  <input id={`titulo-resumo-${i}`} defaultValue={r.titulo ?? ""} autoComplete="off" onChange={(ev) => mudarResumo(i, { titulo: ev.target.value || undefined })} />
                </label>
                <CampoDeParagrafos
                  id={`texto-resumo-${i}`}
                  rotulo={`Resumo em ${nomeDoIdioma(r.idioma)}`}
                  unico
                  inicial={r.trechos.length ? [r.trechos] : []}
                  aoMudar={(paragrafos) => mudarResumo(i, { trechos: paragrafos[0] ?? [] })}
                  dica="O resumo é um parágrafo só."
                />
                <label className="campo-form" htmlFor={`palavras-resumo-${i}`}>
                  Palavras-chave
                  <input
                    id={`palavras-resumo-${i}`}
                    defaultValue={palavrasChaveParaTexto(r.palavrasChave)}
                    autoComplete="off"
                    onChange={(ev) => mudarResumo(i, { palavrasChave: palavrasChaveDoTexto(ev.target.value) })}
                  />
                  <span className="dica-form">Separe por ponto e vírgula.</span>
                </label>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
