import { BONUSES, ITEM_LABEL, ROLE_BY_ID, ROLES } from "./content";
import {
  ActionRecord,
  bagSizeForSet,
  exchangeAllowed,
  FinalScore,
  Item,
  ItemKind,
  MAX_PLAYERS,
  MIN_PLAYERS,
  Player,
  PlayerStats,
  RoomSettings,
  RoomState,
  SecretBonus,
  takeCountForSet,
  TOTAL_SETS,
} from "./types";

export class GameError extends Error {}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T>(entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r < 0) return v;
  }
  return entries[entries.length - 1][0];
}

let itemCounter = 0;
function newItem(kind: ItemKind, fake = false): Item {
  itemCounter += 1;
  return { id: `i${Date.now().toString(36)}${itemCounter.toString(36)}`, kind, fake };
}

function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function emptyStats(): PlayerStats {
  return { kills: [], shots: [], shotBy: [] };
}

function newPlayer(id: string, name: string, colorIndex: number, isHost: boolean): Player {
  return {
    id,
    name,
    connected: true,
    isHost,
    colorIndex,
    seat: 0,
    alive: true,
    role: null,
    bonus: null,
    items: [],
    hasRing: false,
    intelUsed: false,
    knownFakeIds: [],
    notes: [],
    stats: emptyStats(),
  };
}

export function createRoom(hostId: string, hostName: string): RoomState {
  return {
    code: makeRoomCode(),
    phase: "lobby",
    players: [newPlayer(hostId, hostName, 0, true)],
    settings: { deadCanSeeAll: true },
    set: 0,
    startSeat: 1,
    order: [],
    turnIndex: 0,
    bag: [],
    bagVisible: false,
    composition: null,
    intelPending: [],
    log: [],
    history: [],
    winnerIds: [],
    finalScores: [],
    endedEarly: false,
    shotSeq: 0,
    readyIds: [],
    createdAt: Date.now(),
  };
}

export function addPlayer(room: RoomState, playerId: string, name: string): RoomState {
  if (room.phase !== "lobby") {
    throw new GameError("このゲームはすでに開始されています");
  }
  if (room.players.some((p) => p.id === playerId)) {
    return room;
  }
  if (room.players.length >= MAX_PLAYERS) {
    throw new GameError(`部屋の定員(${MAX_PLAYERS}人)に達しています`);
  }
  const nextColorIndex = Math.max(...room.players.map((p) => p.colorIndex)) + 1;
  const players = [...room.players, newPlayer(playerId, name, nextColorIndex, false)];
  // Safety net: a prior disconnect/removal race can leave a room with no
  // host. Never let a lobby end up unable to start the game.
  if (!players.some((p) => p.isHost)) {
    players[0] = { ...players[0], isHost: true };
  }
  return { ...room, players };
}

export function markConnection(room: RoomState, playerId: string, connected: boolean): RoomState {
  return {
    ...room,
    players: room.players.map((p) => (p.id === playerId ? { ...p, connected } : p)),
  };
}

export function removePlayer(room: RoomState, playerId: string): RoomState {
  const players = room.players.filter((p) => p.id !== playerId);
  if (players.length > 0 && !players.some((p) => p.isHost)) {
    players[0] = { ...players[0], isHost: true };
  }
  return { ...room, players };
}

export function updateSettings(room: RoomState, requesterId: string, settings: Partial<RoomSettings>): RoomState {
  const requester = room.players.find((p) => p.id === requesterId);
  if (!requester?.isHost) throw new GameError("ホストのみが設定を変更できます");
  if (room.phase !== "lobby" && room.phase !== "gameover") throw new GameError("ゲーム中は設定を変更できません");
  const next: RoomSettings = { ...room.settings };
  if (typeof settings.deadCanSeeAll === "boolean") next.deadCanSeeAll = settings.deadCanSeeAll;
  return { ...room, settings: next };
}

// ---------------------------------------------------------------------------
// Setup

// Rough share of each kind in a freshly generated bag.
const BAG_WEIGHTS: [ItemKind, number][] = [
  ["gem", 0.4],
  ["gun", 0.15],
  ["bullet", 0.25],
  ["doll", 0.2],
];

/**
 * Controlled randomness: at least 2 gems, at most one of the four kinds
 * missing, and gems never swamp the bag.
 */
