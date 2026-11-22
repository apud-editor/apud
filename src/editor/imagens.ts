// Imagens das figuras no editor: escolher o arquivo, descobrir o formato,
// reduzir foto grande ao tamanho de impressão e guardar com um código feito do
// conteúdo. As partes de decisão são funções puras (testadas); só ler e
// reduzir de verdade usam o navegador.

import { FORMATOS_DE_IMAGEM, type FormatoDeImagem, type Imagem } from "../documento/modelo";

/** Largura útil do texto em A4 (21 cm menos as margens de 3 e 2 cm) a 300 pontos por polegada. */
export const LARGURA_DE_IMPRESSAO_PX = 1890;
/** Altura útil, com folga: uma figura não passa de uma página. */
export const ALTURA_DE_IMPRESSAO_PX = 2600;

const POR_TIPO: Record<string, FormatoDeImagem> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const POR_EXTENSAO: Record<string, FormatoDeImagem> = {
  png: "png",
  jpg: "jpeg",
  jpeg: "jpeg",
  gif: "gif",
  webp: "webp",
  svg: "svg",
};

/** O formato do arquivo, pelo tipo que o navegador informa ou, se faltar, pela extensão. Null se o Apud não aceita. */
export function formatoDaImagem(tipo: string, nome: string): FormatoDeImagem | null {
  const porTipo = POR_TIPO[tipo.toLowerCase()];
  if (porTipo) return porTipo;
  const ext = nome.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return (ext && POR_EXTENSAO[ext]) || null;
}

/** O tipo (MIME) de cada formato, para mostrar a imagem no editor. */
export function tipoDoFormato(f: FormatoDeImagem): string {
  return f === "svg" ? "image/svg+xml" : `image/${f}`;
}

/** A imagem como endereço que o navegador entende (<img src>). */
export const enderecoDaImagem = (i: Imagem): string => `data:${tipoDoFormato(i.formato)};base64,${i.dados}`;

/**
 * Como ficar no tamanho de impressão: a imagem só diminui, nunca aumenta, e
 * mantém a proporção. Devolve null quando já cabe (nada a fazer).
 */
export function tamanhoParaImpressao(largura: number, altura: number): { largura: number; altura: number } | null {
  if (!(largura > 0) || !(altura > 0)) return null;
  const escala = Math.min(1, LARGURA_DE_IMPRESSAO_PX / largura, ALTURA_DE_IMPRESSAO_PX / altura);
  if (escala >= 1) return null;
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) };
}

/** Só imagens que perdem pouco ao serem refeitas: GIF (pode ser animado) e SVG (é desenho, não tem pixels) ficam como estão. */
export const PODE_REDUZIR: readonly FormatoDeImagem[] = ["png", "jpeg", "webp"];

export const TIPOS_ACEITOS = FORMATOS_DE_IMAGEM.map((f) => tipoDoFormato(f)).join(",");

// ---------------------------------------------------------------------------
// Código e base64

export function paraBase64(bytes: Uint8Array): string {
  let texto = "";
  const parte = 0x8000;
  for (let i = 0; i < bytes.length; i += parte) texto += String.fromCharCode(...bytes.subarray(i, i + parte));
  return btoa(texto);
}

