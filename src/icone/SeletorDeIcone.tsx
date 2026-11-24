import { ICONES, arquivoDoIcone, type IdDoIcone } from "./icone";

interface Props {
  escolhido: IdDoIcone;
  aoEscolher: (id: IdDoIcone) => void;
}

/** As miniaturas dos ícones do kit; a pessoa clica no que quer. Fica no topo do Painel. */
export default function SeletorDeIcone({ escolhido, aoEscolher }: Props) {
  return (
    <div className="ic-seletor" role="group" aria-label="Ícone do programa">
      <span className="ic-rotulo" aria-hidden="true">
        Ícone
      </span>
      {ICONES.map((i) => (
        <button
          key={i.id}
          type="button"
          className={`ic-opcao ${i.id === escolhido ? "on" : ""}`}
          aria-pressed={i.id === escolhido}
          aria-label={`${i.nome}: ${i.descricao}`}
          title={`${i.nome}: ${i.descricao}`}
          onClick={() => aoEscolher(i.id)}
        >
          <img src={arquivoDoIcone(i.id)} width={24} height={24} alt="" />
        </button>
      ))}
    </div>
  );
}
