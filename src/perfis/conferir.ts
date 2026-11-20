// Conferência dos perfis: lê cada arquivo, confere cada linha, monta os perfis
// personalizados sobre os originais e confere a ligação com o estilo CSL.
// Um perfil com erro nunca é devolvido para uso.

import { conferirCsl } from "./csl";
import type { DefinicaoRegra, EsquemaNorma } from "./esquema";
import { ESQUEMAS } from "./normas";
import { lerArquivo, type ArquivoLido, type LinhaDeRegra } from "./ler";
import { listarComE, normalizar, sugerir } from "./texto";
import type { Identificacao, Mensagem, PerfilResolvido, Regra, Situacao } from "./tipos";
import { nomeCompleto } from "./tipos";

export interface Arquivo {
  /** Nome do arquivo, como "abnt.txt" ou "estilos/abnt.csl". */
  nome: string;
  conteudo: string;
}

export interface ResultadoDaConferencia {
  arquivo: string;
  mensagens: Mensagem[];
  /** Só existe quando o perfil não tem erros. */
  perfil?: PerfilResolvido;
  /** Esquema da norma (ABNT, APA) que o perfil segue. */
  esquema?: EsquemaNorma;
}

const temErro = (mensagens: Mensagem[]) => mensagens.some((m) => m.gravidade === "erro");

/**
 * Confere todos os perfis de uma pasta de uma vez, porque um perfil
 * personalizado precisa do original para ser montado.
 */
export function conferirPerfis(perfis: Arquivo[], estilos: Arquivo[] = []): ResultadoDaConferencia[] {
  const lidos = perfis.map((a) => ({ arquivo: a, lido: lerArquivo(a.conteudo) }));
  const resultados = new Map<string, ResultadoDaConferencia>();

  // 1. Primeiro os perfis originais (sem "herda de").
  const originais = new Map<string, ResultadoDaConferencia>();
  for (const { arquivo, lido } of lidos) {
    if (lido.ficha.has("herda de")) continue;
    const resultado = conferirOriginal(arquivo.nome, lido, estilos);
    resultados.set(arquivo.nome, resultado);
    const id = fichaDeOriginal(lido);
    if (id) originais.set(chaveDoPerfil(id.perfil, id.versao), resultado);
  }

  // 2. Depois os personalizados, montados sobre o original.
  for (const { arquivo, lido } of lidos) {
    if (!lido.ficha.has("herda de")) continue;
    resultados.set(arquivo.nome, conferirPersonalizado(arquivo.nome, lido, originais, estilos));
  }

  return perfis.map((a) => resultados.get(a.nome)!);
}

const chaveDoPerfil = (perfil: string, versao: string) => `${normalizar(perfil)}|${normalizar(versao)}`;

function fichaDeOriginal(lido: ArquivoLido): { perfil: string; versao: string } | undefined {
  const perfil = lido.ficha.get("perfil")?.valor;
  const versao = lido.ficha.get("versão")?.valor;
  return perfil && versao ? { perfil, versao } : undefined;
}

// ---------------------------------------------------------------------------
// Ficha de identificação

function conferirFicha(lido: ArquivoLido, personalizado: boolean, mensagens: Mensagem[]) {
  const { ficha } = lido;
  const falta = (campo: string, exemplo: string) =>
    mensagens.push({
      gravidade: "erro",
      texto: `falta o campo “${campo}” no começo do arquivo (ex.: ${exemplo}).`,
    });

  const perfil = ficha.get("perfil");
  if (!perfil?.valor) falta("perfil", personalizado ? "perfil: ABNT – Universidade X" : "perfil: ABNT");

  const versao = ficha.get("versão");
  if (personalizado && versao) {
    mensagens.push({
      gravidade: "erro",
      linha: versao.linha,
      texto: "um perfil que herda de outro não tem “versão”: ela vem do original, no campo “herda de”.",
    });
  } else if (!personalizado && !versao?.valor) {
    falta("versão", "versão: 2025");
  }

  let revisao = 0;
  const campoRevisao = ficha.get("revisão");
  if (!campoRevisao) falta("revisão", "revisão: 1");
  else if (!/^\d+$/.test(campoRevisao.valor) || Number(campoRevisao.valor) < 1) {
    mensagens.push({
      gravidade: "erro",
      linha: campoRevisao.linha,
      texto: "a revisão precisa ser um número inteiro a partir de 1, como “revisão: 2”.",
    });
  } else revisao = Number(campoRevisao.valor);

  const data = ficha.get("data da revisão");
  if (!data) falta("data da revisão", "data da revisão: 20/11/2026");
  else if (!dataValida(data.valor)) {
    mensagens.push({
      gravidade: "erro",
      linha: data.linha,
      texto: `a data da revisão precisa estar no formato dia/mês/ano, como “20/11/2026”.`,
    });
  }

  const nota = ficha.get("nota da revisão");
  if (!nota?.valor) falta("nota da revisão", "nota da revisão: o que mudou nesta revisão");

  return {
    perfil: perfil?.valor ?? "",
    versao: versao?.valor ?? "",
    revisao,
    dataDaRevisao: data?.valor ?? "",
    notaDaRevisao: nota?.valor ?? "",
  };
}

