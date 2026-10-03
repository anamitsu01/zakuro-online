"use client";

import { useEffect, useState } from "react";
import type { PublicEvent, RoomState } from "@/lib/types";
import { ItemArt } from "./ItemIcon";

type ShotEvent = Extract<PublicEvent, { type: "shot" }>;

const FIRE_MS = 1400;
const RESULT_MS = 2200;

/**
 * Full-screen cut-ins for each shot: first "X が Y に発砲!", then the outcome.
 * Shots already in the log when this mounts (page load, rejoin) are not replayed.
 */
export default function ShotCutIn({ room, viewerId }: { room: RoomState; viewerId: string }) {
  const [seen, setSeen] = useState(() => room.log.length);
  const [stage, setStage] = useState<"fire" | "result">("fire");

  // A rematch starts a fresh, shorter log; read it from the beginning.
  const from = seen > room.log.length ? 0 : seen;
  const index = room.log.findIndex((e, i) => i >= from && e.type === "shot");
  const shot = index >= 0 ? (room.log[index] as ShotEvent) : null;

  function advance() {
    if (stage === "fire") {
      setStage("result");
    } else {
      setStage("fire");
      setSeen(index + 1);
    }
  }

  useEffect(() => {
    if (!shot) return;
    const t = setTimeout(advance, stage === "fire" ? FIRE_MS : RESULT_MS);
    return () => clearTimeout(t);
  });

  if (!shot) return null;

  const name = (seat: number) => {
    const p = room.players.find((pl) => pl.seat === seat);
    if (!p) return `${seat}番`;
    return p.id === viewerId ? `${seat}番 あなた` : `${seat}番 ${p.name}`;
  };
  const target = name(shot.targetSeat);

  let band = "bg-zakuro";
  let headline: React.ReactNode;
  let sub: string;
  if (stage === "fire") {
    // Break between the two names rather than mid-phrase.
    headline = (
      <>
        <span className="inline-block">{name(shot.shooterSeat)} が</span>{" "}
        <span className="inline-block">{target} に発砲!</span>
      </>
    );
    sub = "";
  } else if (shot.outcome === "killed") {
    headline = "成功!";
    sub = `${target} は死亡した`;
    band = "bg-[#7a0c1f]";
  } else if (shot.outcome === "blocked") {
    headline = "失敗";
    sub = `${target} は人形が身代わりになった`;
    band = "bg-[#3a2a1c]";
  } else {
    headline = "不発";
    sub = "カチッ……弾は出なかった";
    band = "bg-[#2a2a2e]";
  }

  return (
    <div
      className="fixed inset-0 z-40 flex cursor-pointer items-center justify-center overflow-hidden bg-black/60"
      onClick={advance}
      role="status"
      aria-live="assertive"
    >
      <div key={`${index}-${stage}`} className={`zk-cutin w-[130%] ${band} py-6 shadow-2xl sm:py-8`}>
        <div className="zk-cutin-text mx-auto flex max-w-3xl items-center justify-center gap-4 px-6 sm:gap-6">
          {stage === "fire" && <ItemArt kind="gun" className="h-16 w-16 shrink-0 sm:h-24 sm:w-24" />}
          {stage === "result" && shot.outcome === "blocked" && (
            <ItemArt kind="doll" className="h-16 w-16 shrink-0 sm:h-24 sm:w-24" />
          )}
          <div className="min-w-0 text-center">
            <p
              className={`font-mincho font-black text-white drop-shadow ${
                stage === "fire" ? "text-3xl sm:text-5xl" : "text-5xl tracking-widest sm:text-7xl"
              }`}
            >
              {headline}
            </p>
            {sub && <p className="mt-2 font-mincho text-lg font-bold text-bone sm:text-2xl">{sub}</p>}
          </div>
        </div>
      </div>
      <p className="absolute bottom-6 text-xs text-white/40">タップで次へ</p>
    </div>
  );
}
