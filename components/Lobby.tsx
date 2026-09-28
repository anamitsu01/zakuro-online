"use client";

import { useState } from "react";
import type { RoomSettings, RoomState } from "@/lib/types";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/lib/types";
import RulesPanel from "./RulesPanel";

export default function Lobby({
  room,
  viewerId,
  onStart,
  onSettings,
}: {
  room: RoomState;
  viewerId: string;
  onStart: () => Promise<string | null>;
  onSettings: (settings: Partial<RoomSettings>) => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const me = room.players.find((p) => p.id === viewerId);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/room/${room.code}` : "";

  async function handleStart() {
    setStarting(true);
    const err = await onStart();
    setStarting(false);
    setError(err);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // clipboard unavailable; user can copy manually
    }
  }

  return (
    <div className="mx-auto max-w-xl text-center">
      <p className="mb-1 text-white/60">部屋コード</p>
      <div className="mb-4 flex items-center justify-center gap-3">
        <span className="text-5xl font-black tracking-[0.3em] text-zakuro-light">{room.code}</span>
      </div>
      <div className="mb-6 flex items-center justify-center gap-2">
        <input
          readOnly
          value={shareUrl}
          className="w-full max-w-sm rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70"
        />
        <button
          onClick={copyLink}
          className="whitespace-nowrap rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
        >
          リンクをコピー
        </button>
      </div>

      <ul className="mb-6 space-y-2 text-left">
        {room.players.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3"
          >
            <span className="truncate">
              {p.name}
              {p.isHost && <span className="ml-1 text-xs text-white/40">(ホスト)</span>}
            </span>
            {p.id === viewerId && <span className="text-sm text-white/40">(あなた)</span>}
          </li>
        ))}
      </ul>

      <label
        className={`mb-6 flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm ${
          me?.isHost ? "cursor-pointer" : "opacity-70"
        }`}
      >
        <input
          type="checkbox"
          className="mt-0.5 accent-[#c0172f]"
          checked={room.settings.deadCanSeeAll}
          disabled={!me?.isHost}
          onChange={async (e) => setError(await onSettings({ deadCanSeeAll: e.target.checked }))}
        />
        <span>
          <span className="font-semibold">死亡した幹部は全員の手の内を観戦できる</span>
          <span className="block text-white/50">
            オフにすると、死亡後も生きている時と同じ情報しか見えません(通話でのネタバレ防止)。
          </span>
        </span>
      </label>

      {room.players.length < MIN_PLAYERS && (
        <p className="mb-4 text-sm text-white/50">
          開始には{MIN_PLAYERS}〜{MAX_PLAYERS}人必要です(現在{room.players.length}人)
        </p>
      )}

      {me?.isHost ? (
        <button
          onClick={handleStart}
          disabled={starting || room.players.length < MIN_PLAYERS}
          className="rounded-full bg-zakuro px-8 py-3 font-bold text-white hover:bg-zakuro-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          {starting ? "開始中..." : "継承の儀式を始める"}
        </button>
      ) : (
        <p className="text-white/60">ホストの開始を待っています…</p>
      )}
      {error && <p className="mt-3 text-sm text-zakuro-light">{error}</p>}

      <div className="mt-10 text-left">
        <RulesPanel defaultOpen />
      </div>
    </div>
  );
}
