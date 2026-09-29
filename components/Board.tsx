"use client";

import { useMemo, useState } from "react";
import { BONUS_BY_ID, describeBonus, ITEM_ORDER, ROLE_BY_ID } from "@/lib/content";
import type { ClientToServerEvents } from "@/lib/socketEvents";
import type { Item, Player, PublicEvent, RoomState } from "@/lib/types";
import { exchangeAllowed, takeCountForSet, TOTAL_SETS } from "@/lib/types";
import { BagArt, CompositionRow, ItemArt, ItemCard, ItemChip } from "./ItemIcon";
import RulesPanel from "./RulesPanel";

export type Act = <E extends keyof ClientToServerEvents>(
  event: E,
  payload: Omit<Parameters<ClientToServerEvents[E]>[0], "code">
) => Promise<string | null>;

const PHASE_LABEL: Record<RoomState["phase"], string> = {
  lobby: "待機中",
  briefing: "素性の確認",
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

function currentActorId(room: RoomState): string | undefined {
  return room.phase === "designate" || room.phase === "economy" || room.phase === "combat"
    ? room.order[room.turnIndex]
    : undefined;
}

export default function Board({ room, viewerId, act }: { room: RoomState; viewerId: string; act: Act }) {
  const me = room.players.find((p) => p.id === viewerId)!;
  const [busy, setBusy] = useState(false);
  // Errors are tied to the turn they happened on, so they vanish once the game moves on.
  const turnKey = `${room.phase}-${room.set}-${room.turnIndex}`;
  const [errorState, setErrorState] = useState<{ key: string; message: string | null }>({ key: "", message: null });
  const error = errorState.key === turnKey ? errorState.message : null;
  const seesAll = room.phase === "gameover" || (!me.alive && room.settings.deadCanSeeAll);
  const actorId = currentActorId(room);
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

  if (room.phase === "briefing") {
    return (
      <Briefing
        room={room}
        me={me}
        busy={busy}
        error={error}
        onReady={() => run(act("game:ready", {}))}
        onHostSkip={() => run(act("game:hostSkip", {}))}
      />
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <main className="flex min-w-0 flex-col gap-4">
        <IdentityCards me={me} />

        <section className="flex min-h-[20rem] flex-col rounded-2xl border border-zakuro-deep/70 bg-panel/90 p-4 sm:p-6">
          <StageHeader room={room} />
          <div className="flex flex-1 flex-col justify-center">
            {room.phase === "designate" && (
              <DesignateStage room={room} me={me} busy={busy} onPick={(seat) => run(act("game:designate", { seat }))} />
            )}
            {room.phase === "economy" && (
              <EconomyStage
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
              <IntelStage room={room} me={me} busy={busy} onPick={(targetSeat) => run(act("game:intel", { targetSeat }))} />
            )}
            {room.phase === "combat" && (
              <CombatStage room={room} me={me} actor={actor} busy={busy} onShoot={(targetSeat) => run(act("game:shoot", { targetSeat }))} />
            )}
            {room.phase === "gameover" && (
              <GameOverStage room={room} me={me} busy={busy} onPlayAgain={() => run(act("game:playAgain", {}))} />
            )}
          </div>
          {error && <p className="mt-3 text-center text-sm text-zakuro-light">{error}</p>}
          {me.isHost && stuckPlayer && room.phase !== "gameover" && (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-center text-sm text-white/60">
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

        {room.phase !== "gameover" && <HandCard me={me} />}
      </main>

      <aside className="flex flex-col gap-4">
        <PlayerCards room={room} me={me} actorId={actorId} seesAll={seesAll} />
        <RecentLog room={room} />
        <RulesPanel />
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Before set 1: everyone reads who they are, then presses start

function Briefing({
  room,
  me,
  busy,
  error,
  onReady,
  onHostSkip,
}: {
  room: RoomState;
  me: Player;
  busy: boolean;
  error: string | null;
  onReady: () => void;
  onHostSkip: () => void;
}) {
  const role = me.role ? ROLE_BY_ID[me.role] : null;
  const bonus = me.bonus ? BONUS_BY_ID[me.bonus.id] : null;
  const ready = room.readyIds.includes(me.id);
  const waiting = room.players.filter((p) => !room.readyIds.includes(p.id)).sort((a, b) => a.seat - b.seat);
  const stuck = waiting.some((p) => !p.connected);
  const others = room.players.filter((p) => p.id !== me.id).sort((a, b) => a.seat - b.seat);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="text-center">
        <p className="text-xs tracking-[0.4em] text-zakuro-light/80">THE SUCCESSION</p>
        <h1 className="font-mincho text-2xl font-black sm:text-3xl">あなたの素性</h1>
        <p className="mt-1 text-sm text-white/55">役職は全員に公開、秘密ボーナスはあなただけが知っています。</p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-panel/90 p-4">
          <span className="text-xs text-white/45">継承順位</span>
          <span className="font-mincho text-6xl font-black leading-tight text-bone">{me.seat}</span>
          <span className="text-center text-[11px] leading-snug text-white/45">番号が小さいほど同点のときに有利</span>
        </div>
        <div className="flex gap-4 rounded-2xl border border-white/10 bg-panel/90 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/45">役職(全員に公開)</p>
            <p className="font-mincho text-2xl font-bold text-bone">{role?.name}</p>
            <p className="text-xs text-white/45">シノギ: {role?.shinogi}</p>
            <p className="mt-2 text-sm text-white/75">{role?.description}</p>
          </div>
          {me.items.length > 0 && (
            <div className="flex shrink-0 flex-col items-center gap-1">
              <span className="text-[11px] text-white/45">初期所持品</span>
              {sortItems(me.items).map((it) => (
                <ItemCard key={it.id} item={it} size="md" />
              ))}
            </div>
          )}
        </div>
      </div>

      {bonus && me.bonus && (
        <div className="rounded-2xl border border-brass/60 bg-brass/[0.07] p-4 text-center">
          <p className="text-xs text-brass/90">秘密ボーナス(あなただけが知っている)</p>
          <p className="font-mincho text-2xl font-bold text-bone">《{bonus.name}》</p>
          <p className="mt-1 text-sm text-white/80">{describeBonus(me.bonus)}</p>
          <p className="mt-1 text-xs text-white/50">生きたまま達成すれば、最後に宝石1個分が加算されます。</p>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-panel/80 p-4">
        <p className="mb-2 text-xs text-white/45">他の幹部たち</p>
        <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
          {others.map((p) => (
            <li key={p.id} className="flex items-baseline gap-2">
              <span className="w-5 shrink-0 text-center font-mincho text-lg font-black text-bone">{p.seat}</span>
              <span className="min-w-0">
                <span className="font-semibold">{p.name}</span>
                <span className="text-white/55"> — {ROLE_BY_ID[p.role!].name}</span>
                <span className="block text-xs text-white/40">{ROLE_BY_ID[p.role!].description}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col items-center gap-2 pb-4">
        {ready ? (
          <p className="animate-pulse font-mincho text-lg text-bone">準備完了。他の幹部を待っています…</p>
        ) : (
          <PrimaryButton disabled={busy} onClick={onReady}>
            ゲームを始める
          </PrimaryButton>
        )}
        <p className="text-sm text-white/50">
          準備完了 {room.readyIds.length}/{room.players.length}人
          {ready && waiting.length > 0 && <>(待機中: {waiting.map((p) => `${p.seat}番 ${p.name}`).join("、")})</>}
        </p>
        {error && <p className="text-sm text-zakuro-light">{error}</p>}
        {me.isHost && stuck && (
          <button
            disabled={busy}
            onClick={onHostSkip}
            className="rounded-full border border-white/20 px-3 py-1 text-sm text-white/70 hover:bg-white/10 disabled:opacity-40"
          >
            切断中の幹部を準備完了にする
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top: who you are

function IdentityCards({ me }: { me: Player }) {
  const role = me.role ? ROLE_BY_ID[me.role] : null;
  const bonus = me.bonus ? BONUS_BY_ID[me.bonus.id] : null;
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3">
      <div className="relative flex flex-col items-center justify-center rounded-xl border border-white/10 bg-panel/90 p-2">
        <span className="text-[11px] text-white/45">継承順位</span>
        <span className="font-mincho text-4xl font-black leading-none text-bone">{me.seat}</span>
        {!me.alive && (
          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/70 font-mincho text-xl font-bold text-zakuro-light">
            死亡
          </span>
        )}
      </div>
      <div className="rounded-xl border border-white/10 bg-panel/90 p-3">
        <p className="text-[11px] text-white/45">役職(全員に公開)</p>
        <p className="font-mincho text-lg font-bold text-bone">{role?.name}</p>
        <p className="text-xs text-white/60">{role?.description}</p>
      </div>
      {bonus && me.bonus && (
        <div className="col-span-2 rounded-xl border border-brass/50 bg-brass/[0.06] p-3 sm:col-span-1">
          <p className="text-[11px] text-brass/90">秘密ボーナス(あなただけが知っている・達成で宝石+1)</p>
          <p className="font-mincho text-lg font-bold text-bone">《{bonus.name}》</p>
          <p className="text-xs text-white/70">{describeBonus(me.bonus)}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Center: what's happening now

function StageHeader({ room }: { room: RoomState }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
      <div className="flex gap-1">
        {Array.from({ length: TOTAL_SETS }, (_, i) => i + 1).map((s) => (
          <span
            key={s}
            className={`h-2 w-6 rounded-full ${s < room.set ? "bg-zakuro-deep" : s === room.set ? "bg-zakuro" : "bg-white/10"}`}
          />
        ))}
      </div>
      <span className="font-mincho font-bold">{room.phase === "gameover" ? "決着" : `第${room.set}セット`}</span>
      {room.phase !== "gameover" && <span className="text-zakuro-light">{PHASE_LABEL[room.phase]}</span>}
    </div>
  );
}

function Headline({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="text-center">
      <p className="font-mincho text-xl font-bold text-bone sm:text-2xl">{children}</p>
      {sub && <p className="mt-1 text-sm text-white/55">{sub}</p>}
    </div>
  );
}

function PrimaryButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded-full bg-zakuro px-7 py-3 font-bold text-white hover:bg-zakuro-light disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border border-white/20 px-6 py-2.5 hover:bg-white/10 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SeatGrid({
  players,
  busy,
  onPick,
  sub,
  danger,
}: {
  players: Player[];
  busy: boolean;
  onPick: (seat: number) => void;
  sub?: (p: Player) => string;
  danger?: boolean;
}) {
  return (
    <div className="mx-auto grid w-full max-w-xl grid-cols-2 gap-2 sm:grid-cols-3">
      {players.map((p) => (
        <button
          key={p.id}
          disabled={busy}
          onClick={() => onPick(p.seat)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left disabled:opacity-40 ${
            danger ? "border-zakuro/50 bg-zakuro/10 hover:bg-zakuro/30" : "border-white/15 bg-white/5 hover:bg-white/10"
          }`}
        >
          <span className="font-mincho text-2xl font-black text-bone">{p.seat}</span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{p.name}</span>
            <span className="block truncate text-xs text-white/50">{sub ? sub(p) : ROLE_BY_ID[p.role!].name}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function DesignateStage({ room, me, busy, onPick }: { room: RoomState; me: Player; busy: boolean; onPick: (seat: number) => void }) {
  const holder = room.players.find((p) => p.hasRing && p.alive);
  if (holder?.id !== me.id) {
    return (
      <div className="flex flex-col items-center gap-4">
        <ItemArt kind="ring" className="h-24 w-24 animate-pulse" />
        <Headline sub="指名された幹部から継承順位の順に袋が回ります。">
          {holder ? `${holder.seat}番 ${holder.name}` : "?"} がスタートを指名中…
        </Headline>
      </div>
    );
  }
  const alive = room.players.filter((p) => p.alive).sort((a, b) => a.seat - b.seat);
  return (
    <div className="flex flex-col items-center gap-4">
      <ItemArt kind="ring" className="h-20 w-20" />
      <Headline sub="袋の中身は指名の後に公開されます。自分を指名してもかまいません。">
        第{room.set}セットのスタートを指名してください
      </Headline>
      <SeatGrid players={alive} busy={busy} onPick={onPick} sub={(p) => (p.id === me.id ? "自分" : ROLE_BY_ID[p.role!].name)} />
    </div>
  );
}

function EconomyStage({
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
  const bag = sortItems(room.bag);

  function toggleTake(id: string) {
    setTakes((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= maxTakes) return prev;
      return [...prev, id];
    });
  }

  const composition = room.composition && (
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-xs text-white/40">このセットの袋(開始時)</p>
      <CompositionRow composition={room.composition} />
    </div>
  );

  if (!myTurn) {
    const myPos = room.order.indexOf(me.id);
    const remaining = myPos - room.turnIndex;
    return (
      <div className="flex flex-col items-center gap-4">
        <BagArt className="h-28 w-28 animate-pulse" />
        <Headline
          sub={
            remaining > 0
              ? `あなたの番まであと${remaining}人`
              : myPos >= 0 && myPos < room.turnIndex
                ? "あなたはこのセットの袋を確認済みです"
                : undefined
          }
        >
          {actor ? `${actor.seat}番 ${actor.name}` : "…"} が袋を確認中…
        </Headline>
        {seesAll && room.bagVisible && (
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-xs text-white/40">(観戦)現在の袋の中身</p>
            <div className="flex flex-wrap justify-center gap-1">
              {bag.map((it) => (
                <ItemChip key={it.id} item={it} />
              ))}
            </div>
          </div>
        )}
        {composition}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <Headline
        sub={
          exchangeAllowed(room.set)
            ? `${base}個取ってください。${base + 1}個取る場合は、手番の前から持っていた物を1個袋に戻します。`
            : `${base}個取ってください。`
        }
      >
        袋があなたの手に渡った
      </Headline>
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        {bag.map((it) => (
          <ItemCard key={it.id} item={it} selected={takes.includes(it.id)} onClick={() => toggleTake(it.id)} />
        ))}
      </div>

      {exchanging && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-sm text-bone">袋に戻す物を1つ選んでください</p>
          <div className="flex flex-wrap justify-center gap-2">
            {sortItems(me.items).map((it) => (
              <ItemCard
                key={it.id}
                item={it}
                size="md"
                selected={returnId === it.id}
                onClick={() => setReturnId(returnId === it.id ? null : it.id)}
              />
            ))}
          </div>
        </div>
      )}

      <PrimaryButton disabled={!valid || busy} onClick={() => onSubmit(takes, exchanging ? returnId : null)}>
        {exchanging ? `${base + 1}個取って1個戻す` : `${takes.length}/${Math.min(base, room.bag.length)}個 取って次へ渡す`}
      </PrimaryButton>
      {composition}
    </div>
  );
}

function IntelStage({ room, me, busy, onPick }: { room: RoomState; me: Player; busy: boolean; onPick: (seat: number | null) => void }) {
  const pending = room.intelPending.includes(me.id);
  if (!pending) {
    const names = room.players
      .filter((p) => room.intelPending.includes(p.id))
      .map((p) => `${p.seat}番 ${p.name}`)
      .join("、");
    return (
      <div className="flex flex-col items-center gap-3">
        <Headline sub="戦闘の前に、情報を扱う幹部が裏で動いています。">{names} が動いている…</Headline>
      </div>
    );
  }
  const role = ROLE_BY_ID[me.role!];
  const others = room.players.filter((p) => p.id !== me.id).sort((a, b) => a.seat - b.seat);
  if (me.intelUsed) {
    return (
      <div className="flex flex-col items-center gap-4">
        <Headline sub="能力はすでに使っています。(他の幹部には使ったかどうか分かりません)">{role.name}の仕事</Headline>
        <SecondaryButton disabled={busy} onClick={() => onPick(null)}>
          戦闘へ進む
        </SecondaryButton>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4">
      <Headline sub={`${role.description} 使うなら調べる幹部を選んでください。`}>{role.name}の仕事</Headline>
      <SeatGrid players={others} busy={busy} onPick={onPick} sub={(p) => (p.alive ? ROLE_BY_ID[p.role!].name : "死亡")} />
      <SecondaryButton disabled={busy} onClick={() => onPick(null)}>
        今回は使わない
      </SecondaryButton>
    </div>
  );
}

function CombatStage({
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
  const armed = me.items.some((it) => it.kind === "gun" && !it.fake) && me.items.some((it) => it.kind === "bullet" && !it.fake);
  const targets = room.players.filter((p) => p.alive && p.id !== me.id).sort((a, b) => a.seat - b.seat);
  const lastShot = [...room.log].reverse().find((e) => e.set === room.set && (e.type === "shot" || e.type === "pass"));
  const last = lastShot && (
    <p className="rounded-lg bg-black/30 px-3 py-1.5 text-center text-sm text-white/75">直前: {eventText(room, lastShot)}</p>
  );

  if (!myTurn) {
    return (
      <div className="flex flex-col items-center gap-4">
        <ItemArt kind="gun" className="h-24 w-24 animate-pulse" />
        <Headline>{actor ? `${actor.seat}番 ${actor.name}` : "…"} が引き金に指をかけている…</Headline>
        {last}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4">
      <Headline sub={armed ? "弾丸を1発使って誰かを撃てます(このセットで1回だけ)。" : "銃と弾丸が揃っていないため撃てません。"}>
        あなたの番: 撃つか、見逃すか
      </Headline>
      {last}
      {armed && <SeatGrid players={targets} busy={busy} onPick={onShoot} danger />}
      <SecondaryButton disabled={busy} onClick={() => onShoot(null)}>
        撃たない
      </SecondaryButton>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bottom: what you hold

function HandCard({ me }: { me: Player }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-panel/80 p-4">
      <p className="mb-2 text-xs text-white/45">あなたの所持品(他の幹部には見えません)</p>
      {me.items.length ? (
        <div className="flex flex-wrap gap-2">
          {sortItems(me.items).map((it) => (
            <ItemCard key={it.id} item={it} size="md" />
          ))}
        </div>
      ) : (
        <p className="py-3 text-sm text-white/35">何も持っていない</p>
      )}
      {me.knownFakeIds.length > 0 && me.alive && (
        <p className="mt-2 text-xs text-white/40">「偽」印は、あなたが偽物だと知っている物です。</p>
      )}
      {me.notes.length > 0 && (
        <div className="mt-3 border-t border-white/5 pt-2">
          <p className="mb-1 text-xs text-white/45">あなただけが知っていること</p>
          <ul className="space-y-0.5 text-sm text-white/75">
            {me.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Right: everyone else

function statusFor(room: RoomState, p: Player, actorId?: string): string | null {
  if (!p.alive) return "死亡";
  if (!p.connected) return "切断中";
  if (room.phase === "intel" && room.intelPending.includes(p.id)) return "裏で動いている";
  if (p.id !== actorId) return null;
  if (room.phase === "designate") return "スタートを指名中";
  if (room.phase === "economy") return "袋を確認中";
  if (room.phase === "combat") return "狙いを定めている";
  return null;
}

function PlayerCards({ room, me, actorId, seesAll }: { room: RoomState; me: Player; actorId?: string; seesAll: boolean }) {
  const players = room.players.slice().sort((a, b) => a.seat - b.seat);
  const showOrder = room.phase === "economy" || room.phase === "combat";
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="px-1 font-mincho text-sm font-bold text-white/70">幹部たち</h2>
      {players.map((p) => {
        const role = p.role ? ROLE_BY_ID[p.role] : null;
        const status = statusFor(room, p, actorId);
        const acting = p.id === actorId || (room.phase === "intel" && room.intelPending.includes(p.id));
        const orderIdx = room.order.indexOf(p.id);
        const done = showOrder && orderIdx >= 0 && orderIdx < room.turnIndex;
        return (
          <div
            key={p.id}
            className={`flex gap-2.5 rounded-xl border p-2.5 ${
              acting ? "border-zakuro bg-zakuro/15" : p.id === me.id ? "border-white/20 bg-white/[0.05]" : "border-white/5 bg-panel/80"
            } ${p.alive ? "" : "opacity-45"}`}
          >
            <span className="w-7 shrink-0 text-center font-mincho text-2xl font-black leading-7 text-bone">{p.seat}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`truncate font-semibold ${p.alive ? "" : "line-through"}`}>{p.name}</span>
                {p.id === me.id && <span className="shrink-0 text-[11px] text-white/40">あなた</span>}
                {p.hasRing && <ItemArt kind="ring" className="ml-auto h-6 w-6 shrink-0" />}
              </div>
              <p className="truncate text-xs text-white/55" title={role?.description}>
                {role?.name}
                <span className="text-white/35"> — {role?.description}</span>
              </p>
              {(status || (showOrder && p.alive && orderIdx >= 0)) && (
                <p className={`mt-0.5 text-xs ${acting || status === "死亡" ? "text-zakuro-light" : "text-white/40"}`}>
                  {status ?? (done ? "済" : `手番 ${orderIdx + 1}`)}
                </p>
              )}
              {seesAll && p.id !== me.id && (
                <div className="mt-1.5 space-y-1 border-t border-white/5 pt-1.5 text-xs">
                  {p.bonus && (
                    <p className="text-brass/90">
                      《{BONUS_BY_ID[p.bonus.id].name}》{describeBonus(p.bonus)}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {sortItems(p.items).map((it) => (
                      <ItemChip key={it.id} item={it} />
                    ))}
                    {p.items.length === 0 && <span className="text-white/30">所持品なし</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {seesAll && room.phase !== "gameover" && <p className="px-1 text-xs text-white/40">観戦中: 全員の手の内が見えています。</p>}
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

function eventClass(e: PublicEvent): string {
  if (e.type === "shot") return e.outcome === "killed" ? "font-semibold text-zakuro-light" : "text-bone/90";
  if (e.type === "ring" || e.type === "designate") return "text-brass";
  if (e.type === "setStart") return "font-semibold text-bone";
  return "text-white/50";
}

// Routine "X が袋を改めた" lines are left out of the short view; the full log keeps them.
function isNotable(e: PublicEvent): boolean {
  return e.type !== "bagTurn" && e.type !== "setEnd";
}

function RecentLog({ room }: { room: RoomState }) {
  const recent = room.log.filter(isNotable).slice(-4);
  return (
    <section className="rounded-xl border border-white/10 bg-panel/80 p-3">
      <h2 className="mb-1.5 font-mincho text-sm font-bold text-white/70">最近の出来事</h2>
      {recent.length ? (
        <ul className="space-y-1 text-xs">
          {recent.map((e, i) => (
            <li key={i} className={eventClass(e)}>
              {eventText(room, e)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-white/35">まだ何も起きていない</p>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-white/45">すべての記録</summary>
        <ul className="mt-1.5 max-h-64 space-y-1 overflow-y-auto pr-1 text-xs">
          {room.log.map((e, i) => (
            <li key={i} className={eventClass(e)}>
              {eventText(room, e)}
              {e.type === "setStart" && (
                <div className="mt-1">
                  <CompositionRow composition={e.composition} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Game over

function GameOverStage({ room, me, busy, onPlayAgain }: { room: RoomState; me: Player; busy: boolean; onPlayAgain: () => void }) {
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
      <div className="flex flex-col items-center text-center">
        <ItemArt kind="ring" className="mb-2 h-20 w-20" />
        <p className="text-xs tracking-[0.4em] text-zakuro-light/80">NEW BOSS</p>
        <p className="font-mincho text-3xl font-black">{winner ? `${winner.seat}番 ${winner.name}` : "該当者なし"}</p>
        <p className="text-sm text-white/60">
          {room.endedEarly ? "ただ一人生き残り、ボスの座に就いた。" : "がザクロの指輪を継ぐ次のボスとなった。"}
          {winner?.id === me.id && <span className="ml-1 font-bold text-zakuro-light">(あなた)</span>}
        </p>
      </div>

      <div className="space-y-2">
        {rows.map(({ p, s }) => (
          <div
            key={p.id}
            className={`rounded-xl border p-3 ${p.id === winner?.id ? "border-zakuro bg-zakuro/10" : "border-white/10 bg-white/[0.03]"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="font-mincho text-xl font-black">{p.seat}</span>
                <span className={p.alive ? "font-semibold" : "font-semibold text-white/40 line-through"}>{p.name}</span>
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
                <span className={s.bonusAchieved ? "text-brass" : "text-white/40"}>{s.bonusAchieved ? "✓ 達成" : "✗ 未達成"}</span>{" "}
                《{BONUS_BY_ID[p.bonus.id].name}》{describeBonus(p.bonus)}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {sortItems(p.items).map((it) => (
                <ItemChip key={it.id} item={it} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <History room={room} />

      <div className="text-center">
        {me.isHost ? (
          <PrimaryButton disabled={busy} onClick={onPlayAgain}>
            同じメンバーでもう一度
          </PrimaryButton>
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
    <details className="rounded-xl border border-white/10 bg-black/20 p-3" open>
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
                        <ItemChip key={it.id} item={it} />
                      ))}
                      {h.returned && (
                        <>
                          <span className="ml-2 text-white/40">戻した:</span>
                          <ItemChip item={h.returned} />
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