export function generateBag(size: number, includeRing: boolean): Item[] {
  const slots = size - (includeRing ? 1 : 0);
  let counts: Record<string, number> | null = null;
  for (let attempt = 0; attempt < 500 && !counts; attempt++) {
    const c: Record<string, number> = { gem: 0, gun: 0, bullet: 0, doll: 0 };
    for (let i = 0; i < slots; i++) c[weightedPick(BAG_WEIGHTS)] += 1;
    const kinds = Object.values(c).filter((n) => n > 0).length;
    if (c.gem >= 2 && kinds >= 3 && c.gem <= Math.max(2, Math.ceil(slots * 0.6))) counts = c;
  }
  if (!counts) {
    counts = { gem: 2, gun: 1, bullet: 1, doll: Math.max(0, slots - 4) };
  }
  const items: Item[] = [];
  if (includeRing) items.push(newItem("ring"));
  for (const [kind, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) items.push(newItem(kind as ItemKind));
  }
  return shuffle(items);
}

function assignBonus(player: Player, players: Player[], counts: Map<string, number>): SecretBonus {
  const others = players.filter((p) => p.id !== player.id);
  for (;;) {
    const def = pick(BONUSES);
    // Allow the same bonus to appear twice, never more.
    if ((counts.get(def.id) ?? 0) >= 2) continue;
    if (def.id === "usurper" && player.seat === 1) continue;
    let targetSeat: number | undefined;
    if (def.targeted === "enemy") {
      // Low numbers win ties, so kill targets lean toward them.
      const n = players.length;
      targetSeat = weightedPick(others.map((o) => [o.seat, n + 1 - o.seat] as [number, number]));
    } else if (def.targeted === "ally") {
      targetSeat = pick(others).seat;
    }
    counts.set(def.id, (counts.get(def.id) ?? 0) + 1);
    return { id: def.id, targetSeat };
  }
}

function dealNewGame(room: RoomState): RoomState {
  const seats = shuffle(room.players.map((_, i) => i + 1));
  const roles = shuffle(ROLES).slice(0, room.players.length);
  let players: Player[] = room.players.map((p, i) => {
    const role = roles[i];
    const items: Item[] = [];
    const knownFakeIds: string[] = [];
    if (role.start) {
      const item = newItem(role.start.kind, role.start.fake);
      items.push(item);
      if (item.fake) knownFakeIds.push(item.id);
    }
    return {
      ...newPlayer(p.id, p.name, p.colorIndex, p.isHost),
      connected: p.connected,
      seat: seats[i],
      role: role.id,
      items,
      knownFakeIds,
      hasRing: items.some((it) => it.kind === "ring"),
    };
  });
  const bonusCounts = new Map<string, number>();
  players = players.map((p) => ({ ...p, bonus: assignBonus(p, players, bonusCounts) }));

  const next: RoomState = {
    ...room,
    players,
    set: 0,
    startSeat: 1,
    order: [],
    turnIndex: 0,
    bag: [],
    composition: null,
    intelPending: [],
    log: [],
    history: [],
    winnerIds: [],
    finalScores: [],
    endedEarly: false,
    shotSeq: 0,
    readyIds: [],
    // Everyone first reads their seat, role and secret bonus, then presses start.
    phase: "briefing",
  };
  return next;
}

export function startGame(room: RoomState, requesterId: string): RoomState {
  const requester = room.players.find((p) => p.id === requesterId);
  if (!requester?.isHost) throw new GameError("ホストのみがゲームを開始できます");
  if (room.phase !== "lobby") throw new GameError("すでにゲームが開始されています");
  if (room.players.length < MIN_PLAYERS) throw new GameError(`${MIN_PLAYERS}人以上で開始できます`);
  return dealNewGame(structuredClone(room));
}

export function playAgain(room: RoomState, requesterId: string): RoomState {
  const requester = room.players.find((p) => p.id === requesterId);
  if (!requester?.isHost) throw new GameError("ホストのみが再戦を開始できます");
  if (room.phase !== "gameover") throw new GameError("ゲームはまだ終わっていません");
  if (room.players.length < MIN_PLAYERS) throw new GameError(`${MIN_PLAYERS}人以上で開始できます`);
  return dealNewGame(structuredClone(room));
}

export function markReady(room: RoomState, playerId: string): RoomState {
  if (room.phase !== "briefing") throw new GameError("今は準備の場面ではありません");
  byId(room, playerId);
  if (room.readyIds.includes(playerId)) return room;
  const r = structuredClone(room);
  r.readyIds.push(playerId);
  if (r.players.every((p) => r.readyIds.includes(p.id))) return beginSet(r, 1);
  return r;
}

