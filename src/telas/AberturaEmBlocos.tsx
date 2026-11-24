import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  adicionarAAbertura,
  ehFolhaMontada,
  temTextoNaAbertura,
  tirarDaAbertura,
  type Abertura,
  type BlocoDaAbertura,
  type DadosDoTrabalho,
  type Resumo,
  type TipoDaAbertura,
} from "../documento/modelo";
import CampoDeParagrafos from "../editor/CampoDeParagrafos";
import { Icone } from "../editor/icones";
import { nomeDoIdiomaNoModelo } from "../conversor/abertura";
import { comecaEmPaginaNovaNaAbertura } from "../conversor/abertura";
import { valorEfetivo } from "../modelos/herdar";
import type { ModeloResolvido } from "../modelos/tipos";
import {
  chaveDoBloco,
  comPaginaNova,
  faixasDaFolha,
  linhasDePaginaNova,
  mudarPeca,
  nomeDoBlocoDaAbertura,
  opcoesDeAdicionar,
  situacaoDoBloco,
  temEscolhaDePaginaNova,
  type FolhaComPecas,
  type Peca,
} from "./abertura";
import { IDIOMAS_DO_RESUMO, palavrasChaveDoTexto, palavrasChaveParaTexto } from "./trabalho";

interface Props {
  abertura: Abertura;
  dados: DadosDoTrabalho;
  nomeDaNorma: string;
  modelo: ModeloResolvido;
  /**
   * Muda a abertura. Com `redesenhar`, a área se desenha de novo (pôr e tirar
   * blocos, trocar o idioma); escrever num texto não precisa, porque o campo já
   * mostra o que foi escrito.
   */
  aoMudar: (fazer: (a: Abertura) => Abertura, redesenhar: boolean) => void;
  /** Uma peça da capa, da folha de rosto ou da página de título mudou um dado do trabalho. */
  aoMudarDados: (d: DadosDoTrabalho) => void;
  /** Muda quando o menu Modelo › Adicionar à abertura… é escolhido: a lista abre. */
  pedidoDeAdicionar?: number;
}

/**
 * A Abertura em blocos (etapa 3, parte 3a): o que vem antes do texto, no alto
 * do editor, como blocos (decisões 12 e 16 e a proposta de 24/11/2026). Cada
 * bloco tem a etiqueta na margem e o ⚙, como os do texto, mas não se arrasta:
 * a ordem é da norma. "Adicionar à abertura" põe um bloco; "Tirar da abertura",
 * no ⚙, tira e guarda o que foi escrito.
 */
