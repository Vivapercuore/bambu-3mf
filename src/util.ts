/** Shared OPC/3MF helpers used across the bambu export module. */

/** XML-escape text for attribute/element content. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Round to 1e-4 mm and strip trailing zeros — shrinks file and welds verts. */
export function fmt(n: number): string {
  const r = Math.round(n * 1e4) / 1e4;
  return Object.is(r, -0) ? '0' : String(r);
}

/** RFC-4122-ish id for production-extension UUIDs (no crypto strength needed). */
export function uuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Identity 3×4 (linear 3×3 + translation) build-item transform, row-major. */
export const IDENTITY12 = '1 0 0 0 1 0 0 0 1 0 0 0';
/** Identity 4×4 used by model_settings.config part `matrix`. */
export const IDENTITY16 = '1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1';
