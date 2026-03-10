const ROMAN_NUMERALS = new Set(["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]);

export function formatLeagueLabel(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const normalized = value.trim();
  if (!normalized) {
    return "-";
  }

  return normalized
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => {
      const upper = part.toUpperCase();
      if (ROMAN_NUMERALS.has(upper)) {
        return upper;
      }
      return upper.charAt(0) + upper.slice(1).toLowerCase();
    })
    .join(" ");
}

