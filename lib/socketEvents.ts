import type { RoomSettings, RoomState } from "./types";

type Ack = (res: SocketResult<null>) => void;

// Client -> server
export interface ClientToServerEvents {
  "room:create": (payload: { name: string }, cb: (res: SocketResult<{ room: RoomState; playerId: string }>) => void) => void;
  "room:join": (payload: { code: string; name: string }, cb: (res: SocketResult<{ room: RoomState; playerId: string }>) => void) => void;
  "room:rejoin": (payload: { code: string; playerId: string }, cb: (res: SocketResult<{ room: RoomState }>) => void) => void;
  "room:start": (payload: { code: string }, cb: Ack) => void;
  "room:settings": (payload: { code: string; settings: Partial<RoomSettings> }, cb: Ack) => void;
  "game:ready": (payload: { code: string }, cb: Ack) => void;
  "game:designate": (payload: { code: string; seat: number }, cb: Ack) => void;
  "game:take": (payload: { code: string; takeIds: string[]; returnId: string | null }, cb: Ack) => void;
  "game:intel": (payload: { code: string; targetSeat: number | null }, cb: Ack) => void;
  "game:shoot": (payload: { code: string; targetSeat: number | null }, cb: Ack) => void;
  "game:hostSkip": (payload: { code: string }, cb: Ack) => void;
  "game:playAgain": (payload: { code: string }, cb: Ack) => void;
}

// server -> client
export interface ServerToClientEvents {
  "room:update": (room: RoomState) => void;
  "room:error": (message: string) => void;
  "room:closed": () => void;
}

export type SocketResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface SocketData {
  playerId?: string;
  roomCode?: string;
}
