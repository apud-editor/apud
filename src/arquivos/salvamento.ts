// Salvamento automático do trabalho aberto.
//
// - Depois de cada mudança, espera uma pausa curta na digitação e salva.
// - Só uma gravação por vez, sempre do texto mais recente: o texto é lido na
//   hora de gravar, não quando a mudança aconteceu.
// - Se a gravação falhar, avisa e tenta de novo; nada é descartado.
// - salvarAgora() grava na hora (ao fechar o programa ou voltar ao painel).

import type { Armazenamento } from "./armazenamento";

export type SituacaoDoSalvamento =
  | { tipo: "salvo"; quando: Date | null }
  | { tipo: "pendente" }
  | { tipo: "salvando" }
  | { tipo: "erro"; mensagem: string };

export interface OpcoesDoSalvamento {
  armazenamento: Armazenamento;
  arquivo: string;
  /** Monta o texto do arquivo no momento da gravação. */
  conteudo: () => string;
  /** Espera depois da última mudança, em milissegundos. */
  espera?: number;
  /** Espera para tentar de novo depois de um erro. */
  esperaAposErro?: number;
}

export class SalvamentoAutomatico {
  private arquivoAtual: string;
  private sujo = false;
  private relogio: ReturnType<typeof setTimeout> | undefined;
  /** A fila: cada operação começa quando a anterior termina. */
  private fila: Promise<unknown> = Promise.resolve();
  private ouvintes = new Set<(s: SituacaoDoSalvamento) => void>();
  situacao: SituacaoDoSalvamento = { tipo: "salvo", quando: null };

  constructor(private o: OpcoesDoSalvamento) {
    this.arquivoAtual = o.arquivo;
  }

  get arquivo(): string {
    return this.arquivoAtual;
  }

  get temMudancasNaoSalvas(): boolean {
    return this.sujo;
  }

  ouvir(f: (s: SituacaoDoSalvamento) => void): () => void {
    this.ouvintes.add(f);
    return () => this.ouvintes.delete(f);
  }

  private mudar(s: SituacaoDoSalvamento) {
    this.situacao = s;
    this.ouvintes.forEach((f) => f(s));
  }

  /** Avisa que o texto mudou. */
  houveMudanca() {
    this.sujo = true;
    if (this.situacao.tipo !== "erro") this.mudar({ tipo: "pendente" });
    this.agendar(this.o.espera ?? 800);
  }

  private agendar(ms: number) {
    clearTimeout(this.relogio);
    this.relogio = setTimeout(() => void this.salvarAgora().catch(() => {}), ms);
  }

  /** Grava agora, se houver algo para gravar. Rejeita se a gravação falhar. */
  salvarAgora(): Promise<void> {
    clearTimeout(this.relogio);
    return this.enfileirar(() => this.gravar());
  }

  /** Troca o nome do arquivo, na mesma fila das gravações. Devolve o nome novo. */
  renomear(nome: string): Promise<string> {
    return this.enfileirar(async () => {
      await this.gravar();
      this.arquivoAtual = await this.o.armazenamento.renomear(this.arquivoAtual, nome);
      return this.arquivoAtual;
    });
  }

  /** Para o relógio (ao fechar o trabalho). Não descarta nada: chame salvarAgora antes. */
  encerrar() {
    clearTimeout(this.relogio);
    this.ouvintes.clear();
  }

  private enfileirar<T>(f: () => Promise<T>): Promise<T> {
    const p = this.fila.then(f, f);
    this.fila = p.catch(() => {});
    return p;
  }

  private async gravar(): Promise<void> {
    if (!this.sujo) return;
    // Marca como limpo ANTES de ler o texto: uma mudança durante a gravação
    // volta a sujar e agenda outra gravação.
    this.sujo = false;
    this.mudar({ tipo: "salvando" });
    try {
      await this.o.armazenamento.salvar(this.arquivoAtual, this.o.conteudo());
    } catch (e) {
      this.sujo = true;
      const mensagem = e instanceof Error ? e.message : String(e);
      this.mudar({ tipo: "erro", mensagem });
      this.agendar(this.o.esperaAposErro ?? 5000);
      throw e;
    }
    this.mudar(this.sujo ? { tipo: "pendente" } : { tipo: "salvo", quando: new Date() });
  }
}
