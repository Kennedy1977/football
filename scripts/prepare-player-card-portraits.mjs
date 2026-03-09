#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const shirtsArg = process.argv[2] || process.env.PLAYER_CARD_SHIRTS_SOURCE || "tmp/shirts.png";
const faces1Arg = process.argv[3] || process.env.PLAYER_CARD_FACES1_SOURCE || "tmp/faces-1.png";
const faces2Arg = process.argv[4] || process.env.PLAYER_CARD_FACES2_SOURCE || "tmp/faces-2.png";

const shirtsPath = path.resolve(ROOT, shirtsArg);
const faces1Path = path.resolve(ROOT, faces1Arg);
const faces2Path = path.resolve(ROOT, faces2Arg);

const outputDir = path.resolve(ROOT, "apps/web/public/assets/player-cards");
const shirtsSpritePath = path.join(outputDir, "shirts-sprite.webp");
const facesSpritePath = path.join(outputDir, "faces-sprite.webp");
const manifestPath = path.join(outputDir, "portrait-manifest.json");

const SHIRT_GRID = { columns: 8, rows: 6, count: 48, cellSize: 192 };
const FACE_GRID = { columns: 14, rows: 9, count: 126, cellSize: 192 };

async function run() {
  const sharp = await loadSharp();
  await Promise.all([assertSourceExists(shirtsPath), assertSourceExists(faces1Path), assertSourceExists(faces2Path)]);
  await fs.mkdir(outputDir, { recursive: true });

  const shirtComponents = await detectConnectedComponents(shirtsPath, "shirts", sharp);
  const faceComponents1 = await detectConnectedComponents(faces1Path, "faces", sharp);
  const faceComponents2 = await detectConnectedComponents(faces2Path, "faces", sharp);

  const shirtBoxes = shirtComponents
    .filter((component) => {
      return (
        component.pixelCount >= 3000 &&
        component.width >= 120 &&
        component.width <= 190 &&
        component.height >= 110 &&
        component.height <= 190 &&
        component.top < 1200
      );
    })
    .sort(sortByRowThenColumn);

  const faceBoxes1 = faceComponents1
    .filter((component) => {
      return (
        component.pixelCount >= 1500 &&
        component.width >= 90 &&
        component.width <= 170 &&
        component.height >= 100 &&
        component.height <= 190
      );
    })
    .sort(sortByRowThenColumn);

  const faceBoxes2 = faceComponents2
    .filter((component) => {
      return (
        component.pixelCount >= 1500 &&
        component.width >= 90 &&
        component.width <= 170 &&
        component.height >= 100 &&
        component.height <= 190
      );
    })
    .sort(sortByRowThenColumn);

  if (shirtBoxes.length !== SHIRT_GRID.count) {
    throw new Error(
      `Expected ${SHIRT_GRID.count} shirt sprites but found ${shirtBoxes.length}. ` +
        "Verify the shirts source image and filtering assumptions."
    );
  }

  if (faceBoxes1.length !== 63 || faceBoxes2.length !== 63) {
    throw new Error(
      `Expected 63 faces in each sheet, found ${faceBoxes1.length} and ${faceBoxes2.length}. ` +
      "Verify the faces source images and filtering assumptions."
    );
  }

  const shirtTiles = await buildTiles(shirtsPath, shirtBoxes, SHIRT_GRID.cellSize, 10, sharp, {
    cleanupIslands: true,
    alphaThreshold: 88,
  });
  const faceTilesA = await buildTiles(faces1Path, faceBoxes1, FACE_GRID.cellSize, 10, sharp);
  const faceTilesB = await buildTiles(faces2Path, faceBoxes2, FACE_GRID.cellSize, 10, sharp);
  const faceTiles = [...faceTilesA, ...faceTilesB];

  await writeSprite(shirtTiles, SHIRT_GRID.columns, SHIRT_GRID.rows, SHIRT_GRID.cellSize, shirtsSpritePath, sharp);
  await writeSprite(faceTiles, FACE_GRID.columns, FACE_GRID.rows, FACE_GRID.cellSize, facesSpritePath, sharp);

  const manifest = {
    generatedAt: new Date().toISOString(),
    sources: {
      shirts: path.relative(ROOT, shirtsPath),
      faces1: path.relative(ROOT, faces1Path),
      faces2: path.relative(ROOT, faces2Path),
    },
    shirts: {
      file: path.relative(ROOT, shirtsSpritePath),
      count: SHIRT_GRID.count,
      columns: SHIRT_GRID.columns,
      rows: SHIRT_GRID.rows,
      cellSize: SHIRT_GRID.cellSize,
    },
    faces: {
      file: path.relative(ROOT, facesSpritePath),
      count: FACE_GRID.count,
      columns: FACE_GRID.columns,
      rows: FACE_GRID.rows,
      cellSize: FACE_GRID.cellSize,
    },
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log("Player card portrait sprites prepared.");
  console.log(`Shirts: ${manifest.shirts.file} (${manifest.shirts.columns}x${manifest.shirts.rows})`);
  console.log(`Faces: ${manifest.faces.file} (${manifest.faces.columns}x${manifest.faces.rows})`);
}

async function detectConnectedComponents(imagePath, mode, sharp) {
  const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const pixelCount = width * height;

  const mask = new Uint8Array(pixelCount);
  for (let index = 0, offset = 0; index < pixelCount; index += 1, offset += 4) {
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = data[offset + 3];

    if (mode === "shirts") {
      mask[index] = a > 20 ? 1 : 0;
    } else {
      mask[index] = a > 20 && (r < 245 || g < 245 || b < 245) ? 1 : 0;
    }
  }

  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  const components = [];

  for (let start = 0; start < pixelCount; start += 1) {
    if (!mask[start] || visited[start]) continue;

    let head = 0;
    let tail = 0;
    queue[tail] = start;
    tail += 1;
    visited[start] = 1;

    let left = width;
    let right = 0;
    let top = height;
    let bottom = 0;
    let count = 0;

    while (head < tail) {
      const current = queue[head];
      head += 1;
      count += 1;

      const y = Math.floor(current / width);
      const x = current - y * width;

      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;

      if (x + 1 < width) {
        const rightIndex = current + 1;
        if (mask[rightIndex] && !visited[rightIndex]) {
          visited[rightIndex] = 1;
          queue[tail] = rightIndex;
          tail += 1;
        }
      }
      if (x > 0) {
        const leftIndex = current - 1;
        if (mask[leftIndex] && !visited[leftIndex]) {
          visited[leftIndex] = 1;
          queue[tail] = leftIndex;
          tail += 1;
        }
      }
      if (y + 1 < height) {
        const downIndex = current + width;
        if (mask[downIndex] && !visited[downIndex]) {
          visited[downIndex] = 1;
          queue[tail] = downIndex;
          tail += 1;
        }
      }
      if (y > 0) {
        const upIndex = current - width;
        if (mask[upIndex] && !visited[upIndex]) {
          visited[upIndex] = 1;
          queue[tail] = upIndex;
          tail += 1;
        }
      }
    }

    components.push({
      left,
      top,
      width: right - left + 1,
      height: bottom - top + 1,
      pixelCount: count,
    });
  }

  return components;
}

async function buildTiles(imagePath, boxes, cellSize, padding, sharp, options = {}) {
  const { cleanupIslands = false, alphaThreshold = 80 } = options;
  const sourceMeta = await sharp(imagePath).metadata();
  const width = sourceMeta.width || 0;
  const height = sourceMeta.height || 0;
  const tiles = [];

  for (const box of boxes) {
    const rect = padRect(box, width, height, padding);
    let tile = await sharp(imagePath)
      .extract(rect)
      .resize(cellSize - 20, cellSize - 20, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    if (cleanupIslands) {
      tile = await keepLargestAlphaIsland(tile, sharp, alphaThreshold);
    }

    const canvas = await sharp({
      create: {
        width: cellSize,
        height: cellSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: tile, left: 10, top: 10 }])
      .png()
      .toBuffer();

    tiles.push(canvas);
  }

  return tiles;
}

async function keepLargestAlphaIsland(inputBuffer, sharp, alphaThreshold) {
  const { data, info } = await sharp(inputBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);

  let largestIsland = [];

  for (let start = 0; start < pixelCount; start += 1) {
    const alpha = data[start * 4 + 3];
    if (alpha <= alphaThreshold || visited[start]) continue;

    let head = 0;
    let tail = 0;
    queue[tail] = start;
    tail += 1;
    visited[start] = 1;

    const island = [];

    while (head < tail) {
      const current = queue[head];
      head += 1;
      island.push(current);

      const y = Math.floor(current / width);
      const x = current - y * width;

      if (x + 1 < width) {
        const rightIndex = current + 1;
        if (!visited[rightIndex] && data[rightIndex * 4 + 3] > alphaThreshold) {
          visited[rightIndex] = 1;
          queue[tail] = rightIndex;
          tail += 1;
        }
      }
      if (x > 0) {
        const leftIndex = current - 1;
        if (!visited[leftIndex] && data[leftIndex * 4 + 3] > alphaThreshold) {
          visited[leftIndex] = 1;
          queue[tail] = leftIndex;
          tail += 1;
        }
      }
      if (y + 1 < height) {
        const downIndex = current + width;
        if (!visited[downIndex] && data[downIndex * 4 + 3] > alphaThreshold) {
          visited[downIndex] = 1;
          queue[tail] = downIndex;
          tail += 1;
        }
      }
      if (y > 0) {
        const upIndex = current - width;
        if (!visited[upIndex] && data[upIndex * 4 + 3] > alphaThreshold) {
          visited[upIndex] = 1;
          queue[tail] = upIndex;
          tail += 1;
        }
      }
    }

    if (island.length > largestIsland.length) {
      largestIsland = island;
    }
  }

  if (!largestIsland.length) {
    return inputBuffer;
  }

  const keep = new Uint8Array(pixelCount);
  for (const index of largestIsland) {
    keep[index] = 1;
  }

  for (let index = 0; index < pixelCount; index += 1) {
    if (!keep[index]) {
      data[index * 4 + 3] = 0;
    }
  }

  return sharp(data, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function writeSprite(tiles, columns, rows, cellSize, destinationPath, sharp) {
  const spriteWidth = columns * cellSize;
  const spriteHeight = rows * cellSize;

  const composite = tiles.map((tile, index) => ({
    input: tile,
    left: (index % columns) * cellSize,
    top: Math.floor(index / columns) * cellSize,
  }));

  await sharp({
    create: {
      width: spriteWidth,
      height: spriteHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composite)
    .webp({ quality: 94, effort: 6 })
    .toFile(destinationPath);
}

function sortByRowThenColumn(a, b) {
  if (Math.abs(a.top - b.top) > 12) {
    return a.top - b.top;
  }
  return a.left - b.left;
}

function padRect(box, sourceWidth, sourceHeight, padding) {
  const left = Math.max(0, box.left - padding);
  const top = Math.max(0, box.top - padding);
  const right = Math.min(sourceWidth, box.left + box.width + padding);
  const bottom = Math.min(sourceHeight, box.top + box.height + padding);
  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

async function loadSharp() {
  try {
    const module = await import("sharp");
    return module.default;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to load sharp. Install dependencies first. Detail: ${detail}`);
  }
}

async function assertSourceExists(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Source image not found at ${filePath}`);
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
