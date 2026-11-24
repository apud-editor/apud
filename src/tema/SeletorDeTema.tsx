import { ESCOLHAS_DE_TEMA, type EscolhaDeTema } from "./tema";

interface Props {
  escolha: EscolhaDeTema;
  aoEscolher: (escolha: EscolhaDeTema) => void;
}

/** Claro, Escuro ou Sistema. Fica no topo do Painel; no editor, em Arquivo › Preferências. */
export default function SeletorDeTema({ escolha, aoEscolher }: Props) {
  return (
    <div className="tema-seletor" role="group" aria-label="Tema do programa">
      <span className="tema-rotulo" aria-hidden="true">
        Tema
      </span>
      {ESCOLHAS_DE_TEMA.map((e) => (
        <button
          key={e.valor}
          type="button"
          className={`tema-opcao ${e.valor === escolha ? "on" : ""}`}
          aria-pressed={e.valor === escolha}
          onClick={() => aoEscolher(e.valor)}
        >
          {e.rotulo}
        </button>
      ))}
    </div>
  );
}