// ---------------------------------------------------------------------------
// Set flow

function bySeat(room: RoomState, seat: number): Player | undefined {
  return room.players.find((p) => p.seat === seat);
}

function byId(room: RoomState, id: string): Player {
  const p = room.players.find((pl) => pl.id === id);
  if (!p) throw new GameError("プレイヤーが見つかりません");
  return p;
}

function aliveSeatsAsc(room: RoomState): number[] {
  return room.players.filter((p) => p.alive).map((p) => p.seat).sort((a, b) => a - b);
}

/** Seat order starting from `startSeat`, wrapping around, alive players only. */
function turnOrder(room: RoomState, startSeat: number): string[] {
  const seats = aliveSeatsAsc(room);
  const i = seats.indexOf(startSeat);
  const rotated = [...seats.slice(i), ...seats.slice(0, i)];
  return rotated.map((s) => bySeat(room, s)!.id);
}

/** First alive seat at or after `seat`, wrapping (5人で5番が死亡 → 1番). */
function nextAliveSeatFrom(room: RoomState, seat: number): number {
  const seats = aliveSeatsAsc(room);
  return seats.find((s) => s >= seat) ?? seats[0];
}

function ringHolder(room: RoomState): Player | undefined {
  return room.players.find((p) => p.hasRing && p.alive);
}

function beginSet(room: RoomState, set: number): RoomState {
  room.set = set;
  room.composition = null;
  room.bag = [];
  const holder = ringHolder(room);
  if (holder) {
    room.phase = "designate";
    room.order = [holder.id];
    room.turnIndex = 0;
    return room;
  }
  // No ring holder: keep the previous start player (set 1 → 継承順位1番),
  // moving on to the next alive seat if they died.
  room.startSeat = nextAliveSeatFrom(room, set === 1 ? 1 : room.startSeat);
  return startEconomy(room);
}

function startEconomy(room: RoomState): RoomState {
  const ringHeld = room.players.some((p) => p.hasRing);
  room.bag = generateBag(bagSizeForSet(room.set, room.players.length), !ringHeld);
  const composition: Record<ItemKind, number> = { ring: 0, gem: 0, gun: 0, bullet: 0, doll: 0 };
  for (const it of room.bag) composition[it.kind] += 1;
  room.composition = composition;
  room.order = turnOrder(room, room.startSeat);
  room.turnIndex = 0;
  room.phase = "economy";
  room.log.push({ type: "setStart", set: room.set, startSeat: room.startSeat, composition });
  return room;
}

export function designateStart(room: RoomState, playerId: string, seat: number): RoomState {
  if (room.phase !== "designate") throw new GameError("今はスタートプレイヤーを指名する場面ではありません");
  const r = structuredClone(room);
  const holder = ringHolder(r);
  if (!holder || holder.id !== playerId) throw new GameError("指輪の持ち主だけが指名できます");
  const target = bySeat(r, seat);
  if (!target || !target.alive) throw new GameError("生存している幹部を指名してください");
  r.startSeat = seat;
  r.log.push({ type: "designate", set: r.set, bySeat: holder.seat, startSeat: seat });
  return startEconomy(r);
}

function currentActor(room: RoomState): Player | undefined {
  const id = room.order[room.turnIndex];
  return id ? room.players.find((p) => p.id === id) : undefined;
}

