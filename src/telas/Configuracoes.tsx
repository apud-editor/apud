import { useEffect, useRef, useState } from "react";
import type { Abertura, DadosDoTrabalho, TipoDeTrabalho } from "../documento/modelo";
import { prenderTab } from "../editor/foco";
import type { Escrita, LinhaDaJanelinha } from "../editor/janelinha";
import type { EscolhaDoAutor } from "../referencias/escolhas";
import type { ModeloResolvido } from "../modelos/tipos";
import CamposDosDados from "./CamposDosDados";
import EscolhasDoAutor from "./EscolhasDoAutor";
import { TIPOS } from "./trabalho";

export const ABAS = [
  { id: "trabalho", nome: "Trabalho" },
  { id: "dados", nome: "Dados" },
  { id: "escolhas", nome: "Escolhas do autor" },
] as const;
export type AbaDasConfiguracoes = (typeof ABAS)[number]["id"];

interface Props {
  aba: AbaDasConfiguracoes;
  aoTrocarAba: (a: AbaDasConfiguracoes) => void;
  dados: DadosDoTrabalho;
  abertura: Abertura;
  /** O nome da norma do trabalho. */
  nomeDaNorma: string;
  modelo: ModeloResolvido;
  normas: string[];
  escolhas: EscolhaDoAutor[];
  aoMudarDados: (d: DadosDoTrabalho) => void;
  aoMudarAbertura: (fazer: (a: Abertura) => Abertura) => void;
  aoTrocarNorma: (nome: string) => void;
  aoEscolher: (e: EscolhaDoAutor, valor: string) => void;
  /** As linhas "Fonte do trabalho" e "Tamanho da letra", lidas do modelo com as escolhas de agora (as mesmas do ⚙ do parágrafo). */
  lerLinhasDaFonte: () => LinhaDaJanelinha[];
  /** Muda a fonte ou o tamanho do trabalho todo ("todos os iguais" no elemento Texto). */
  aoMudarFonte: (escrita: Escrita) => { ok: true; avisos: string[] } | { ok: false; erro: string };
  aoFechar: () => void;
}

/**
 * As Configurações do trabalho: tipo, norma, versão sem identificação, dados e
 * escolhas do autor. Os elementos antes do texto (capa, resumos...) ficam na
 * Abertura, no alto do texto (etapa 3, parte 3a).
 */
