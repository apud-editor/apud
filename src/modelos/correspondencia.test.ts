// O teste regra por regra (versão 2, etapa 1b): cada regra dos perfis da versão
// 1 está no modelo novo, no lugar certo, com o mesmo valor, a mesma origem, a
// mesma situação e o mesmo comentário. E o modelo não tem nada que não venha
// de uma regra (ou de um valor que a versão 1 tinha no código, listado).

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aplicarPerfilNoCsl, conferirPerfis, type Arquivo as ArquivoDoPerfil } from "../perfis";
import { normalizar } from "../perfis/texto";
import type { PerfilResolvido } from "../perfis/tipos";
import { conferirModelos, type Arquivo } from "./conferir";
import { destinosDe, PARTE_PARA_ELEMENTO, VALORES_QUE_ESTAVAM_NO_CODIGO } from "./correspondencia";
import { atalho, caminho, propriedade } from "./elementos";
import { valorEfetivo, valorProprio } from "./herdar";
import { lerModelo } from "./ler";
import { esquemaDeCitacoes, perfilDeCitacoes } from "./ponte";
import type { ModeloResolvido, ValorNoModelo } from "./tipos";

const RAIZ = join(import.meta.dirname, "..", "..");
const ler = (pasta: string, prefixo = ""): Arquivo[] =>
  readdirSync(join(RAIZ, pasta))
    .filter((n) => n.endsWith(".txt"))
    .map((nome) => ({ nome: prefixo + nome, conteudo: readFileSync(join(RAIZ, pasta, nome), "utf8") }));

const estilos: ArquivoDoPerfil[] = readdirSync(join(RAIZ, "perfis", "estilos")).map((nome) => ({ nome, conteudo: readFileSync(join(RAIZ, "perfis", "estilos", nome), "utf8") }));
const perfis = conferirPerfis([...ler("perfis"), ...ler("perfis/exemplos")], estilos);
const modelos = conferirModelos([...ler("modelos"), ...ler("modelos/exemplos", "exemplos/")]);

const perfil = (arquivo: string): PerfilResolvido => perfis.find((r) => r.arquivo === arquivo)!.perfil!;
const modelo = (arquivo: string): ModeloResolvido => {
  const r = modelos.find((x) => x.arquivo === arquivo)!;
  expect(r.mensagens.filter((m) => m.gravidade === "erro")).toEqual([]);
  return r.resolvido!;
};

/** Os comentários logo acima de cada regra do perfil (a leitura dos modelos serve, porque a escrita é a mesma). */
function comentarios(arquivo: string): Map<string, string> {
  const lido = lerModelo(readFileSync(join(RAIZ, "perfis", arquivo), "utf8"));
  return new Map(lido.secoes.flatMap((s) => s.valores).flatMap((v) => (v.nota ? [[normalizar(v.nome), v.nota] as const] : [])));
}

/** O valor que o modelo dá a um destino: a propriedade, ou o atalho, como escrito. */
function noModelo(m: ModeloResolvido, elemento: string, nome: string): ValorNoModelo | undefined {
  return atalho(elemento, nome) && !propriedade(elemento, nome) ? m.atalhos.get(elemento)?.get(nome) : valorProprio(m, elemento, nome);
}

const NORMAS = [
  { perfil: "abnt.txt", modelo: "abnt.txt", nome: "ABNT" },
  { perfil: "apa.txt", modelo: "apa.txt", nome: "APA" },
] as const;

