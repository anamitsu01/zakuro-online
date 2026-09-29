import { BONUSES, ROLES } from "@/lib/content";

export default function RulesPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="rounded-xl border border-white/10 bg-panel/80 p-4 text-sm leading-relaxed">
      <summary className="cursor-pointer font-mincho text-base font-bold text-bone">ルール</summary>
      <RulesContent className="mt-3" />
    </details>
  );
}

export function RulesContent({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-3 text-white/70 ${className}`}>
      <p>
        先代のボスの跡目を争う幹部たち。<b className="text-bone">3セット</b>が終わった時点で、生き残っている中で
        <b className="text-bone">宝石が最も多い</b>幹部が次のボスになる。
      </p>
      <p>
        <b className="text-bone">継承順位</b>: ゲーム開始時に、各幹部へ1番から人数分までの番号がランダムに振られる(全員に公開)。
        袋を回す順番や戦闘の順番は、スタートプレイヤーから番号順(最後の番号の次は1番)。第1セットは1番から始まる。
        最後に同点になったときは、番号が小さい方が上位になる。
      </p>
      <div>
        <p className="font-semibold text-bone">1セットの流れ</p>
        <ol className="ml-5 list-decimal space-y-1">
          <li>袋の中身(種類と数)が全員に公開される。</li>
          <li>
            <b className="text-bone">経済フェーズ</b>: スタートから継承順位の順に袋を回す。中を見られるのは袋を持っている本人だけ。
            <ul className="ml-4 list-disc">
              <li>第1セット: 1個取る</li>
              <li>第2セット: 1個取る(または2個取って、手番前から持っていた物を1個戻す)</li>
              <li>第3セット: 2個取る(または3個取って、手番前から持っていた物を1個戻す)</li>
            </ul>
          </li>
          <li>
            <b className="text-bone">戦闘フェーズ</b>: 同じ順番で、銃と弾丸を持つ者は1回だけ誰かを撃てる(弾丸1発消費)。
            身代わり人形1体で1発防げる。防げなければ死亡し、撃った者が所持品をすべて奪う。
          </li>
          <li>袋の残りは捨てられ、次のセットでは新しい袋が用意される。</li>
        </ol>
      </div>
      <p>
        <b className="text-bone">ザクロの指輪</b>はゲームに1個だけ。持ち主は全員に公開され、各セットの最初にスタートプレイヤーを指名できる(自分でも他人でもよい)。最後まで持っていれば宝石1個分。
      </p>
      <p>
        <b className="text-bone">偽物</b>は見た目では本物と区別できない。偽の銃・弾丸は不発になり、偽の人形は身を守れず、偽の宝石は得点にならない。
      </p>
      <p>
        <b className="text-bone">秘密ボーナス</b>: 各自に1つ、自分だけが知る条件が配られる。生きて達成すれば宝石+1。
      </p>
      <p>
        同点のときは、指輪の持ち主 → 秘密ボーナス達成者 → 継承順位が上(番号が小さい)の順で決まる。生存者が1人になった時点でその幹部の勝利。
      </p>
      <details className="rounded-lg bg-white/[0.03] p-3">
        <summary className="cursor-pointer font-semibold text-bone">役職一覧</summary>
        <ul className="mt-2 space-y-1">
          {ROLES.map((r) => (
            <li key={r.id}>
              <b className="text-bone">{r.name}</b>: {r.description}
            </li>
          ))}
        </ul>
      </details>
      <details className="rounded-lg bg-white/[0.03] p-3">
        <summary className="cursor-pointer font-semibold text-bone">秘密ボーナス一覧</summary>
        <ul className="mt-2 space-y-1">
          {BONUSES.map((b) => (
            <li key={b.id}>
              <b className="text-bone">{b.name}</b>: {b.describe(b.targeted ? 0 : undefined).replace("0番", "○番")}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
