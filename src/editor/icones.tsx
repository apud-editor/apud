// Ícones de interface da barra de ferramentas e da coluna da direita.
// Traço fino, no estilo do protótipo da v2 (conjunto Tabler, licença MIT, copiado como
// caminhos de SVG: nada vem da internet). A cor vem do texto do botão (currentColor).

import type { ReactNode } from "react";

const CAMINHOS = {
  desfazer: (
    <>
      <path d="M9 14l-4-4 4-4" />
      <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
    </>
  ),
  refazer: (
    <>
      <path d="M15 14l4-4-4-4" />
      <path d="M19 10H8a4 4 0 1 0 0 8h1" />
    </>
  ),
  negrito: (
    <>
      <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" />
      <path d="M13 12h1a3.5 3.5 0 0 1 0 7H7v-7" />
    </>
  ),
  italico: (
    <>
      <path d="M11 5h6" />
      <path d="M7 19h6" />
      <path d="M14 5l-4 14" />
    </>
  ),
  sobrescrito: (
    <>
      <path d="M5 7l8 10" />
      <path d="M13 7l-8 10" />
      <path d="M16 6a2 2 0 1 1 3.6 1.2L16 11h5" />
    </>
  ),
  lista: (
    <>
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="M5 6v.01" />
      <path d="M5 12v.01" />
      <path d="M5 18v.01" />
    </>
  ),
  listaEmSequencia: (
    <>
      <path d="M11 6h9" />
      <path d="M11 12h9" />
      <path d="M11 18h9" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </>
  ),
  quebraDePagina: (
    <>
      <path d="M6 9V4h12v5" />
      <path d="M6 15v5h12v-5" />
      <path d="M3 12h2" />
      <path d="M9 12h2" />
      <path d="M13 12h2" />
      <path d="M19 12h2" />
    </>
  ),
  citar: (
    <>
      <path d="M6 17h3l2-4V7H5v6h3" />
      <path d="M14 17h3l2-4V7h-6v6h3" />
    </>
  ),
  tabela: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16" />
      <path d="M10 4v16" />
    </>
  ),
  figura: (
    <>
      <path d="M15 8h.01" />
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M4 15l4-4a3 5 0 0 1 3 0l5 5" />
      <path d="M14 14l1-1a3 5 0 0 1 3 0l2 2" />
    </>
  ),
  nota: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8.5 7.5h7" />
      <path d="M8.5 11h4" />
      <path d="M8.5 17h3" />
    </>
  ),
  engrenagem: (
    <>
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065" />
      <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0-6 0" />
    </>
  ),
  fechar: (
    <>
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </>
  ),
  previa: (
    <>
      <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0-4 0" />
      <path d="M21 12c-2.4 4-5.4 6-9 6s-6.6-2-9-6c2.4-4 5.4-6 9-6s6.6 2 9 6" />
    </>
  ),
  referencias: (
    <>
      <path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
      <path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
      <path d="M3 6v13" />
      <path d="M12 6v13" />
      <path d="M21 6v13" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type NomeDoIcone = keyof typeof CAMINHOS;

/** Um ícone de interface. É só enfeite: o botão que o usa precisa ter `aria-label`. */
export function Icone({
  nome,
  tamanho = 18,
}: {
  nome: NomeDoIcone;
  tamanho?: number;
}) {
  return (
    <svg
      className="ic"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {CAMINHOS[nome]}
    </svg>
  );
}