function dataValida(texto: string): boolean {
  const partes = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!partes) return false;
  const [dia, mes, ano] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const d = new Date(ano, mes - 1, dia);
  return d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia;
}

// ---------------------------------------------------------------------------
// Regras

function lerSituacao(
  texto: string | undefined,
  definicao: DefinicaoRegra,
  nome: string,
): { ok: true; situacao: Situacao | undefined } | { ok: false; erro: string } {
  if (texto === undefined) return { ok: true, situacao: undefined };
  const t = normalizar(texto);
  if (t === "faculdade") return { ok: true, situacao: { tipo: "faculdade" } };
  if (t === "desligada") return { ok: true, situacao: { tipo: "desligada" } };
  const escolha = texto.trim().match(/^escolha\s*:\s*(.*)$/i);
  if (escolha) {
    if (!definicao.tipo.permiteEscolha) {
      return { ok: false, erro: `a regra “${nome}” não pode ser uma escolha, porque o valor já é uma lista.` };
    }
    // "a, b, c" ou "a, b ou c". A vírgula de "1,5" não separa, porque não tem espaço depois.
    const escritas = escolha[1].split(/,\s+|\s+ou\s+/).map((o) => o.trim()).filter(Boolean);
    if (escritas.length < 2) {
      return { ok: false, erro: `uma escolha precisa de pelo menos duas opções, separadas por vírgula.` };
    }
    const opcoes: string[] = [];
    for (const escrita of escritas) {
      const lida = definicao.tipo.ler(escrita, nome);
      if (!lida.ok) return { ok: false, erro: `na escolha, ${lida.erro}` };
      if (opcoes.includes(lida.texto)) return { ok: false, erro: `a opção “${lida.texto}” aparece duas vezes na escolha.` };
      opcoes.push(lida.texto);
    }
    return { ok: true, situacao: { tipo: "escolha", opcoes } };
  }
  return {
    ok: false,
    erro: `“${texto.trim()}” não é uma situação conhecida. Use “faculdade”, “desligada” ou “escolha: opção 1, opção 2”.`,
  };
}

/**
 * Confere as linhas de regra contra o esquema. Nos originais todas as regras
 * são obrigatórias; nos personalizados só aparecem as que mudam.
 */
function conferirRegras(
  linhas: LinhaDeRegra[],
  esquema: EsquemaNorma,
  arquivo: string,
  mensagens: Mensagem[],
  original?: PerfilResolvido,
): Map<string, Regra> {
  const definicoes = new Map(esquema.regras.map((d) => [d.chave, d]));
  const regras = new Map<string, Regra>();
  const vistas = new Map<string, number>();
  const erro = (linha: number, texto: string) => mensagens.push({ gravidade: "erro", linha, texto });

  for (const linha of linhas) {
    const definicao = definicoes.get(linha.chave);
    if (!definicao) {
      const parecida = sugerir(linha.chave, [...definicoes.keys()]);
      const dica = parecida ? ` Você quis dizer “${parecida}”?` : "";
      erro(linha.linha, `não conheço a regra “${linha.nomeEscrito}” na norma ${esquema.norma}.${dica}`);
      continue;
    }
    if (vistas.has(linha.chave)) {
      erro(
        linha.linha,
        `a regra “${linha.nomeEscrito}” já apareceu na linha ${vistas.get(linha.chave)}. Cada regra aparece uma vez só.`,
      );
      continue;
    }
    vistas.set(linha.chave, linha.linha);

    const lido = definicao.tipo.ler(linha.valor, linha.nomeEscrito);
    if (!lido.ok) {
      erro(linha.linha, lido.erro);
      continue;
    }
    const situacaoLida = lerSituacao(linha.situacao, definicao, linha.nomeEscrito);
    if (!situacaoLida.ok) {
      erro(linha.linha, situacaoLida.erro);
      continue;
    }
    // Sem situação escrita: no original é "confirmada"; no personalizado vem do original.
    const situacao: Situacao = situacaoLida.situacao ??
      original?.regras.get(linha.chave)?.situacao ?? { tipo: "confirmada" };

    if (situacao.tipo === "escolha" && !situacao.opcoes.includes(lido.texto)) {
      const deOnde = situacaoLida.situacao ? "da escolha" : "da escolha do perfil original";
      erro(
        linha.linha,
        `o valor “${lido.texto}” não está entre as opções ${deOnde} (${listarComE(situacao.opcoes)}). ` +
          `O valor da linha é o padrão e precisa ser uma das opções.`,
      );
      continue;
    }

    regras.set(linha.chave, {
      chave: linha.chave,
      valor: lido.valor,
      texto: lido.texto,
      origem: linha.origem,
      situacao,
      arquivo,
      linha: linha.linha,
    });
  }

  if (!original) {
    for (const definicao of esquema.regras) {
      if (!vistas.has(definicao.chave)) {
        mensagens.push({
          gravidade: "erro",
          texto: `falta a regra “${definicao.chave}” (seção “${definicao.secao}”). Todas as regras precisam estar no perfil original.`,
        });
      }
    }
  }
  return regras;
}

