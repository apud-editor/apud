// A correspondência entre as regras dos perfis da versão 1 (perfis/abnt.txt e
// perfis/apa.txt) e os modelos da versão 2 (modelos/abnt.txt e modelos/apa.txt).
//
// Serve a duas coisas: montar os modelos a partir dos perfis, sem copiar à mão,
// e o teste regra por regra (correspondencia.test.ts), que confere que nenhuma
// regra se perdeu nem mudou de valor, de origem, de situação ou de comentário.
//
// Regra geral: o que tinha efeito na versão 1 continua com o mesmo efeito; o
// que não tinha continua sem.
//
// Quatro destinos:
//   1. Propriedade de um elemento, com outro nome (a maior parte da forma na
//      página): "recuo de parágrafo" vira Texto › recuo da primeira linha.
//   2. Opção reservada, sem efeito ainda: "seção primária, página nova" vira
//      Títulos › Nível 1 › página nova.
//   3. "O que a norma diz": a regra fica com o mesmo nome, no elemento a que
//      pertence, sem efeito, como era ("resumo, extensão em artigo").
//   4. Citações e referências: o mesmo nome, lida pelo motor e pelo CSL.
// Os destinos 3 e 4 não precisam estar listados aqui: a regra que não aparece
// em CORRESPONDENCIA vai para a propriedade de mesmo nome (só um elemento a declara).

import { ELEMENTOS } from "./elementos";

export interface Destino {
  elemento: string;
  /** A propriedade ou o atalho que recebe o valor. */
  propriedade: string;
  /** O valor no modelo, quando não é o mesmo texto da regra (ex.: "início do texto: repete o título" → "sim"). */
  valor?: string;
}

const d = (elemento: string, propriedade: string, valor?: string): Destino => (valor === undefined ? { elemento, propriedade } : { elemento, propriedade, valor });

