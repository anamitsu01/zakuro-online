"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BONUS_BY_ID, describeBonus, ITEM_LABEL, ITEM_ORDER, ROLE_BY_ID } from "@/lib/content";
import type { ClientToServerEvents } from "@/lib/socketEvents";
import type { Item, Player, PublicEvent, RoomState } from "@/lib/types";
import { exchangeAllowed, takeCountForSet, TOTAL_SETS } from "@/lib/types";
import { CompositionRow, ItemChip, ItemIcon } from "./ItemIcon";
import PlayerTag from "./PlayerTag";
import RulesPanel from "./RulesPanel";

export type Act = <E extends keyof ClientToServerEvents>(
  event: E,
  payload: Omit<Parameters<ClientToServerEvents[E]>[0], "code">
) => Promise<string | null>;

const PHASE_LABEL: Record<RoomState["phase"], string> = {
  lobby: "待機中",
  designate: "スタート指名",
  economy: "経済フェーズ",
  intel: "内偵",
  combat: "戦闘フェーズ",
  gameover: "決着",
};

function sortItems(items: Item[]): Item[] {
  return items.slice().sort((a, b) => ITEM_ORDER.indexOf(a.kind) - ITEM_ORDER.indexOf(b.kind));
}

function seatName(room: RoomState, seat: number): string {
  const p = room.players.find((pl) => pl.seat === seat);
  return p ? `${seat}番 ${p.name}` : `${seat}番`;
}

export default function Board({ room, viewerId, act }: { room: RoomState; viewerId: string; act: Act }) {
  const me = room.players.find((p) => p.id === viewerId)!;
  // Errors are tied to the turn they happened on, so they vanish once the game moves on.
  const turnKey = `${room.phase}-${room.set}-${room.turnIndex}`;
  const [errorState, setErrorState] = useState<{ key: string; message: string | null }>({ key: "", message: null });
  const error = errorState.key === turnKey ? errorState.message : null;
  const [busy, setBusy] = useState(false);
  const seesAll = room.phase === "gameover" || (!me.alive && room.settings.deadCanSeeAll);
  const actorId =
    room.phase === "designate" || room.phase === "economy" || room.phase === "combat"
      ? room.order[room.turnIndex]
      : undefined;
  const actor = room.players.find((p) => p.id === actorId);

  async function run(p: Promise<string | null>) {
    setBusy(true);
    const err = await p;
    setBusy(false);
    setErrorState({ key: turnKey, message: err });
  }

  const stuckPlayer =
    room.phase === "intel"
      ? room.players.find((p) => room.intelPending.includes(p.id) && !p.connected)
      : actor && !actor.connected
        ? actor
        : undefined;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <SetHeader room={room} />

        <section className="rounded-xl border border-zakuro-deep/60 bg-panel/90 p-4 sm:p-5">
          {room.phase === "designate" && <DesignatePanel room={room} me={me} busy={busy} onPick={(seat) => run(act("game:designate", { seat }))} />}
          {room.phase === "economy" && (
            <EconomyPanel
              key={`${room.set}-${room.turnIndex}`}
              room={room}
              me={me}
              actor={actor}
              busy={busy}
              seesAll={seesAll}
              onSubmit={(takeIds, returnId) => run(act("game:take", { takeIds, returnId }))}
            />
          )}
          {room.phase === "intel" && (
            <IntelPanel room={room} me={me} busy={busy} onPick={(targetSeat) => run(act("game:intel", { targetSeat }))} />
          )}
          {room.phase === "combat" && (
            <CombatPanel room={room} me={me} actor={actor} busy={busy} onShoot={(targetSeat) => run(act("game:shoot", { targetSeat }))} />
          )}
          {room.phase === "gameover" && (
            <GameOverPanel room={room} me={me} busy={busy} onPlayAgain={() => run(act("game:playAgain", {}))} />
          )}
          {error && <p className="mt-3 text-sm text-zakuro-light">{error}</p>}
          {me.isHost && stuckPlayer && room.phase !== "gameover" && (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-white/60">
              {stuckPlayer.seat}番 {stuckPlayer.name} が切断中です。
              <button
                disabled={busy}
                onClick={() => run(act("game:hostSkip", {}))}
                className="ml-2 rounded-full border border-white/20 px-3 py-1 text-white hover:bg-white/10 disabled:opacity-40"
              >
                代わりに手番を進める
              </button>
            </div>
          )}
        </section>

        {room.phase !== "gameover" && <MyDossier room={room} me={me} />}
      </div>

      <aside className="flex w-full flex-col gap-4 lg:w-80">
        <PlayerList room={room} me={me} actorId={actorId} seesAll={seesAll} />
        <EventLog room={room} />
        <RulesPanel />
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SetHeader({ room }: { room: RoomState }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex gap-1.5">
        {Array.from({ length: TOTAL_SETS }, (_, i) => i + 1).map((s) => (
          <span
            key={s}
            className={`h-2.5 w-8 rounded-full ${s < room.set ? "bg-zakuro-deep" : s === room.set ? "bg-zakuro" : "bg-white/10"}`}
          />
        ))}
      </div>
      <span className="font-mincho text-xl font-bold">
        {room.phase === "gameover" ? "決着" : `第${room.set}セット`}
      </span>
      {room.phase !== "gameover" && (
        <span className="rounded-full bg-zakuro/20 px-3 py-0.5 text-sm text-zakuro-light">{PHASE_LABEL[room.phase]}</span>
      )}
      {room.composition && room.phase !== "gameover" && room.phase !== "designate" && (
        <span className="text-sm text-white/50">スタート: {seatName(room, room.startSeat)}</span>
      )}
    </div>
  );
}

