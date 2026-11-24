// Conversa com o motor Typst (motor.worker.ts): carrega as fontes uma vez e
// pede a prévia ou o PDF.

import type { PosicaoDoBloco } from "../telas/acompanhar";
import type { Pedido, Resposta } from "./motor.worker";
import type { ArquivoDoTypst } from "./elementos";
import { armazenamento } from "../arquivos/armazenamento";

/**
 * Fontes de reserva que vêm com o Apud (pasta public/fontes), com as mesmas
 * medidas das fontes do Windows: Liberation Serif (Times New Roman), Liberation
 * Sans (Arial), Carlito (Calibri) e Gelasio (Georgia). Todas com licença OFL.
 */
const FONTES_DE_RESERVA = [
  "LiberationSerif-Regular.ttf",
  "LiberationSerif-Bold.ttf",
  "LiberationSerif-Italic.ttf",
  "LiberationSerif-BoldItalic.ttf",
  "LiberationSans-Regular.ttf",
  "LiberationSans-Bold.ttf",
  "LiberationSans-Italic.ttf",
  "LiberationSans-BoldItalic.ttf",
  "Carlito-Regular.ttf",
  "Carlito-Bold.ttf",
  "Carlito-Italic.ttf",
  "Carlito-BoldItalic.ttf",
  "Gelasio-Regular.ttf",
  "Gelasio-Bold.ttf",
  "Gelasio-Italic.ttf",
  "Gelasio-BoldItalic.ttf",
];

type Espera = { resolver: (r: Resposta) => void };

class Motor {
  private worker: Worker | null = null;
  private iniciado: Promise<void> | null = null;
  private proximoId = 1;
  private esperando = new Map<number, Espera>();
  /**
   * As imagens que o motor já tem. O caminho leva o código da imagem, que é
   * feito do próprio conteúdo: o mesmo caminho é sempre a mesma imagem.
   */
  private enviadas = new Set<string>();
  /** Fontes que vieram do computador (Times New Roman, Arial), para avisar quando faltar alguma. */
  fontesDoComputador: string[] = [];

  private iniciar(): Promise<void> {
    if (this.iniciado) return this.iniciado;
    this.iniciado = (async () => {
      const [reserva, doComputador] = await Promise.all([
        Promise.all(
          FONTES_DE_RESERVA.map(async (nome) => {
            const r = await fetch(`/fontes/${nome}`);
            if (!r.ok) throw new Error(`não encontrei a fonte ${nome}`);
            return new Uint8Array(await r.arrayBuffer());
          }),
        ),
        armazenamento.fontesDoComputador().catch(() => []),
      ]);
      this.fontesDoComputador = doComputador.map((f) => f.nome);
      this.worker = new Worker(new URL("./motor.worker.ts", import.meta.url), { type: "module" });
      await new Promise<void>((resolver, rejeitar) => {
        this.worker!.onmessage = (e: MessageEvent<Resposta>) => {
          const r = e.data;
          if (r.tipo === "pronto") return resolver();
          if (r.tipo === "erro" && r.id === null) return rejeitar(new Error(r.mensagem));
          if ("id" in r && r.id !== null) {
            this.esperando.get(r.id)?.resolver(r);
            this.esperando.delete(r.id);
          }
        };
        this.worker!.onerror = (e) => rejeitar(new Error(e.message || "o motor de PDF parou"));
        const pedido: Pedido = { tipo: "iniciar", fontes: [...doComputador.map((f) => f.dados), ...reserva] };
        this.worker!.postMessage(pedido);
      });
    })();
    // Se falhar, deixa tentar de novo na próxima vez.
    this.iniciado.catch(() => (this.iniciado = null));
    return this.iniciado;
  }

  private async pedir(tipo: "previa" | "pdf", typst: string, arquivos: ArquivoDoTypst[]): Promise<Resposta> {
    await this.iniciar();
    const id = this.proximoId++;
    const novos = arquivos.filter((a) => !this.enviadas.has(a.caminho));
    novos.forEach((a) => this.enviadas.add(a.caminho));
    return new Promise((resolver) => {
      this.esperando.set(id, { resolver });
      const pedido: Pedido = { tipo, id, typst, arquivos: novos };
      this.worker!.postMessage(pedido);
    });
  }

  /**
   * As páginas, como imagem SVG, para a prévia, e onde cada bloco ficou (se o
   * texto veio com as marcas da prévia). As imagens das figuras vão em arquivos.
   */
  async previa(typst: string, arquivos: ArquivoDoTypst[] = []): Promise<{ svg: string; posicoes: PosicaoDoBloco[] }> {
    const r = await this.pedir("previa", typst, arquivos);
    if (r.tipo === "erro") throw new Error(r.mensagem);
    if (r.tipo !== "previa") throw new Error("resposta inesperada do motor");
    return { svg: r.svg, posicoes: r.posicoes };
  }

  async pdf(typst: string, arquivos: ArquivoDoTypst[] = []): Promise<Uint8Array> {
    const r = await this.pedir("pdf", typst, arquivos);
    if (r.tipo === "erro") throw new Error(r.mensagem);
    if (r.tipo !== "pdf") throw new Error("resposta inesperada do motor");
    return r.pdf;
  }
}

export const motor = new Motor();
