// O motor Typst, rodando separado da tela (um "worker"): montar as páginas de
// um trabalho longo leva um tempo, e a digitação não pode travar enquanto isso.

import { createTypstCompiler, createTypstRenderer, initOptions, loadFonts } from "@myriaddreamin/typst.ts";
import compiladorWasm from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url";
import renderizadorWasm from "@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url";
import type { ArquivoDoTypst } from "./elementos";
import type { PosicaoDoBloco } from "../telas/acompanhar";

export type Pedido =
  | { tipo: "iniciar"; fontes: Uint8Array[] }
  | { tipo: "previa"; id: number; typst: string; arquivos: ArquivoDoTypst[] }
  | { tipo: "pdf"; id: number; typst: string; arquivos: ArquivoDoTypst[] };

export type Resposta =
  | { tipo: "pronto" }
  | { tipo: "previa"; id: number; svg: string; posicoes: PosicaoDoBloco[] }
  | { tipo: "pdf"; id: number; pdf: Uint8Array }
  | { tipo: "erro"; id: number | null; mensagem: string };

const compilador = createTypstCompiler();
const renderizador = createTypstRenderer();
let pronto: Promise<void> | null = null;

const ARQUIVO = "/trabalho.typ";

function mensagemDoTypst(diagnosticos: unknown[] | undefined): string {
  const linhas = (diagnosticos ?? []).map((d) => (typeof d === "string" ? d : JSON.stringify(d)));
  return linhas.length ? linhas.join("\n") : "o Typst não conseguiu montar as páginas";
}

async function compilar(typst: string, arquivos: ArquivoDoTypst[], formato: 0 | 1): Promise<Uint8Array> {
  // As imagens das figuras ficam guardadas no motor: cada uma chega uma vez só (motor.ts).
  for (const a of arquivos) compilador.mapShadow(a.caminho, a.dados);
  compilador.addSource(ARQUIVO, typst);
  const r = await compilador.compile({ mainFilePath: ARQUIVO, format: formato, diagnostics: "unix" });
  if (!r.result) throw new Error(mensagemDoTypst(r.diagnostics));
  return r.result;
}

/** O que o motor devolve da montagem: um resultado ou as mensagens de erro. */
type Montagem = { result?: Uint8Array; diagnostics?: unknown[] };

/**
 * A prévia: as páginas no formato vetorial e onde cada bloco do texto ficou
 * (página e altura), pelas marcas que o conversor pôs. As duas coisas saem da
 * mesma montagem. Se a consulta das marcas falhar, a prévia só não acompanha o
 * cursor: nada de erro.
 */
async function montarPrevia(typst: string, arquivos: ArquivoDoTypst[]): Promise<{ vetor: Uint8Array; posicoes: PosicaoDoBloco[] }> {
  for (const a of arquivos) compilador.mapShadow(a.caminho, a.dados);
  compilador.addSource(ARQUIVO, typst);
  return compilador.runWithWorld({ mainFilePath: ARQUIVO }, async (mundo) => {
    const r = mundo.vector({ diagnostics: "unix" }) as Montagem;
    if (!r.result) throw new Error(mensagemDoTypst(r.diagnostics));
    let posicoes: PosicaoDoBloco[] = [];
    try {
      const lista: unknown = await mundo.query({ selector: "<apud-posicoes>", field: "value" });
      const primeira = Array.isArray(lista) ? lista[0] : undefined;
      if (Array.isArray(primeira)) posicoes = primeira as PosicaoDoBloco[];
    } catch {
      // Sem as marcas: a prévia não acompanha o cursor.
    }
    return { vetor: r.result, posicoes };
  });
}

self.onmessage = async (e: MessageEvent<Pedido>) => {
  const p = e.data;
  const responder = (r: Resposta, transferir: Transferable[] = []) =>
    (self as unknown as Worker).postMessage(r, transferir);
  try {
    if (p.tipo === "iniciar") {
      pronto = Promise.all([
        compilador.init({
          getModule: () => compiladorWasm,
          // Sem internet: as fontes vêm do programa e do Windows, nunca de um servidor.
          beforeBuild: [initOptions.disableDefaultFontAssets(), loadFonts(p.fontes)],
        }),
        renderizador.init({ getModule: () => renderizadorWasm }),
      ]).then(() => undefined);
      await pronto;
      responder({ tipo: "pronto" });
      return;
    }
    if (!pronto) throw new Error("o motor ainda não foi iniciado");
    await pronto;
    if (p.tipo === "previa") {
      // 0 = formato "vetorial", que o renderizador transforma nas páginas da prévia.
      const { vetor, posicoes } = await montarPrevia(p.typst, p.arquivos);
      // Só o desenho das páginas: sem os scripts de interação do Typst.
      const svg = await renderizador.renderSvg({
        format: "vector",
        artifactContent: vetor,
        data_selection: { body: true, defs: true, css: true, js: false },
      });
      responder({ tipo: "previa", id: p.id, svg, posicoes });
    } else {
      const pdf = await compilar(p.typst, p.arquivos, 1);
      responder({ tipo: "pdf", id: p.id, pdf }, [pdf.buffer]);
    }
  } catch (erro) {
    responder({ tipo: "erro", id: "id" in p ? p.id : null, mensagem: erro instanceof Error ? erro.message : String(erro) });
  }
};
