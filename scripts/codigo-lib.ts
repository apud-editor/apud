// O gabarito do código: o código Typst que o conversor escreve para alguns
// trabalhos de teste, guardado em perfis/prova/codigo/. Serve para a etapa 1
// da versão 2, que troca os perfis pelos modelos em árvore: o conversor novo
// tem de escrever o mesmo código, letra por letra. Código igual dá PDF igual.
//
// Os casos cobrem as duas normas, a abertura inteira, as marcas da prévia, os
// dois artigos de teste, as escolhas do autor e os valores de faculdade que
// mudam a página (fonte, recuo, alinhamento, posição do número...).
//
// Uso:
//   npm run codigo              confere com o gabarito e mostra o que mudou
//   npm run codigo -- --gravar  grava o código atual como gabarito. Use só
//                               quando a mudança no código for de propósito.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { documentoParaTypst, type OpcoesDoConversor } from "../src/conversor/typst";
import { conferirPerfis, formatarMensagem, normaDoTrabalho, type Arquivo } from "../src/perfis";
import type { Documento, Referencia, Resumo } from "../src/documento/modelo";
import { documentoDeProva, documentoDoTexto, PASTA_PERFIS, PASTA_PROVA } from "./prova-lib";

export const PASTA_DO_CODIGO = join(PASTA_PROVA, "codigo");

export interface CasoDeCodigo {
  /** Nome do arquivo do gabarito, sem o .typ. */
  nome: string;
  /** O que o caso cobre, em poucas palavras. */
  descricao: string;
  /** O código Typst que o conversor escreve hoje para o caso. */
  codigo: () => string;
}

const lerPasta = (pasta: string, extensao: string): Arquivo[] =>
  readdirSync(pasta)
    .filter((n) => n.endsWith(extensao))
    .map((nome) => ({ nome, conteudo: readFileSync(join(pasta, nome), "utf8") }));

/** O perfil (da pasta perfis/ ou o de exemplo) com os ajustes do caso e o CSL ajustado. */
function norma(arquivo: string, ajustes: Record<string, string> = {}) {
  const perfis = [...lerPasta(PASTA_PERFIS, ".txt"), ...lerPasta(join(PASTA_PERFIS, "exemplos"), ".txt")];
  const r = conferirPerfis(perfis, lerPasta(join(PASTA_PERFIS, "estilos"), ".csl")).find((x) => x.arquivo === arquivo);
  if (!r?.perfil) throw new Error(`o perfil ${arquivo} tem erros: ${r?.mensagens.map(formatarMensagem).join("; ")}`);
  const n = normaDoTrabalho(r, lerPasta(join(PASTA_PERFIS, "estilos"), ".csl"), ajustes);
  if (n.problemas.length) throw new Error(n.problemas.map(formatarMensagem).join("\n"));
  return n;
}

/**
 * O código como vai para o gabarito:
 *   - o estilo CSL e os dados das referências entram no código como textos
 *     longos (bytes("...")); cada um vira a sua impressão digital (SHA-256) e o
 *     tamanho: o arquivo fica legível, e qualquer letra diferente ainda aparece;
 *   - a primeira linha (um comentário com o nome e a revisão do perfil) não
 *     entra: ela muda quando o perfil vira modelo, e não muda nada no PDF.
 */
export function paraOGabarito(codigo: string): string {
  return codigo.replace(/^\/\/ Gerado pelo Apud .*\n/, "").replace(/bytes\("((?:[^"\\]|\\.)*)"\)/g, (todo, dentro: string) =>
    dentro.length < 500 ? todo : `bytes(<sha256 ${createHash("sha256").update(dentro).digest("hex").slice(0, 32)}, ${dentro.length} caracteres>)`,
  );
}

function codigo(doc: Documento, arquivo: string, ajustes: Record<string, string> = {}, opcoes: OpcoesDoConversor = {}): string {
  const n = norma(arquivo, ajustes);
  return paraOGabarito(documentoParaTypst(doc, n.perfil, { ...opcoes, csl: n.csl }));
}

/** Um artigo de perfis/artigos, com as escolhas do autor do trabalho.json dele. */
function artigo(pasta: string) {
  const dir = join(PASTA_PERFIS, "artigos", pasta);
  const trabalho = JSON.parse(readFileSync(join(dir, "trabalho.json"), "utf8")) as { nome: string; norma: string; ajustes?: Record<string, string> };
  const referencias = JSON.parse(readFileSync(join(dir, "referencias.json"), "utf8")) as Referencia[];
  const { documento } = documentoDoTexto(readFileSync(join(dir, "artigo.md"), "utf8"), referencias, dir);
  return { documento, trabalho };
}

/** O documento de prova com outro tipo de trabalho, e a abertura mudada. */
function provaComo(mudar: (d: Documento) => Documento): Documento {
  return mudar(structuredClone(documentoDeProva().documento));
}

const resumoEmEspanhol: Resumo = {
  idioma: "es",
  titulo: "La acogida en salud mental",
  trechos: [{ texto: "Este trabajo relata una experiencia de pasantía en un servicio de salud mental." }],
  palavrasChave: ["acogida", "salud mental"],
};

