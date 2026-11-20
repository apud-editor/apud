// Liga o perfil ao estilo CSL (o formato de estilos de citação do Zotero).
//
// No arquivo .csl, uma marca como
//     <!-- apud: referências, destaque do título -->
// fica logo antes do elemento que a regra comanda. Antes de gerar o PDF, o
// Apud troca os atributos desse elemento conforme o valor da regra no perfil.
//
// Outra marca guarda o modelo que o CSL monta, para conferência:
//     <!-- apud modelo: modelo, livro = SOBRENOME, Prenome. **Título**... -->

import type { EsquemaNorma } from "./esquema";
import type { Mensagem, PerfilResolvido } from "./tipos";
import { normalizar } from "./texto";

const MARCA = /<!--\s*apud:\s*([^>]*?)\s*-->/g;
const MARCA_DE_MODELO = /<!--\s*apud modelo:\s*([^=]+?)\s*=\s*([\s\S]*?)\s*-->/g;

export interface MarcaNoCsl {
  chave: string;
  /** Posição da marca no texto do CSL. */
  posicao: number;
}

export function listarMarcas(csl: string): MarcaNoCsl[] {
  return [...csl.matchAll(MARCA)].map((m) => ({ chave: normalizar(m[1]), posicao: m.index! }));
}

export function listarModelos(csl: string): Map<string, string> {
  const modelos = new Map<string, string>();
  for (const m of csl.matchAll(MARCA_DE_MODELO)) modelos.set(normalizar(m[1]), m[2]);
  return modelos;
}

function escaparXml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Troca, liga ou remove atributos de uma etiqueta de abertura XML. */
function ajustarAtributos(etiqueta: string, mudancas: Record<string, string | null>): string {
  const partes = etiqueta.match(/^<([\w:-]+)([\s\S]*?)(\/?)>$/);
  if (!partes) throw new Error(`não consegui ler a etiqueta ${etiqueta}`);
  const [, nome, corpo, fecha] = partes;
  const atributos: Array<[string, string]> = [...corpo.matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]);
  for (const [atributo, valor] of Object.entries(mudancas)) {
    const i = atributos.findIndex(([n]) => n === atributo);
    if (valor === null) {
      if (i >= 0) atributos.splice(i, 1);
    } else if (i >= 0) {
      atributos[i][1] = escaparXml(valor);
    } else {
      atributos.push([atributo, escaparXml(valor)]);
    }
  }
  const texto = atributos.map(([n, v]) => ` ${n}="${v}"`).join("");
  return `<${nome}${texto}${fecha}>`;
}

/**
 * Devolve uma cópia do CSL ajustada com os valores do perfil.
 * Lança um erro se uma marca não puder ser aplicada.
 */
