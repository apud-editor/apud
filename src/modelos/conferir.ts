// Conferência dos modelos: lê cada arquivo, confere cada linha contra a árvore
// de elementos, monta a cadeia de herança (Em branco › ABNT › faculdade) e
// confere que o Em branco dá um valor a tudo o que o Apud aplica.
// Um modelo com erro nunca é devolvido para uso.

import { listarComE, normalizar, sugerir } from "../perfis/texto";
import type { TipoValor } from "../perfis/valores";
import { atalho, caminho, ELEMENTOS, elementoPeloCaminho, nomesPossiveis, propriedade, sugerirElemento } from "./elementos";
import { resolver, valorEfetivo } from "./herdar";
import { lerModelo, type LinhaDeValor, type ModeloLido } from "./ler";
import type { IdentificacaoDoModelo, Mensagem, Modelo, ModeloResolvido, Situacao, ValorNoModelo, ValoresPorElemento } from "./tipos";

export interface Arquivo {
  /** Nome do arquivo, como "abnt.txt". */
  nome: string;
  conteudo: string;
}

export interface ResultadoDaConferencia {
  arquivo: string;
  mensagens: Mensagem[];
  /** Só existe quando o modelo não tem erros: o que ele mesmo escreve. */
  modelo?: Modelo;
  /** Só existe quando o modelo e todos os de cima não têm erros: o modelo somado aos de cima. */
  resolvido?: ModeloResolvido;
}

const temErro = (mensagens: Mensagem[]) => mensagens.some((m) => m.gravidade === "erro");

