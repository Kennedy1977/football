export type RarityFrame = "common" | "rare" | "epic" | "legendary";

export function toRarityFrame(value: string | null | undefined): RarityFrame {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  switch (normalized) {
    case "RARE":
      return "rare";
    case "EPIC":
      return "epic";
    case "LEGENDARY":
      return "legendary";
    case "COMMON":
    default:
      return "common";
  }
}
