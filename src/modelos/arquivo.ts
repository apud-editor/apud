// O modelo dentro do arquivo .apud (decisão 4 da v2): cada trabalho leva uma
// cópia inteira do modelo, já somada (Em branco + ABNT + ...). Assim o trabalho
// abre igual mesmo que um dia o Em branco ou a ABNT mudem; a etapa 4 vai usar
// a cópia para avisar "o modelo mudou".
//
// A cópia é JSON legível: cada valor vai como texto ("1,25 cm"), com a origem,
// a situação, o comentário e o modelo de onde veio. Ao abrir, cada valor é
// lido de novo pelo tipo da propriedade: um valor estragado recusa o arquivo.
//
//   "modelo": {
//     "nome": "ABNT", "versao": "2025", "revisao": 10, ...,
//     "cadeia": [{ "nome": "Em branco", "revisao": 1, ... }, { "nome": "ABNT", ... }],
//     "valores": { "titulos.nivel1": { "destaque": { "valor": "maiúsculas, negrito",
//                  "origem": "NBR 6024:2012 ...", "situacao": "ajustável", "de": "ABNT" } } },
//     "atalhos": { "pagina": { "margens": { ... } } }
//   }

import type { Situacao } from "../perfis/tipos";
import { atalho, propriedade } from "./elementos";
import type { IdentificacaoDoModelo, ModeloResolvido, ValorNoModelo, ValoresPorElemento } from "./tipos";

type Json = Record<string, unknown>;

const objeto = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const texto = (v: unknown): v is string => typeof v === "string";

function situacaoParaArquivo(s: Situacao): unknown {
  if (s.tipo === "confirmada") return undefined;
  if (s.tipo === "ajustavel") return "ajustável";
  if (s.tipo === "desligada") return "desligada";
  return { escolha: s.opcoes };
}

function situacaoDoArquivo(v: unknown): Situacao | null {
  if (v === undefined) return { tipo: "confirmada" };
  if (v === "ajustável") return { tipo: "ajustavel" };
  if (v === "desligada") return { tipo: "desligada" };
  if (objeto(v) && Array.isArray(v.escolha) && v.escolha.length >= 2 && v.escolha.every(texto)) return { tipo: "escolha", opcoes: [...v.escolha] };
  return null;
}

function identificacaoParaArquivo(id: IdentificacaoDoModelo): Json {
  return {
    id: id.id,
    nome: id.nome,
    ...(id.versao ? { versao: id.versao } : {}),
    revisao: id.revisao,
    dataDaRevisao: id.dataDaRevisao,
    notaDaRevisao: id.notaDaRevisao,
    ...(id.herdaDe ? { herdaDe: id.herdaDe } : {}),
  };
}

function identificacaoDoArquivo(v: unknown): IdentificacaoDoModelo | null {
  if (!objeto(v) || !texto(v.id) || !texto(v.nome) || typeof v.revisao !== "number" || !texto(v.dataDaRevisao) || !texto(v.notaDaRevisao)) return null;
  if (v.versao !== undefined && !texto(v.versao)) return null;
  let herdaDe: IdentificacaoDoModelo["herdaDe"];
  if (v.herdaDe !== undefined) {
    const h = v.herdaDe;
    if (!objeto(h) || !texto(h.nome) || typeof h.revisao !== "number" || (h.versao !== undefined && !texto(h.versao))) return null;
    herdaDe = { nome: h.nome, revisao: h.revisao, ...(h.versao ? { versao: h.versao as string } : {}) };
  }
  return {
    id: v.id,
    nome: v.nome,
    ...(v.versao ? { versao: v.versao as string } : {}),
    revisao: v.revisao,
    dataDaRevisao: v.dataDaRevisao,
    notaDaRevisao: v.notaDaRevisao,
    ...(herdaDe ? { herdaDe } : {}),
  };
}