export default function Configuracoes(p: Props) {
  const janela = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const aoApertar = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        p.aoFechar();
      }
      if (ev.key === "Tab" && !ev.altKey && !ev.ctrlKey && !ev.metaKey && janela.current && prenderTab(janela.current, ev.shiftKey)) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    };
    document.addEventListener("keydown", aoApertar, true);
    return () => document.removeEventListener("keydown", aoApertar, true);
  }, [p.aoFechar]);

  const moverAba = (ev: React.KeyboardEvent, i: number) => {
    const delta = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    ev.preventDefault();
    const novo = ABAS[(i + delta + ABAS.length) % ABAS.length];
    p.aoTrocarAba(novo.id);
    requestAnimationFrame(() => document.getElementById(`aba-${novo.id}`)?.focus());
  };

  return (
    <div className="janela-fundo">
      <div ref={janela} className="janela-citacao janela-configuracoes" role="dialog" aria-modal="true" aria-labelledby="titulo-das-configuracoes">
        <div className="gaveta-topo">
          <h2 id="titulo-das-configuracoes">Configurações do trabalho</h2>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={p.aoFechar}>
            Fechar
          </button>
        </div>
        <div className="abas" role="tablist" aria-label="Configurações">
          {ABAS.map((a, i) => (
            <button
              key={a.id}
              id={`aba-${a.id}`}
              type="button"
              role="tab"
              aria-selected={p.aba === a.id}
              aria-controls={`painel-${a.id}`}
              tabIndex={p.aba === a.id ? 0 : -1}
              className={`aba ${p.aba === a.id ? "on" : ""}`}
              onClick={() => p.aoTrocarAba(a.id)}
              onKeyDown={(ev) => moverAba(ev, i)}
            >
              {a.nome}
            </button>
          ))}
        </div>

        <div id={`painel-${p.aba}`} role="tabpanel" aria-labelledby={`aba-${p.aba}`} className="painel-da-aba">
          {p.aba === "trabalho" && (
            <>
              <fieldset className="grupo-form">
                <legend>Tipo de trabalho</legend>
                {TIPOS.map((t) => (
                  <label key={t.tipo} className="opcao-escolha">
                    <input
                      type="radio"
                      name="config-tipo"
                      checked={p.dados.tipo === t.tipo}
                      onChange={() => p.aoMudarDados({ ...p.dados, tipo: t.tipo as TipoDeTrabalho })}
                    />
                    <span>
                      {t.nome}
                      <span className="dica-form"> — {t.explicacao}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <fieldset className="grupo-form">
                <legend>Norma</legend>
                <div className="seletor-norma" role="group" aria-label="Norma do trabalho">
                  {p.normas.map((n) => (
                    <button key={n} type="button" className={`seg ${n === p.nomeDaNorma ? "on" : ""}`} aria-pressed={n === p.nomeDaNorma} onClick={() => p.aoTrocarNorma(n)}>
                      {n}
                    </button>
                  ))}
                </div>
                <p className="dica-form">Trocar de norma não apaga nada: o texto, os dados e as referências continuam, e o PDF muda de forma.</p>
              </fieldset>
              <FonteDoTrabalho lerLinhas={p.lerLinhasDaFonte} aoMudar={p.aoMudarFonte} nomeDaNorma={p.nomeDaNorma} />
              <fieldset className="grupo-form">
                <legend>Avaliação cega</legend>
                <label className="marcar-form">
                  <input
                    type="checkbox"
                    checked={p.abertura.semIdentificacao}
                    onChange={(e) => p.aoMudarAbertura((a) => ({ ...a, semIdentificacao: e.target.checked }))}
                  />
                  <span>Versão sem identificação</span>
                </label>
                <p className="dica-form">Os nomes dos autores e do orientador ficam guardados, mas não saem no PDF.</p>
              </fieldset>
              <p className="dica-form">Idioma do trabalho: português do Brasil.</p>
            </>
          )}

          {p.aba === "dados" && <CamposDosDados dados={p.dados} aoMudar={p.aoMudarDados} nomeDaNorma={p.nomeDaNorma} />}

          {p.aba === "escolhas" && <EscolhasDoAutor escolhas={p.escolhas} nomeDaNorma={p.nomeDaNorma} aoEscolher={p.aoEscolher} />}
        </div>
      </div>
    </div>
  );
}

/**
 * Fonte e tamanho do trabalho (etapa 3b): os mesmos botões do ⚙ do parágrafo.
 * Quando a escolha sai do que a norma pede, o Apud aceita e avisa.
 */
export function FonteDoTrabalho(p: {
  lerLinhas: () => LinhaDaJanelinha[];
  aoMudar: (escrita: Escrita) => { ok: true; avisos: string[] } | { ok: false; erro: string };
  nomeDaNorma: string;
}) {
  // Depois de mudar, as linhas são lidas de novo (o modelo com a escolha nova).
  const [, setVez] = useState(0);
  const [mensagens, setMensagens] = useState<{ avisos: string[]; erro: string | null }>({ avisos: [], erro: null });
  const escolher = (escrita: Escrita) => {
    const r = p.aoMudar(escrita);
    setMensagens(r.ok ? { avisos: r.avisos, erro: null } : { avisos: [], erro: r.erro });
    setVez((v) => v + 1);
  };
  return (
    <fieldset className="grupo-form">
      <legend>Fonte e tamanho</legend>
      {p.lerLinhas().map((l) => (
        <div key={l.rotulo} className="linha-da-fonte">
          <span className="rotulo-da-fonte">{l.rotulo === "Fonte do trabalho" ? "Fonte" : "Tamanho"}</span>
          <div className="seletor-norma" role="group" aria-label={l.rotulo}>
            {l.opcoes.map((o) => (
              <button key={o.rotulo} type="button" className={`seg ${o.ativa ? "on" : ""}`} aria-pressed={o.ativa} onClick={() => escolher(o.escrita)}>
                {o.rotulo}
              </button>
            ))}
          </div>
        </div>
      ))}
      {mensagens.erro && (
        <p className="aviso-form" role="alert">
          {mensagens.erro}
        </p>
      )}
      {mensagens.avisos.map((a) => (
        <p key={a} className="aviso-form" role="status">
          {a}
        </p>
      ))}
      <p className="dica-form">Vale para todo o texto. As citações longas, as notas e as legendas continuam menores, como a {p.nomeDaNorma} pede. Também dá para mudar no ⚙ de qualquer parágrafo.</p>
    </fieldset>
  );
}