/** "Em branco" → "em-branco"; "ABNT – Universidade X" → "abnt-universidade-x". */
export function idDoModelo(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Confere todos os modelos de uma vez, porque cada um precisa dos de cima
 * para ser somado. Devolve um resultado por arquivo, na mesma ordem.
 */
export function conferirModelos(arquivos: Arquivo[]): ResultadoDaConferencia[] {
  const resultados = arquivos.map((a) => conferirUm(a));

  // A cadeia de herança, pelo nome do modelo.
  const porNome = new Map<string, ResultadoDaConferencia>();
  for (const r of resultados) {
    if (!r.modelo) continue;
    const chave = normalizar(r.modelo.identificacao.nome);
    const outro = porNome.get(chave);
    if (outro) {
      r.mensagens.push({ gravidade: "erro", texto: `já existe outro modelo chamado “${r.modelo.identificacao.nome}” (${outro.arquivo}).` });
      r.modelo = undefined;
      continue;
    }
    porNome.set(chave, r);
  }

  const cadeiaDe = (r: ResultadoDaConferencia, vistos: string[] = []): Modelo[] | string => {
    const m = r.modelo!;
    const herda = m.identificacao.herdaDe;
    if (!herda) return [m];
    if (vistos.includes(r.arquivo)) return `a herança dá uma volta e chega de novo em ${r.arquivo}.`;
    const pai = porNome.get(normalizar(herda.nome));
    if (!pai) return `não achei o modelo “${herda.nome}”, de quem este herda.`;
    if (!pai.modelo || temErro(pai.mensagens)) return `o modelo “${herda.nome}” (${pai.arquivo}), de quem este herda, tem erros.`;
    const acima = cadeiaDe(pai, [...vistos, r.arquivo]);
    if (typeof acima === "string") return acima;
    return [...acima, m];
  };

  for (const r of resultados) {
    if (!r.modelo || temErro(r.mensagens)) continue;
    const cadeia = cadeiaDe(r);
    if (typeof cadeia === "string") {
      r.mensagens.push({ gravidade: "erro", linha: undefined, texto: cadeia });
      continue;
    }
    const herda = r.modelo.identificacao.herdaDe;
    if (herda) {
      const pai = cadeia[cadeia.length - 2].identificacao;
      if (herda.versao && pai.versao && normalizar(herda.versao) !== normalizar(pai.versao)) {
        r.mensagens.push({ gravidade: "erro", texto: `este modelo herda de “${herda.nome} ${herda.versao}”, mas o modelo ${pai.nome} é da versão ${pai.versao}.` });
        continue;
      }
      if (herda.revisao !== pai.revisao) {
        r.mensagens.push({
          gravidade: "aviso",
          texto:
            `este modelo foi feito sobre a revisão ${herda.revisao} de ${pai.nome}, que agora está na revisão ${pai.revisao}. ` +
            `Confira se as mudanças deste modelo continuam valendo e depois atualize o número em “herda de”.`,
        });
      }
    } else {
      conferirRaiz(r.modelo, r.mensagens);
      if (temErro(r.mensagens)) continue;
    }
    r.resolvido = resolver(cadeia);
  }
  return resultados;
}

// ---------------------------------------------------------------------------
// Um arquivo

function conferirUm(arquivo: Arquivo): ResultadoDaConferencia {
  const lido = lerModelo(arquivo.conteudo);
  const mensagens = [...lido.mensagens];
  const identificacao = conferirFicha(lido, mensagens);
  const { diferencas, atalhos, notasDosElementos } = conferirSecoes(lido, identificacao?.nome ?? "", arquivo.nome, mensagens);
  if (!identificacao || temErro(mensagens)) return { arquivo: arquivo.nome, mensagens };
  return { arquivo: arquivo.nome, mensagens, modelo: { identificacao, diferencas, atalhos, notasDosElementos } };
}

function conferirFicha(lido: ModeloLido, mensagens: Mensagem[]): IdentificacaoDoModelo | undefined {
  const { ficha } = lido;
  const falta = (campo: string, exemplo: string) =>
    mensagens.push({ gravidade: "erro", texto: `falta o campo “${campo}” no começo do arquivo (ex.: ${exemplo}).` });

  const nome = ficha.get("modelo")?.valor;
  if (!nome) falta("modelo", "modelo: ABNT");

  const revisaoLida = ficha.get("revisão");
  let revisao = 0;
  if (!revisaoLida) falta("revisão", "revisão: 1");
  else if (!/^\d+$/.test(revisaoLida.valor) || Number(revisaoLida.valor) < 1) {
    mensagens.push({ gravidade: "erro", linha: revisaoLida.linha, texto: "a revisão precisa ser um número inteiro, como 1, 2 ou 3." });
  } else revisao = Number(revisaoLida.valor);

  const data = ficha.get("data da revisão");
  if (!data) falta("data da revisão", "data da revisão: 24/11/2026");
  else if (!dataValida(data.valor)) {
    mensagens.push({ gravidade: "erro", linha: data.linha, texto: "a data da revisão precisa estar no formato dia/mês/ano, como “24/11/2026”." });
  }

  const nota = ficha.get("nota da revisão");
  if (!nota?.valor) falta("nota da revisão", "nota da revisão: o que mudou nesta revisão");

  let herdaDe: IdentificacaoDoModelo["herdaDe"];
  const herda = ficha.get("herda de");
  if (herda) {
    const m = herda.valor.match(/^(.+?)(?:\s+(\S+))?\s*,\s*revisão\s+(\d+)$/i);
    if (!m) {
      mensagens.push({
        gravidade: "erro",
        linha: herda.linha,
        texto: "escreva de quem o modelo herda com o nome, a versão (se houver) e a revisão, como “herda de: ABNT 2025, revisão 10” ou “herda de: Em branco, revisão 1”.",
      });
    } else {
      // "ABNT 2025": a última palavra é a versão quando tem número; "Em branco" não tem versão.
      const [, nomeLido, talvezVersao, rev] = m;
      const temVersao = talvezVersao && /\d/.test(talvezVersao);
      herdaDe = {
        nome: temVersao ? nomeLido : `${nomeLido}${talvezVersao ? ` ${talvezVersao}` : ""}`,
        ...(temVersao ? { versao: talvezVersao } : {}),
        revisao: Number(rev),
      };
    }
  }

  if (!nome || temErro(mensagens)) return undefined;
  const versao = ficha.get("versão")?.valor;
  return {
    id: idDoModelo(nome),
    nome,
    ...(versao ? { versao } : {}),
    revisao,
    dataDaRevisao: data!.valor,
    notaDaRevisao: nota!.valor,
    ...(herdaDe ? { herdaDe } : {}),
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
// Seções e valores

/** A situação escrita depois da segunda barra. Sem situação: confirmada. */
export function lerSituacao(texto: string | undefined, tipo: TipoValor, nome: string): { ok: true; situacao: Situacao } | { ok: false; erro: string } {
  if (texto === undefined) return { ok: true, situacao: { tipo: "confirmada" } };
  const t = normalizar(texto);
  if (t === "faculdade") return { ok: true, situacao: { tipo: "faculdade" } };
  if (t === "desligada") return { ok: true, situacao: { tipo: "desligada" } };
  const escolha = texto.trim().match(/^escolha\s*:\s*(.*)$/i);
  if (escolha) {
    if (!tipo.permiteEscolha) return { ok: false, erro: `“${nome}” não pode ser uma escolha, porque o valor já é uma lista.` };
    // "a, b, c" ou "a, b ou c". A vírgula de "1,5" não separa, porque não tem espaço depois.
    const escritas = escolha[1].split(/,\s+|\s+ou\s+/).map((o) => o.trim()).filter(Boolean);
    if (escritas.length < 2) return { ok: false, erro: "uma escolha precisa de pelo menos duas opções, separadas por vírgula." };
    const opcoes: string[] = [];
    for (const escrita of escritas) {
      const lida = tipo.ler(escrita, nome);
      if (!lida.ok) return { ok: false, erro: `na escolha, ${lida.erro}` };
      if (opcoes.includes(lida.texto)) return { ok: false, erro: `a opção “${lida.texto}” aparece duas vezes na escolha.` };
      opcoes.push(lida.texto);
    }
    return { ok: true, situacao: { tipo: "escolha", opcoes } };
  }
  return { ok: false, erro: `“${texto.trim()}” não é uma situação conhecida. Use “faculdade”, “desligada” ou “escolha: opção 1, opção 2”.` };
}

function conferirSecoes(lido: ModeloLido, nomeDoModelo: string, arquivo: string, mensagens: Mensagem[]) {
  const diferencas: ValoresPorElemento = new Map();
  const atalhos: ValoresPorElemento = new Map();
  const notasDosElementos = new Map<string, string>();
  const erro = (linha: number, texto: string) => mensagens.push({ gravidade: "erro", linha, texto });
  const secoesVistas = new Map<string, number>();

  for (const secao of lido.secoes) {
    const el = elementoPeloCaminho(secao.caminho);
    if (!el) {
      const parecido = sugerirElemento(secao.caminho);
      erro(secao.linha, `não conheço o elemento “${secao.caminho}”.${parecido ? ` Você quis dizer “${parecido}”?` : ""}`);
      continue;
    }
    if (secoesVistas.has(el.id)) {
      erro(secao.linha, `a seção “${caminho(el.id)}” já apareceu na linha ${secoesVistas.get(el.id)}. Junte as linhas numa seção só.`);
      continue;
    }
    secoesVistas.set(el.id, secao.linha);
    if (secao.nota) notasDosElementos.set(el.id, secao.nota);

    const valores = new Map<string, ValorNoModelo>();
    const atalhosDaSecao = new Map<string, ValorNoModelo>();
    const vistas = new Map<string, { linha: number; deAtalho?: string }>();

    const registrar = (nome: string, linha: number, deAtalho?: string): boolean => {
      const chave = normalizar(nome);
      const antes = vistas.get(chave);
      if (antes) {
        const como = antes.deAtalho ? `pelo atalho “${antes.deAtalho}”, na linha ${antes.linha}` : `na linha ${antes.linha}`;
        erro(linha, `“${nome}” já recebeu um valor ${como}. Cada propriedade aparece uma vez em cada elemento.`);
        return false;
      }
      vistas.set(chave, { linha, deAtalho });
      return true;
    };

    for (const l of secao.valores) {
      const def = propriedade(el.id, l.nome);
      const at = def ? undefined : atalho(el.id, l.nome);
      if (!def && !at) {
        const parecido = sugerir(l.nome, nomesPossiveis(el.id));
        erro(l.linha, `o elemento “${caminho(el.id)}” não tem “${l.nome}”.${parecido ? ` Você quis dizer “${parecido}”?` : ""}`);
        continue;
      }
      const tipo = def?.tipo ?? at!.tipo;
      const nome = def?.nome ?? at!.nome;
      const lido = lerValor(l, tipo, nome);
      if (!lido.ok) {
        erro(l.linha, lido.erro);
        continue;
      }
      const base = { origem: l.origem, situacao: lido.situacao, de: nomeDoModelo, arquivo, linha: l.linha, ...(l.nota ? { nota: l.nota } : {}) };
      if (def) {
        if (registrar(def.nome, l.linha)) valores.set(def.nome, { valor: lido.valor, texto: lido.texto, ...base });
        continue;
      }
      // Atalho: escreve cada propriedade, com a mesma origem e a mesma situação.
      atalhosDaSecao.set(at!.nome, { valor: lido.valor, texto: lido.texto, ...base });
      for (const [prop, texto] of at!.expandir(lido.valor, lido.texto)) {
        const defProp = propriedade(el.id, prop)!;
        const lidoProp = defProp.tipo.ler(texto, defProp.nome);
        if (!lidoProp.ok) throw new Error(`o atalho “${at!.nome}” escreveu um valor que “${prop}” não aceita: ${lidoProp.erro}`);
        if (!registrar(defProp.nome, l.linha, at!.nome)) continue;
        // A escolha de um atalho é de pares (Arial 11, Times 12): só se escolhe pelo
        // atalho, nunca uma propriedade sozinha. Nelas, o valor fica como confirmado.
        const situacao: Situacao = lido.situacao.tipo === "escolha" ? { tipo: "confirmada" } : lido.situacao;
        valores.set(defProp.nome, { valor: lidoProp.valor, texto: lidoProp.texto, ...base, situacao, atalho: at!.nome });
      }
    }
    if (valores.size) diferencas.set(el.id, valores);
    if (atalhosDaSecao.size) atalhos.set(el.id, atalhosDaSecao);
  }
  return { diferencas, atalhos, notasDosElementos };
}

function lerValor(l: LinhaDeValor, tipo: TipoValor, nome: string) {
  const lido = tipo.ler(l.valor, nome);
  if (!lido.ok) return lido;
  const s = lerSituacao(l.situacao, tipo, nome);
  if (!s.ok) return { ok: false as const, erro: s.erro };
  if (s.situacao.tipo === "escolha" && !s.situacao.opcoes.includes(lido.texto)) {
    return {
      ok: false as const,
      erro: `o valor “${lido.texto}” não está entre as opções da escolha (${listarComE(s.situacao.opcoes)}). O valor da linha é o padrão e precisa ser uma das opções.`,
    };
  }
  return { ok: true as const, valor: lido.valor, texto: lido.texto, situacao: s.situacao };
}

// ---------------------------------------------------------------------------
// A raiz (Em branco)

/**
 * A raiz dá um valor a tudo o que o Apud aplica: toda propriedade de aparência,
 * montagem e opções de todo elemento que não está guardado para depois. Assim,
 * nenhum valor de formatação precisa ficar escrito no código.
 */
function conferirRaiz(modelo: Modelo, mensagens: Mensagem[]) {
  const resolvido = resolver([modelo]);
  for (const el of ELEMENTOS) {
    if (el.reservado) continue;
    for (const p of el.propriedades) {
      if (p.grupo === "norma" || p.grupo === "citações") continue;
      if (!valorEfetivo(resolvido, el.id, p.nome)) {
        mensagens.push({
          gravidade: "erro",
          texto: `o modelo ${modelo.identificacao.nome} é a raiz (não herda de ninguém) e precisa dar um valor a “${p.nome}” em “${caminho(el.id)}” (ou a um elemento de cima).`,
        });
      }
    }
  }
}