export function takeFromBag(room: RoomState, playerId: string, takeIds: string[], returnId: string | null): RoomState {
  if (room.phase !== "economy") throw new GameError("今は袋を操作する場面ではありません");
  const r = structuredClone(room);
  const player = currentActor(r);
  if (!player || player.id !== playerId) throw new GameError("あなたの番ではありません");

  const base = takeCountForSet(r.set);
  const uniqueTakes = [...new Set(takeIds)];
  if (uniqueTakes.length !== takeIds.length) throw new GameError("同じ物を二度は取れません");
  const taken = uniqueTakes.map((id) => {
    const it = r.bag.find((b) => b.id === id);
    if (!it) throw new GameError("袋の中にない物は取れません");
    return it;
  });

  let returned: Item | null = null;
  if (returnId) {
    if (!exchangeAllowed(r.set)) throw new GameError("第1セットでは交換できません");
    if (taken.length !== base + 1) throw new GameError(`交換する場合は袋から${base + 1}個取ってください`);
    // Only items held before this turn can go back — not something just taken.
    returned = player.items.find((it) => it.id === returnId) ?? null;
    if (!returned) throw new GameError("戻せるのは手番の前から持っていた物だけです");
  } else {
    const expected = Math.min(base, r.bag.length);
    if (taken.length !== expected) {
      throw new GameError(
        exchangeAllowed(r.set)
          ? `袋から${base}個取るか、${base + 1}個取って手持ちを1個戻してください`
          : `袋から${base}個取ってください`
      );
    }
  }

  const takenIds = new Set(taken.map((t) => t.id));
  r.bag = r.bag.filter((b) => !takenIds.has(b.id));
  player.items.push(...taken);
  if (returned) {
    player.items = player.items.filter((it) => it.id !== returned!.id);
    r.bag.push(returned);
    r.bag = shuffle(r.bag);
  }

  const tookRing = taken.some((t) => t.kind === "ring");
  const returnedRing = returned?.kind === "ring";
  player.hasRing = player.items.some((it) => it.kind === "ring");

  const record: ActionRecord = { set: r.set, playerId: player.id, took: taken, returned };
  r.history.push(record);
  r.log.push({ type: "bagTurn", set: r.set, seat: player.seat });
  if (tookRing) r.log.push({ type: "ring", set: r.set, seat: player.seat, action: "took" });
  if (returnedRing) r.log.push({ type: "ring", set: r.set, seat: player.seat, action: "returned" });

  r.turnIndex += 1;
  if (r.turnIndex >= r.order.length) return afterEconomy(r);
  return r;
}

function isIntelRole(p: Player): boolean {
  return p.role === "informant";
}

function afterEconomy(room: RoomState): RoomState {
  // Intel roles are always asked, even once their ability is spent, so the
  // table can't tell whether it was used.
  const pending = room.players.filter((p) => p.alive && isIntelRole(p)).map((p) => p.id);
  if (pending.length > 0) {
    room.phase = "intel";
    room.intelPending = pending;
    return room;
  }
  return startCombat(room);
}

export function applyIntel(room: RoomState, playerId: string, targetSeat: number | null): RoomState {
  if (room.phase !== "intel") throw new GameError("今は情報を使う場面ではありません");
  if (!room.intelPending.includes(playerId)) throw new GameError("あなたの行動は完了しています");
  const r = structuredClone(room);
  const me = byId(r, playerId);
  if (targetSeat !== null) {
    if (me.intelUsed) throw new GameError("能力はすでに使っています");
    const target = bySeat(r, targetSeat);
    if (!target || target.id === me.id) throw new GameError("自分以外の幹部を指定してください");
    const rec = r.history.find((h) => h.set === r.set && h.playerId === target.id);
    const name = `${target.seat}番 ${target.name}`;
    const kinds = rec ? rec.took.map((t) => ITEM_LABEL[t.kind]).join("・") : "";
    me.notes.push(`【第${r.set}セット・情報】${name} が袋から取った物: ${kinds || "なし"}`);
    me.intelUsed = true;
  }
  r.intelPending = r.intelPending.filter((id) => id !== playerId);
  if (r.intelPending.length === 0) return startCombat(r);
  return r;
}

function startCombat(room: RoomState): RoomState {
  room.phase = "combat";
  room.intelPending = [];
  room.turnIndex = 0;
  return skipDeadActors(room);
}

function skipDeadActors(room: RoomState): RoomState {
  while (room.turnIndex < room.order.length) {
    const actor = currentActor(room);
    if (actor?.alive) return room;
    room.turnIndex += 1;
  }
  return endSet(room);
}

function usable(p: Player, kind: ItemKind): Item[] {
  return p.items.filter((it) => it.kind === kind && !p.knownFakeIds.includes(it.id));
}

export function canShoot(p: Player): boolean {
  return usable(p, "gun").length > 0 && usable(p, "bullet").length > 0;
}

function removeItem(p: Player, id: string) {
  p.items = p.items.filter((it) => it.id !== id);
}