describe.each(NORMAS)("$nome: do perfil da versão 1 para o modelo", (n) => {
  const v1 = perfil(n.perfil);
  const m = modelo(n.modelo);
  const notas = comentarios(n.perfil);

  it("a ficha continua o perfil: a mesma norma e versão, a revisão seguinte, e herda do Em branco", () => {
    expect(m.identificacao).toMatchObject({ nome: n.nome, versao: v1.identificacao.versao, revisao: v1.identificacao.revisao + 1 });
    expect(m.cadeia.map((c) => c.nome)).toEqual(["Em branco", n.nome]);
  });

  it("cada regra está no destino, com o mesmo valor, a mesma origem e a mesma situação", () => {
    const problemas: string[] = [];
    for (const regra of v1.regras.values()) {
      for (const destino of destinosDe(regra.chave)) {
        const onde = `“${regra.chave}” → ${caminho(destino.elemento)} › ${destino.propriedade}`;
        const v = noModelo(m, destino.elemento, destino.propriedade);
        if (!v) {
          problemas.push(`${onde}: não está no modelo`);
          continue;
        }
        if (v.de !== n.nome) problemas.push(`${onde}: o valor veio de ${v.de}, e não do modelo ${n.nome}`);
        const tipo = (propriedade(destino.elemento, destino.propriedade) ?? atalho(destino.elemento, destino.propriedade))!.tipo;
        const esperado = tipo.ler(destino.valor ?? regra.texto, destino.propriedade);
        if (!esperado.ok) problemas.push(`${onde}: o valor da versão 1 não serve: ${esperado.erro}`);
        else if (JSON.stringify(esperado.valor) !== JSON.stringify(v.valor)) problemas.push(`${onde}: valor ${v.texto}, esperado ${esperado.texto}`);
        if (v.origem !== regra.origem) problemas.push(`${onde}: origem “${v.origem}”, esperada “${regra.origem}”`);
        if (JSON.stringify(v.situacao) !== JSON.stringify(regra.situacao)) problemas.push(`${onde}: situação ${JSON.stringify(v.situacao)}, esperada ${JSON.stringify(regra.situacao)}`);
      }
    }
    expect(problemas).toEqual([]);
    expect(v1.regras.size).toBe(n.nome === "ABNT" ? 225 : 133);
  });

  it("o comentário de cada regra vai junto, na primeira linha do destino", () => {
    const problemas: string[] = [];
    for (const [chave, nota] of notas) {
      const [primeiro] = destinosDe(chave);
      const v = noModelo(m, primeiro.elemento, primeiro.propriedade);
      if (v?.nota !== nota) problemas.push(`“${chave}”: ${JSON.stringify(v?.nota)} em vez de ${JSON.stringify(nota)}`);
    }
    expect(problemas).toEqual([]);
    expect(notas.size).toBeGreaterThan(n.nome === "ABNT" ? 40 : 30);
  });

  it("fonte menor e espaço simples (ABNT) viram o tamanho e a entrelinha de cada elemento da lista", () => {
    const menor = v1.regras.get("fonte menor");
    const onde = v1.regras.get("fonte menor, onde");
    const simples = v1.regras.get("espaço simples, onde");
    if (n.nome === "APA") {
      expect([menor, onde, simples]).toEqual([undefined, undefined, undefined]);
      return;
    }
    for (const parte of onde!.valor.tipo === "lista" ? onde!.valor.itens : []) {
      expect(valorProprio(m, PARTE_PARA_ELEMENTO[parte], "tamanho")?.texto, parte).toBe(menor!.texto);
    }
    for (const parte of simples!.valor.tipo === "lista" ? simples!.valor.itens : []) {
      expect(valorProprio(m, PARTE_PARA_ELEMENTO[parte], "entrelinha")?.texto, parte).toBe("simples");
    }
  });

  it("o modelo não tem nenhum valor que não venha de uma regra da versão 1 ou do código dela", () => {
    const explicados = new Set<string>();
    const marcar = (elemento: string, nome: string) => explicados.add(`${elemento}|${nome}`);
    for (const regra of v1.regras.values()) {
      for (const d of destinosDe(regra.chave)) {
        marcar(d.elemento, d.propriedade);
        const at = atalho(d.elemento, d.propriedade);
        if (at && !propriedade(d.elemento, d.propriedade)) {
          const v = m.atalhos.get(d.elemento)!.get(d.propriedade)!;
          for (const [p] of at.expandir(v.valor, v.texto)) marcar(d.elemento, p);
        }
      }
    }
    for (const parte of Object.keys(PARTE_PARA_ELEMENTO)) {
      if ((v1.regras.get("fonte menor, onde")?.texto ?? "").includes(parte)) marcar(PARTE_PARA_ELEMENTO[parte], "tamanho");
      if ((v1.regras.get("espaço simples, onde")?.texto ?? "").includes(parte)) marcar(PARTE_PARA_ELEMENTO[parte], "entrelinha");
    }
    for (const x of VALORES_QUE_ESTAVAM_NO_CODIGO.filter((x) => x.modelo === n.nome)) {
      const v = valorProprio(m, x.elemento, x.propriedade);
      expect(v).toMatchObject({ texto: x.valor, origem: x.origem, de: n.nome });
      // A nota que o Apud escreveu pode estar quebrada em mais de uma linha no arquivo.
      expect(v?.nota?.replace(/\s+/g, " ")).toBe(x.nota);
      marcar(x.elemento, x.propriedade);
    }
    const sobrando: string[] = [];
    for (const [elemento, props] of m.valores) {
      for (const [nome, v] of props) if (v.de === n.nome && !explicados.has(`${elemento}|${nome}`)) sobrando.push(`${caminho(elemento)} › ${nome}`);
    }
    expect(sobrando).toEqual([]);
  });

  it("as citações leem do modelo as mesmas regras do perfil, e o estilo CSL sai igual", () => {
    const ponte = perfilDeCitacoes(m);
    const doPerfil = [...v1.regras.values()].filter((r) => destinosDe(r.chave).some((d) => d.elemento === "citacoes"));
    expect([...ponte.regras.keys()].sort()).toEqual(doPerfil.map((r) => r.chave).sort());
    for (const r of doPerfil) {
      const p = ponte.regras.get(r.chave)!;
      expect({ texto: p.texto, valor: p.valor, origem: p.origem, situacao: p.situacao }, r.chave).toEqual({ texto: r.texto, valor: r.valor, origem: r.origem, situacao: r.situacao });
    }
    expect(ponte.identificacao).toMatchObject({ perfil: n.nome, norma: n.nome, versao: v1.identificacao.versao });
    const csl = estilos.find((e) => e.nome === v1.regras.get("estilo csl")!.texto)!.conteudo;
    const esquema = esquemaDeCitacoes(m)!;
    expect(aplicarPerfilNoCsl(csl, ponte, esquema)).toBe(aplicarPerfilNoCsl(csl, v1, esquema));
  });
});