export const CASOS: CasoDeCodigo[] = [
  {
    nome: "prova-abnt",
    descricao: "documento de prova em ABNT, com a abertura inteira (capa, folha de rosto, resumos, sumário...)",
    codigo: () => codigo(documentoDeProva().documento, "abnt.txt", {}, { titulo: "Documento de prova" }),
  },
  {
    nome: "prova-apa",
    descricao: "documento de prova em APA (página de título e resumos; o resto da abertura não existe na APA)",
    codigo: () => codigo(documentoDeProva().documento, "apa.txt", {}, { titulo: "Documento de prova" }),
  },
  {
    nome: "prova-abnt-previa",
    descricao: "o mesmo da prova em ABNT, como a prévia monta (com as marcas de cada bloco)",
    codigo: () => codigo(documentoDeProva().documento, "abnt.txt", {}, { titulo: "Documento de prova", marcarBlocos: true }),
  },
  {
    nome: "artigo-univali-abnt",
    descricao: "artigo da UNIVALI (ABNT), sem abertura",
    codigo: () => {
      const { documento, trabalho } = artigo("univali-abnt");
      return codigo(documento, trabalho.norma, trabalho.ajustes, { titulo: trabalho.nome });
    },
  },
  {
    nome: "artigo-revista-apa",
    descricao: "artigo da Psicologia Política (APA), com as três escolhas de revista",
    codigo: () => {
      const { documento, trabalho } = artigo("revista-apa");
      return codigo(documento, trabalho.norma, trabalho.ajustes, { titulo: trabalho.nome });
    },
  },
  {
    nome: "tcc-abnt-faculdade",
    descricao: "TCC em ABNT com resumo em espanhol e valores de faculdade trocados (fonte, recuo, alinhamento, número embaixo...)",
    codigo: () =>
      codigo(
        provaComo((d) => ({
          ...d,
          dados: { ...d.dados, tipo: "tcc" },
          abertura: { ...d.abertura, resumos: [...d.abertura.resumos, resumoEmEspanhol] },
        })),
        "abnt.txt",
        {
          "família da fonte": "Arial",
          "recuo de parágrafo": "1,5 cm",
          alinhamento: "à esquerda",
          "numeração de página, posição": "canto inferior direito",
          "título nível 2, destaque": "negrito, sublinhado",
          "ilustração, posição na página": "à esquerda",
          "ilustrações e tabelas, linhas em branco antes e depois": "0 linha",
          "citação longa, linhas em branco antes e depois": "2 linhas",
          "tabelas, espaçamento do corpo": "1,5",
          "tabelas em mais de uma página, posição das indicações": "à esquerda",
          "sumário, ligação até a página": "nenhuma",
          "folha de rosto, rótulo do orientador": "Orientadora:",
          "palavras-chave, linhas em branco antes": "0 linha",
          "referências, prenomes": "abreviados",
          "autores, quatro ou mais": "primeiro com et al.",
        },
        { titulo: "TCC de teste" },
      ),
  },
  {
    nome: "artigo-abnt-numero-no-centro",
    descricao: "artigo da UNIVALI (ABNT) com o número da página no centro, embaixo",
    codigo: () => {
      const { documento, trabalho } = artigo("univali-abnt");
      return codigo(documento, trabalho.norma, { "numeração de página, posição": "centro inferior" }, { titulo: trabalho.nome });
    },
  },
  {
    nome: "artigo-apa-sem-identificacao",
    descricao: "documento de prova como artigo APA (modo profissional), sem identificação, Arial 11 e tabela em espaço simples",
    codigo: () =>
      codigo(
        provaComo((d) => ({ ...d, dados: { ...d.dados, tipo: "artigo" }, abertura: { ...d.abertura, semIdentificacao: true } })),
        "apa.txt",
        {
          fonte: "Arial 11 pt",
          "tabelas, espaçamento do corpo": "simples",
          "número de página, distância do topo": "1,5 cm",
          "referências, prenomes": "por extenso",
        },
        { titulo: "Artigo de teste" },
      ),
  },
  {
    nome: "exemplo-universidade",
    descricao: "documento de prova com o perfil de exemplo de uma universidade (herda da ABNT)",
    codigo: () => codigo(documentoDeProva().documento, "abnt-universidade-exemplo.txt", {}, { titulo: "Documento de prova" }),
  },
];

/** O gabarito gravado de um caso, ou undefined se ainda não foi gravado. */
export function lerCodigoGravado(nome: string): string | undefined {
  try {
    return readFileSync(join(PASTA_DO_CODIGO, `${nome}.typ`), "utf8");
  } catch {
    return undefined;
  }
}

/** A primeira linha diferente entre dois códigos, para mostrar onde mudou. */
export function primeiraDiferenca(gravado: string, atual: string): string | undefined {
  if (gravado === atual) return undefined;
  const a = gravado.split("\n");
  const b = atual.split("\n");
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      const corte = (s: string | undefined) => (s === undefined ? "(fim)" : s.length > 200 ? `${s.slice(0, 200)}…` : s);
      return `linha ${i + 1}\n  gabarito: ${corte(a[i])}\n  agora:    ${corte(b[i])}`;
    }
  }
  return "só no fim do arquivo";
}