export default function AberturaEmBlocos({ abertura, dados, nomeDaNorma, modelo, aoMudar, aoMudarDados, pedidoDeAdicionar = 0 }: Props) {
  const [menuAberto, setMenuAberto] = useState(false);
  // A Abertura se recolhe numa linha só (a seta no divisor), para escrever o texto sem ela à vista.
  const [aberta, setAberta] = useState(true);
  const [ajustes, setAjustes] = useState<string | null>(null);
  const secao = useRef<HTMLElement>(null);
  const opcoes = opcoesDeAdicionar(abertura, modelo);
  const blocos = abertura.blocos;
  // Depois de pôr um bloco, o cursor vai para o primeiro campo dele.
  const focarDepois = useRef<string | null>(null);

  useEffect(() => {
    if (!pedidoDeAdicionar) return;
    setAberta(true);
    setMenuAberto(true);
    secao.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }, [pedidoDeAdicionar]);

  useLayoutEffect(() => {
    const chave = focarDepois.current;
    if (!chave) return;
    focarDepois.current = null;
    const el = secao.current?.querySelector<HTMLElement>(`[data-chave="${chave}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
    // O texto do bloco (o campo do TipTap aparece um instante depois) ou, nas folhas, a primeira peça.
    let tentativas = 10;
    const focar = () => {
      const alvo = el?.querySelector<HTMLElement>(".campo-da-abertura") ?? (el?.querySelector(".ab-folha") ? el.querySelector<HTMLElement>(".ab-peca") : null);
      if (alvo) alvo.focus();
      else if (tentativas-- > 0) requestAnimationFrame(focar);
      else el?.querySelector<HTMLElement>(".ab-engrenagem")?.focus();
    };
    focar();
  });

  const adicionar = (tipo: TipoDaAbertura, idioma?: string) => {
    setAberta(true);
    let nova: Abertura | null = null;
    aoMudar((a) => (nova = adicionarAAbertura(a, tipo, idioma)), true);
    setMenuAberto(false);
    if (nova) {
      const n = nova as Abertura;
      const i = n.blocos.findIndex((b) => b.tipo === tipo && (tipo !== "resumo" || (b as Resumo).idioma === idioma));
      if (i >= 0) focarDepois.current = chaveDoBloco(n.blocos, i);
    }
  };

  const tirar = (indice: number) => {
    setAjustes(null);
    aoMudar((a) => tirarDaAbertura(a, indice), true);
  };

  /** Muda um bloco sem redesenhar (o texto que a pessoa digita). */
  const mudarBloco = (indice: number, fazer: (b: BlocoDaAbertura) => BlocoDaAbertura, redesenhar = false) =>
    aoMudar((a) => ({ ...a, blocos: a.blocos.map((b, i) => (i === indice ? fazer(b) : b)) }), redesenhar);

  const linhas = linhasDePaginaNova(blocos, modelo);
  const quantos = blocos.length === 1 ? "1 elemento" : `${blocos.length} elementos`;

  return (
    <section ref={secao} className={`ab ${aberta ? "" : "recolhida"}`} aria-label="Abertura do trabalho">
      <div className="ab-divisor">
        <button
          type="button"
          className="ab-recolher"
          aria-expanded={aberta}
          title={aberta ? "Recolher a abertura" : "Mostrar a abertura"}
          onClick={() => setAberta(!aberta)}
        >
          <span className={`ab-seta ${aberta ? "" : "fechada"}`} aria-hidden="true">
            <Icone nome="baixo" tamanho={14} />
          </span>
          <span className="ab-divisor-nome">Abertura</span>
          {!aberta && blocos.length > 0 && <span className="ab-quantos">{quantos}</span>}
        </button>
        <span className="ab-divisor-linha" aria-hidden="true" />
        <MenuDeAdicionar aberto={menuAberto} aoAlternar={setMenuAberto} opcoes={opcoes} nomeDaNorma={nomeDaNorma} aoEscolher={adicionar} />
      </div>
      {aberta && blocos.length === 0 && <p className="ab-vazia">Nada antes do texto. A capa, os resumos e o resto entram por “Adicionar à abertura”.</p>}
      {aberta &&
        blocos.map((b, i) => {
          const chave = chaveDoBloco(blocos, i);
          const linha = linhas[i];
          return (
            <div key={chave} className="ab-lugar">
              {linha && <LinhaDePaginaNova podeSair={linha.podeSair} nome={nomeDoBlocoDaAbertura(b)} aoTirar={() => mudarBloco(i, (x) => comPaginaNova(x, modelo, false), true)} />}
              <BlocoNaTela
                chave={chave}
                bloco={b}
                dados={dados}
                modelo={modelo}
                nomeDaNorma={nomeDaNorma}
                semIdentificacao={abertura.semIdentificacao}
                ajustesAbertos={ajustes === chave}
                aoAlternarAjustes={() => setAjustes((x) => (x === chave ? null : chave))}
                aoFecharAjustes={() => setAjustes(null)}
                aoTirar={() => tirar(i)}
                aoMudar={(fazer, redesenhar) => mudarBloco(i, fazer, redesenhar)}
                aoMudarDados={aoMudarDados}
              />
            </div>
          );
        })}
      <div className="ab-divisor ab-divisor-texto">
        <span className="ab-divisor-nome">Texto</span>
        <span className="ab-divisor-linha" aria-hidden="true" />
      </div>
    </section>
  );
}

/**
 * A linha "Página nova" acima do bloco, como a dos títulos: clicar e apertar
 * Delete (ou Backspace) tira a página nova só deste bloco. Depois de um
 * elemento que ocupa a folha inteira, ela só mostra (não dá para tirar).
 */
function LinhaDePaginaNova({ podeSair, nome, aoTirar }: { podeSair: boolean; nome: string; aoTirar: () => void }) {
  if (!podeSair) {
    return (
      <div className="ab-pagina-nova fixa" title="Começa numa página nova: o elemento de cima ocupa a folha inteira.">
        <span>Página nova</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="ab-pagina-nova"
      aria-label={`Página nova antes de ${nome}. Aperte Delete para tirar.`}
      title="Clique e aperte Delete para tirar a página nova só deste bloco (ele fica na mesma página do anterior). Para pôr de volta, use o ⚙."
      onKeyDown={(ev) => {
        if (ev.key === "Delete" || ev.key === "Backspace") {
          ev.preventDefault();
          aoTirar();
        }
      }}
    >
      <span>Página nova</span>
    </button>
  );
}

// ---------------------------------------------------------------------------

function MenuDeAdicionar({
  aberto,
  aoAlternar,
  opcoes,
  nomeDaNorma,
  aoEscolher,
}: {
  aberto: boolean;
  aoAlternar: (aberto: boolean) => void;
  opcoes: ReturnType<typeof opcoesDeAdicionar>;
  nomeDaNorma: string;
  aoEscolher: (tipo: TipoDaAbertura, idioma?: string) => void;
}) {
  const id = useId();
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (ev: MouseEvent) => {
      if (!caixa.current?.contains(ev.target as Node)) aoAlternar(false);
    };
    const esc = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        aoAlternar(false);
        caixa.current?.querySelector<HTMLElement>(".ab-adicionar")?.focus();
      }
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    // O foco vai para a primeira opção, para o teclado andar pela lista.
    caixa.current?.querySelector<HTMLElement>(".ab-opcao")?.focus();
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto, aoAlternar]);

  const andar = (ev: React.KeyboardEvent) => {
    if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
    ev.preventDefault();
    const itens = Array.from(caixa.current?.querySelectorAll<HTMLElement>(".ab-opcao") ?? []);
    const atual = itens.indexOf(document.activeElement as HTMLElement);
    const proximo = (atual + (ev.key === "ArrowDown" ? 1 : -1) + itens.length) % itens.length;
    itens[proximo]?.focus();
  };

  return (
    <div className="ab-menu" ref={caixa}>
      <button type="button" className="ab-adicionar" aria-expanded={aberto} aria-controls={aberto ? id : undefined} onClick={() => aoAlternar(!aberto)}>
        <Icone nome="mais" tamanho={15} /> Adicionar à abertura
      </button>
      {aberto && (
        <div id={id} className="ab-opcoes" role="menu" aria-label="Adicionar à abertura" onKeyDown={andar}>
          {opcoes.length === 0 ? (
            <p className="dica ab-opcoes-vazio">Tudo o que o modelo {nomeDaNorma} tem já está na abertura.</p>
          ) : (
            opcoes.map((o) => (
              <button key={`${o.tipo}-${o.idioma ?? ""}`} type="button" role="menuitem" className="ab-opcao" onClick={() => aoEscolher(o.tipo, o.idioma)}>
                <span>{o.rotulo}</span>
                {o.guardado && <span className="ab-etiqueta">texto guardado</span>}
                {o.foraDaNorma && <span className="ab-etiqueta ab-etiqueta-aviso">a {nomeDaNorma} não tem</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface PropsDoBloco {
  chave: string;
  bloco: BlocoDaAbertura;
  dados: DadosDoTrabalho;
  modelo: ModeloResolvido;
  nomeDaNorma: string;
  semIdentificacao: boolean;
  ajustesAbertos: boolean;
  aoAlternarAjustes: () => void;
  aoFecharAjustes: () => void;
  aoTirar: () => void;
  aoMudar: (fazer: (b: BlocoDaAbertura) => BlocoDaAbertura, redesenhar?: boolean) => void;
  aoMudarDados: (d: DadosDoTrabalho) => void;
}

function BlocoNaTela(p: PropsDoBloco) {
  const { bloco: b } = p;
  const nome = nomeDoBlocoDaAbertura(b);
  const situacao = situacaoDoBloco(b, p.modelo, p.nomeDaNorma);
  const foraDaNorma = situacao?.startsWith(`A ${p.nomeDaNorma} não tem`);
  const base = useId();

  return (
    <div className={`ab-bloco ${foraDaNorma ? "fora-da-norma" : ""} ${p.ajustesAbertos ? "com-ajustes" : ""}`} data-etiqueta={nome} data-chave={p.chave} role="group" aria-label={nome}>
      <button
        type="button"
        className="engrenagem ab-engrenagem"
        aria-label={`Ajustes: ${nome}`}
        aria-expanded={p.ajustesAbertos}
        title={`Ajustes: ${nome}`}
        onClick={p.aoAlternarAjustes}
      >
        <Icone nome="engrenagem" tamanho={16} />
      </button>
      {ehFolhaMontada(b) && b.tipo !== "sumario" && (
        <FolhaNaTela tipo={b.tipo as FolhaComPecas} dados={p.dados} modelo={p.modelo} semIdentificacao={p.semIdentificacao} aoMudarDados={p.aoMudarDados} />
      )}
      {b.tipo === "sumario" && <p className="ab-montado">Montado pelo Apud com os títulos do texto e os números das páginas.</p>}
      {(b.tipo === "dedicatoria" || b.tipo === "agradecimentos") && (
        <CampoDeParagrafos
          id={`${base}-texto`}
          rotulo={nome}
          inicial={b.paragrafos}
          convite={b.tipo === "dedicatoria" ? "Escreva a dedicatória…" : "Escreva os agradecimentos…"}
          aoMudar={(paragrafos) => p.aoMudar((x) => ({ ...x, paragrafos }) as BlocoDaAbertura)}
        />
      )}
      {b.tipo === "epigrafe" && (
        <>
          <CampoDeParagrafos id={`${base}-texto`} rotulo="Epígrafe" inicial={b.paragrafos} convite="Escreva a frase da epígrafe…" aoMudar={(paragrafos) => p.aoMudar((x) => ({ ...x, paragrafos }) as BlocoDaAbertura)} />
          <label className="ab-linha ab-autoria">
            <span className="ab-linha-rotulo">Quem escreveu</span>
            <input
              defaultValue={b.autoria}
              autoComplete="off"
              placeholder="Nome, como deve sair"
              onChange={(ev) => p.aoMudar((x) => ({ ...x, autoria: ev.target.value }) as BlocoDaAbertura)}
            />
          </label>
        </>
      )}
      {b.tipo === "resumo" && <ResumoNaTela bloco={b} base={base} dados={p.dados} modelo={p.modelo} aoMudar={p.aoMudar} />}
      {situacao && <p className={`ab-situacao ${foraDaNorma ? "aviso" : ""}`}>{situacao}</p>}
      {p.ajustesAbertos && <AjustesDoBlocoDaAbertura {...p} nome={nome} />}
    </div>
  );
}

function ResumoNaTela({
  bloco: b,
  base,
  dados,
  modelo,
  aoMudar,
}: {
  bloco: Resumo;
  base: string;
  dados: DadosDoTrabalho;
  modelo: ModeloResolvido;
  aoMudar: PropsDoBloco["aoMudar"];
}) {
  const idioma = nomeDoIdiomaNoModelo(b.idioma);
  const rotuloDasPalavras = valorEfetivo(modelo, "abertura.resumo.palavrasChave", `rótulo em ${idioma}`)?.texto ?? "Palavras-chave:";
  // O título noutro idioma é para os resumos estrangeiros (revistas pedem); no idioma do trabalho, só se já tiver.
  const comTitulo = b.idioma !== dados.idioma || !!b.titulo?.trim();
  return (
    <>
      {comTitulo && (
        <label className="ab-linha">
          <span className="ab-linha-rotulo">Título neste idioma</span>
          <input
            defaultValue={b.titulo ?? ""}
            autoComplete="off"
            placeholder="Opcional (revistas pedem)"
            onChange={(ev) => {
              const t = ev.target.value;
              aoMudar((x) => {
                const r = { ...(x as Resumo) };
                if (t.trim()) r.titulo = t;
                else delete r.titulo;
                return r;
              });
            }}
          />
        </label>
      )}
      <CampoDeParagrafos
        id={`${base}-texto`}
        rotulo={`Texto do resumo em ${idioma}`}
        inicial={[b.trechos]}
        unico
        convite="Escreva o resumo, num parágrafo só…"
        aoMudar={(ps) => aoMudar((x) => ({ ...x, trechos: ps[0] ?? [] }) as BlocoDaAbertura)}
      />
      <label className="ab-linha">
        <span className="ab-linha-rotulo">{rotuloDasPalavras.replace(/:\s*$/, "")}</span>
        <input
          defaultValue={palavrasChaveParaTexto(b.palavrasChave)}
          autoComplete="off"
          placeholder="Separadas por ponto e vírgula"
          onChange={(ev) => {
            const palavrasChave = palavrasChaveDoTexto(ev.target.value);
            aoMudar((x) => ({ ...x, palavrasChave }) as BlocoDaAbertura);
          }}
        />
      </label>
    </>
  );
}

// ---------------------------------------------------------------------------
// A capa, a folha de rosto e a página de título: as peças em faixas

function FolhaNaTela({
  tipo,
  dados,
  modelo,
  semIdentificacao,
  aoMudarDados,
}: {
  tipo: FolhaComPecas;
  dados: DadosDoTrabalho;
  modelo: ModeloResolvido;
  semIdentificacao: boolean;
  aoMudarDados: (d: DadosDoTrabalho) => void;
}) {
  const faixas = faixasDaFolha(tipo, dados, modelo, semIdentificacao);
  return (
    <div className="ab-folha">
      {faixas.map((f) => (
        <div key={f.nome} className="ab-faixa">
          <span className="ab-faixa-nome">{f.nome}</span>
          <div className="ab-pecas">
            {f.pecas.map((peca) => (
              <PecaNaTela key={peca.campo} peca={peca} dados={dados} aoMudarDados={aoMudarDados} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PecaNaTela({ peca, dados, aoMudarDados }: { peca: Peca; dados: DadosDoTrabalho; aoMudarDados: (d: DadosDoTrabalho) => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(peca.editavel);
  const [erro, setErro] = useState<string | null>(null);
  const id = useId();
  const botao = useRef<HTMLButtonElement>(null);

  const abrir = () => {
    setTexto(peca.editavel);
    setErro(null);
    setEditando(true);
  };
  const fechar = (voltarFoco = true) => {
    setEditando(false);
    setErro(null);
    if (voltarFoco) requestAnimationFrame(() => botao.current?.focus());
  };
  const guardar = (voltarFoco = true) => {
    if (texto === peca.editavel) return fechar(voltarFoco);
    const r = mudarPeca(dados, peca.campo, texto);
    if (!r.ok) return setErro(r.erro);
    aoMudarDados(r.dados);
    fechar(voltarFoco);
  };

  if (!editando) {
    const vazio = !peca.valor;
    return (
      <button ref={botao} type="button" className={`ab-peca ${vazio ? "vazia" : ""}`} onClick={abrir} title="Clique para editar">
        <span className="ab-peca-rotulo">{peca.rotulo}</span>
        <span className="ab-peca-valor">
          {vazio ? "clique para preencher" : peca.valor}
          {peca.montada && !vazio && <span className="ab-peca-nota"> (montada pelo Apud)</span>}
          {peca.escondido && <span className="ab-peca-nota"> (não sai no PDF: versão sem identificação)</span>}
        </span>
      </button>
    );
  }

  const teclas = (ev: React.KeyboardEvent) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      fechar();
    } else if (ev.key === "Enter" && (!peca.linhas || ev.ctrlKey)) {
      ev.preventDefault();
      guardar();
    }
  };
  const comum = {
    id,
    value: texto,
    autoFocus: true,
    "aria-invalid": erro ? true : undefined,
    "aria-describedby": `${id}-dica`,
    onKeyDown: teclas,
    onBlur: () => guardar(false),
  };
  return (
    <div className="ab-peca editando">
      <label className="ab-peca-rotulo" htmlFor={id}>
        {peca.rotulo}
      </label>
      {peca.linhas ? (
        <textarea {...comum} rows={peca.campo === "natureza" ? 3 : Math.max(2, texto.split("\n").length)} placeholder={peca.campo === "natureza" ? peca.valor : undefined} onChange={(e) => setTexto(e.target.value)} />
      ) : peca.campo === "dataDeEntrega" ? (
        <input {...comum} type="date" onChange={(e) => setTexto(e.target.value)} />
      ) : (
        <input {...comum} autoComplete="off" inputMode={peca.campo === "ano" ? "numeric" : undefined} onChange={(e) => setTexto(e.target.value)} />
      )}
      <span id={`${id}-dica`} className={erro ? "erro-campo" : "dica"} role={erro ? "alert" : undefined}>
        {erro ?? `${peca.dica ? `${peca.dica} ` : ""}É um dado do trabalho: muda em todas as folhas e nas Configurações › Dados. ${peca.linhas ? "Ctrl+Enter guarda" : "Enter guarda"}, Esc desiste.`}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// O ⚙ de um bloco da abertura

function AjustesDoBlocoDaAbertura(p: PropsDoBloco & { nome: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const { bloco: b, aoFecharAjustes } = p;
  useEffect(() => {
    const fora = (ev: MouseEvent) => {
      const alvo = ev.target as Element | null;
      if (!caixa.current?.contains(alvo) && !alvo?.closest?.(".ab-engrenagem")) aoFecharAjustes();
    };
    const esc = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      aoFecharAjustes();
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    caixa.current?.scrollIntoView?.({ block: "nearest" });
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aoFecharAjustes]);

  const modelo = p.modelo.identificacao.nome;
  const origem = ehFolhaMontada(b)
    ? b.tipo === "sumario"
      ? `Montado com os títulos do texto, na forma do modelo ${modelo}.`
      : `Montada com os dados do trabalho, na forma do modelo ${modelo}.`
    : `O texto é seu; a forma vem do modelo ${modelo}.`;
  const guarda = temTextoNaAbertura(b);

  return (
    <div ref={caixa} className="janelinha ab-janelinha" role="dialog" aria-label={`Ajustes: ${p.nome}`}>
      <div className="janelinha-topo">
        <strong>{p.nome}</strong>
        <button type="button" className="mini" aria-label="Fechar" onClick={aoFecharAjustes}>
          ×
        </button>
      </div>
      <p className="janelinha-origem">{origem}</p>
      {b.tipo === "resumo" && (
        <label className="ab-linha ab-idioma">
          <span className="janelinha-rotulo">Idioma</span>
          <select
            className="seletor"
            value={b.idioma}
            onChange={(ev) => {
              const idioma = ev.target.value;
              p.aoMudar((x) => ({ ...x, idioma }) as BlocoDaAbertura, true);
              aoFecharAjustes();
            }}
          >
            {(IDIOMAS_DO_RESUMO.some((i) => i.codigo === b.idioma) ? IDIOMAS_DO_RESUMO : [{ codigo: b.idioma, nome: b.idioma }, ...IDIOMAS_DO_RESUMO]).map((i) => (
              <option key={i.codigo} value={i.codigo}>
                {i.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      {temEscolhaDePaginaNova(b) && (
        <PaginaNovaNoAjuste bloco={b} modelo={p.modelo} aoMudar={(quer) => p.aoMudar((x) => comPaginaNova(x, p.modelo, quer), true)} />
      )}
      <div className="janelinha-mover">
        <button type="button" className="btn" onClick={p.aoTirar}>
          Tirar da abertura
        </button>
        <button type="button" className="btn" disabled title="O painel completo chega numa próxima versão">
          Mais opções…
        </button>
      </div>
      <p className="dica">{guarda ? "O texto fica guardado no trabalho e volta com “Adicionar à abertura”." : "Volta quando quiser, por “Adicionar à abertura”."}</p>
    </div>
  );
}

/** "Começar em página nova" no ⚙ (agradecimentos, resumos e sumário): só neste bloco. */
function PaginaNovaNoAjuste({ bloco, modelo, aoMudar }: { bloco: BlocoDaAbertura; modelo: ModeloResolvido; aoMudar: (quer: boolean) => void }) {
  const ligada = comecaEmPaginaNovaNaAbertura(modelo, bloco.tipo, bloco.excecoes);
  const soEste = !!bloco.excecoes?.["página nova"];
  return (
    <>
      <button type="button" className={`janelinha-chave ${ligada ? "on" : ""}`} aria-pressed={ligada} onClick={() => aoMudar(!ligada)}>
        <span>Começar em página nova</span>
        <span className="janelinha-tg" aria-hidden="true" />
      </button>
      {soEste && <p className="dica janelinha-so-este">Só neste bloco. O modelo põe cada elemento numa página nova.</p>}
    </>
  );
}
