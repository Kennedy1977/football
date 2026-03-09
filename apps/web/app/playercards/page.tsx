import type { CSSProperties } from "react";
import { toRarityFrame } from "../../src/lib/rarity-frame";
import { getPlayerCardArt } from "../../src/lib/player-card-art";

type PreviewRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

const previewPlayers: Array<{
  id: number;
  name: string;
  position: "GK" | "DEF" | "MID" | "ATT";
  rarity: PreviewRarity;
  overall: number;
  shirtNumber: number;
}> = [
  { id: 101, name: "Leo Hart", position: "ATT", rarity: "LEGENDARY", overall: 94, shirtNumber: 9 },
  { id: 102, name: "Noah Silva", position: "MID", rarity: "EPIC", overall: 88, shirtNumber: 8 },
  { id: 103, name: "Mason Cole", position: "DEF", rarity: "RARE", overall: 82, shirtNumber: 5 },
  { id: 104, name: "Ruben Kane", position: "GK", rarity: "COMMON", overall: 76, shirtNumber: 1 },
  { id: 105, name: "Kai Mercer", position: "ATT", rarity: "EPIC", overall: 90, shirtNumber: 11 },
  { id: 106, name: "Ezra Quinn", position: "MID", rarity: "RARE", overall: 85, shirtNumber: 7 },
  { id: 107, name: "Jude Nolan", position: "DEF", rarity: "COMMON", overall: 74, shirtNumber: 3 },
  { id: 108, name: "Ira Bennett", position: "ATT", rarity: "LEGENDARY", overall: 95, shirtNumber: 10 },
];

export default function PlayerCardsPreviewPage() {
  return (
    <main className="page-panel page-panel-portrait">
      <h2 className="page-title">Player Card Preview</h2>
      <p className="page-copy">1-up, 2-up and landscape concepts with tuned portrait alignment and banner-safe naming.</p>

      <div className="inline" style={{ marginBottom: 12 }}>
        <span className="label-pill">Route: /playercards</span>
        <span className="label-pill">Faces: 108</span>
        <span className="label-pill">Shirts: 48</span>
      </div>

      <section className="preview-block">
        <h3 className="preview-block-title">1-Up Vertical</h3>
        <div className="preview-card-grid preview-card-grid-1up">
          {previewPlayers.map((player) => (
            <VerticalPreviewCard key={`one-${player.id}`} player={player} />
          ))}
        </div>
      </section>

      <section className="preview-block">
        <h3 className="preview-block-title">2-Up Vertical</h3>
        <div className="preview-card-grid preview-card-grid-2up">
          {previewPlayers.map((player) => (
            <VerticalPreviewCard key={`two-${player.id}`} player={player} />
          ))}
        </div>
      </section>

      <section className="preview-block">
        <h3 className="preview-block-title">Landscape Gradient</h3>
        <div className="preview-landscape-grid">
          {previewPlayers.map((player) => (
            <LandscapePreviewCard key={`land-${player.id}`} player={player} />
          ))}
        </div>
      </section>
    </main>
  );
}

function VerticalPreviewCard({
  player,
}: {
  player: (typeof previewPlayers)[number];
}) {
  const art = getPlayerCardArt(`${player.id}-${player.name}-${player.shirtNumber}`);
  const shirtStyle: CSSProperties = { backgroundPosition: art.shirtPosition };
  const faceStyle: CSSProperties = { backgroundPosition: art.facePosition };
  const rarityClass = `rarity-${toRarityFrame(player.rarity)}`;

  return (
    <article className={`preview-player-card ${rarityClass}`}>
      <div className="preview-player-art" aria-hidden>
        <span className="preview-player-shirt" style={shirtStyle} />
        <span className="preview-player-face" style={faceStyle} />
      </div>
      <span className="preview-player-rating">{toTwoDigitRating(player.overall)}</span>
      <span className="preview-player-name">{formatDisplayName(player.name)}</span>
      <span className="preview-player-meta">
        #{player.shirtNumber} • {player.position}
      </span>
    </article>
  );
}

function LandscapePreviewCard({
  player,
}: {
  player: (typeof previewPlayers)[number];
}) {
  const art = getPlayerCardArt(`${player.id}-${player.name}-${player.shirtNumber}`);
  const shirtStyle: CSSProperties = { backgroundPosition: art.shirtPosition };
  const faceStyle: CSSProperties = { backgroundPosition: art.facePosition };
  const rarityClass = `rarity-${toRarityFrame(player.rarity)}`;

  return (
    <article className={`preview-player-card-landscape ${rarityClass}`}>
      <div className="preview-player-art-landscape" aria-hidden>
        <span className="preview-player-shirt preview-player-shirt-landscape" style={shirtStyle} />
        <span className="preview-player-face preview-player-face-landscape" style={faceStyle} />
      </div>
      <span className="preview-player-rating preview-player-rating-landscape">{toTwoDigitRating(player.overall)}</span>
      <h4 className="preview-player-name-landscape">{formatDisplayName(player.name)}</h4>
      <p className="preview-player-meta-landscape">
        #{player.shirtNumber} • {player.position} • {player.rarity}
      </p>
    </article>
  );
}

function formatDisplayName(fullName: string): string {
  const normalized = fullName.trim().replace(/\s+/g, " ");
  if (normalized.length <= 13) {
    return normalized;
  }

  const parts = normalized.split(" ");
  if (parts.length < 2) {
    return normalized.slice(0, 13);
  }

  const firstInitial = parts[0].charAt(0).toUpperCase();
  const lastName = parts[parts.length - 1];
  const shortName = `${firstInitial}. ${lastName}`;

  if (shortName.length <= 13) {
    return shortName;
  }

  return `${firstInitial}. ${lastName.slice(0, 10)}`.trimEnd();
}

function toTwoDigitRating(overall: number): string {
  return Math.min(99, Math.max(0, Math.round(overall)))
    .toString()
    .padStart(2, "0");
}
