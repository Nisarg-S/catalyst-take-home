"use client";

import { useState } from "react";
import { cx } from "@/lib/cx";

type Props = {
  alternatives: string[];
  busy: boolean;
  onFork: (text: string) => void;
  compact?: boolean;
};

export function ForkForm({ alternatives, busy, onFork, compact }: Props) {
  const [text, setText] = useState("");
  return (
    <div className={cx("space-y-2", compact && "space-y-1.5")}>
      {alternatives.length > 0 && (
        <div className="flex flex-col gap-1">
          {alternatives.map((a) => (
            <button
              key={a}
              type="button"
              disabled={busy}
              onClick={() => onFork(a)}
              className="rounded-lg border border-gold/30 bg-gold/10 px-2.5 py-1.5 text-left text-[12px] text-gold hover:bg-gold/20 disabled:opacity-40"
            >
              Create a new path: {a}
            </button>
          ))}
        </div>
      )}
      <div className={cx("flex gap-1.5", compact && "flex-col")}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim().length >= 2) {
              onFork(text.trim());
              setText("");
            }
          }}
          placeholder="Or type your own what-if…"
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs outline-none focus:border-gold/40"
        />
        <button
          type="button"
          disabled={busy || text.trim().length < 2}
          onClick={() => {
            onFork(text.trim());
            setText("");
          }}
          className="shrink-0 rounded-md bg-gold px-3 py-1.5 text-xs font-medium text-[#1a140c] disabled:opacity-40"
        >
          Create a new path
        </button>
      </div>
    </div>
  );
}
