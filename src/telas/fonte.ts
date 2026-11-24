// O aviso de fonte faltando na prévia. As quatro fontes que o Apud oferece têm
// reserva com as mesmas medidas (Liberation Serif, Liberation Sans, Carlito e
// Gelasio, na pasta public/fontes); o aviso vale para elas.

const FONTES: Record<string, { nome: string; arquivo: string; reserva: string }> = {
  "times new roman": { nome: "Times New Roman", arquivo: "times.ttf", reserva: "Liberation Serif" },
  arial: { nome: "Arial", arquivo: "arial.ttf", reserva: "Liberation Sans" },
  calibri: { nome: "Calibri", arquivo: "calibri.ttf", reserva: "Carlito" },
  georgia: { nome: "Georgia", arquivo: "georgia.ttf", reserva: "Gelasio" },
};

/**
 * O aviso, ou null se não há o que avisar. Só avisa no programa (no navegador as fontes
 * do computador não são lidas) e só para a fonte que o perfil pede.
 */
export function avisoDeFonte(familia: string | undefined, fontesDoComputador: string[], noPrograma: boolean): string | null {
  if (!noPrograma || !familia) return null;
  const f = FONTES[familia.trim().toLowerCase()];
  if (!f || fontesDoComputador.includes(f.arquivo)) return null;
  return `A ${f.nome} não foi encontrada neste computador. A prévia e o PDF usam a ${f.reserva}, que tem as mesmas medidas.`;
}
