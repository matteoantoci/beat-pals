// The shelf packer of the texture atlas (./atlas): it places the shapes in rows, left to right.

/** A place in the atlas, in CSS px. */
export type Frame = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

const ROW_WIDTH = 1024;
const PAD = 2;

/** Places the shapes in rows, left to right. */
export const pack = (
  shapes: readonly { readonly key: string; readonly w: number; readonly h: number }[]
): { frames: Map<string, Frame>; width: number; height: number } => {
  const frames = new Map<string, Frame>();
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  for (const shape of shapes) {
    const w = Math.ceil(shape.w) + PAD;
    const h = Math.ceil(shape.h) + PAD;
    const wrap = x + w > ROW_WIDTH;
    y += wrap ? rowHeight : 0;
    rowHeight = wrap ? h : Math.max(rowHeight, h);
    x = wrap ? 0 : x;
    frames.set(shape.key, { x: x + PAD / 2, y: y + PAD / 2, w: Math.ceil(shape.w), h: Math.ceil(shape.h) });
    x += w;
  }
  return { frames, width: ROW_WIDTH, height: y + rowHeight };
};
