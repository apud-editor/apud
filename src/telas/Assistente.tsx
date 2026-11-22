import { useMemo, useRef, useState } from "react";
import type { Trabalho } from "../arquivos/formato";
import type { DadosDoTrabalho, TipoDeTrabalho } from "../documento/modelo";
import { normasEmbutidas, perfilEmbutido } from "../perfis/embutidos";
import CamposDosDados from "./CamposDosDados";
import {
  TIPOS,
  aberturaPadrao,
  anoDeHoje,
  palavrasChaveDoTexto,
  problemasDosDados,
  resumoDoAssistente,
  trabalhoNovo,
} from "./trabalho";

interface Props {
  aoCriar: (trabalho: Trabalho) => void;
  aoCancelar: () => void;
}

const PASSOS = ["Tipo e norma", "Dados", "Resumo"] as const;

/** O que o Apud deixa ligado para o tipo e a norma escolhidos, em frases simples (para o passo 3). */
function frasesDoQueLiga(tipo: TipoDeTrabalho, norma: string): string[] {
  const perfil = perfilEmbutido(norma);
  const a = aberturaPadrao(tipo, perfil);
  const lista: string[] = [];
  if (a.capa) lista.push("capa");
  if (a.folhaDeRosto) lista.push("folha de rosto");
  if (a.paginaDeTitulo) lista.push("página de título");
  if (a.sumario) lista.push("sumário");
  return lista;
}

