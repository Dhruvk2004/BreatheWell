/** The dark modules of a QR code as one SVG path ("M x y h1 v1 h-1 z" per module), for crisp scaling. */
export interface QrMatrix {
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
}

export function qrPath(qr: QrMatrix): { size: number; d: string } {
  const size = qr.getModuleCount();
  const parts: string[] = [];
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) if (qr.isDark(row, col)) parts.push(`M${col} ${row}h1v1h-1z`);
  return { size, d: parts.join("") };
}

/** The QR for a join link (spec 5.3): made in the browser, medium error correction, no external service. */
export async function joinQr(link: string): Promise<{ size: number; d: string }> {
  const { default: qrcode } = await import("qrcode-generator");
  const qr = qrcode(0, "M");
  qr.addData(link);
  qr.make();
  return qrPath(qr);
}
