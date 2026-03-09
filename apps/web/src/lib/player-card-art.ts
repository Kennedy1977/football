const FACE_COLUMNS = 12;
const FACE_ROWS = 10;
const FACE_COUNT = FACE_COLUMNS * FACE_ROWS;

const SHIRT_COLUMNS = 8;
const SHIRT_ROWS = 6;
const SHIRT_COUNT = SHIRT_COLUMNS * SHIRT_ROWS;

export function getPlayerCardArt(seed: string | number) {
  const hash = fnv1aHash(String(seed));

  const faceIndex = hash % FACE_COUNT;
  const shirtIndex = ((hash >>> 8) ^ (hash >>> 17)) % SHIRT_COUNT;

  return {
    faceIndex,
    shirtIndex,
    facePosition: toSpritePosition(faceIndex, FACE_COLUMNS, FACE_ROWS),
    shirtPosition: toSpritePosition(shirtIndex, SHIRT_COLUMNS, SHIRT_ROWS),
  };
}

function toSpritePosition(index: number, columns: number, rows: number): string {
  const col = index % columns;
  const row = Math.floor(index / columns);

  const x = columns > 1 ? (col / (columns - 1)) * 100 : 0;
  const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;

  return `${x}% ${y}%`;
}

function fnv1aHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
