export type ItemKind = "gem" | "gun" | "bullet" | "doll" | "ring";

export interface Item {
  id: string;
  kind: ItemKind;
  /** Server truth. In a sanitized state this is only true when the viewer knows it's fake. */
  fake: boolean;
}

export type GamePhase = "lobby" | "designate" | "economy" | "intel" | "combat" | "gameover";

export type RoleId =
  | "armsDealer"
  | "ammoDealer"
  | "jeweler"
  | "bodyguard"
  | "elder"
  | "forger"
  | "gunsmith"
  | "blankSeller"
  | "puppeteer"
  | "informant"
  | "watcher";

export type BonusId =
  | "revenge"
  | "pacifist"
  | "tough"
  | "guardian"
  | "assassin"
  | "quickDraw"
  | "disarmed"
  | "miser"
  | "fearless"
  | "collector"
  | "usurper"
  | "retaliation"
  | "chosen"
  | "stockpile";

export interface SecretBonus {
  id: BonusId;
  /** 継承順位 of the target player, for bonuses that name one. */
  targetSeat?: number;
}

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  colorIndex: number;
  /** 継承順位 (1 = highest). Public. 0 while in the lobby. */
  seat: number;
  alive: boolean;
  role: RoleId | null;
  /** Secret. null for other players in a sanitized state (until game over). */
  bonus: SecretBonus | null;
  /** Secret. Empty for other players in a sanitized state (until game over). */
  items: Item[];
  /** Public: the ring is the one item everyone can see. */
  hasRing: boolean;
  intelUsed: boolean;
  /** Ids of items this player knows are fake (their own starting fake). */
  knownFakeIds: string[];
  /** Private notes only this player sees (misfires, loot, intel results...). */
  notes: string[];
  stats: PlayerStats;
}

export interface PlayerStats {
  /** Shots aimed at this player that didn't kill them (blocked or misfired). */
  shotsSurvived: number;
  kills: { victimSeat: number; set: number }[];
  shots: { targetSeat: number; set: number; seq: number }[];
  shotBy: { shooterSeat: number; seq: number }[];
  returnedSomething: boolean;
  designatedByOther: boolean;
}

export interface ActionRecord {
  set: number;
  playerId: string;
  took: Item[];
  returned: Item | null;
}

export type PublicEvent =
  | { type: "setStart"; set: number; startSeat: number; composition: Record<ItemKind, number> }
  | { type: "designate"; set: number; bySeat: number; startSeat: number }
  | { type: "bagTurn"; set: number; seat: number }
  | { type: "ring"; set: number; seat: number; action: "took" | "returned" }
  | { type: "shot"; set: number; shooterSeat: number; targetSeat: number; outcome: "misfire" | "blocked" | "killed" }
  | { type: "pass"; set: number; seat: number }
  | { type: "loot"; set: number; shooterSeat: number; victimSeat: number }
  | { type: "setEnd"; set: number };

export interface FinalScore {
  playerId: string;
  gems: number;
  ring: number;
  bonus: number;
  total: number;
  bonusAchieved: boolean;
}

export interface RoomSettings {
  /** Dead players see everything (all items, secret bonuses, the bag). */
  deadCanSeeAll: boolean;
}

export interface RoomState {
  code: string;
  phase: GamePhase;
  players: Player[];
  settings: RoomSettings;
  set: number;
  startSeat: number;
  /** Player ids in turn order for the current set (alive at set start). */
  order: string[];
  turnIndex: number;
  /** Secret. Only the player currently holding the bag (or an allowed spectator) sees it. */
  bag: Item[];
  bagVisible: boolean;
  composition: Record<ItemKind, number> | null;
  /** Players who still need to act in the intel phase. */
  intelPending: string[];
  log: PublicEvent[];
  /** Secret until game over. */
  history: ActionRecord[];
  winnerIds: string[];
  finalScores: FinalScore[];
  endedEarly: boolean;
  shotSeq: number;
  createdAt: number;
}

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 8;
export const TOTAL_SETS = 3;

export function takeCountForSet(set: number): number {
  return set === 3 ? 2 : 1;
}

export function exchangeAllowed(set: number): boolean {
  return set >= 2;
}

export function bagSizeForSet(set: number, playerCount: number): number {
  return set === 3 ? playerCount * 2 + 2 : playerCount + 1;
}
