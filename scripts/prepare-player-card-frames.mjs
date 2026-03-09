#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_SOURCE = "assets/player-card-frames-source.png";
const sourceArg = process.argv[2] || process.env.PLAYER_CARD_FRAME_SOURCE || DEFAULT_SOURCE;
const sourcePath = path.resolve(ROOT, sourceArg);
const outputDir = path.resolve(ROOT, "apps/web/public/assets/player-cards");
const spriteOutput = path.join(outputDir, "rarity-sprite.webp");

const FRAME_LAYOUT = [
  { key: "common", col: 0, row: 0 },
  { key: "rare", col: 1, row: 0 },
  { key: "epic", col: 0, row: 1 },
  { key: "legendary", col: 1, row: 1 },
];

async function run() {
  const sharp = await loadSharp();
  await assertSourceExists(sourcePath);
  await fs.mkdir(outputDir, { recursive: true });

  const source = sharp(sourcePath);
  const meta = await source.metadata();

  if (!meta.width || !meta.height) {
    throw new Error("Unable to read image dimensions from source.");
  }

  if (meta.width < 2 || meta.height < 2) {
    throw new Error(`Source image is too small (${meta.width}x${meta.height}).`);
  }

  const tileWidth = Math.floor(meta.width / 2);
  const tileHeight = Math.floor(meta.height / 2);

  if (tileWidth < 1 || tileHeight < 1) {
    throw new Error("Computed tile size is invalid.");
  }

  await sharp(sourcePath)
    .webp({ quality: 92, effort: 6 })
    .toFile(spriteOutput);

  for (const frame of FRAME_LAYOUT) {
    const left = frame.col * tileWidth;
    const top = frame.row * tileHeight;
    const framePath = path.join(outputDir, `${frame.key}.webp`);

    await sharp(sourcePath)
      .extract({
        left,
        top,
        width: tileWidth,
        height: tileHeight,
      })
      .webp({ quality: 92, effort: 6 })
      .toFile(framePath);
  }

  const manifest = {
    source: path.relative(ROOT, sourcePath),
    generatedAt: new Date().toISOString(),
    sprite: path.relative(ROOT, spriteOutput),
    frameSize: {
      width: tileWidth,
      height: tileHeight,
    },
    frames: FRAME_LAYOUT.map((frame) => ({
      rarity: frame.key,
      file: path.relative(ROOT, path.join(outputDir, `${frame.key}.webp`)),
      spritePosition: `${frame.col * 100}% ${frame.row * 100}%`,
    })),
  };

  await fs.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log("Player card frames prepared.");
  console.log(`Source: ${manifest.source}`);
  console.log(`Sprite: ${manifest.sprite}`);
  console.log(`Frame size: ${tileWidth}x${tileHeight}`);
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
    throw new Error(
      `Source image not found at ${filePath}.\n` +
        "Place your uploaded 2x2 rarity frame image there, or pass a path:\n" +
        "npm run assets:card-frames -- ./path/to/your-image.png"
    );
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
