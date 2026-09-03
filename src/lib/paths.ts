export const PATH_COLORS = ["#d4a574", "#7eb8d8", "#8ee0b0", "#c9a0dc", "#f09a9a", "#e8c06a"] as const;

export type PathHighlight = {
  pathId: string;
  label: string;
  color: string;
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  emphasized: boolean;
};