export function aplicarPerfilNoCsl(csl: string, perfil: PerfilResolvido, esquema: EsquemaNorma): string {
  const definicoes = new Map(esquema.regras.map((d) => [d.chave, d]));
  let resultado = "";
  let cursor = 0;

  for (const marca of csl.matchAll(MARCA)) {
    const chave = normalizar(marca[1]);
    const fimDaMarca = marca.index! + marca[0].length;
    resultado += csl.slice(cursor, fimDaMarca);
    cursor = fimDaMarca;

    const definicao = definicoes.get(chave);
    const regra = perfil.regras.get(chave);
    if (!definicao?.csl || !regra) throw new Error(`a marca “${marca[1]}” não corresponde a nenhuma regra ligada ao CSL`);
    if (regra.situacao.tipo === "desligada") continue;

    // A etiqueta logo depois da marca.
    const depois = csl.slice(cursor);
    const etiqueta = depois.match(/^(\s*)(<[\w:-]+[^>]*>)/);
    if (!etiqueta) throw new Error(`depois da marca “${marca[1]}” deveria vir um elemento do CSL`);
    const [, espaco, abertura] = etiqueta;

    const ligacao = definicao.csl;
    if (ligacao.tipo === "valor") {
      resultado += espaco + ajustarAtributos(abertura, { value: regra.texto });
      cursor += etiqueta[0].length;
    } else if (ligacao.tipo === "atributos") {
      const opcao = regra.valor.tipo === "opcao" ? regra.valor.valor : regra.texto;
      const mudancas = ligacao.porOpcao[opcao];
      if (!mudancas) throw new Error(`a opção “${opcao}” de “${chave}” não tem ajuste no CSL`);
      resultado += espaco + ajustarAtributos(abertura, mudancas);
      cursor += etiqueta[0].length;
    } else if (ligacao.tipo === "meses") {
      if (regra.valor.tipo !== "meses") throw new Error("a regra dos meses precisa ter 12 abreviaturas");
      const fim = depois.indexOf("</terms>");
      if (fim < 0) throw new Error("a marca dos meses precisa vir antes de um bloco <terms>");
      const itens = regra.valor.itens;
      const bloco = depois
        .slice(0, fim)
        .replace(
          /(<term name="month-(\d\d)" form="short">)[^<]*(<\/term>)/g,
          (_, abre: string, mes: string, fecha: string) => `${abre}${escaparXml(itens[Number(mes) - 1])}${fecha}`,
        );
      resultado += bloco;
      cursor += fim;
    }
  }
  return resultado + csl.slice(cursor);
}

/** Confere se o CSL e o perfil combinam: marcas, regras ligadas e modelos. */
export function conferirCsl(
  csl: string,
  nomeDoCsl: string,
  perfil: PerfilResolvido,
  esquema: EsquemaNorma,
): Mensagem[] {
  const mensagens: Mensagem[] = [];
  const marcas = listarMarcas(csl);
  const chavesMarcadas = new Set(marcas.map((m) => m.chave));
  const definicoes = new Map(esquema.regras.map((d) => [d.chave, d]));

  for (const marca of marcas) {
    if (!definicoes.get(marca.chave)?.csl) {
      mensagens.push({
        gravidade: "erro",
        texto: `o estilo ${nomeDoCsl} tem a marca “apud: ${marca.chave}”, mas essa regra não comanda o CSL.`,
      });
    }
  }
  for (const definicao of esquema.regras) {
    if (definicao.csl && !chavesMarcadas.has(definicao.chave)) {
      mensagens.push({
        gravidade: "erro",
        linha: perfil.regras.get(definicao.chave)?.linha,
        arquivo: perfil.regras.get(definicao.chave)?.arquivo,
        texto: `a regra “${definicao.chave}” deveria comandar o estilo ${nomeDoCsl}, mas o arquivo não tem a marca <!-- apud: ${definicao.chave} -->.`,
      });
    }
  }

  const modelos = listarModelos(csl);
  for (const [chave, regra] of perfil.regras) {
    if (!chave.startsWith("modelo, ")) continue;
    const doCsl = modelos.get(chave);
    if (doCsl === undefined) {
      mensagens.push({
        gravidade: "aviso",
        linha: regra.linha,
        arquivo: regra.arquivo,
        texto: `o estilo ${nomeDoCsl} não informa como monta “${chave}”, então não deu para conferir o modelo.`,
      });
    } else if (normalizar(doCsl) !== normalizar(regra.texto)) {
      mensagens.push({
        gravidade: "aviso",
        linha: regra.linha,
        arquivo: regra.arquivo,
        texto:
          `o modelo mudou, mas quem monta a referência é o estilo ${nomeDoCsl}, que ainda segue o modelo antigo: ` +
          `“${doCsl}”. O PDF continua como antes até alguém ajustar o CSL.`,
      });
    }
  }

  if (mensagens.every((m) => m.gravidade !== "erro")) {
    try {
      aplicarPerfilNoCsl(csl, perfil, esquema);
    } catch (e) {
      mensagens.push({ gravidade: "erro", texto: `não consegui ajustar o estilo ${nomeDoCsl}: ${(e as Error).message}.` });
    }
  }
  return mensagens;
}
