/**
 * Primitivos ESC/POS pra montar comandos de impressão térmica (Epson
 * TM-T20X, 80mm / 48 colunas em fonte padrão). Sem nenhuma API de browser
 * aqui — só monta bytes, o envio de verdade fica em `webusb-printer.ts`.
 */

/** Colunas úteis em fonte padrão (Font A) numa bobina de 80mm. */
export const COLUMNS = 48;

/**
 * A impressora liga com code page PC437 (americano) — texto UTF-8 cru sai
 * como lixo em qualquer acento. `ESC t 16` seleciona WPC1252 (Windows-1252),
 * que no intervalo 0xA0–0xFF é idêntico ao Latin-1/Unicode, cobrindo todo o
 * português. Por isso a codificação abaixo é só "code point vira byte":
 * qualquer caractere fora de 0x00–0xFF (emoji etc.) cai pra '?'.
 */
const SELECT_WPC1252: readonly number[] = [0x1b, 0x74, 16];

function encodeWpc1252(value: string): number[] {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0x3f;
    bytes.push(code <= 0xff ? code : 0x3f);
  }
  return bytes;
}

export class ReceiptBuilder {
  private chunks: number[] = [];

  private push(...bytes: number[]) {
    this.chunks.push(...bytes);
    return this;
  }

  /** Reinicia a impressora e fixa o code page — sempre o primeiro comando. */
  init() {
    return this.push(0x1b, 0x40, ...SELECT_WPC1252);
  }

  align(value: 'left' | 'center' | 'right') {
    const map = { left: 0, center: 1, right: 2 } as const;
    return this.push(0x1b, 0x61, map[value]);
  }

  bold(on: boolean) {
    return this.push(0x1b, 0x45, on ? 1 : 0);
  }

  /** Fonte maior (2x largura/altura) — usada pra dar destaque a um título. */
  doubleSize(on: boolean) {
    return this.push(0x1d, 0x21, on ? 0x11 : 0x00);
  }

  /**
   * Só o dobro da altura (largura normal) — dá destaque sem estourar as 48
   * colunas, então serve pra linha de item e observação.
   */
  doubleHeight(on: boolean) {
    return this.push(0x1d, 0x21, on ? 0x01 : 0x00);
  }

  /**
   * Imagem raster (`GS v 0`) — bitmap 1bpp, MSB primeiro, bit 1 = ponto
   * preto. Respeita o `align()` corrente. `atob` existe no browser e no
   * Node 16+, então serve nos dois lados.
   */
  image(bitmap: { widthBytes: number; height: number; data: string }) {
    const binary = atob(bitmap.data);
    const { widthBytes, height } = bitmap;
    this.push(
      0x1d,
      0x76,
      0x30,
      0x00,
      widthBytes & 0xff,
      (widthBytes >> 8) & 0xff,
      height & 0xff,
      (height >> 8) & 0xff,
    );
    for (let i = 0; i < binary.length; i += 1) {
      this.chunks.push(binary.charCodeAt(i));
    }
    return this;
  }

  text(value: string) {
    this.chunks.push(...encodeWpc1252(value));
    return this;
  }

  line(value = '') {
    return this.text(value).text('\n');
  }

  /**
   * Linha "rótulo à esquerda, valor à direita" preenchendo as 48 colunas.
   * Se as duas pontas não couberem, quebra em duas linhas em vez de estourar.
   */
  row(left: string, right: string) {
    const gap = COLUMNS - left.length - right.length;
    if (gap < 1) return this.line(left).line(' '.repeat(Math.max(0, COLUMNS - right.length)) + right);
    return this.line(left + ' '.repeat(gap) + right);
  }

  /** Linha pontilhada de largura cheia. */
  divider() {
    return this.line('-'.repeat(COLUMNS));
  }

  feed(lines = 1) {
    return this.push(0x1b, 0x64, lines);
  }

  /**
   * Corte parcial — a maioria dos modelos Epson usa `GS V 1`. Avança bem
   * antes de cortar pra sobrar papel em branco depois da última linha (e o
   * corte não comer o fim do texto).
   */
  cut() {
    return this.feed(6).push(0x1d, 0x56, 1);
  }

  toBytes(): Uint8Array {
    return new Uint8Array(this.chunks);
  }
}