export function shoot(room: RoomState, playerId: string, targetSeat: number | null): RoomState {
  if (room.phase !== "combat") throw new GameError("今は銃撃の場面ではありません");
  const r = structuredClone(room);
  const shooter = currentActor(r);
  if (!shooter || shooter.id !== playerId) throw new GameError("あなたの番ではありません");

  if (targetSeat === null) {
    r.log.push({ type: "pass", set: r.set, seat: shooter.seat });
    r.turnIndex += 1;
    return skipDeadActors(r);
  }

  const target = bySeat(r, targetSeat);
  if (!target || !target.alive || target.id === shooter.id) throw new GameError("生存している他の幹部を狙ってください");
  if (!canShoot(shooter)) throw new GameError("銃と弾丸の両方が必要です");

  r.shotSeq += 1;
  const seq = r.shotSeq;
  shooter.stats.shots.push({ targetSeat: target.seat, set: r.set, seq });
  target.stats.shotBy.push({ shooterSeat: shooter.seat, seq });

  const gun = pick(usable(shooter, "gun"));
  const bullet = pick(usable(shooter, "bullet"));
  let outcome: "misfire" | "blocked" | "killed";

  if (gun.fake) {
    removeItem(shooter, gun.id);
    shooter.notes.push(`【第${r.set}セット】銃は偽物だった。壊れた銃を捨てた(弾丸は残っている)。`);
    outcome = "misfire";
  } else if (bullet.fake) {
    removeItem(shooter, bullet.id);
    shooter.notes.push(`【第${r.set}セット】弾丸は偽物だった。偽の弾丸は失われた。`);
    outcome = "misfire";
  } else {
    removeItem(shooter, bullet.id);
    outcome = "killed";
    for (const doll of shuffle(usable(target, "doll"))) {
      removeItem(target, doll.id);
      if (doll.fake) {
        target.notes.push(`【第${r.set}セット】身代わり人形は偽物だった。砕け散った。`);
        continue;
      }
      outcome = "blocked";
      break;
    }
  }

  r.log.push({ type: "shot", set: r.set, shooterSeat: shooter.seat, targetSeat: target.seat, outcome });

  if (outcome === "killed") {
    target.alive = false;
    shooter.stats.kills.push({ victimSeat: target.seat, set: r.set });
    const loot = target.items;
    target.items = [];
    target.hasRing = false;
    shooter.items.push(...loot);
    shooter.hasRing = shooter.items.some((it) => it.kind === "ring");
    const lootText = loot.length ? loot.map((it) => ITEM_LABEL[it.kind]).join("・") : "なし";
    shooter.notes.push(`【第${r.set}セット】${target.seat}番 ${target.name} から奪った物: ${lootText}`);
    target.notes.push(`【第${r.set}セット】${shooter.seat}番 ${shooter.name} に撃たれて死亡した。`);
    r.log.push({ type: "loot", set: r.set, shooterSeat: shooter.seat, victimSeat: target.seat });
    if (r.players.filter((p) => p.alive).length === 1) {
      r.endedEarly = true;
      return finishGame(r);
    }
  }

  r.turnIndex += 1;
  return skipDeadActors(r);
}

function endSet(room: RoomState): RoomState {
  room.log.push({ type: "setEnd", set: room.set });
  // Leftover bag contents (and any fakes planted in it) are discarded. The
  // ring, if still in the bag, goes into the next set's bag.
  room.bag = [];
  if (room.set >= TOTAL_SETS) return finishGame(room);
  return beginSet(room, room.set + 1);
}

// ---------------------------------------------------------------------------
// Scoring

function countKind(p: Player, kind: ItemKind, realOnly = false): number {
  return p.items.filter((it) => it.kind === kind && (!realOnly || !it.fake)).length;
}

export function bonusAchieved(room: RoomState, p: Player): boolean {
  if (!p.alive || !p.bonus) return false;
  const s = p.stats;
  switch (p.bonus.id) {
    case "revenge":
      return s.kills.some((k) => k.victimSeat === p.bonus!.targetSeat);
    case "pacifist":
      return room.players.every((pl) => pl.alive);
    case "guardian":
      return !!bySeat(room, p.bonus.targetSeat!)?.alive;
    case "assassin":
      return s.kills.some((k) => k.set === 3);
    case "quickDraw":
      return s.shots.some((sh) => sh.set <= 2);
    case "disarmed":
      return countKind(p, "gun") === 0;
    case "fearless":
      return countKind(p, "doll") === 0;
    case "collector":
      return (["gem", "gun", "bullet", "doll"] as ItemKind[]).every((k) => countKind(p, k) > 0);
    case "usurper":
      return s.kills.some((k) => k.victimSeat < p.seat);
    case "retaliation":
      return s.shotBy.some((by) => s.shots.some((sh) => sh.targetSeat === by.shooterSeat && sh.seq > by.seq));
    case "stockpile":
      return countKind(p, "bullet") >= 2;
  }
}

