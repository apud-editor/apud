import { comInicialMaiuscula, type EscolhaDoAutor } from "../referencias/escolhas";

interface Props {
  escolhas: EscolhaDoAutor[];
  nomeDaNorma: string;
  aoEscolher: (e: EscolhaDoAutor, valor: string) => void;
}

/** As escolhas do autor: os pontos em que a norma aceita mais de uma forma. Ficam nas Configurações do trabalho. */
export default function EscolhasDoAutor({ escolhas, nomeDaNorma, aoEscolher }: Props) {
  if (escolhas.length === 0) return <p className="dica-form">A {nomeDaNorma} não tem escolhas para o autor neste ponto.</p>;
  return (
    <section className="escolhas" aria-label="Escolhas do autor">
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
  );
}
