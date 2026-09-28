import { ITEM_LABEL, ITEM_ORDER } from "@/lib/content";
import type { Item, ItemKind } from "@/lib/types";

// Hand-drawn flat illustrations (64×64) for each item, plus the bag itself.
export function ItemArt({ kind, className = "h-6 w-6" }: { kind: ItemKind; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {kind === "gem" && (
        <g stroke="#6f685c" strokeWidth="1.1" strokeLinejoin="round">
          <polygon points="12,22 21,11 43,11 52,22 32,55" fill="#f4f1ea" />
          <polygon points="21,11 43,11 38,22 26,22" fill="#ffffff" />
          <polygon points="12,22 21,11 26,22" fill="#e1dbcf" />
          <polygon points="43,11 52,22 38,22" fill="#d6cebf" />
          <polygon points="12,22 26,22 32,55" fill="#e9e4da" />
          <polygon points="26,22 38,22 32,55" fill="#fbfaf6" />
          <polygon points="38,22 52,22 32,55" fill="#cbc2b1" />
          <path d="M50 5l1.3 3.2L54.5 9.5l-3.2 1.3L50 14l-1.3-3.2L45.5 9.5l3.2-1.3z" fill="#ffffff" stroke="none" />
        </g>
      )}
      {kind === "gun" && (
        <g>
          <rect x="24" y="17" width="33" height="7" rx="1.5" fill="#8b949e" />
          <rect x="24" y="17" width="33" height="2" rx="1" fill="#b5bcc4" />
          <rect x="53" y="13.5" width="3" height="4" fill="#6b737c" />
          <path d="M11 19l3-5h5l3 5z" fill="#5d656e" />
          <rect x="12" y="18" width="14" height="14" rx="2" fill="#6b737c" />
          <rect x="19" y="16" width="14" height="15" rx="3.5" fill="#555d66" />
          <path d="M22 18v11M26 17v13M30 18v11" stroke="#3f464e" strokeWidth="1.2" />
          <path d="M28 31c0 7 8 8 9 1" fill="none" stroke="#555d66" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M30 31l1 4" stroke="#3f464e" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 28l14 2-3 20c-.4 3-2.6 4.5-5.5 4.2l-8.5-1c-2.4-.3-3.5-2.4-2.8-4.7z" fill="#6a3f27" />
          <path d="M14 34l8 1M13 39l8 1M12 44l8 1" stroke="#4b2a18" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      )}
      {kind === "bullet" && (
        <g>
          <path d="M32 5c6 5.5 8.5 11.5 8.5 19h-17C23.5 16.5 26 10.5 32 5z" fill="#b8703a" />
          <path d="M32 5c-3 3.5-4.5 9-4.5 19h-4C23.5 16.5 26 10.5 32 5z" fill="#d68d54" />
          <rect x="22.5" y="24" width="19" height="29" rx="1.5" fill="#c9a44c" />
          <rect x="35" y="24" width="6.5" height="29" fill="#a8843a" />
          <rect x="25.5" y="24" width="3" height="29" fill="#e6c878" />
          <rect x="22.5" y="28" width="19" height="1.6" fill="#8f6f2e" />
          <rect x="21" y="52" width="22" height="6" rx="1.2" fill="#a8843a" />
          <rect x="21" y="52" width="22" height="1.6" fill="#c9a44c" />
        </g>
      )}
      {kind === "doll" && (
        <g stroke="#6e4f36" strokeWidth="1.2" strokeLinejoin="round">
          <path d="M11 26c0-3 2-4.5 5-4.5h32c3 0 5 1.5 5 4.5s-2 4.5-5 4.5H40l3 23c.3 2.4-1.2 4-3.5 4h-3c-1.8 0-3-1-3.4-2.8L32 46l-1.1 8.7c-.4 1.8-1.6 2.8-3.4 2.8h-3c-2.3 0-3.8-1.6-3.5-4l3-23h-8c-3 0-5-1.5-5-4.5z" fill="#b08968" />
          <circle cx="32" cy="14" r="10" fill="#c09a78" />
          <path d="M27 11.5l3.5 3.5M30.5 11.5L27 15M34 11.5l3.5 3.5M37.5 11.5L34 15" stroke="#2e1f14" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M28 19h8M29.5 18v2M32 18v2M34.5 18v2" stroke="#2e1f14" strokeWidth="1" />
          <path d="M32 24v20" strokeDasharray="2 2" fill="none" />
          <path d="M37 33l12-10" stroke="#9aa3ad" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="49.5" cy="22.5" r="3" fill="#c0172f" stroke="#7a0d1d" />
        </g>
      )}
      {kind === "ring" && (
        <g>
          <ellipse cx="32" cy="42" rx="17" ry="15" fill="none" stroke="#9c7a2e" strokeWidth="6" />
          <ellipse cx="32" cy="42" rx="17" ry="15" fill="none" stroke="#d9b75c" strokeWidth="3" />
          <path d="M20 33a17 15 0 0 1 10-5.8" fill="none" stroke="#f3dd95" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M23 25h18l-4 6h-10z" fill="#b8913a" />
          <polygon points="20,16 27,7 37,7 44,16 32,29" fill="#b3122e" stroke="#5c0c17" strokeWidth="1" strokeLinejoin="round" />
          <polygon points="27,7 37,7 35,14 29,14" fill="#e0334c" />
          <polygon points="20,16 27,7 29,14" fill="#8f0e24" />
          <polygon points="37,7 44,16 35,14" fill="#7a0c1f" />
          <polygon points="29,14 35,14 32,29" fill="#d12640" />
          <circle cx="29.5" cy="10" r="1.3" fill="#ffd0d7" />
        </g>
      )}
    </svg>
  );
}

