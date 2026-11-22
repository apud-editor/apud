import { useEffect, useRef } from "react";
import type { Abertura, DadosDoTrabalho, TipoDeTrabalho } from "../documento/modelo";
import { prenderTab } from "../editor/foco";
import type { EscolhaDoAutor } from "../referencias/escolhas";
import type { PerfilResolvido } from "../perfis/tipos";
import CamposDosDados from "./CamposDosDados";
import EscolhasDoAutor from "./EscolhasDoAutor";
import { TIPOS, elementosDaNorma } from "./trabalho";

export const ABAS = [
  { id: "trabalho", nome: "Trabalho" },
  { id: "dados", nome: "Dados" },
  { id: "elementos", nome: "Elementos" },
  { id: "escolhas", nome: "Escolhas do autor" },
] as const;
export type AbaDasConfiguracoes = (typeof ABAS)[number]["id"];

interface Props {
  aba: AbaDasConfiguracoes;
  aoTrocarAba: (a: AbaDasConfiguracoes) => void;
  dados: DadosDoTrabalho;
  abertura: Abertura;
  /** A norma do trabalho (o padrão dela, para saber que elementos ela tem). */
  nomeDaNorma: string;
  perfil: PerfilResolvido;
  normas: string[];
  escolhas: EscolhaDoAutor[];
  aoMudarDados: (d: DadosDoTrabalho) => void;
  aoMudarAbertura: (fazer: (a: Abertura) => Abertura) => void;
  aoTrocarNorma: (nome: string) => void;
  aoEscolher: (e: EscolhaDoAutor, valor: string) => void;
  aoFechar: () => void;
}

/** As Configurações do trabalho: tipo, norma, dados, elementos antes do texto e escolhas do autor. */
export default function Configuracoes(p: Props) {
  const janela = useRef<HTMLDivElement>(null);
  const noElementos = elementosDaNorma(p.perfil);

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

  const ligar = (chave: "capa" | "folhaDeRosto" | "paginaDeTitulo" | "sumario" | "semIdentificacao", rotulo: string, ajuda: string, elemento?: keyof typeof noElementos) => {
    const naNorma = elemento ? noElementos[elemento] : true;
    return (
      <div className="opcao-elemento">
        <label className="marcar-form">
          <input type="checkbox" checked={p.abertura[chave]} onChange={(e) => p.aoMudarAbertura((a) => ({ ...a, [chave]: e.target.checked }))} />
          <span>{rotulo}</span>
        </label>
        <p className="dica-form">{naNorma ? ajuda : `A ${p.nomeDaNorma} não tem este elemento: o que você ligar fica guardado, mas não sai no PDF.`}</p>
      </div>
    );
  };

  const textoLigado = (chave: "dedicatoria" | "agradecimentos" | "epigrafe", rotulo: string) => (
    <div className="opcao-elemento">
      <label className="marcar-form">
        <input
          type="checkbox"
          checked={p.abertura[chave].incluir}
          onChange={(e) => p.aoMudarAbertura((a) => ({ ...a, [chave]: { ...a[chave], incluir: e.target.checked } }))}
        />
        <span>{rotulo}</span>
      </label>
      <p className="dica-form">
        {noElementos[chave]
          ? "Você escreve o texto na Abertura do trabalho, no topo do editor."
          : `A ${p.nomeDaNorma} não tem este elemento: o que você escrever fica guardado, mas não sai no PDF.`}
      </p>
    </div>
  );

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
              <p className="dica-form">Idioma do trabalho: português do Brasil.</p>
            </>
          )}

          {p.aba === "dados" && <CamposDosDados dados={p.dados} aoMudar={p.aoMudarDados} nomeDaNorma={p.nomeDaNorma} />}

          {p.aba === "elementos" && (
            <>
              <p className="dica-form">Os elementos antes do texto. O Apud põe cada um na ordem da {p.nomeDaNorma}, cada um na sua folha.</p>
              {ligar("capa", "Capa", "Instituição, curso, autores, título, cidade e ano.", "capa")}
              {ligar("folhaDeRosto", "Folha de rosto", "Autores, título, natureza do trabalho, orientador, cidade e ano.", "folhaDeRosto")}
              {ligar("paginaDeTitulo", "Página de título", "Título, autores, curso, instituição, disciplina, professor e data.", "paginaDeTitulo")}
              {textoLigado("dedicatoria", "Dedicatória")}
              {textoLigado("agradecimentos", "Agradecimentos")}
              {textoLigado("epigrafe", "Epígrafe")}
              {ligar("sumario", "Sumário", "Montado com os títulos que você numerou. O Apud não numera nada sozinho.", "sumario")}
              <p className="dica-form">Os resumos você adiciona na Abertura do trabalho, no topo do editor: um por idioma.</p>
              {ligar("semIdentificacao", "Versão sem identificação", "Para avaliação cega: os nomes dos autores e do orientador ficam guardados, mas não saem no PDF.")}
            </>
          )}

          {p.aba === "escolhas" && <EscolhasDoAutor escolhas={p.escolhas} nomeDaNorma={p.nomeDaNorma} aoEscolher={p.aoEscolher} />}
        </div>
      </div>
    </div>
  );
}
