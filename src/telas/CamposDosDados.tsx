import { useId, useState } from "react";
import type { DadosDoTrabalho } from "../documento/modelo";
import { naturezaDoTrabalho } from "../conversor/abertura";
import { dataDoCampo, dataParaCampo, lerAno } from "./trabalho";

interface Props {
  dados: DadosDoTrabalho;
  aoMudar: (d: DadosDoTrabalho) => void;
  nomeDaNorma: string;
  /** No assistente só aparecem os dados que mais importam; nas Configurações, todos. */
  completo?: boolean;
  /** Mostra o erro de cada campo (o assistente só mostra depois de a pessoa tentar seguir). */
  erros?: { titulo?: string; autores?: string; ano?: string };
}

/** Os campos dos dados do trabalho: o assistente (passo 2) e as Configurações usam os mesmos. */
export default function CamposDosDados({ dados, aoMudar, nomeDaNorma, completo = true, erros = {} }: Props) {
  const base = useId();
  const id = (n: string) => `${base}-${n}`;
  const [textoDoAno, setTextoDoAno] = useState(dados.ano?.toString() ?? "");
  const mudar = (p: Partial<DadosDoTrabalho>) => aoMudar({ ...dados, ...p });
  const autores = dados.autores.length ? dados.autores : [""];
  const noApa = nomeDaNorma === "APA";
  const anoErrado = Number.isNaN(lerAno(textoDoAno)) ? "Escreva o ano com números, como 2026." : erros.ano;

  const campo = (chave: "subtitulo" | "curso" | "instituicao" | "orientador" | "cidade" | "disciplina", rotulo: string, dica?: string, inteiro = false) => (
    <label className={`campo-form ${inteiro ? "inteiro" : ""}`} htmlFor={id(chave)}>
      {rotulo}
      <input id={id(chave)} value={dados[chave] ?? ""} onChange={(e) => mudar({ [chave]: e.target.value })} autoComplete="off" />
      {dica && <span className="dica-form">{dica}</span>}
    </label>
  );

  return (
    <div className="dados-do-trabalho">
      <div className="grade-form">
        <label className="campo-form inteiro" htmlFor={id("titulo")}>
          Título do trabalho
          <input
            id={id("titulo")}
            value={dados.titulo}
            onChange={(e) => mudar({ titulo: e.target.value })}
            autoComplete="off"
            aria-invalid={erros.titulo ? true : undefined}
            aria-describedby={erros.titulo ? id("erro-titulo") : undefined}
          />
          {erros.titulo && (
            <span className="erro-campo" id={id("erro-titulo")} role="alert">
              {erros.titulo}
            </span>
          )}
        </label>
        {campo("subtitulo", "Subtítulo (se tiver)", "Sai depois do título, separado por dois-pontos.", true)}
      </div>

      <fieldset className="grupo-form" aria-describedby={erros.autores ? id("erro-autores") : undefined}>
        <legend>Autores</legend>
        {autores.map((a, i) => (
          <div key={i} className="linha-autor-simples">
            <input
              aria-label={`Nome completo do autor ${i + 1}`}
              placeholder="Nome completo"
              value={a}
              autoComplete="off"
              onChange={(e) => mudar({ autores: autores.map((x, j) => (j === i ? e.target.value : x)) })}
            />
            <button
              type="button"
              className="mini"
              aria-label={`Subir o autor ${i + 1}`}
              disabled={i === 0}
              onClick={() => {
                const novos = [...autores];
                [novos[i - 1], novos[i]] = [novos[i], novos[i - 1]];
                mudar({ autores: novos });
              }}
            >
              ↑
            </button>
            <button
              type="button"
              className="mini"
              aria-label={`Descer o autor ${i + 1}`}
              disabled={i === autores.length - 1}
              onClick={() => {
                const novos = [...autores];
                [novos[i + 1], novos[i]] = [novos[i], novos[i + 1]];
                mudar({ autores: novos });
              }}
            >
              ↓
            </button>
            <button
              type="button"
              className="mini"
              aria-label={`Tirar o autor ${i + 1}`}
              disabled={autores.length === 1 && !a}
              onClick={() => mudar({ autores: autores.filter((_, j) => j !== i) })}
            >
              Tirar
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="btn" onClick={() => mudar({ autores: [...autores, ""] })}>
            Adicionar autor
          </button>
        </div>
        <p className="dica-form">Escreva o nome completo, na ordem em que deve sair.</p>
        {erros.autores && (
          <span className="erro-campo" id={id("erro-autores")} role="alert">
            {erros.autores}
          </span>
        )}
      </fieldset>

      <div className="grade-form">
        <label className="campo-form" htmlFor={id("ano")}>
          Ano
          <input
            id={id("ano")}
            inputMode="numeric"
            value={textoDoAno}
            maxLength={4}
            placeholder="2026"
            aria-invalid={anoErrado ? true : undefined}
            onChange={(e) => {
              setTextoDoAno(e.target.value);
              mudar({ ano: lerAno(e.target.value) });
            }}
          />
          {anoErrado && (
            <span className="erro-campo" role="alert">
              {anoErrado}
            </span>
          )}
        </label>
        {campo("cidade", "Cidade")}
        {campo("curso", "Curso")}
        {campo("instituicao", "Instituição")}
        {completo && (
          <>
            {campo("orientador", noApa ? "Professor (ou orientador)" : "Orientador ou professor", noApa ? "Na APA, aparece como “Professor”." : "Aparece como Orientador ou Professor, conforme o tipo.")}
            {campo("disciplina", "Disciplina")}
            <label className="campo-form" htmlFor={id("entrega")}>
              Data de entrega
              <input
                id={id("entrega")}
                type="date"
                value={dataParaCampo(dados.dataDeEntrega)}
                onChange={(e) => mudar({ dataDeEntrega: dataDoCampo(e.target.value) })}
              />
              <span className="dica-form">Sai na página de título da APA.</span>
            </label>
          </>
        )}
      </div>

      {completo && (
        <label className="campo-form inteiro" htmlFor={id("natureza")}>
          Natureza do trabalho (folha de rosto)
          <textarea
            id={id("natureza")}
            rows={3}
            value={dados.natureza ?? ""}
            placeholder={naturezaDoTrabalho({ ...dados, natureza: undefined }) || "Preencha o curso, a instituição ou a disciplina, e o Apud monta a frase."}
            onChange={(e) => mudar({ natureza: e.target.value })}
          />
          <span className="dica-form">Deixe em branco: o Apud monta a frase com o tipo, a disciplina, o curso e a instituição. Se você escrever a sua, vale a sua.</span>
        </label>
      )}
    </div>
  );
}