export function BagArt({ className = "h-28 w-28" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M15 32c-4 11-2 25 17 26 19-1 21-15 17-26-3-7-9-10-17-10s-14 3-17 10z" fill="#3a2428" stroke="#8a5560" strokeWidth="1.2" />
      <path d="M22 44c3 6 17 7 21 1" fill="none" stroke="#5a363d" strokeWidth="1.2" />
      <path d="M24 22l3-8h10l3 8z" fill="#4a2e33" stroke="#8a5560" strokeWidth="1" />
      <path d="M22 14c2-7 7-6 10-3 3-3 8-4 10 3z" fill="#4a2e33" stroke="#8a5560" strokeWidth="1" />
      <path d="M22 20c6 4 14 4 20 0" fill="none" stroke="#c0172f" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M41 21l3 10M43 21l4 8" stroke="#c0172f" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="44" cy="32" r="1.8" fill="#e0334c" />
      <circle cx="47.5" cy="29.5" r="1.8" fill="#e0334c" />
    </svg>
  );
}

function FakeBadge() {
  return <span className="rounded bg-white/15 px-1 text-[10px] font-bold text-white/80">偽</span>;
}

/** Large, tappable tile with an illustration — for the bag and your hand. */
export function ItemCard({
  item,
  selected,
  onClick,
  size = "lg",
}: {
  item: Pick<Item, "kind" | "fake">;
  selected?: boolean;
  onClick?: () => void;
  size?: "lg" | "md";
}) {
  const dims = size === "lg" ? "w-24 sm:w-28" : "w-20";
  const art = size === "lg" ? "h-14 w-14 sm:h-16 sm:w-16" : "h-11 w-11";
  const cls = `relative flex ${dims} flex-col items-center gap-1 rounded-xl border px-2 pb-2 pt-3 text-sm transition ${
    selected
      ? "-translate-y-1 border-zakuro-light bg-zakuro/25 text-white"
      : "border-white/10 bg-white/[0.04] text-bone/90"
  } ${onClick ? "cursor-pointer hover:border-zakuro-light/70" : ""}`;
  const body = (
    <>
      <ItemArt kind={item.kind} className={art} />
      <span className="whitespace-nowrap text-xs sm:text-sm">{ITEM_LABEL[item.kind]}</span>
      {item.fake && (
        <span className="absolute right-1.5 top-1.5">
          <FakeBadge />
        </span>
      )}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Compact inline item — for lists, logs and results. */
export function ItemChip({ item }: { item: Pick<Item, "kind" | "fake"> }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-white/5 px-1 py-0.5 text-xs">
      <ItemArt kind={item.kind} className="h-4 w-4" />
      {ITEM_LABEL[item.kind]}
      {item.fake && <span className="text-zakuro-light">(偽)</span>}
    </span>
  );
}

export function CompositionRow({ composition }: { composition: Record<ItemKind, number> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ITEM_ORDER.filter((k) => composition[k] > 0).map((k) => (
        <span key={k} className="inline-flex items-center gap-1 rounded-lg bg-white/[0.05] px-2 py-1 text-xs">
          <ItemArt kind={k} className="h-5 w-5" />
          {ITEM_LABEL[k]}
          <span className="font-bold text-white">×{composition[k]}</span>
        </span>
      ))}
    </div>
  );
}
