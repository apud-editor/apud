import { useId, useState } from "react";
import type { Referencia, TipoDeReferencia } from "../documento/modelo";
import {
  camposDoTipo,
  DESCRICAO_DOS_TIPOS,
  formularioParaReferencia,
  formularioVazio,
  instituicaoVazia,
  NOME_DO_TIPO_NA_TELA,
  pessoaVazia,
  referenciaParaFormulario,
  TIPOS_NO_FORMULARIO,
  type AutorNoFormulario,
  type DataNoFormulario,
  type ErroDoFormulario,
  type Formulario,
} from "../referencias/formulario";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

interface Props {
  /** A fonte que está sendo editada. Sem ela, é uma fonte nova. */
  base?: Referencia;
  /**
   * Quando a fonte veio da busca pelo DOI: "base" é então a fonte trazida do
   * Crossref, que ainda não foi salva. O formulário avisa o que conferir.
   */
  origemDoi?: { avisos: string[] };
  /** Os códigos que já existem, para o código novo não repetir. */
  existentes: string[];
  aoSalvar: (r: Referencia) => void;
  aoCancelar: () => void;
}

/** O formulário "Adicionar à mão": um por tipo, só com os campos que o tipo usa. */
export default function FormularioDeReferencia({ base, origemDoi, existentes, aoSalvar, aoCancelar }: Props) {
  const [f, setF] = useState<Formulario>(() => (base ? referenciaParaFormulario(base) : formularioVazio()));
  const [erros, setErros] = useState<ErroDoFormulario[]>([]);
  const prefixo = useId();
  const descricao = DESCRICAO_DOS_TIPOS[f.tipo];
  const erroDe = (campo: string) => erros.find((e) => e.campo === campo)?.mensagem;
  const id = (campo: string) => `${prefixo}-${campo}`;

  const salvar = () => {
    const r = formularioParaReferencia(f, { existentes, base });
    if (r.ok) aoSalvar(r.referencia);
    else {
      setErros(r.erros);
      // Leva a pessoa ao primeiro problema.
      const primeiro = r.erros.find((e) => e.campo);
      if (primeiro) setTimeout(() => document.getElementById(id(primeiro.campo))?.focus());
    }
  };

  return (
    <form
      className="form-ref"
      aria-label={origemDoi ? "Conferir fonte do DOI" : base ? "Editar fonte" : "Nova fonte"}
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        salvar();
      }}
    >
      <p className="form-ref-titulo">{origemDoi ? "Conferir a fonte do DOI" : base ? "Editar fonte" : "Nova fonte"}</p>

      {origemDoi && (
        <div className="aviso-doi" role="status">
          <p>
            Estes dados vieram do Crossref. Confira cada campo e corrija o que precisar: a fonte só entra no trabalho quando você clicar em “Salvar fonte”. O que o
            Crossref não trouxe ficou em branco.
          </p>
          {origemDoi.avisos.length > 0 && (
            <ul>
              {origemDoi.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {base?.doi && (
        <p className="dica-form" style={{ margin: 0 }}>
          DOI guardado com a fonte: <b>{base.doi}</b>
        </p>
      )}

      <label className="campo-form" htmlFor={id("tipo")}>
        Tipo de fonte
        <select id={id("tipo")} value={f.tipo} onChange={(ev) => setF({ ...f, tipo: ev.target.value as TipoDeReferencia })}>
          {TIPOS_NO_FORMULARIO.map((t) => (
            <option key={t} value={t}>
              {NOME_DO_TIPO_NA_TELA[t]}
            </option>
          ))}
        </select>
      </label>

      <Autores
        rotulo={descricao.rotuloDosAutores}
        exemplo={descricao.exemploDosAutores}
        linhas={f.autores}
        aoMudar={(autores) => setF({ ...f, autores })}
        erroDe={erroDe}
        prefixo="autores"
        id={id}
        comDica
      />
      {descricao.rotuloDosAutoresOrganizadores && (
        <label className="marcar-form" htmlFor={id("autoresOrganizadores")}>
          <input
            type="checkbox"
            id={id("autoresOrganizadores")}
            checked={f.autoresOrganizadores}
            onChange={(ev) => setF({ ...f, autoresOrganizadores: ev.target.checked })}
          />
          {descricao.rotuloDosAutoresOrganizadores}
        </label>
      )}

      <div className="grade-form">
        {camposDoTipo(f.tipo).map((c) => (
          <label key={c.chave} className={`campo-form ${c.curto ? "" : "inteiro"}`} htmlFor={id(c.chave)}>
            {c.rotulo}
            <input
              id={id(c.chave)}
              value={f.texto[c.chave]}
              placeholder={c.exemplo}
              aria-invalid={erroDe(c.chave) ? true : undefined}
              onChange={(ev) => setF({ ...f, texto: { ...f.texto, [c.chave]: ev.target.value } })}
            />
            {erroDe(c.chave) && <span className="erro-campo">{erroDe(c.chave)}</span>}
          </label>
        ))}
      </div>

      {descricao.rotuloDosOrganizadores && (
        <Autores
          rotulo={descricao.rotuloDosOrganizadores}
          linhas={f.organizadores}
          aoMudar={(organizadores) => setF({ ...f, organizadores })}
          erroDe={erroDe}
          prefixo="organizadores"
          id={id}
        />
      )}

      <fieldset className="grupo-form">
        <legend>Data de publicação</legend>
        <DataDigitada valor={f.data} aoMudar={(data) => setF({ ...f, data })} campo="data" erroDe={erroDe} id={id} />
        <label className="campo-form" htmlFor={id("dataIncerta")}>
          Ou data incerta
          <input
            id={id("dataIncerta")}
            value={f.dataIncerta}
            placeholder="[2019?] ou [201-]"
            aria-invalid={erroDe("dataIncerta") ? true : undefined}
            onChange={(ev) => setF({ ...f, dataIncerta: ev.target.value })}
          />
          {erroDe("dataIncerta") && <span className="erro-campo">{erroDe("dataIncerta")}</span>}
        </label>
      </fieldset>

      <fieldset className="grupo-form">
        <legend>Data de acesso</legend>
        <p className="dica-form">Para fontes da internet: o dia em que você viu a página.</p>
        <DataDigitada valor={f.acesso} aoMudar={(acesso) => setF({ ...f, acesso })} campo="acesso" erroDe={erroDe} id={id} />
      </fieldset>

      {erros.length > 0 && (
        <p className="erro-form" role="alert">
          Confira {erros.length === 1 ? "o campo marcado" : `os ${erros.length} campos marcados`}.
          {erros.filter((e) => !e.campo).map((e) => ` ${e.mensagem}`)}
        </p>
      )}

      <div className="acoes-form">
        <button type="button" className="btn" onClick={aoCancelar}>
          Cancelar
        </button>
        <button type="submit" className="btn primario">
          Salvar fonte
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

function Autores(p: {
  rotulo: string;
  exemplo?: string;
  linhas: AutorNoFormulario[];
  aoMudar: (linhas: AutorNoFormulario[]) => void;
  erroDe: (campo: string) => string | undefined;
  prefixo: "autores" | "organizadores";
  id: (campo: string) => string;
  comDica?: boolean;
}) {
  const { linhas, aoMudar } = p;
  const trocar = (i: number, nova: AutorNoFormulario) => aoMudar(linhas.map((l, j) => (j === i ? nova : l)));
  const mover = (i: number, passo: -1 | 1) => {
    const copia = [...linhas];
    [copia[i], copia[i + passo]] = [copia[i + passo], copia[i]];
    aoMudar(copia);
  };

  return (
    <fieldset className="grupo-form">
      <legend>{p.rotulo}</legend>
      {p.comDica && (
        <p className="dica-form">Partículas como de, da e dos vão no fim dos prenomes: Lucas Freitas de. A ordem aqui é a ordem na referência.</p>
      )}
      {linhas.some((l) => l.tipo === "instituicao") && (
        <p className="dica-form">Órgão de governo ou parte de uma instituição: escreva os níveis com ponto entre eles, como Brasil. Ministério da Saúde.</p>
      )}
      {linhas.length === 0 && <p className="dica-form">Nenhum por enquanto.</p>}
      {linhas.map((a, i) => (
        <div key={i} className="linha-autor">
          <select
            aria-label={`Tipo do autor ${i + 1}`}
            value={a.tipo}
            onChange={(ev) => trocar(i, ev.target.value === "pessoa" ? pessoaVazia() : instituicaoVazia())}
          >
            <option value="pessoa">Pessoa</option>
            <option value="instituicao">Instituição</option>
          </select>
          {a.tipo === "pessoa" ? (
            <>
              <input
                id={p.id(`${p.prefixo}.${i}.sobrenome`)}
                aria-label={`Sobrenome do autor ${i + 1}`}
                aria-invalid={p.erroDe(`${p.prefixo}.${i}.sobrenome`) ? true : undefined}
                placeholder="Sobrenome"
                value={a.sobrenome}
                onChange={(ev) => trocar(i, { ...a, sobrenome: ev.target.value })}
              />
              <input
                aria-label={`Prenomes do autor ${i + 1}`}
                placeholder="Prenomes"
                value={a.prenomes}
                onChange={(ev) => trocar(i, { ...a, prenomes: ev.target.value })}
              />
            </>
          ) : (
            <input
              aria-label={`Nome da instituição ${i + 1}`}
              className="dobro"
              placeholder={p.exemplo ?? "Nome da instituição, ou a sigla"}
              value={a.nome}
              onChange={(ev) => trocar(i, { ...a, nome: ev.target.value })}
            />
          )}
          <span className="mover">
            <button type="button" className="mini" aria-label={`Subir o autor ${i + 1}`} disabled={i === 0} onClick={() => mover(i, -1)}>
              ↑
            </button>
            <button type="button" className="mini" aria-label={`Descer o autor ${i + 1}`} disabled={i === linhas.length - 1} onClick={() => mover(i, 1)}>
              ↓
            </button>
            <button type="button" className="mini" aria-label={`Tirar o autor ${i + 1}`} onClick={() => aoMudar(linhas.filter((_, j) => j !== i))}>
              Tirar
            </button>
          </span>
          {p.erroDe(`${p.prefixo}.${i}.sobrenome`) && <span className="erro-campo">{p.erroDe(`${p.prefixo}.${i}.sobrenome`)}</span>}
        </div>
      ))}
      <div className="adicionar-autor">
        <button type="button" className="mini" onClick={() => aoMudar([...linhas, pessoaVazia()])}>
          + Pessoa
        </button>
        <button type="button" className="mini" onClick={() => aoMudar([...linhas, instituicaoVazia()])}>
          + Instituição
        </button>
      </div>
    </fieldset>
  );
}

function DataDigitada(p: {
  valor: DataNoFormulario;
  aoMudar: (d: DataNoFormulario) => void;
  campo: "data" | "acesso";
  erroDe: (campo: string) => string | undefined;
  id: (campo: string) => string;
}) {
  const { valor, aoMudar } = p;
  return (
    <div className="data-form">
      <label className="campo-form" htmlFor={p.id(`${p.campo}.ano`)}>
        Ano
        <input
          id={p.id(`${p.campo}.ano`)}
          inputMode="numeric"
          maxLength={4}
          placeholder="2019"
          value={valor.ano}
          aria-invalid={p.erroDe(`${p.campo}.ano`) ? true : undefined}
          onChange={(ev) => aoMudar({ ...valor, ano: ev.target.value })}
        />
      </label>
      <label className="campo-form" htmlFor={p.id(`${p.campo}.mes`)}>
        Mês
        <select
          id={p.id(`${p.campo}.mes`)}
          value={valor.mes}
          aria-invalid={p.erroDe(`${p.campo}.mes`) ? true : undefined}
          onChange={(ev) => aoMudar({ ...valor, mes: ev.target.value })}
        >
          <option value="">—</option>
          {MESES.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="campo-form" htmlFor={p.id(`${p.campo}.dia`)}>
        Dia
        <input
          id={p.id(`${p.campo}.dia`)}
          inputMode="numeric"
          maxLength={2}
          placeholder="15"
          value={valor.dia}
          aria-invalid={p.erroDe(`${p.campo}.dia`) ? true : undefined}
          onChange={(ev) => aoMudar({ ...valor, dia: ev.target.value })}
        />
      </label>
      {(["ano", "mes", "dia"] as const).map((parte) => p.erroDe(`${p.campo}.${parte}`) && <span key={parte} className="erro-campo larga">{p.erroDe(`${p.campo}.${parte}`)}</span>)}
    </div>
  );
}
