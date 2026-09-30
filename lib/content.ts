import type { BonusId, ItemKind, RoleId, SecretBonus } from "./types";

export const ITEM_LABEL: Record<ItemKind, string> = {
  gem: "宝石",
  gun: "銃",
  bullet: "弾丸",
  doll: "身代わり人形",
  ring: "ザクロの指輪",
};

export const ITEM_ORDER: ItemKind[] = ["ring", "gem", "gun", "bullet", "doll"];

export type RoleType = "asset" | "fake" | "intel";

export interface RoleDef {
  id: RoleId;
  name: string;
  shinogi: string;
  type: RoleType;
  description: string;
  /** Item the role starts with, if any. */
  start?: { kind: ItemKind; fake: boolean };
}

// 役職 = その幹部のシノギ。全員に公開される。説明は一文、効果は一つ。
export const ROLES: RoleDef[] = [
  { id: "armsDealer", name: "武器商人", shinogi: "武器密売", type: "asset", description: "銃を1丁持って開始する。", start: { kind: "gun", fake: false } },
  { id: "ammoDealer", name: "弾薬商", shinogi: "弾薬の横流し", type: "asset", description: "弾丸を1発持って開始する。", start: { kind: "bullet", fake: false } },
  { id: "jeweler", name: "宝石商", shinogi: "盗品の売買", type: "asset", description: "宝石を1個持って開始する。", start: { kind: "gem", fake: false } },
  { id: "bodyguard", name: "用心棒", shinogi: "護衛", type: "asset", description: "身代わり人形を1体持って開始する。", start: { kind: "doll", fake: false } },
  { id: "forger", name: "贋作師", shinogi: "宝石詐欺", type: "fake", description: "偽の宝石を1個持って開始する。", start: { kind: "gem", fake: true } },
  { id: "gunsmith", name: "密造屋", shinogi: "密造銃", type: "fake", description: "偽の銃を1丁持って開始する。", start: { kind: "gun", fake: true } },
  { id: "chemist", name: "闇化学者", shinogi: "火薬の細工", type: "fake", description: "偽の弾丸を1発持って開始する。", start: { kind: "bullet", fake: true } },
  { id: "puppeteer", name: "人形師", shinogi: "替え玉", type: "fake", description: "偽の身代わり人形を1体持って開始する。", start: { kind: "doll", fake: true } },
  { id: "informant", name: "情報屋", shinogi: "情報売買", type: "intel", description: "ゲーム中1回、戦闘前に指定した幹部がこのセットで袋から取った物を見られる。" },
];

export const ROLE_BY_ID: Record<RoleId, RoleDef> = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<RoleId, RoleDef>;

export interface BonusDef {
  id: BonusId;
  name: string;
  /** Whether the bonus names a target player (by 継承順位). */
  targeted?: "enemy" | "ally";
  describe: (targetSeat?: number) => string;
}

// 秘密ボーナス。達成すると宝石+1。死亡すると無効。役職とは無関係にランダムで配られる。
export const BONUSES: BonusDef[] = [
  { id: "revenge", name: "復讐", targeted: "enemy", describe: (t) => `継承順位${t}番を自分の手で殺す。` },
  { id: "pacifist", name: "平和主義", describe: () => "誰も死亡せずにゲームが終わる。" },
  { id: "guardian", name: "守護", targeted: "ally", describe: (t) => `継承順位${t}番が最後まで生き残る。` },
  { id: "assassin", name: "暗殺者", describe: () => "第3セットの戦闘で誰かを殺す。" },
  { id: "quickDraw", name: "早撃ち", describe: () => "第1・第2セットのどちらかで誰かを撃つ(結果は問わない)。" },
  { id: "disarmed", name: "武装解除", describe: () => "ゲーム終了時に銃を持っていない。" },
  { id: "fearless", name: "大胆不敵", describe: () => "ゲーム終了時に身代わり人形を持っていない。" },
  { id: "collector", name: "収集家", describe: () => "ゲーム終了時に宝石・銃・弾丸・身代わり人形をすべて1つ以上持っている。" },
  { id: "usurper", name: "下剋上", describe: () => "自分より継承順位が上(番号が小さい)の誰かを殺す。" },
  { id: "retaliation", name: "報復", describe: () => "自分を撃った幹部を撃ち返す(結果は問わない)。" },
  { id: "stockpile", name: "備蓄", describe: () => "ゲーム終了時に弾丸を2発以上持っている。" },
];

export const BONUS_BY_ID: Record<BonusId, BonusDef> = Object.fromEntries(BONUSES.map((b) => [b.id, b])) as Record<BonusId, BonusDef>;

export function describeBonus(bonus: SecretBonus): string {
  return BONUS_BY_ID[bonus.id].describe(bonus.targetSeat);
}