function finishGame(room: RoomState): RoomState {
  room.phase = "gameover";
  room.bag = [];
  room.order = [];
  const scores: FinalScore[] = room.players.map((p) => {
    const achieved = bonusAchieved(room, p);
    const gems = p.alive ? countKind(p, "gem", true) : 0;
    const ring = p.alive && p.hasRing ? 1 : 0;
    const bonus = achieved ? 1 : 0;
    return { playerId: p.id, gems, ring, bonus, total: gems + ring + bonus, bonusAchieved: achieved };
  });
  room.finalScores = scores;
  const alive = room.players.filter((p) => p.alive);
  // 宝石合計 → 指輪 → 秘密ボーナス達成 → 継承順位(番号が小さい方)
  const ranked = alive.slice().sort((a, b) => {
    const sa = scores.find((s) => s.playerId === a.id)!;
    const sb = scores.find((s) => s.playerId === b.id)!;
    if (sb.total !== sa.total) return sb.total - sa.total;
    if (a.hasRing !== b.hasRing) return a.hasRing ? -1 : 1;
    if (sa.bonusAchieved !== sb.bonusAchieved) return sa.bonusAchieved ? -1 : 1;
    return a.seat - b.seat;
  });
  room.winnerIds = ranked.length ? [ranked[0].id] : [];
  return room;
}

// ---------------------------------------------------------------------------
// Host tools

/** Lets the host move the game along when the player whose turn it is has dropped. */
export function hostSkip(room: RoomState, requesterId: string): RoomState {
  const requester = room.players.find((p) => p.id === requesterId);
  if (!requester?.isHost) throw new GameError("ホストのみが操作できます");
  if (room.phase === "briefing") {
    const stuck = room.players.filter((p) => !p.connected && !room.readyIds.includes(p.id));
    if (!stuck.length) throw new GameError("切断中のプレイヤーはいません");
    return stuck.reduce((r, p) => markReady(r, p.id), room);
  }
  if (room.phase === "intel") {
    const stuck = room.intelPending.find((id) => !byId(room, id).connected);
    if (!stuck) throw new GameError("切断中のプレイヤーはいません");
    return applyIntel(room, stuck, null);
  }
  const actor = room.phase === "designate" ? ringHolder(room) : currentActor(room);
  if (!actor) throw new GameError("進められる手番がありません");
  if (actor.connected) throw new GameError("そのプレイヤーは接続中です");
  if (room.phase === "designate") return designateStart(room, actor.id, actor.seat);
  if (room.phase === "economy") {
    const n = Math.min(takeCountForSet(room.set), room.bag.length);
    return takeFromBag(room, actor.id, shuffle(room.bag).slice(0, n).map((it) => it.id), null);
  }
  if (room.phase === "combat") return shoot(room, actor.id, null);
  throw new GameError("進められる手番がありません");
}

// ---------------------------------------------------------------------------
// Visibility

export function seesEverything(room: RoomState, viewer: Player | undefined): boolean {
  if (room.phase === "gameover") return true;
  return !!viewer && !viewer.alive && room.settings.deadCanSeeAll;
}

export function sanitizeForPlayer(room: RoomState, viewerId: string): RoomState {
  const viewer = room.players.find((p) => p.id === viewerId);
  if (seesEverything(room, viewer)) {
    return { ...room, bagVisible: room.phase === "economy" };
  }
  const knows = (id: string) => !!viewer?.knownFakeIds.includes(id);
  const maskItem = (it: Item): Item => ({ ...it, fake: it.fake && knows(it.id) });
  const actor = currentActor(room);
  const holdsBag = room.phase === "economy" && actor?.id === viewerId;
  return {
    ...room,
    players: room.players.map((p) =>
      p.id === viewerId
        ? { ...p, items: p.items.map(maskItem) }
        : {
            ...p,
            bonus: null,
            items: [],
            knownFakeIds: [],
            notes: [],
            intelUsed: false,
            stats: emptyStats(),
          }
    ),
    bag: holdsBag ? room.bag.map(maskItem) : [],
    bagVisible: holdsBag,
    history: [],
  };
}

export function roleName(id: Player["role"]): string {
  return id ? ROLE_BY_ID[id].name : "";
}