function valoresParaArquivo(valores: ValoresPorElemento): Json {
  const saida: Json = {};
  for (const [elemento, props] of valores) {
    const doElemento: Json = {};
    for (const [nome, v] of props) {
      doElemento[nome] = {
        valor: v.texto,
        origem: v.origem,
        ...(situacaoParaArquivo(v.situacao) !== undefined ? { situacao: situacaoParaArquivo(v.situacao) } : {}),
        de: v.de,
        ...(v.nota ? { nota: v.nota } : {}),
        ...(v.atalho ? { atalho: v.atalho } : {}),
      };
    }
    saida[elemento] = doElemento;
  }
  return saida;
}

/** Os valores conferidos, ou o motivo do erro. `atalhos` diz se são os registros dos atalhos. */
function valoresDoArquivo(v: unknown, atalhos: boolean): ValoresPorElemento | string {
  if (!objeto(v)) return "faltam os valores";
  const saida: ValoresPorElemento = new Map();
  for (const [elemento, props] of Object.entries(v)) {
    if (!objeto(props)) return `os valores de “${elemento}” estão estragados`;
    const doElemento = new Map<string, ValorNoModelo>();
    for (const [nome, bruto] of Object.entries(props)) {
      let tipo;
      try {
        tipo = atalhos ? atalho(elemento, nome)?.tipo : propriedade(elemento, nome)?.tipo;
      } catch {
        return `o elemento “${elemento}” não existe neste Apud`;
      }
      if (!tipo) return `“${nome}” não existe em “${elemento}” neste Apud`;
      if (!objeto(bruto) || !texto(bruto.valor) || !texto(bruto.origem) || !texto(bruto.de)) return `o valor de “${nome}” em “${elemento}” está estragado`;
      const lido = tipo.ler(bruto.valor, nome);
      if (!lido.ok) return `o valor de “${nome}” em “${elemento}” está estragado: ${lido.erro}`;
      const situacao = situacaoDoArquivo(bruto.situacao);
      if (!situacao) return `a situação de “${nome}” em “${elemento}” está estragada`;
      if (bruto.nota !== undefined && !texto(bruto.nota)) return `o comentário de “${nome}” em “${elemento}” está estragado`;
      if (bruto.atalho !== undefined && !texto(bruto.atalho)) return `o atalho de “${nome}” em “${elemento}” está estragado`;
      doElemento.set(nome, {
        valor: lido.valor,
        texto: lido.texto,
        origem: bruto.origem,
        situacao,
        de: bruto.de,
        ...(bruto.nota ? { nota: bruto.nota as string } : {}),
        ...(bruto.atalho ? { atalho: bruto.atalho as string } : {}),
      });
    }
    saida.set(elemento, doElemento);
  }
  return saida;
}

/** A cópia do modelo, como vai para o .apud. */
export function modeloParaArquivo(m: ModeloResolvido): Json {
  return {
    ...identificacaoParaArquivo(m.identificacao),
    cadeia: m.cadeia.map(identificacaoParaArquivo),
    valores: valoresParaArquivo(m.valores),
    atalhos: valoresParaArquivo(m.atalhos),
  };
}

/** A cópia do modelo lida do .apud e conferida, ou o motivo do erro. */
export function modeloDoArquivo(v: unknown): ModeloResolvido | string {
  const identificacao = identificacaoDoArquivo(v);
  if (!identificacao || !objeto(v)) return "a cópia do modelo está estragada";
  if (!Array.isArray(v.cadeia) || !v.cadeia.length) return "a cópia do modelo está estragada (falta de onde ele vem)";
  const cadeia: IdentificacaoDoModelo[] = [];
  for (const c of v.cadeia) {
    const id = identificacaoDoArquivo(c);
    if (!id) return "a cópia do modelo está estragada (de onde ele vem)";
    cadeia.push(id);
  }
  const valores = valoresDoArquivo(v.valores, false);
  if (typeof valores === "string") return `a cópia do modelo está estragada: ${valores}`;
  const atalhos = valoresDoArquivo(v.atalhos, true);
  if (typeof atalhos === "string") return `a cópia do modelo está estragada: ${atalhos}`;
  return { identificacao, cadeia, valores, atalhos };
}
