import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Documento } from "../documento/modelo";
import { documentoParaTypst } from "../conversor/typst";
import { arquivosDasImagens } from "../conversor/elementos";
import { motor } from "../conversor/motor";
import type { NormaDoTrabalho } from "../perfis/norma";
import { rodandoNoPrograma } from "../arquivos/armazenamento";
import { avisoDeFonte } from "./fonte";
import { alturaNaPrevia, lugarDoBloco, rolagemPara, type PosicaoDoBloco } from "./acompanhar";

interface Props {
  lerTexto: React.MutableRefObject<(() => Documento) | null>;
  /** A norma do trabalho (perfil com os ajustes e estilo CSL), lida a cada montagem. */
  lerNorma: React.MutableRefObject<() => NormaDoTrabalho>;
  /** Avisa quando o texto muda (a prévia espera uma pausa e remonta). */
  mudancas: EventTarget;
  nome: string;
  aoFechar: () => void;
  /** Avisa quando o cursor muda de bloco; lerCursor diz em que bloco ele está. */
  cursor?: EventTarget;
  lerCursor?: () => number | null;
}

/** A prévia do PDF: as páginas de verdade, montadas pelo mesmo motor da exportação. */
/** O espaço entre as folhas na prévia, em pt (as medidas do desenho do Typst). */
const ESPACO = 16;