/** Põe as regras na ordem do esquema, que é a ordem do checklist. */
function ordenar(regras: Map<string, Regra>, esquema: EsquemaNorma): Map<string, Regra> {
  const ordenado = new Map<string, Regra>();
  for (const d of esquema.regras) {
    const r = regras.get(d.chave);
    if (r) ordenado.set(d.chave, r);
  }
  return ordenado;
}

/** Conferências que envolvem mais de uma regra. */
function conferirCombinacoes(perfil: PerfilResolvido, mensagens: Mensagem[]) {
  const medida = (chave: string) => {
    const r = perfil.regras.get(chave);
    return r?.valor.tipo === "medida" ? { numero: r.valor.numero, regra: r } : undefined;
  };
  const tamanho = medida("tamanho da fonte");
  const menor = medida("fonte menor");
  if (tamanho && menor && menor.numero >= tamanho.numero) {
    mensagens.push({
      gravidade: "erro",
      linha: menor.regra.linha,
      texto: `a fonte menor (${menor.regra.texto}) precisa ser menor que o tamanho da fonte do texto (${tamanho.regra.texto}).`,
    });
  }
}

function conferirEstilo(
  arquivo: string,
  perfil: PerfilResolvido,
  esquema: EsquemaNorma,
  estilos: Arquivo[],
  mensagens: Mensagem[],
) {
  if (estilos.length === 0) return;
  const regra = perfil.regras.get("estilo csl");
  if (!regra || regra.valor.tipo !== "texto") return;
  const nome = regra.valor.valor;
  const estilo = estilos.find((e) => e.nome.split("/").pop() === nome);
  if (!estilo) {
    mensagens.push({
      gravidade: "erro",
      linha: regra.linha,
      texto: `não achei o arquivo “${nome}” na pasta perfis/estilos.`,
    });
    return;
  }
  for (const m of conferirCsl(estilo.conteudo, nome, perfil, esquema)) {
    if (!m.arquivo || m.arquivo === arquivo) {
      mensagens.push({ ...m, arquivo: undefined });
    } else if (m.gravidade === "erro") {
      // A regra veio do perfil original: o aviso já aparece lá; o erro aponta para lá.
      mensagens.push({ ...m, texto: `no perfil original (${m.arquivo}, linha ${m.linha}): ${m.texto}`, linha: undefined, arquivo: undefined });
    }
  }
}

// ---------------------------------------------------------------------------
// Perfil original

function conferirOriginal(nome: string, lido: ArquivoLido, estilos: Arquivo[]): ResultadoDaConferencia {
  const mensagens = [...lido.mensagens];
  const ficha = conferirFicha(lido, false, mensagens);
  const esquema = ESQUEMAS.get(normalizar(ficha.perfil));
  if (!esquema) {
    if (ficha.perfil) {
      mensagens.push({
        gravidade: "erro",
        linha: lido.ficha.get("perfil")?.linha,
        texto:
          `não conheço a norma “${ficha.perfil}”. O Apud conhece ${listarComE([...ESQUEMAS.values()].map((e) => e.norma))}. ` +
          `Se este é um perfil personalizado, diga de quem ele herda, como “herda de: ABNT 2025, revisão 1”.`,
      });
    }
    return { arquivo: nome, mensagens };
  }

  const regras = conferirRegras(lido.regras, esquema, nome, mensagens);
  const identificacao: Identificacao = { ...ficha, perfil: esquema.norma, norma: esquema.norma };
  const perfil: PerfilResolvido = { identificacao, regras: ordenar(regras, esquema) };
  if (!temErro(mensagens)) {
    conferirCombinacoes(perfil, mensagens);
    conferirEstilo(nome, perfil, esquema, estilos, mensagens);
  }
  return { arquivo: nome, mensagens, esquema, perfil: temErro(mensagens) ? undefined : perfil };
}

