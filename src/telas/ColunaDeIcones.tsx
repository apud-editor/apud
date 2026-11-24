// Coluna estreita de ícones, na direita da tela de escrita: abre e fecha a
// Prévia e as Referências (os mesmos painéis dos menus e dos atalhos).

import { Icone } from "../editor/icones";
import { ATALHOS_DOS_PAINEIS, type Painel } from "./atalhos";

const BOTOES: {
  painel: Painel;
  icone: "previa" | "referencias";
  rotulo: string;
}[] = [
  { painel: "previa", icone: "previa", rotulo: "Prévia" },
  { painel: "referencias", icone: "referencias", rotulo: "Referências" },
];

export default function ColunaDeIcones({
  aberto,
  aoAlternar,
}: {
  /** Qual painel está aberto agora (nenhum = null). */
  aberto: Painel | null;
  aoAlternar: (p: Painel) => void;
}) {
  return (
    <div
      className="colicones"
      role="toolbar"
      aria-label="Painéis"
      aria-orientation="vertical"
    >
      {BOTOES.map((b) => {
        const atalho = ATALHOS_DOS_PAINEIS[b.painel].texto;
        return (
          <button
            key={b.painel}
            type="button"
            className={`fb colicones-botao ${aberto === b.painel ? "on" : ""}`}
            aria-label={b.rotulo}
            aria-pressed={aberto === b.painel}
            aria-keyshortcuts={atalho}
            title={`${b.rotulo} (${atalho})`}
            onClick={() => aoAlternar(b.painel)}
          >
            <Icone nome={b.icone} tamanho={20} />
          </button>
        );
      })}
    </div>
  );
}