/** O código da imagem: os 16 primeiros dígitos do SHA-256 do conteúdo (a mesma imagem, o mesmo código). */
export async function codigoDaImagem(bytes: Uint8Array): Promise<string> {
  const resumo = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return Array.from(resumo, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

/** Monta a imagem do .apud a partir dos bytes já prontos. */
export async function imagemDosBytes(bytes: Uint8Array, formato: FormatoDeImagem, nome: string, tamanho?: { largura: number; altura: number }): Promise<Imagem> {
  return {
    id: await codigoDaImagem(bytes),
    formato,
    dados: paraBase64(bytes),
    ...(tamanho ? { largura: tamanho.largura, altura: tamanho.altura } : {}),
    nome,
  };
}

// ---------------------------------------------------------------------------
// Ler o arquivo (navegador)

export class ImagemRecusada extends Error {}

/**
 * Lê o arquivo escolhido: confere o formato, descobre o tamanho e, se a foto
 * for maior que a folha pode mostrar, reduz ao tamanho de impressão. Lança
 * ImagemRecusada com uma frase pronta para mostrar, se não der.
 */
export async function lerImagemDoArquivo(arquivo: File): Promise<Imagem> {
  const formato = formatoDaImagem(arquivo.type, arquivo.name);
  if (!formato) throw new ImagemRecusada("Esse arquivo não é uma imagem que o Apud aceite. Use PNG, JPEG, GIF, WebP ou SVG.");
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const tamanho = await medir(bytes, formato).catch(() => null);
  if (!tamanho && formato !== "svg") throw new ImagemRecusada("Não consegui abrir essa imagem. Ela pode estar estragada.");

  if (tamanho && PODE_REDUZIR.includes(formato)) {
    const menor = tamanhoParaImpressao(tamanho.largura, tamanho.altura);
    if (menor) {
      const reduzida = await reduzir(bytes, formato, menor).catch(() => null);
      if (reduzida) return imagemDosBytes(reduzida, formato, arquivo.name, menor);
    }
  }
  return imagemDosBytes(bytes, formato, arquivo.name, tamanho ?? undefined);
}

function carregar(bytes: Uint8Array, formato: FormatoDeImagem): Promise<HTMLImageElement> {
  const endereco = URL.createObjectURL(new Blob([bytes as BlobPart], { type: tipoDoFormato(formato) }));
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(endereco);
      ok(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(endereco);
      erro(new Error("imagem ilegível"));
    };
    img.src = endereco;
  });
}

async function medir(bytes: Uint8Array, formato: FormatoDeImagem): Promise<{ largura: number; altura: number } | null> {
  const img = await carregar(bytes, formato);
  // SVG sem tamanho próprio: o navegador devolve 0; nesse caso o tamanho fica desconhecido.
  return img.naturalWidth > 0 && img.naturalHeight > 0 ? { largura: img.naturalWidth, altura: img.naturalHeight } : null;
}

async function reduzir(bytes: Uint8Array, formato: FormatoDeImagem, para: { largura: number; altura: number }): Promise<Uint8Array | null> {
  const img = await carregar(bytes, formato);
  const tela = document.createElement("canvas");
  tela.width = para.largura;
  tela.height = para.altura;
  const contexto = tela.getContext("2d");
  if (!contexto) return null;
  contexto.imageSmoothingQuality = "high";
  contexto.drawImage(img, 0, 0, para.largura, para.altura);
  const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, tipoDoFormato(formato), 0.9));
  // Só vale se o navegador gravou no mesmo formato e a imagem ficou menor.
  if (!blob || blob.type !== tipoDoFormato(formato) || blob.size >= bytes.length) return null;
  return new Uint8Array(await blob.arrayBuffer());
}

// ---------------------------------------------------------------------------
// As imagens do trabalho, vistas pelo editor

/**
 * Guarda as imagens do trabalho para o editor: a figura pergunta pelo código e
 * o editor entrega o endereço para mostrar. As imagens ficam na tela do
 * trabalho (fora do editor), como as referências.
 */
export class ImagensNoEditor extends EventTarget {
  constructor(
    private lista: () => Imagem[],
    private guardar: (i: Imagem) => void,
  ) {
    super();
  }

  buscar(id: string): Imagem | undefined {
    return id ? this.lista().find((i) => i.id === id) : undefined;
  }

  /** Guarda a imagem (se ainda não estiver) e avisa as figuras. */
  adicionar(i: Imagem) {
    if (!this.buscar(i.id)) this.guardar(i);
    this.dispatchEvent(new Event("mudou"));
  }
}