// ---------------------------------------------------------------------------
// Perfil personalizado (herança)

function conferirPersonalizado(
  nome: string,
  lido: ArquivoLido,
  originais: Map<string, ResultadoDaConferencia>,
  estilos: Arquivo[],
): ResultadoDaConferencia {
  const mensagens = [...lido.mensagens];
  const ficha = conferirFicha(lido, true, mensagens);
  const campo = lido.ficha.get("herda de")!;

  const partes = campo.valor.match(/^(.+?)\s+(\S+)\s*,\s*revisão\s+(\d+)$/i);
  if (!partes) {
    mensagens.push({
      gravidade: "erro",
      linha: campo.linha,
      texto: `escreva de quem o perfil herda com o nome, a versão e a revisão do original, como “herda de: ABNT 2025, revisão 1”.`,
    });
    return { arquivo: nome, mensagens };
  }
  const [, perfilOriginal, versaoOriginal, revisaoTexto] = partes;
  const revisaoOriginal = Number(revisaoTexto);

  const base = originais.get(chaveDoPerfil(perfilOriginal, versaoOriginal));
  if (!base) {
    const disponiveis = [...originais.values()]
      .map((r) => r.perfil && nomeCompleto(r.perfil.identificacao).replace(/, revisão \d+$/, ""))
      .filter((n): n is string => Boolean(n));
    mensagens.push({
      gravidade: "erro",
      linha: campo.linha,
      texto:
        `não achei o perfil “${perfilOriginal} ${versaoOriginal}” na pasta de perfis.` +
        (disponiveis.length ? ` Perfis disponíveis: ${listarComE(disponiveis)}.` : ""),
    });
    return { arquivo: nome, mensagens };
  }
  if (!base.perfil || !base.esquema) {
    mensagens.push({
      gravidade: "erro",
      linha: campo.linha,
      texto: `o perfil original “${perfilOriginal} ${versaoOriginal}” tem erros. Corrija o arquivo ${base.arquivo} primeiro.`,
    });
    return { arquivo: nome, mensagens };
  }

  const original = base.perfil;
  if (normalizar(ficha.perfil) === normalizar(original.identificacao.perfil)) {
    mensagens.push({
      gravidade: "erro",
      linha: lido.ficha.get("perfil")?.linha,
      texto: `dê ao perfil personalizado um nome diferente do original, como “${original.identificacao.perfil} – Universidade X”.`,
    });
  }
  if (revisaoOriginal !== original.identificacao.revisao) {
    mensagens.push({
      gravidade: "aviso",
      linha: campo.linha,
      texto:
        `este perfil foi feito sobre a revisão ${revisaoOriginal} de ${perfilOriginal} ${versaoOriginal}, ` +
        `e o original está na revisão ${original.identificacao.revisao} (“${original.identificacao.notaDaRevisao}”). ` +
        `Confira se as suas mudanças continuam valendo e depois atualize o número em “herda de”.`,
    });
  }

  const proprias = conferirRegras(lido.regras, base.esquema, nome, mensagens, original);
  const regras = new Map(original.regras);
  for (const [chave, regra] of proprias) regras.set(chave, regra);

  const identificacao: Identificacao = {
    ...ficha,
    norma: original.identificacao.norma,
    versao: original.identificacao.versao,
    herdaDe: { perfil: perfilOriginal, versao: versaoOriginal, revisao: revisaoOriginal },
  };
  const perfil: PerfilResolvido = { identificacao, regras: ordenar(regras, base.esquema) };
  if (!temErro(mensagens)) {
    conferirCombinacoes(perfil, mensagens);
    conferirEstilo(nome, perfil, base.esquema, estilos, mensagens);
  }
  return { arquivo: nome, mensagens, esquema: base.esquema, perfil: temErro(mensagens) ? undefined : perfil };
}