/** "Novo trabalho" em 3 passos: tipo e norma, dados, resumo (dá para pular). Nada é criado antes do último passo. */
export default function Assistente({ aoCriar, aoCancelar }: Props) {
  const normas = useMemo(() => normasEmbutidas(), []);
  const [passo, setPasso] = useState(0);
  const [norma, setNorma] = useState(normas[0] ?? "ABNT");
  const [dados, setDados] = useState<DadosDoTrabalho>({ tipo: "disciplina", idioma: "pt-BR", titulo: "", autores: [""], ano: anoDeHoje() });
  const [tentou, setTentou] = useState(false);
  const [textoDoResumo, setTextoDoResumo] = useState("");
  const [palavras, setPalavras] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const criando = useRef(false);

  const problemas = problemasDosDados(dados);
  const erros = tentou
    ? {
        titulo: problemas.find((p) => p.startsWith("Escreva o título")),
        autores: problemas.find((p) => p.includes("autor")),
        ano: problemas.find((p) => p.startsWith("O ano")),
      }
    : {};
  const ligados = frasesDoQueLiga(dados.tipo, norma);

  const seguir = () => {
    if (passo === 1) {
      setTentou(true);
      if (problemas.length) return;
    }
    setPasso((p) => p + 1);
  };

  const criar = (comResumo: boolean) => {
    if (criando.current) return;
    criando.current = true;
    try {
      const resumo = comResumo ? resumoDoAssistente(dados.idioma, textoDoResumo, palavras) : null;
      aoCriar(trabalhoNovo({ dados, resumo }, perfilEmbutido(norma)));
    } catch (e) {
      criando.current = false;
      setErro(`Não consegui montar o trabalho: ${(e as Error).message}.`);
    }
  };

  return (
    <div className="tela">
      <header className="topo">
        <span className="marca">Apud</span>
        <span className="barra" aria-hidden="true">
          /
        </span>
        <span className="aviso">Novo trabalho</span>
      </header>
      <main className="painel">
        <div className="painel-conteudo assistente">
          <ol className="passos" aria-label="Passos do assistente">
            {PASSOS.map((nome, i) => (
              <li key={nome} className={i === passo ? "atual" : i < passo ? "feito" : ""} aria-current={i === passo ? "step" : undefined}>
                <span className="passo-numero">{i + 1}</span> {nome}
              </li>
            ))}
          </ol>

          {passo === 0 && (
            <section aria-labelledby="passo-1">
              <h1 id="passo-1">Que trabalho é este?</h1>
              <p className="dica-grande">O tipo ajuda o Apud a deixar ligado o que costuma entrar. Você muda tudo depois, nas Configurações.</p>
              <fieldset className="cartoes">
                <legend className="oculto">Tipo de trabalho</legend>
                {TIPOS.map((t) => (
                  <label key={t.tipo} className={`cartao-escolha ${dados.tipo === t.tipo ? "on" : ""}`}>
                    <input type="radio" name="tipo-de-trabalho" checked={dados.tipo === t.tipo} onChange={() => setDados({ ...dados, tipo: t.tipo })} />
                    <span>
                      <b>{t.nome}</b>
                      <span className="dica-form">{t.explicacao}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <h2>Qual norma?</h2>
              <fieldset className="cartoes">
                <legend className="oculto">Norma</legend>
                {normas.map((n) => (
                  <label key={n} className={`cartao-escolha ${norma === n ? "on" : ""}`}>
                    <input type="radio" name="norma-do-trabalho" checked={norma === n} onChange={() => setNorma(n)} />
                    <span>
                      <b>{n}</b>
                      <span className="dica-form">{n === "ABNT" ? "A norma brasileira: capa, folha de rosto, sumário, citação (AUTOR, ano)." : "A norma americana: página de título, citação (Autor, ano)."}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </section>
          )}

          {passo === 1 && (
            <section aria-labelledby="passo-2">
              <h1 id="passo-2">Os dados do trabalho</h1>
              <p className="dica-grande">São os que aparecem na capa ou na página de título. Só o título e um autor são obrigatórios; o resto você completa quando quiser.</p>
              <CamposDosDados dados={dados} aoMudar={setDados} nomeDaNorma={norma} completo={false} erros={erros} />
            </section>
          )}

          {passo === 2 && (
            <section aria-labelledby="passo-3">
              <h1 id="passo-3">Resumo e palavras-chave</h1>
              <p className="dica-grande">Se já tiver o resumo, cole aqui. Dá para pular e escrever depois, na Abertura do trabalho, no topo do texto.</p>
              <label className="campo-form" htmlFor="resumo-novo">
                Resumo
                <textarea id="resumo-novo" rows={8} value={textoDoResumo} onChange={(e) => setTextoDoResumo(e.target.value)} />
              </label>
              <label className="campo-form" htmlFor="palavras-novas">
                Palavras-chave
                <input id="palavras-novas" value={palavras} onChange={(e) => setPalavras(e.target.value)} autoComplete="off" />
                <span className="dica-form">
                  Separe por ponto e vírgula.
                  {palavrasChaveDoTexto(palavras).length > 0 && ` Entendi ${palavrasChaveDoTexto(palavras).length}.`}
                </span>
              </label>
              <p className="dica-form" role="status">
                {ligados.length
                  ? `O Apud deixa ligado: ${ligados.join(", ")}. Você liga e desliga nas Configurações.`
                  : "O Apud começa sem capa, folha de rosto e sumário. Você liga o que quiser nas Configurações."}
              </p>
            </section>
          )}

          {erro && (
            <p className="erro-form" role="alert">
              {erro}
            </p>
          )}

          <div className="acoes-form acoes-assistente">
            <button type="button" className="btn" onClick={aoCancelar}>
              Cancelar
            </button>
            <span style={{ flex: 1 }} />
            {passo > 0 && (
              <button type="button" className="btn" onClick={() => setPasso((p) => p - 1)}>
                Voltar
              </button>
            )}
            {passo < 2 ? (
              <button type="button" className="btn primario" onClick={seguir}>
                Continuar
              </button>
            ) : (
              <>
                <button type="button" className="btn" onClick={() => criar(false)}>
                  Pular o resumo e criar
                </button>
                <button type="button" className="btn primario" onClick={() => criar(true)}>
                  Criar o trabalho
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