/** As regras que mudam de nome ou que se dividem em mais de uma propriedade. */
export const CORRESPONDENCIA: Readonly<Record<string, Destino[]>> = {
  // --- Página e texto ---
  "tamanho da fonte": [d("texto", "tamanho")],
  "família da fonte": [d("texto", "fonte")],
  fonte: [d("texto", "fonte e tamanho")],
  entrelinhas: [d("texto", "entrelinha")],
  alinhamento: [d("texto", "alinhamento")],
  "recuo de parágrafo": [d("texto", "recuo da primeira linha")],
  "margens, esquerda": [d("pagina", "margem esquerda")],
  "margens, superior": [d("pagina", "margem superior")],
  "margens, direita": [d("pagina", "margem direita")],
  "margens, inferior": [d("pagina", "margem inferior")],
  margens: [d("pagina", "margens")],

  // --- Número da página ---
  "numeração de página, contar desde": [d("pagina.numero", "contar desde")],
  "numeração de página, mostrar desde": [d("pagina.numero", "mostrar desde")],
  "numeração de página, posição": [d("pagina.numero", "posição")],
  "numeração de página, distância das bordas": [d("pagina.numero", "distância das bordas")],
  "número de página, posição": [d("pagina.numero", "posição")],
  "número de página, distância do topo": [d("pagina.numero", "distância vertical")],

  // --- Títulos ---
  "seção primária, página nova": [d("titulos.nivel1", "página nova")],
  "títulos, espaço antes": [d("titulos", "espaço antes")],
  "títulos, espaço depois": [d("titulos", "espaço depois")],
  "títulos, linhas em branco antes e depois": [d("titulos", "espaço antes e depois")],
  "títulos na mesma linha, final": [d("titulos", "final na mesma linha")],
  ...Object.fromEntries(
    [1, 2, 3, 4, 5].flatMap((n) => [
      [`título nível ${n}, destaque`, [d(`titulos.nivel${n}`, "destaque")]],
      [`título nível ${n}, posição`, [d(`titulos.nivel${n}`, "posição")]],
      [`título nível ${n}, texto depois`, [d(`titulos.nivel${n}`, "texto depois")]],
    ]),
  ),
  "títulos sem número, alinhamento": [d("titulos.semNumero", "alinhamento")],
  "rótulos de seção, alinhamento": [d("titulos.semNumero", "alinhamento")],
  "início do texto": [d("titulos.repetido", "repetir no começo do texto", "sim")],

  // --- Listas ---
  "alíneas, marcador": [d("listas", "marcador")],
  "alíneas, recuo": [d("listas", "recuo à esquerda")],
  "sub-alíneas, marcador": [d("listas", "marcador da sub-lista")],
  "sub-alíneas, recuo a mais": [d("listas", "recuo a mais da sub-lista")],
  "listas em sequência, marcador": [d("listas", "marcador em sequência")],
  "listas sem sequência, marcador": [d("listas", "marcador sem sequência")],
  "listas, recuo": [d("listas", "recuo à esquerda")],
  "sub-listas, recuo a mais": [d("listas", "recuo a mais da sub-lista")],

  // --- Citação longa ---
  "citação longa, recuo": [d("citacaoLonga", "recuo à esquerda")],
  "citação longa, linhas em branco antes e depois": [d("citacaoLonga", "espaço antes e depois")],
  "citação, ponto final": [d("citacaoLonga", "ponto final")],
  "citação em bloco, recuo": [d("citacaoLonga", "recuo à esquerda")],
  "citação em bloco, ponto final": [d("citacaoLonga", "ponto final")],

  // --- Notas de rodapé ---
  "notas de rodapé, filete": [d("nota", "filete")],
  "notas de rodapé, linhas seguintes": [d("nota", "linhas seguintes")],
  "notas de rodapé, tamanho da fonte": [d("nota", "tamanho")],
  "notas de rodapé, espaçamento": [d("nota", "entrelinha")],

  // --- Ilustrações e tabelas ---
  "ilustração, tipos": [d("ilustracoes", "espécies")],
  "figura, rótulo": [d("ilustracoes", "espécies")],
  "ilustração, posição na página": [d("ilustracoes", "posição")],
  "figuras, posição da imagem": [d("ilustracoes", "posição")],
  "ilustração, largura da fonte e da legenda": [d("ilustracoes", "largura do título e da fonte")],
  "ilustrações e tabelas, linhas em branco antes e depois": [d("ilustracoes", "espaço antes e depois")],
  "tabelas e figuras, linhas em branco antes e depois": [d("ilustracoes", "espaço antes e depois")],
  "ilustração, separador do título": [d("ilustracoes.identificacao", "separador")],
  "tabelas e figuras, número": [d("ilustracoes.identificacao", "destaque do número", "negrito")],
  "tabelas e figuras, título": [d("ilustracoes.identificacao", "título na linha de baixo", "sim"), d("ilustracoes.identificacao", "destaque do título", "itálico")],
  "tabelas, espaçamento de número, título e nota": [d("ilustracoes.identificacao", "entrelinha"), d("ilustracoes.fonte", "entrelinha")],
  "ilustração, rótulo da fonte": [d("ilustracoes.fonte", "rótulo da fonte")],
  "ilustração, fonte quando é sua": [d("ilustracoes.fonte", "fonte quando é sua")],
  "tabelas e figuras, rótulo da nota": [d("ilustracoes.fonte", "rótulo da nota")],
  "tabelas e figuras, fonte": [d("ilustracoes.fonte", "fonte dentro da nota", "sim")],
  "tabelas, rótulo": [d("ilustracoes.tabela", "rótulo")],
  "tabela, rótulo": [d("ilustracoes.tabela", "rótulo")],
  "tabelas, fios": [d("ilustracoes.tabela", "fios")],
  "tabelas, alinhamento": [d("ilustracoes.tabela", "alinhamento das células")],
  "tabelas, espaçamento do corpo": [d("ilustracoes.tabela", "entrelinha")],
  "tabelas em mais de uma página": [d("ilustracoes.tabela", "em mais de uma página")],
  "tabelas em mais de uma página, indicações": [d("ilustracoes.tabela", "indicações")],
  "tabelas em mais de uma página, posição das indicações": [d("ilustracoes.tabela", "posição das indicações")],

  // --- Lista de referências ---
  "rótulo das referências": [d("referencias", "título")],
  "referências, alinhamento": [d("referencias", "alinhamento")],
  "referências, entre uma e outra": [d("referencias", "espaço entre as referências")],
  "referências, linhas em branco entre elas": [d("referencias", "espaço entre as referências")],
  "referências, recuo das linhas seguintes": [d("referencias", "recuo das linhas seguintes")],
  "referências, página nova": [d("referencias", "página nova")],

  // --- Abertura ---
  // Se a norma tem o elemento: na versão 1, a regra existir bastava; agora é "existe: sim".
  capa: [d("abertura.capa", "capa"), d("abertura.capa", "existe", "sim")],
  "capa, campos": [d("abertura.capa", "campos")],
  "capa, destaque do título": [d("abertura.capa", "destaque do título")],
  "folha de rosto": [d("abertura.folhaDeRosto", "folha de rosto"), d("abertura.folhaDeRosto", "existe", "sim")],
  "folha de rosto, campos": [d("abertura.folhaDeRosto", "campos")],
  "folha de rosto, destaque do título": [d("abertura.folhaDeRosto", "destaque do título")],
  "folha de rosto, rótulo do orientador": [d("abertura.folhaDeRosto", "rótulo do orientador")],
  "folha de rosto, rótulo do professor": [d("abertura.folhaDeRosto", "rótulo do professor")],
  "página de título (estudante), campos": [d("abertura.paginaDeTitulo", "campos no modo estudante"), d("abertura.paginaDeTitulo", "existe", "sim")],
  "página de título (profissional), campos": [d("abertura.paginaDeTitulo", "campos no modo profissional")],
  "página de título (estudante), espaçamento": [d("abertura.paginaDeTitulo", "entrelinha")],
  "página de título (estudante), destaque do título": [d("abertura.paginaDeTitulo", "destaque do título")],
  "página de título (estudante), linhas antes do título": [d("abertura.paginaDeTitulo", "linhas antes do título")],
  "página de título (estudante), linhas em branco depois do título": [d("abertura.paginaDeTitulo", "linhas depois do título")],
  "modo, quando o trabalho é artigo": [d("abertura.paginaDeTitulo", "modo quando o trabalho é artigo")],
  dedicatória: [d("abertura.dedicatoria", "dedicatória"), d("abertura.dedicatoria", "existe", "sim")],
  epígrafe: [d("abertura.epigrafe", "epígrafe"), d("abertura.epigrafe", "existe", "sim")],
  "epígrafe, autor": [d("abertura.epigrafe", "autoria")],
  agradecimentos: [d("abertura.agradecimentos", "agradecimentos"), d("abertura.agradecimentos", "existe", "sim")],
  "agradecimentos, título": [d("abertura.agradecimentos", "título")],
  resumo: [d("abertura.resumo", "resumo"), d("abertura.resumo", "existe", "sim")],
  "rótulo do resumo": [d("abertura.resumo", "título em português"), d("abertura.resumo", "existe", "sim")],
  "resumo, título": [d("abertura.resumo", "título em português")],
  "resumo em língua estrangeira, título": [d("abertura.resumo", "título em inglês")],
  "resumo, espaçamento": [d("abertura.resumo", "entrelinha")],
  "resumo, recuo da primeira linha": [d("abertura.resumo", "recuo da primeira linha")],
  "palavras-chave, rótulo": [d("abertura.resumo.palavrasChave", "rótulo em português")],
  "resumo em língua estrangeira, rótulo das palavras-chave": [d("abertura.resumo.palavrasChave", "rótulo em inglês")],
  "palavras-chave, destaque do rótulo": [d("abertura.resumo.palavrasChave", "destaque do rótulo")],
  "palavras-chave, separador": [d("abertura.resumo.palavrasChave", "separador")],
  "palavras-chave, final": [d("abertura.resumo.palavrasChave", "final")],
  "palavras-chave, linhas em branco antes": [d("abertura.resumo.palavrasChave", "espaço antes")],
  "palavras-chave, recuo da primeira linha": [d("abertura.resumo.palavrasChave", "recuo da primeira linha")],
  sumário: [d("abertura.sumario", "sumário"), d("abertura.sumario", "existe", "sim")],
  "sumário, título": [d("abertura.sumario", "título")],
  "sumário, ligação até a página": [d("abertura.sumario", "ligação até a página")],
};

