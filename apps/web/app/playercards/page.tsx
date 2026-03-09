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
      <p className="page-copy">Vertical card concept using your frame, shirt, and face asset sheets.</p>

      <div className="inline" style={{ marginBottom: 12 }}>
        <span className="label-pill">Route: /playercards</span>
        <span className="label-pill">Faces: 120</span>
        <span className="label-pill">Shirts: 48</span>
      </div>

      <section className="preview-card-grid">
        {previewPlayers.map((player) => {
          const art = getPlayerCardArt(`${player.id}-${player.name}-${player.shirtNumber}`);
          const shirtStyle: CSSProperties = { backgroundPosition: art.shirtPosition };
          const faceStyle: CSSProperties = { backgroundPosition: art.facePosition };
          const rarityClass = `rarity-${toRarityFrame(player.rarity)}`;

          return (
            <article key={player.id} className={`preview-player-card ${rarityClass}`}>
              <div className="preview-player-art" aria-hidden>
                <span className="preview-player-shirt" style={shirtStyle} />
                <span className="preview-player-face" style={faceStyle} />
              </div>
              <span className="preview-player-rating">{toTwoDigitRating(player.overall)}</span>
              <span className="preview-player-name">{player.name}</span>
              <span className="preview-player-meta">
                #{player.shirtNumber} • {player.position}
              </span>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function toTwoDigitRating(overall: number): string {
  return Math.min(99, Math.max(0, Math.round(overall)))
    .toString()
    .padStart(2, "0");
}
