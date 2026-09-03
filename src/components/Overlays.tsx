"use client";

import { useEffect } from "react";
import { cx } from "@/lib/cx";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  width?: number;
  onClose: () => void;
  children: React.ReactNode;
};

export function SlideOver({ open, title, subtitle, width = 400, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        className="h-full flex-1 bg-black/45"
        onClick={onClose}
      />
      <aside
        style={{ width }}
        className={cx(
          "flex h-full max-w-[92vw] flex-col border-l border-white/10 bg-[#0c0f14] shadow-[-24px_0_48px_rgba(0,0,0,0.45)]",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/8 px-4 py-3">
          <div>
            <div className="font-serif text-xl leading-tight">{title}</div>
            {subtitle && <p className="mt-1 text-[12px] text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[12px] text-muted hover:bg-white/6 hover:text-foreground"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">{children}</div>
      </aside>
    </div>
  );
}

type ModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function Modal({ open, title, subtitle, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[#10141c] p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="font-serif text-xl leading-tight">{title}</div>
            {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[12px] text-muted hover:bg-white/6"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
