// Joins bot players to a room and has them play randomly — for testing with
// fewer than 4 humans.
// Run: npx tsx scripts/bots.ts <ROOMCODE> [count] [url]
import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../lib/socketEvents";
import type { RoomState } from "../lib/types";
import { exchangeAllowed, takeCountForSet } from "../lib/types";

const [code, countArg, url = "http://localhost:3000"] = process.argv.slice(2);
if (!code) {
  console.error("usage: npx tsx scripts/bots.ts <ROOMCODE> [count] [url]");
  process.exit(1);
}
const count = Number(countArg) || 3;

function rand<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

function startBot(i: number) {
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(url, { transports: ["websocket"] });
  let me = "";
  let pending = false;
  const name = `ボット${i + 1}`;

  function act(fn: () => void) {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      fn();
      pending = false;
    }, 600 + Math.random() * 900);
  }

  function onRoom(room: RoomState) {
    const self = room.players.find((p) => p.id === me);
    if (!self) return;
    const actorId = room.order[room.turnIndex];
    const done = (res: { ok: boolean; error?: string }) => {
      if (!res.ok) console.log(`${name}: ${res.error}`);
    };

    if (room.phase === "briefing" && !room.readyIds.includes(me)) {
      act(() => socket.emit("game:ready", { code }, done));
    } else if (room.phase === "designate" && actorId === me) {
      const alive = room.players.filter((p) => p.alive);
      act(() => socket.emit("game:designate", { code, seat: rand(alive).seat }, done));
    } else if (room.phase === "economy" && actorId === me && room.bagVisible) {
      const base = takeCountForSet(room.set);
      const ids = room.bag.map((b) => b.id).sort(() => Math.random() - 0.5);
      if (exchangeAllowed(room.set) && self.items.length > 0 && ids.length > base && Math.random() < 0.4) {
        act(() => socket.emit("game:take", { code, takeIds: ids.slice(0, base + 1), returnId: rand(self.items).id }, done));
      } else {
        act(() => socket.emit("game:take", { code, takeIds: ids.slice(0, base), returnId: null }, done));
      }
    } else if (room.phase === "intel" && room.intelPending.includes(me)) {
      const others = room.players.filter((p) => p.id !== me);
      act(() => socket.emit("game:intel", { code, targetSeat: !self.intelUsed && Math.random() < 0.5 ? rand(others).seat : null }, done));
    } else if (room.phase === "combat" && actorId === me) {
      const armed = self.items.some((it) => it.kind === "gun" && !it.fake) && self.items.some((it) => it.kind === "bullet" && !it.fake);
      const targets = room.players.filter((p) => p.alive && p.id !== me);
      act(() => socket.emit("game:shoot", { code, targetSeat: armed && Math.random() < 0.6 ? rand(targets).seat : null }, done));
    }
  }

  socket.on("room:update", onRoom);
  socket.on("connect", () => {
    socket.emit("room:join", { code, name }, (res) => {
      if (!res.ok) {
        console.log(`${name}: join failed: ${res.error}`);
        return;
      }
      me = res.data.playerId;
      console.log(`${name} joined as ${me}`);
    });
  });
}

for (let i = 0; i < count; i++) startBot(i);
