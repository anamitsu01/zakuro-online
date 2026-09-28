// Fixed, high-contrast palette for identifying players by color throughout
// the app. Deliberately avoids amber/gold, which is the app's UI accent
// color (buttons, headings), so a player's color never gets confused with
// chrome. Assigned once per player via Player.colorIndex and never reshuffled,
// so a player keeps the same color for the whole session (rejoins, "play
// again", etc.)
const PALETTE_HEX = [
  "#fb7185", // rose
  "#38bdf8", // sky
  "#34d399", // emerald
  "#a78bfa", // violet
  "#f472b6", // pink
  "#22d3ee", // cyan
  "#818cf8", // indigo
  "#fb923c", // orange
];

export interface PlayerColor {
  hex: string;
  /** Translucent background, for chips/pills. */
  bg: string;
  /** More opaque background, for stronger highlights (e.g. selected card). */
  bgStrong: string;
  /** Solid-ish border/ring color. */
  ring: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function getPlayerColor(colorIndex: number): PlayerColor {
  const i = ((colorIndex % PALETTE_HEX.length) + PALETTE_HEX.length) % PALETTE_HEX.length;
  const hex = PALETTE_HEX[i];
  const [r, g, b] = hexToRgb(hex);
  return {
    hex,
    bg: `rgba(${r}, ${g}, ${b}, 0.16)`,
    bgStrong: `rgba(${r}, ${g}, ${b}, 0.35)`,
    ring: `rgba(${r}, ${g}, ${b}, 0.95)`,
  };
}
