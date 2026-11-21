// Converte uma referência do modelo do Apud para o formato que o Typst lê
// (hayagriva), com os campos extras que preparar.ts transforma conforme a norma.
//
// O formato do Apud guarda os dados com nomes em português e uma forma só para
// cada coisa (autores sempre numa lista, datas com ano, mês e dia separados).
// Aqui eles viram os campos do hayagriva: author, parent, publisher, page-range...
// A forma final (caixa alta, iniciais, ordem das partes) continua com o perfil
// e o estilo CSL.

import { ehInstituicao, type Autor, type Data, type Publicacao, type Referencia } from "../documento/modelo";
import type { Referencia as ReferenciaDoTypst } from "./preparar";

/** Número como número, para o hayagriva: "2" vira 2; "2. ed. rev." fica como está. */
function numeroOuTexto(s: string): number | string {
  return /^\d+$/.test(s.trim()) ? Number(s.trim()) : s;
}

/** Data no formato do hayagriva: 2019, "2025-03" ou "2024-05-02". */
export function dataDoTypst(d: Data): number | string {
  if (d.mes === undefined) return d.ano;
  const dois = (n: number) => String(n).padStart(2, "0");
  return d.dia === undefined ? `${d.ano}-${dois(d.mes)}` : `${d.ano}-${dois(d.mes)}-${dois(d.dia)}`;
}

/** Pessoas como "Sobrenome, Prenomes"; instituições como { name }. */
function nomes(autores: Autor[]): unknown[] {
  return autores.map((a) => {
    if (ehInstituicao(a)) return { name: a.instituicao };
    return a.prenomes?.trim() ? `${a.sobrenome}, ${a.prenomes.trim()}` : a.sobrenome;
  });
}

/** Editora e cidade, como o hayagriva guarda: { name, location }. */
function editora(ref: { editora?: string; cidade?: string }): Record<string, string> | undefined {
  const p: Record<string, string> = {};
  if (ref.editora) p.name = ref.editora;
  if (ref.cidade) p.location = ref.cidade;
  return Object.keys(p).length ? p : undefined;
}

function sem<T extends Record<string, unknown>>(o: T): T {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
  return o;
}

/** A obra maior (livro, revista, anais, jornal, rede social). */
function pai(tipo: string, p: Publicacao | undefined, extra: Record<string, unknown> = {}): Record<string, unknown> | undefined {
  if (!p) return undefined;
  return sem({
    type: tipo,
    title: p.titulo,
    subtitle: p.subtitulo,
    editor: p.organizadores?.length ? nomes(p.organizadores) : undefined,
    location: p.cidade,
    volume: p.volume !== undefined ? numeroOuTexto(p.volume) : undefined,
    issue: p.numero !== undefined ? numeroOuTexto(p.numero) : undefined,
    ...extra,
  });
}

/** Converte uma referência do Apud para o Typst. */
export function paraHayagriva(ref: Referencia): ReferenciaDoTypst {
  const comuns = sem({
    title: ref.titulo,
    subtitle: ref.subtitulo,
    author: ref.autores.length ? nomes(ref.autores) : undefined,
    date: ref.data ? dataDoTypst(ref.data) : undefined,
    "uncertain-date": ref.dataIncerta,
    url: ref.url ? sem({ value: ref.url, date: ref.acesso ? dataDoTypst(ref.acesso) : undefined }) : undefined,
    "serial-number": ref.doi ? { doi: ref.doi } : undefined,
    // As notas vão no campo runtime do hayagriva, que o Typst passa ao CSL como
    // "dimensions": é um campo livre que os estilos do Apud escrevem como texto.
    runtime: ref.notas?.trim() || undefined,
  });

  switch (ref.tipo) {
    case "livro":
      return sem({
        type: "book",
        ...comuns,
        // Livro organizado: os nomes vão como organizadores (editor), e o estilo escreve (org.).
        ...(ref.autoresOrganizadores && ref.autores.length ? { author: undefined, editor: nomes(ref.autores) } : {}),
        edition: ref.edicao !== undefined ? numeroOuTexto(ref.edicao) : undefined,
        publisher: editora(ref),
      });

    case "capitulo":
      // Edição, editora e cidade são do livro.
      return sem({
        type: "chapter",
        ...comuns,
        "page-range": ref.paginas,
        parent: pai("anthology", ref.publicacao, sem({
          edition: ref.edicao !== undefined ? numeroOuTexto(ref.edicao) : undefined,
          publisher: editora(ref),
        })),
      });

    case "artigo":
      return sem({
        type: "article",
        ...comuns,
        "page-range": ref.paginas,
        "e-number": ref.numeroEletronico,
        parent: pai("periodical", ref.publicacao),
      });

    case "site":
      return sem({ type: "web", ...comuns, publisher: editora(ref) });

    case "lei":
      return sem({ type: "legislation", ...comuns, abstract: ref.ementa, publisher: editora(ref) });

    case "tese":
      return sem({
        type: "thesis",
        ...comuns,
        genre: ref.tipoDoTrabalho,
        degree: ref.grau,
        publisher: editora(ref),
        "page-total": ref.folhas !== undefined ? numeroOuTexto(ref.folhas) : undefined,
      });

    case "relatorio":
      return sem({
        type: "report",
        ...comuns,
        genre: ref.serie,
        // O número na série ocupa o campo do DOI no hayagriva; um relatório com os dois guarda o DOI junto.
        "serial-number":
          ref.numeroNaSerie !== undefined
            ? ref.doi
              ? { serial: ref.numeroNaSerie, doi: ref.doi }
              : numeroOuTexto(ref.numeroNaSerie)
            : comuns["serial-number"],
        publisher: editora(ref),
      });

    case "evento":
      return sem({
        type: "article",
        ...comuns,
        "page-range": ref.paginas,
        event: ref.evento
          ? sem({
              name: ref.evento.nome,
              number: ref.evento.numero !== undefined ? numeroOuTexto(ref.evento.numero) : undefined,
              date: ref.evento.ano !== undefined ? numeroOuTexto(ref.evento.ano) : undefined,
              location: ref.evento.cidade,
            })
          : undefined,
        parent: pai("proceedings", ref.publicacao, sem({ publisher: editora(ref) })),
      });

    case "noticia":
      return sem({ type: "article", ...comuns, parent: pai("newspaper", ref.publicacao) });

    case "rede-social":
      return sem({
        type: "post",
        ...comuns,
        handle: ref.perfil,
        genre: ref.tipoDaPostagem,
        publisher: editora(ref),
        parent: pai("web", ref.publicacao),
      });
  }
}
