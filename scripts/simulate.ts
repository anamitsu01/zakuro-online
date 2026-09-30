// Plays many random games straight through the engine and checks invariants.
// Run: npx tsx scripts/simulate.ts [games]
import {
  addPlayer,
  canShoot,
  createRoom,
  designateStart,
  markReady,
  generateBag,
  sanitizeForPlayer,
  shoot,
  startGame,
  takeFromBag,
  applyIntel,
} from "../lib/gameEngine";
import { bagSizeForSet, exchangeAllowed, RoomState, takeCountForSet } from "../lib/types";

const games = Number(process.argv[2]) || 2000;

function assert(cond: unknown, msg: string, room?: RoomState): asserts cond {
  if (!cond) {
    if (room) console.error(JSON.stringify(room, null, 1).slice(0, 4000));
    throw new Error(msg);
  }
}

function rand<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

function ringCount(r: RoomState): number {
  return r.bag.filter((i) => i.kind === "ring").length + r.players.reduce((s, p) => s + p.items.filter((i) => i.kind === "ring").length, 0);
}

// Bag generation constraints
for (let n = 4; n <= 8; n++) {
  for (const set of [1, 2, 3]) {
    for (const ring of [true, false]) {
      for (let i = 0; i < 500; i++) {
        const bag = generateBag(bagSizeForSet(set, n), ring);
        assert(bag.length === bagSizeForSet(set, n), "bag size");
        const c = { gem: 0, gun: 0, bullet: 0, doll: 0, ring: 0 };
        bag.forEach((it) => c[it.kind]++);
        assert(c.gem >= 2, "at least 2 gems");
        assert([c.gun, c.bullet, c.doll].filter((x) => x > 0).length >= 2, "at most one kind missing");
        assert(c.ring === (ring ? 1 : 0), "ring presence");
      }
    }
  }
}

const stats = { games: 0, early: 0, kills: 0, shots: 0, bonus: 0, players: 0, sets: 0 };

for (let g = 0; g < games; g++) {
  const n = 4 + (g % 5);
  let r = createRoom("p0", "P0");
  for (let i = 1; i < n; i++) r = addPlayer(r, `p${i}`, `P${i}`);
  r = startGame(r, "p0");
  assert(r.phase === "briefing", "starts with briefing");
  for (const p of r.players.slice(0, -1)) r = markReady(r, p.id);
  assert(r.phase === "briefing", "waits for everyone");
  r = markReady(r, r.players[r.players.length - 1].id);
  assert(r.phase !== "briefing", "all ready starts set 1");
  assert(new Set(r.players.map((p) => p.seat)).size === n, "unique seats");
  assert(new Set(r.players.map((p) => p.role)).size === n, "unique roles");

  let guard = 0;
  while (r.phase !== "gameover") {
    assert(guard++ < 500, "game did not terminate", r);
    if (["economy", "intel", "combat"].includes(r.phase)) assert(ringCount(r) === 1, "exactly one ring in play", r);
    assert(r.players.filter((p) => p.hasRing).length <= 1, "one ring holder");

    if (r.phase === "designate") {
      const holder = r.players.find((p) => p.hasRing && p.alive)!;
      const target = rand(r.players.filter((p) => p.alive));
      r = designateStart(r, holder.id, target.seat);
    } else if (r.phase === "economy") {
      const actor = r.players.find((p) => p.id === r.order[r.turnIndex])!;
      // The acting player's sanitized view must include the bag; others' must not.
      assert(sanitizeForPlayer(r, actor.id).bag.length === r.bag.length, "actor sees bag");
      const other = r.players.find((p) => p.id !== actor.id && p.alive)!;
      assert(sanitizeForPlayer(r, other.id).bag.length === 0, "others don't see bag");
      assert(sanitizeForPlayer(r, other.id).players.find((p) => p.id === actor.id)!.items.length === 0, "items hidden");

      const base = takeCountForSet(r.set);
      const bagIds = r.bag.map((b) => b.id).sort(() => Math.random() - 0.5);
      const ring = actor.items.find((i) => i.kind === "ring");
      if (r.ringDueId === actor.id) {
        assert(ring, "ring holder has the ring", r);
        let threw = false;
        try {
          takeFromBag(r, actor.id, bagIds.slice(0, base), null);
        } catch {
          threw = true;
        }
        assert(threw, "ring holder cannot keep the ring");
        r = takeFromBag(r, actor.id, bagIds.slice(0, base + 1), ring.id);
        assert(!r.players.find((p) => p.id === actor.id)!.hasRing, "ring returned");
      } else if (exchangeAllowed(r.set) && actor.items.length > 0 && r.bag.length > base && Math.random() < 0.5) {
        r = takeFromBag(r, actor.id, bagIds.slice(0, base + 1), rand(actor.items).id);
      } else {
        // Illegal: taking too many without returning.
        let threw = false;
        try {
          takeFromBag(r, actor.id, bagIds.slice(0, base + 1), null);
        } catch {
          threw = true;
        }
        assert(threw || r.bag.length <= base, "over-take rejected");
        r = takeFromBag(r, actor.id, bagIds.slice(0, base), null);
      }
    } else if (r.phase === "intel") {
      const id = r.intelPending[0];
      const me = r.players.find((p) => p.id === id)!;
      const others = r.players.filter((p) => p.id !== id);
      r = applyIntel(r, id, !me.intelUsed && Math.random() < 0.5 ? rand(others).seat : null);
    } else if (r.phase === "combat") {
      const actor = r.players.find((p) => p.id === r.order[r.turnIndex])!;
      assert(actor.alive, "dead player acting");
      const targets = r.players.filter((p) => p.alive && p.id !== actor.id);
      if (canShoot(actor) && Math.random() < 0.7) {
        stats.shots++;
        r = shoot(r, actor.id, rand(targets).seat);
      } else {
        r = shoot(r, actor.id, null);
      }
    }
  }

  stats.games++;
  stats.players += n;
  stats.sets += r.set;
  if (r.endedEarly) stats.early++;
  stats.kills += r.players.filter((p) => !p.alive).length;
  stats.bonus += r.finalScores.filter((s) => s.bonusAchieved).length;
  assert(r.winnerIds.length === 1, "exactly one winner", r);
  assert(r.players.find((p) => p.id === r.winnerIds[0])!.alive, "winner alive");
  for (const s of r.finalScores) {
    const p = r.players.find((pl) => pl.id === s.playerId)!;
    if (!p.alive) assert(s.total === 0 && !s.bonusAchieved, "dead score zero");
  }
}

console.log("OK", {
  games: stats.games,
  endedEarly: stats.early,
  avgDeathsPerGame: +(stats.kills / stats.games).toFixed(2),
  bonusRate: +(stats.bonus / stats.players).toFixed(2),
});
