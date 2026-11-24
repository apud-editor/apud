// Pequenas funções de texto usadas pela leitura e pela conferência dos modelos.

/** Deixa um texto comparável: sem espaços sobrando e em minúsculas. */
export function normalizar(texto: string): string {
  return texto.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Tira os acentos, para comparar "nao" com "não" ao sugerir correções. */
export function semAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Quantas letras é preciso mudar para transformar um texto no outro. */
export function distancia(a: string, b: string): number {
  const linhaAnterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = linhaAnterior[0];
    linhaAnterior[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const acima = linhaAnterior[j];
      linhaAnterior[j] = Math.min(
        linhaAnterior[j] + 1,
        linhaAnterior[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = acima;
    }
  }
  return linhaAnterior[b.length];
}

/** Procura, entre os candidatos, o mais parecido com o texto digitado. */
export function sugerir(digitado: string, candidatos: readonly string[]): string | undefined {
  const alvo = semAcentos(normalizar(digitado));
  let melhor: string | undefined;
  let menor = Infinity;
  for (const candidato of candidatos) {
    const d = distancia(alvo, semAcentos(normalizar(candidato)));
    if (d < menor) {
      menor = d;
      melhor = candidato;
    }
  }
  const tolerancia = Math.max(2, Math.floor(alvo.length / 4));
  return menor <= tolerancia ? melhor : undefined;
}

/** "a", "a e b", "a, b e c": para listar opções nas mensagens. */
export function listarComE(itens: readonly string[]): string {
  const comAspas = itens.map((i) => `“${i}”`);
  if (comAspas.length <= 1) return comAspas.join("");
  return `${comAspas.slice(0, -1).join(", ")} e ${comAspas[comAspas.length - 1]}`;
}