function TurnOrder({ room, actorId }: { room: RoomState; actorId?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm">
      {room.order.map((id, i) => {
        const p = room.players.find((pl) => pl.id === id)!;
        const done = i < room.turnIndex;
        const current = id === actorId;
        return (
          <span key={id} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-white/25">→</span>}
            <span
              className={`rounded-md px-2 py-0.5 ${
                current ? "bg-zakuro text-white" : done || !p.alive ? "text-white/30" : "bg-white/5 text-white/70"
              } ${p.alive ? "" : "line-through"}`}
            >
              {p.seat}番 {p.name}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function Waiting({ children }: { children: React.ReactNode }) {
  return <p className="animate-pulse py-2 text-white/60">{children}</p>;
}

function SeatButtons({
  players,
  busy,
  onPick,
  label,
  danger,
}: {
  players: Player[];
  busy: boolean;
  onPick: (seat: number) => void;
  label: (p: Player) => string;
  danger?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {players.map((p) => (
        <button
          key={p.id}
          disabled={busy}
          onClick={() => onPick(p.seat)}
          className={`rounded-lg border px-3 py-2.5 text-left font-semibold disabled:opacity-40 ${
            danger
              ? "border-zakuro/50 bg-zakuro/15 hover:bg-zakuro/35"
              : "border-white/15 bg-white/5 hover:bg-white/10"
          }`}
        >
          {label(p)}
        </button>
      ))}
    </div>
  );
}

function DesignatePanel({ room, me, busy, onPick }: { room: RoomState; me: Player; busy: boolean; onPick: (seat: number) => void }) {
  const holder = room.players.find((p) => p.hasRing && p.alive);
  if (holder?.id !== me.id) {
    return (
      <Waiting>
        ザクロの指輪を持つ {holder ? `${holder.seat}番 ${holder.name}` : "?"} が、このセットのスタートプレイヤーを指名しています…
      </Waiting>
    );
  }
  const alive = room.players.filter((p) => p.alive).sort((a, b) => a.seat - b.seat);
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 font-semibold">
        <ItemIcon kind="ring" /> 指輪の持ち主として、第{room.set}セットのスタートプレイヤーを指名してください
      </p>
      <p className="text-sm text-white/50">指名した幹部から継承順位の順に袋が回ります。袋の中身はこの後に公開されます。</p>
      <SeatButtons
        players={alive}
        busy={busy}
        onPick={onPick}
        label={(p) => `${p.seat}番 ${p.name}${p.id === me.id ? "(自分)" : ""}`}
      />
    </div>
  );
}

function EconomyPanel({
  room,
  me,
  actor,
  busy,
  seesAll,
  onSubmit,
}: {
  room: RoomState;
  me: Player;
  actor?: Player;
  busy: boolean;
  seesAll: boolean;
  onSubmit: (takeIds: string[], returnId: string | null) => void;
}) {
  const myTurn = actor?.id === me.id;
  const base = takeCountForSet(room.set);
  const canExchange = exchangeAllowed(room.set) && me.items.length > 0 && room.bag.length > base;
  const [takes, setTakes] = useState<string[]>([]);
  const [returnId, setReturnId] = useState<string | null>(null);

  const maxTakes = canExchange ? base + 1 : Math.min(base, room.bag.length);
  const exchanging = takes.length === base + 1;
  const valid = exchanging ? !!returnId : takes.length === Math.min(base, room.bag.length);

  function toggleTake(id: string) {
    setTakes((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= maxTakes) return prev;
      return [...prev, id];
    });
  }

  const bag = sortItems(room.bag);

  return (
    <div className="space-y-4">
      {room.composition && (
        <div>
          <p className="mb-1.5 text-xs tracking-wider text-white/40">このセットの袋(開始時)</p>
          <CompositionRow composition={room.composition} />
        </div>
      )}
      <TurnOrder room={room} actorId={actor?.id} />

      {!myTurn && (
        <>
          <Waiting>{actor ? `${actor.seat}番 ${actor.name} が袋を改めています…` : "…"}</Waiting>
          {seesAll && room.bagVisible && (
            <div>
              <p className="mb-1.5 text-xs text-white/40">(観戦)現在の袋の中身</p>
              <div className="flex flex-wrap gap-2">
                {bag.map((it) => (
                  <ItemChip key={it.id} item={it} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {myTurn && (
        <div className="space-y-4 rounded-lg border border-zakuro/40 bg-black/30 p-4">
          <p className="font-mincho text-lg font-bold">袋があなたの手に渡った</p>
          <p className="text-sm text-white/60">
            {exchangeAllowed(room.set)
              ? `${base}個取ってください。${base + 1}個取る場合は、手番の前から持っていた物を1個袋に戻します。`
              : `${base}個取ってください。`}
          </p>
          <div>
            <p className="mb-1.5 text-xs tracking-wider text-white/40">袋の中身(あなたにだけ見えています)</p>
            <div className="flex flex-wrap gap-2">
              {bag.map((it) => (
                <ItemChip key={it.id} item={it} selected={takes.includes(it.id)} onClick={() => toggleTake(it.id)} />
              ))}
            </div>
          </div>

          {canExchange && (
            <div className={exchanging ? "" : "opacity-50"}>
              <p className="mb-1.5 text-xs tracking-wider text-white/40">
                袋に戻す物{exchanging ? "を1つ選んでください" : `(${base + 1}個取る場合のみ)`}
              </p>
              <div className="flex flex-wrap gap-2">
                {sortItems(me.items).map((it) => (
                  <ItemChip
                    key={it.id}
                    item={it}
                    selected={returnId === it.id}
                    onClick={exchanging ? () => setReturnId(returnId === it.id ? null : it.id) : undefined}
                  />
                ))}
              </div>
            </div>
          )}

          <button
            disabled={!valid || busy}
            onClick={() => onSubmit(takes, exchanging ? returnId : null)}
            className="rounded-full bg-zakuro px-6 py-2.5 font-bold text-white hover:bg-zakuro-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            {exchanging ? `${base + 1}個取って1個戻す` : `${takes.length}個取って次へ渡す`}
          </button>
        </div>
      )}
    </div>
  );
}

function IntelPanel({ room, me, busy, onPick }: { room: RoomState; me: Player; busy: boolean; onPick: (seat: number | null) => void }) {
  const pending = room.intelPending.includes(me.id);
  const waitingFor = room.players.filter((p) => room.intelPending.includes(p.id));
  if (!pending) {
    return (
      <Waiting>
        戦闘の前に、{waitingFor.map((p) => `${p.seat}番 ${p.name}(${ROLE_BY_ID[p.role!].name})`).join("、")} が裏で動いています…
      </Waiting>
    );
  }
  const role = ROLE_BY_ID[me.role!];
  const others = room.players.filter((p) => p.id !== me.id).sort((a, b) => a.seat - b.seat);
  return (
    <div className="space-y-3">
      <p className="font-mincho text-lg font-bold">{role.name}の仕事</p>
      {me.intelUsed ? (
        <>
          <p className="text-sm text-white/60">能力はすでに使っています。(他の幹部には使ったかどうか分かりません)</p>
          <button
            disabled={busy}
            onClick={() => onPick(null)}
            className="rounded-full border border-white/20 px-5 py-2 hover:bg-white/10 disabled:opacity-40"
          >
            戦闘へ進む
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-white/60">{role.description} 使うなら調べる幹部を選んでください。</p>
          <SeatButtons players={others} busy={busy} onPick={onPick} label={(p) => `${p.seat}番 ${p.name}${p.alive ? "" : "(死亡)"}`} />
          <button
            disabled={busy}
            onClick={() => onPick(null)}
            className="rounded-full border border-white/20 px-5 py-2 hover:bg-white/10 disabled:opacity-40"
          >
            今回は使わない
          </button>
        </>
      )}
    </div>
  );
}

function hasUsable(me: Player, kind: "gun" | "bullet"): boolean {
  return me.items.some((it) => it.kind === kind && !it.fake);
}

function CombatPanel({
  room,
  me,
  actor,
  busy,
  onShoot,
}: {
  room: RoomState;
  me: Player;
  actor?: Player;
  busy: boolean;
  onShoot: (seat: number | null) => void;
}) {
  const myTurn = actor?.id === me.id;
  const armed = hasUsable(me, "gun") && hasUsable(me, "bullet");
  const targets = room.players.filter((p) => p.alive && p.id !== me.id).sort((a, b) => a.seat - b.seat);
  const lastShot = [...room.log].reverse().find((e) => e.set === room.set && (e.type === "shot" || e.type === "pass"));

  return (
    <div className="space-y-4">
      <TurnOrder room={room} actorId={actor?.id} />
      {lastShot && <p className="text-sm text-white/70">直前: {eventText(room, lastShot)}</p>}
      {!myTurn && <Waiting>{actor ? `${actor.seat}番 ${actor.name} が引き金に指をかけている…` : "…"}</Waiting>}
      {myTurn && (
        <div className="space-y-3 rounded-lg border border-zakuro/40 bg-black/30 p-4">
          <p className="font-mincho text-lg font-bold">あなたの番: 撃つか、見逃すか</p>
          {armed ? (
            <>
              <p className="text-sm text-white/60">弾丸を1発使って誰かを撃てます。(撃てるのはこのセットで1回だけ)</p>
              <SeatButtons players={targets} busy={busy} onPick={onShoot} danger label={(p) => `${p.seat}番 ${p.name} を撃つ`} />
            </>
          ) : (
            <p className="text-sm text-white/60">銃と弾丸が揃っていないため撃てません。</p>
          )}
          <button
            disabled={busy}
            onClick={() => onShoot(null)}
            className="rounded-full border border-white/20 px-5 py-2 hover:bg-white/10 disabled:opacity-40"
          >
            撃たない
          </button>
        </div>
      )}
    </div>
  );
}

function MyDossier({ room, me }: { room: RoomState; me: Player }) {
  const role = me.role ? ROLE_BY_ID[me.role] : null;
  const notesRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    notesRef.current?.scrollTo({ top: notesRef.current.scrollHeight });
  }, [me.notes.length]);

  return (
    <section className="grid gap-4 rounded-xl border border-white/10 bg-panel/80 p-4 sm:grid-cols-2 sm:p-5">
      <div className="space-y-3">
        <div>
          <p className="text-xs tracking-wider text-white/40">あなた</p>
          <p className="font-mincho text-lg font-bold">
            継承順位 {me.seat}番・{role?.name}
            {!me.alive && <span className="ml-2 text-zakuro-light">(死亡)</span>}
          </p>
          <p className="text-sm text-white/60">{role?.description}</p>
        </div>
        {me.bonus && (
          <div className="rounded-lg border border-brass/30 bg-brass/5 p-3">
            <p className="text-xs tracking-wider text-brass/80">秘密ボーナス(あなただけが知っている)</p>
            <p className="font-bold">《{BONUS_BY_ID[me.bonus.id].name}》</p>
            <p className="text-sm text-white/70">{describeBonus(me.bonus)} 達成で宝石+1。</p>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs tracking-wider text-white/40">所持品(他の幹部には見えません)</p>
          {me.items.length ? (
            <div className="flex flex-wrap gap-2">
              {sortItems(me.items).map((it) => (
                <ItemChip key={it.id} item={it} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/40">なし</p>
          )}
        </div>
        {me.notes.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs tracking-wider text-white/40">あなただけが知っていること</p>
            <ul ref={notesRef} className="max-h-36 space-y-1 overflow-y-auto text-sm text-white/75">
              {me.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {room.phase !== "gameover" && me.alive && me.knownFakeIds.length > 0 && (
        <p className="text-xs text-white/40 sm:col-span-2">「偽」印は、あなたが偽物だと知っている物です。</p>
      )}
    </section>
  );
}

function PlayerList({ room, me, actorId, seesAll }: { room: RoomState; me: Player; actorId?: string; seesAll: boolean }) {
  const players = room.players.slice().sort((a, b) => a.seat - b.seat);
  const actingIds = room.phase === "intel" ? room.intelPending : actorId ? [actorId] : [];
  return (
    <section className="rounded-xl border border-white/10 bg-panel/80 p-4">
      <h2 className="mb-3 font-mincho font-bold">幹部たち(継承順位順)</h2>
      <ul className="space-y-2">
        {players.map((p) => {
          const role = p.role ? ROLE_BY_ID[p.role] : null;
          const acting = actingIds.includes(p.id);
          const showSecrets = seesAll && p.id !== me.id;
          return (
            <li
              key={p.id}
              className={`rounded-lg border px-3 py-2 ${acting ? "border-zakuro bg-zakuro/10" : "border-white/5 bg-white/[0.03]"} ${
                p.alive ? "" : "opacity-60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <PlayerTag player={p} showSeat />
                <span className="flex shrink-0 items-center gap-1 text-xs">
                  {p.hasRing && (
                    <span title="ザクロの指輪" className="inline-flex items-center">
                      <ItemIcon kind="ring" className="h-5 w-5" />
                    </span>
                  )}
                  {!p.alive && <span className="text-zakuro-light">死亡</span>}
                  {!p.connected && <span className="text-white/40">切断</span>}
                  {p.id === me.id && <span className="text-white/40">あなた</span>}
                </span>
              </div>
              {role && (
                <p className="mt-0.5 text-xs text-white/55">
                  <b className="text-bone/80">{role.name}</b> — {role.description}
                </p>
              )}
              {showSecrets && (
                <div className="mt-1.5 space-y-1 border-t border-white/5 pt-1.5 text-xs">
                  {p.bonus && (
                    <p className="text-brass/90">
                      《{BONUS_BY_ID[p.bonus.id].name}》{describeBonus(p.bonus)}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {sortItems(p.items).map((it) => (
                      <span key={it.id} className="inline-flex items-center gap-0.5 rounded bg-white/5 px-1">
                        <ItemIcon kind={it.kind} className="h-3.5 w-3.5" />
                        {ITEM_LABEL[it.kind]}
                        {it.fake && <span className="text-white/50">(偽)</span>}
                      </span>
                    ))}
                    {p.items.length === 0 && <span className="text-white/30">所持品なし</span>}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {seesAll && room.phase !== "gameover" && <p className="mt-3 text-xs text-white/40">観戦中: 全員の手の内が見えています。</p>}
    </section>
  );
}

function eventText(room: RoomState, e: PublicEvent): string {
  switch (e.type) {
    case "setStart":
      return `第${e.set}セット開始。${seatName(room, e.startSeat)} から袋が回る。`;
    case "designate":
      return `指輪の持ち主 ${seatName(room, e.bySeat)} が ${seatName(room, e.startSeat)} をスタートに指名した。`;
    case "bagTurn":
      return `${seatName(room, e.seat)} が袋を改めた。`;
    case "ring":
      return e.action === "took"
        ? `${seatName(room, e.seat)} がザクロの指輪を手にした。`
        : `${seatName(room, e.seat)} がザクロの指輪を袋に戻した。`;
    case "shot": {
      const head = `${seatName(room, e.shooterSeat)} が ${seatName(room, e.targetSeat)} を撃った`;
      if (e.outcome === "misfire") return `${head} — カチッ。不発。`;
      if (e.outcome === "blocked") return `${head} — 身代わり人形が弾を受けた。`;
      return `${head} — ${seatName(room, e.targetSeat)} は死亡した。`;
    }
    case "pass":
      return `${seatName(room, e.seat)} は撃たなかった。`;
    case "loot":
      return `${seatName(room, e.shooterSeat)} が亡骸から所持品をすべて奪った。`;
    case "setEnd":
      return `第${e.set}セット終了。袋の残りは捨てられた。`;
  }
}

function EventLog({ room }: { room: RoomState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [room.log.length]);
  return (
    <section className="rounded-xl border border-white/10 bg-panel/80 p-4">
      <h2 className="mb-2 font-mincho font-bold">記録</h2>
      <div ref={ref} className="max-h-72 space-y-1.5 overflow-y-auto pr-1 text-sm">
        {room.log.map((e, i) => (
          <div key={i}>
            {e.type === "setStart" && (
              <div className="mb-1 mt-2 space-y-1 border-t border-white/10 pt-2">
                <p className="font-semibold text-bone">{eventText(room, e)}</p>
                <CompositionRow composition={e.composition} />
              </div>
            )}
            {e.type !== "setStart" && (
              <p
                className={
                  e.type === "shot"
                    ? e.outcome === "killed"
                      ? "font-semibold text-zakuro-light"
                      : "text-bone/90"
                    : e.type === "ring" || e.type === "designate"
                      ? "text-brass"
                      : "text-white/50"
                }
              >
                {eventText(room, e)}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function GameOverPanel({ room, me, busy, onPlayAgain }: { room: RoomState; me: Player; busy: boolean; onPlayAgain: () => void }) {
  const winner = room.players.find((p) => p.id === room.winnerIds[0]);
  const rows = useMemo(
    () =>
      room.players
        .map((p) => ({ p, s: room.finalScores.find((f) => f.playerId === p.id)! }))
        .sort((a, b) => Number(b.p.alive) - Number(a.p.alive) || b.s.total - a.s.total || a.p.seat - b.p.seat),
    [room.players, room.finalScores]
  );

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-xs tracking-[0.4em] text-zakuro-light/80">NEW BOSS</p>
        <p className="font-mincho text-3xl font-black">
          {winner ? `${winner.seat}番 ${winner.name}` : "該当者なし"}
        </p>
        <p className="text-sm text-white/60">
          {room.endedEarly ? "ただ一人生き残り、ボスの座に就いた。" : "がザクロの指輪を継ぐ次のボスとなった。"}
          {winner?.id === me.id && <span className="ml-1 font-bold text-zakuro-light">(あなた)</span>}
        </p>
      </div>

      <div className="space-y-2">
        {rows.map(({ p, s }) => (
          <div
            key={p.id}
            className={`rounded-lg border p-3 ${p.id === winner?.id ? "border-zakuro bg-zakuro/10" : "border-white/10 bg-white/[0.03]"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <PlayerTag player={p} showSeat />
                <span className="text-xs text-white/50">{p.role && ROLE_BY_ID[p.role].name}</span>
              </span>
              <span className="text-sm">
                {p.alive ? (
                  <>
                    宝石{s.gems}
                    {s.ring ? " + 指輪1" : ""}
                    {s.bonus ? " + ボーナス1" : ""} = <b className="text-lg text-bone">{s.total}</b>
                  </>
                ) : (
                  <span className="text-zakuro-light">死亡</span>
                )}
              </span>
            </div>
            {p.bonus && (
              <p className="mt-1 text-xs text-white/60">
                <span className={s.bonusAchieved ? "text-brass" : "text-white/40"}>
                  {s.bonusAchieved ? "✓ 達成" : "✗ 未達成"}
                </span>{" "}
                《{BONUS_BY_ID[p.bonus.id].name}》{describeBonus(p.bonus)}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1 text-xs">
              {sortItems(p.items).map((it) => (
                <span key={it.id} className="inline-flex items-center gap-0.5 rounded bg-white/5 px-1">
                  <ItemIcon kind={it.kind} className="h-3.5 w-3.5" />
                  {ITEM_LABEL[it.kind]}
                  {it.fake && <span className="text-zakuro-light">(偽)</span>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <History room={room} />

      <div className="text-center">
        {me.isHost ? (
          <button
            disabled={busy}
            onClick={onPlayAgain}
            className="rounded-full bg-zakuro px-8 py-3 font-bold text-white hover:bg-zakuro-light disabled:opacity-40"
          >
            同じメンバーでもう一度
          </button>
        ) : (
          <p className="text-sm text-white/50">ホストが次のゲームを始めるのを待っています…</p>
        )}
      </div>
    </div>
  );
}

/** 答え合わせ: who took and returned what, set by set. */
function History({ room }: { room: RoomState }) {
  const sets = [...new Set(room.history.map((h) => h.set))];
  if (!sets.length) return null;
  return (
    <details className="rounded-lg border border-white/10 bg-black/20 p-3" open>
      <summary className="cursor-pointer font-mincho font-bold">答え合わせ: 袋の中で何が起きていたか</summary>
      <div className="mt-2 space-y-3">
        {sets.map((set) => (
          <div key={set}>
            <p className="mb-1 text-sm font-semibold text-bone">第{set}セット</p>
            <ul className="space-y-1 text-xs">
              {room.history
                .filter((h) => h.set === set)
                .map((h, i) => {
                  const p = room.players.find((pl) => pl.id === h.playerId)!;
                  return (
                    <li key={i} className="flex flex-wrap items-center gap-1">
                      <span className="w-24 shrink-0 truncate text-white/70">
                        {p.seat}番 {p.name}
                      </span>
                      <span className="text-white/40">取った:</span>
                      {h.took.map((it) => (
                        <span key={it.id} className="inline-flex items-center gap-0.5">
                          <ItemIcon kind={it.kind} className="h-3.5 w-3.5" />
                          {ITEM_LABEL[it.kind]}
                          {it.fake && <span className="text-zakuro-light">(偽)</span>}
                        </span>
                      ))}
                      {h.returned && (
                        <>
                          <span className="ml-2 text-white/40">戻した:</span>
                          <span className="inline-flex items-center gap-0.5">
                            <ItemIcon kind={h.returned.kind} className="h-3.5 w-3.5" />
                            {ITEM_LABEL[h.returned.kind]}
                            {h.returned.fake && <span className="text-zakuro-light">(偽)</span>}
                          </span>
                        </>
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