/**
 * "Fonte menor, onde" e "espaço simples, onde" (perfil ABNT): cada parte da
 * lista vira o tamanho ou a entrelinha de um elemento. As duas regras também
 * ficam guardadas no Texto, como "o que a norma diz".
 */
export const PARTE_PARA_ELEMENTO: Readonly<Record<string, string>> = {
  "citações longas": "citacaoLonga",
  "notas de rodapé": "nota",
  "número de página": "pagina.numero",
  legendas: "ilustracoes.fonte",
  "fontes de ilustrações e tabelas": "ilustracoes.fonte",
  referências: "referencias",
  "natureza do trabalho": "abertura.folhaDeRosto.natureza",
};

/**
 * Valores que a versão 1 tinha no código, num caminho só de uma norma (o
 * "ramo ABNT" ou o "ramo APA" do conversor), e que agora são do modelo.
 */
export interface ValorQueEstavaNoCodigo {
  modelo: "ABNT" | "APA";
  elemento: string;
  propriedade: string;
  valor: string;
  origem: string;
  nota: string;
}

export const VALORES_QUE_ESTAVAM_NO_CODIGO: readonly ValorQueEstavaNoCodigo[] = [
  {
    modelo: "ABNT",
    elemento: "ilustracoes.tabela",
    propriedade: "largura",
    valor: "largura do conteúdo",
    origem: "IBGE, Normas de apresentação tabular (1993)",
    nota: "A tabela na largura do conteúdo, no meio da página, com o título e a fonte na largura da tabela. Na versão 1, era o ramo ABNT do conversor.",
  },
  {
    modelo: "APA",
    elemento: "pagina.numero",
    propriedade: "distância lateral",
    valor: "na margem",
    origem: "APA 7 (Student Paper Setup Guide: cabeçalho a 0,5 polegada, como no Word)",
    nota: "O número fica no cabeçalho, alinhado à margem direita. Na versão 1, era o ramo APA do conversor.",
  },
];

/**
 * Para onde vai uma regra da versão 1: os destinos de CORRESPONDENCIA, ou a
 * propriedade de mesmo nome (o que a norma diz, ou citações e referências).
 */
export function destinosDe(chave: string): Destino[] {
  const listados = CORRESPONDENCIA[chave];
  if (listados) return listados;
  const donos = ELEMENTOS.filter((e) => e.propriedades.some((p) => p.nome === chave && (p.grupo === "norma" || p.grupo === "citações")));
  if (donos.length !== 1) throw new Error(`a regra “${chave}” da versão 1 não tem destino (${donos.length} elementos a guardam)`);
  return [d(donos[0].id, chave)];
}