describe("modelo de exemplo de uma faculdade", () => {
  const v1 = perfil("abnt-universidade-exemplo.txt");
  const m = modelo("exemplos/abnt-universidade-exemplo.txt");

  it("herda da ABNT e dá os mesmos valores e situações do perfil de exemplo", () => {
    expect(m.cadeia.map((c) => c.nome)).toEqual(["Em branco", "ABNT", "ABNT – Universidade Exemplo"]);
    for (const [chave, elemento, prop] of [
      ["família da fonte", "texto", "fonte"],
      ["recuo de parágrafo", "texto", "recuo da primeira linha"],
      ["referências, prenomes", "citacoes", "referências, prenomes"],
    ] as const) {
      const r = v1.regras.get(chave)!;
      const v = valorEfetivo(m, elemento, prop)!;
      expect({ texto: v.texto, situacao: v.situacao, origem: v.origem }, chave).toEqual({ texto: r.texto, situacao: r.situacao, origem: r.origem });
    }
    expect(valorEfetivo(m, "titulos.nivel1", "destaque")).toMatchObject({ texto: "maiúsculas, negrito", de: "ABNT" });
  });

  it("as citações seguem a ABNT, com a escolha da faculdade", () => {
    const ponte = perfilDeCitacoes(m);
    expect(ponte.identificacao).toMatchObject({ perfil: "ABNT – Universidade Exemplo", norma: "ABNT", herdaDe: { perfil: "ABNT", revisao: 10 } });
    expect(ponte.regras.get("referências, prenomes")?.texto).toBe("abreviados");
    expect(ponte.regras.get("citação, rótulo da página")?.texto).toBe("p.");
  });
});
