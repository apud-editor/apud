import type { CSSProperties } from "react";

import { LETRAS_DA_LOGO } from "./letras";

/**
 * Marca do Apud em SVG "de verdade" (não imagem): as cores vêm do tema e a
 * linha e o cursor são peças separadas, para a animação "Digitando".
 *
 * - `Logo`: logo oficial completa "Apud." (só nas telas de abertura).
 * - `Simbolo`: A + linha + cursor + ponto (ícone do cabeçalho do editor).
 *
 * A animação (tema.css, classes `mk-*`) acontece quando o elemento de fora
 * com a classe `mk-gatilho` recebe o mouse ou o foco do teclado, e não
 * acontece para quem pediu menos movimento no sistema.
 */

type PropsDaMarca = {
  /** Altura em pixels (a largura acompanha a proporção). */
  altura: number;
  /** Texto para leitores de tela; vazio = só enfeite. */
  titulo?: string;
};

export function Logo({ altura, titulo = "Apud" }: PropsDaMarca) {
  const estilo: CSSProperties = { height: altura, width: (altura * 898) / 408 };
  return (
    <svg
      className="mk-logo"
      viewBox="0 0 898 408"
      style={estilo}
      role={titulo ? "img" : undefined}
      aria-label={titulo || undefined}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
    >
      <path fill="currentColor" fillRule="evenodd" d={LETRAS_DA_LOGO} />
      <g className="mk-acento">
        <circle cx="869.8" cy="229.2" r="25.7" />
        <rect className="mk-linha" x="2.5" y="337.7" width="312" height="31.3" />
        <rect className="mk-cursor" x="339.5" y="303.4" width="20" height="102.5" />
      </g>
    </svg>
  );
}

export function Simbolo({ altura, titulo = "Apud" }: PropsDaMarca) {
  const estilo: CSSProperties = { height: altura, width: (altura * 732) / 754 };
  return (
    <svg
      className="mk-simbolo"
      viewBox="145 135 732 754"
      style={estilo}
      role={titulo ? "img" : undefined}
      aria-label={titulo || undefined}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        transform="translate(170 155) scale(1.12 .99)"
        d="M200 0H319L515 486H401L358 375H157L116 486H0Z M190 295H330L261 101Z"
      />
      <g className="mk-acento">
        <circle cx="803" cy="548" r="54" />
        <rect className="mk-linha" x="165" y="742" width="585" height="57" />
        <rect className="mk-cursor" x="789" y="670" width="45" height="199" />
      </g>
    </svg>
  );
}
