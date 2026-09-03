"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PanZoom = { x: number; y: number; scale: number };

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.5;

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

type Options = {
  contentWidth: number;
  contentHeight: number;
  fitKey?: string;
};

export function usePanZoom({ contentWidth, contentHeight, fitKey }: Options) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<PanZoom>({ x: 0, y: 0, scale: 1 });
  const dragging = useRef(false);
  const pointerId = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const transformRef = useRef(transform);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  const fitToView = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp || contentWidth <= 0 || contentHeight <= 0) return;
    const pad = 32;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const scale = clampScale(
      Math.min((vw - pad * 2) / contentWidth, (vh - pad * 2) / contentHeight, 1),
    );
    setTransform({
      x: (vw - contentWidth * scale) / 2,
      y: (vh - contentHeight * scale) / 2,
      scale,
    });
  }, [contentWidth, contentHeight]);

  useEffect(() => {
    fitToView();
  }, [fitKey, fitToView]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const ro = new ResizeObserver(() => fitToView());
    ro.observe(vp);
    return () => ro.disconnect();
  }, [fitToView]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const { x, y, scale } = transformRef.current;
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      const nextScale = clampScale(scale * factor);
      const wx = (px - x) / scale;
      const wy = (py - y) / scale;
      setTransform({
        scale: nextScale,
        x: px - wx * nextScale,
        y: py - wy * nextScale,
      });
    };

    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const { x, y, scale } = transformRef.current;
    const cx = vp.clientWidth / 2;
    const cy = vp.clientHeight / 2;
    const nextScale = clampScale(scale * factor);
    const wx = (cx - x) / scale;
    const wy = (cy - y) / scale;
    setTransform({
      scale: nextScale,
      x: cx - wx * nextScale,
      y: cy - wy * nextScale,
    });
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-chain-interactive]")) return;
    dragging.current = true;
    pointerId.current = e.pointerId;
    last.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || pointerId.current !== e.pointerId) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    dragging.current = false;
    pointerId.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  return {
    viewportRef,
    transform,
    fitToView,
    zoomIn: () => zoomBy(1.15),
    zoomOut: () => zoomBy(1 / 1.15),
    mapHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  };
}
