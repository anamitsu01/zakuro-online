import { ITEM_LABEL } from "@/lib/content";
import type { Item, ItemKind } from "@/lib/types";

const COLOR: Record<ItemKind, string> = {
  gem: "#f2ede4",
  gun: "#9aa3ad",
  bullet: "#c9a44c",
  doll: "#b08968",
  ring: "#c9a44c",
};

export function ItemIcon({ kind, className = "h-5 w-5" }: { kind: ItemKind; className?: string }) {
  const c = COLOR[kind];
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {kind === "gem" && (
        <g fill={c} stroke="#0c0708" strokeWidth="0.8" strokeLinejoin="round">
          <path d="M6 4h12l4 5-10 12L2 9z" />
          <path d="M2 9h20M9 4l-2 5 5 12 5-12-2-5" fill="none" />
        </g>
      )}
      {kind === "gun" && (
        <path
          fill={c}
          d="M2 7h17l1-1h2v4h-3l-1 1h-4l-1 2h-2l-1 5H6l1-5H4L2 10z"
        />
      )}
      {kind === "bullet" && (
        <g fill={c}>
          <path d="M12 2c-2.2 2-3 4.6-3 7v2h6V9c0-2.4-.8-5-3-7z" />
          <rect x="9" y="12" width="6" height="9" rx="0.8" fill="#a8843a" />
        </g>
      )}
      {kind === "doll" && (
        <g fill={c}>
          <circle cx="12" cy="6" r="3.5" />
          <path d="M7 22l1.2-8.5L5 11l1.2-1.6L10 11h4l3.8-1.6L19 11l-3.2 2.5L17 22h-3.2L12 16l-1.8 6z" />
        </g>
      )}
      {kind === "ring" && (
        <g>
          <circle cx="12" cy="14.5" r="6" fill="none" stroke={c} strokeWidth="2.4" />
          <path d="M12 2.5l3.2 3.5-3.2 3.5-3.2-3.5z" fill="#c0172f" stroke="#ff8a9b" strokeWidth="0.6" />
        </g>
      )}
    </svg>
  );
}

export function ItemChip({
  item,
  selected,
  dim,
  onClick,
  showFake = true,
}: {
  item: Pick<Item, "kind" | "fake">;
  selected?: boolean;
  dim?: boolean;
  onClick?: () => void;
  showFake?: boolean;
}) {
  const base =
    "relative inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors";
  const state = selected
    ? "border-zakuro-light bg-zakuro/30 text-white"
    : "border-white/10 bg-white/[0.04] text-bone/90";
  const interactive = onClick ? "cursor-pointer hover:border-zakuro-light/70" : "";
  const content = (
    <>
      <ItemIcon kind={item.kind} />
      <span>{ITEM_LABEL[item.kind]}</span>
      {showFake && item.fake && (
        <span className="rounded bg-white/15 px-1 text-[10px] font-bold text-white/80">偽</span>
      )}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} ${state} ${interactive} ${dim ? "opacity-40" : ""}`}>
        {content}
      </button>
    );
  }
  return <span className={`${base} ${state} ${dim ? "opacity-40" : ""}`}>{content}</span>;
}

export function CompositionRow({ composition }: { composition: Record<ItemKind, number> }) {
  const kinds: ItemKind[] = ["ring", "gem", "gun", "bullet", "doll"];
  return (
    <div className="flex flex-wrap gap-2">
      {kinds
        .filter((k) => composition[k] > 0)
        .map((k) => (
          <span key={k} className="inline-flex items-center gap-1 rounded-lg bg-white/[0.05] px-2 py-1 text-sm">
            <ItemIcon kind={k} />
            {ITEM_LABEL[k]}
            <span className="font-bold text-white">×{composition[k]}</span>
          </span>
        ))}
    </div>
  );
}
