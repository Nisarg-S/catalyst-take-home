export function pct(n: number, digits = 1) {
  const sign = n > 0 ? "+" : n < 0 ? "" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function signed(n: number, digits = 1) {
  const sign = n > 0 ? "+" : n < 0 ? "" : "";
  return `${sign}${n.toFixed(digits)}`;
}

export function pnlTone(n: number) {
  if (n > 0.4) return "pos";
  if (n < -0.4) return "neg";
  return "flat";
}

export function days(n: number) {
  if (n < 14) return `${n}d`;
  if (n < 60) return `${Math.round(n / 7)}w`;
  return `${Math.round(n / 30)}mo`;
}

export function pLabel(p: number) {
  return `${Math.round(p * 100)}%`;
}