export default function Previa({ lerTexto, lerNorma, mudancas, nome, aoFechar, cursor, lerCursor }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<"montando" | "pronta" | "erro">("montando");
  const [erro, setErro] = useState("");
  const [selo, setSelo] = useState("");
  const [avisoDaFonte, setAvisoDaFonte] = useState<string | null>(null);
  const ocupado = useRef(false);
  const deNovo = useRef(false);
  /** A montagem do efeito que está valendo agora (a que pode ser chamada "de novo"). */
  const montarAtual = useRef<(() => Promise<void>) | null>(null);
  const nomeRef = useRef(nome);
  nomeRef.current = nome;
  const caixa = useRef<HTMLDivElement>(null);
  const lateral = useRef<HTMLElement>(null);
  /** Onde cada bloco ficou na última montagem, e a altura de cada folha (pt). */
  const posicoes = useRef<PosicaoDoBloco[]>([]);
  const alturas = useRef<number[]>([]);
  const lerCursorRef = useRef(lerCursor);
  lerCursorRef.current = lerCursor;

  /** Rola a prévia até o bloco do cursor, se ele não estiver à vista. */
  const acompanhar = () => {
    const indice = lerCursorRef.current?.();
    const doc = caixa.current?.querySelector("svg.typst-doc");
    const painel = lateral.current;
    if (indice == null || !doc || !painel) return;
    const lugar = lugarDoBloco(posicoes.current, indice);
    if (!lugar) return;
    const largura = Number(doc.getAttribute("width")) || 1;
    const escala = doc.getBoundingClientRect().width / largura;
    const topoDoDesenho = doc.getBoundingClientRect().top - painel.getBoundingClientRect().top + painel.scrollTop;
    const alvo = topoDoDesenho + alturaNaPrevia(alturas.current, ESPACO, lugar.pagina, lugar.y) * escala;
    const destino = rolagemPara(alvo, painel.scrollTop, painel.clientHeight);
    if (destino !== null) painel.scrollTo({ top: destino, behavior: "smooth" });
  };

  // O Typst entrega as páginas coladas umas nas outras. Aqui cada página ganha
  // fundo branco e um espaço entre ela e a próxima, como folhas de papel.
  useLayoutEffect(() => {
    const doc = caixa.current?.querySelector("svg.typst-doc");
    if (!doc) return;
    const paginas = Array.from(doc.querySelectorAll<SVGGElement>(":scope > g.typst-page"));
    let y = 0;
    let largura = 0;
    alturas.current = [];
    for (const g of paginas) {
      const w = Number(g.dataset.pageWidth ?? g.getAttribute("data-page-width"));
      const h = Number(g.dataset.pageHeight ?? g.getAttribute("data-page-height"));
      g.setAttribute("transform", `translate(0, ${y})`);
      const fundo = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      fundo.setAttribute("x", "0");
      fundo.setAttribute("y", String(y));
      fundo.setAttribute("width", String(w));
      fundo.setAttribute("height", String(h));
      fundo.setAttribute("class", "folha-da-previa");
      doc.insertBefore(fundo, g);
      alturas.current.push(h);
      y += h + ESPACO;
      largura = Math.max(largura, w);
    }
    const altura = Math.max(0, y - ESPACO);
    doc.setAttribute("viewBox", `0 0 ${largura} ${altura}`);
    doc.setAttribute("width", String(largura));
    doc.setAttribute("height", String(altura));
    acompanhar();
  }, [svg]);

  // O cursor mudou de bloco: a prévia vai atrás.
  useEffect(() => {
    if (!cursor) return;
    const aoMover = () => acompanhar();
    cursor.addEventListener("mudou", aoMover);
    return () => cursor.removeEventListener("mudou", aoMover);
  }, [cursor]);

  useEffect(() => {
    let ativo = true;
    let relogio: ReturnType<typeof setTimeout> | undefined;

    const montar = async () => {
      // Uma montagem por vez; se o texto mudar no meio, monta de novo no fim.
      // "De novo" é sempre com a montagem mais recente: se a prévia foi
      // reaberta no meio (ou a norma mudou), a antiga não pode deixar o pedido
      // novo esquecido.
      if (ocupado.current) {
        deNovo.current = true;
        return;
      }
      const ler = lerTexto.current;
      if (!ler) return;
      ocupado.current = true;
      setSituacao((s) => (s === "pronta" ? s : "montando"));
      try {
        const { perfil, csl } = lerNorma.current();
        setSelo(perfil.identificacao.perfil);
        const doc = ler();
        const pronto = await motor.previa(documentoParaTypst(doc, perfil, { titulo: nomeRef.current, csl, marcarBlocos: true }), arquivosDasImagens(doc));
        if (!ativo) return;
        posicoes.current = pronto.posicoes;
        setSvg(pronto.svg);
        setSituacao("pronta");
        const familia = perfil.regras.get("família da fonte")?.texto;
        setAvisoDaFonte(avisoDeFonte(familia, motor.fontesDoComputador, rodandoNoPrograma));
      } catch (e) {
        if (!ativo) return;
        setErro((e as Error).message);
        setSituacao("erro");
      } finally {
        ocupado.current = false;
        if (deNovo.current) {
          deNovo.current = false;
          void montarAtual.current?.();
        }
      }
    };
    montarAtual.current = montar;

    const aoMudar = () => {
      clearTimeout(relogio);
      relogio = setTimeout(montar, 700);
    };
    mudancas.addEventListener("mudou", aoMudar);
    void montar();
    return () => {
      ativo = false;
      if (montarAtual.current === montar) montarAtual.current = null;
      clearTimeout(relogio);
      mudancas.removeEventListener("mudou", aoMudar);
    };
  }, [lerTexto, lerNorma, mudancas]);

  return (
    <aside ref={lateral} className="previa" aria-label="Prévia do PDF">
      <div className="previa-topo">
        <span className="previa-titulo">Prévia do PDF</span>
        {selo && <span className="selo-norma">{selo}</span>}
        {situacao === "montando" && svg && <span className="dica">atualizando…</span>}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" style={{ minHeight: 32 }} onClick={aoFechar}>
          Fechar
        </button>
      </div>
      {avisoDaFonte && <p className="previa-aviso">{avisoDaFonte}</p>}
      {situacao === "erro" && (
        <p className="previa-aviso erro" role="alert">
          Não consegui montar a prévia: {erro}
        </p>
      )}
      {svg ? (
        // O SVG vem do motor Typst, a partir do texto do próprio trabalho.
        <div ref={caixa} className="previa-paginas" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : situacao === "montando" ? (
        <p className="dica previa-espera">Montando as páginas… Na primeira vez, o motor de PDF leva alguns segundos para começar.</p>
      ) : null}
    </aside>
  );
}
