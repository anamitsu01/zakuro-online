"use client";

import { getPlayerColor } from "@/lib/playerColors";
import type { Player } from "@/lib/types";

export default function PlayerTag({
  player,
  size = "md",
  showSeat = false,
}: {
  player: Pick<Player, "name" | "colorIndex" | "isHost" | "seat"> & Partial<Pick<Player, "connected" | "alive">>;
  size?: "sm" | "md";
  showSeat?: boolean;
}) {
  const color = getPlayerColor(player.colorIndex);
  const dotSize = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
  const connected = player.connected ?? true;
  const alive = player.alive ?? true;

  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${alive ? "" : "text-white/40 line-through"}`}>
      {showSeat && player.seat > 0 && (
        <span className="shrink-0 rounded bg-white/10 px-1.5 text-xs font-bold tabular-nums text-bone no-underline">
          {player.seat}
        </span>
      )}
      <span
        className={`${dotSize} shrink-0 rounded-full`}
        style={{ backgroundColor: color.hex, opacity: connected ? 1 : 0.35 }}
      />
      <span className="truncate">
        {player.name}
        {player.isHost ? <span className="ml-1 text-xs text-white/40">(ホスト)</span> : null}
      </span>
    </span>
  );
}
