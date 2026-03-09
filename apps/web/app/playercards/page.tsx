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
  level: number;
  shirtNumber: number;
}> = [
  { id: 101, name: "Leo Hart", position: "ATT", rarity: "LEGENDARY", overall: 94, level: 15, shirtNumber: 9 },
  { id: 102, name: "Noah Silva", position: "MID", rarity: "EPIC", overall: 88, level: 11, shirtNumber: 8 },
  { id: 103, name: "Mason Cole", position: "DEF", rarity: "RARE", overall: 82, level: 8, shirtNumber: 5 },
  { id: 104, name: "Ruben Kane", position: "GK", rarity: "COMMON", overall: 76, level: 6, shirtNumber: 1 },
  { id: 105, name: "Kai Mercer", position: "ATT", rarity: "EPIC", overall: 90, level: 13, shirtNumber: 11 },
  { id: 106, name: "Ezra Quinn", position: "MID", rarity: "RARE", overall: 85, level: 9, shirtNumber: 7 },
  { id: 107, name: "Jude Nolan", position: "DEF", rarity: "COMMON", overall: 74, level: 5, shirtNumber: 3 },
  { id: 108, name: "Ira Bennett", position: "ATT", rarity: "LEGENDARY", overall: 95, level: 16, shirtNumber: 10 },
];

export default function PlayerCardsPreviewPage() {
  return (
    <main className="page-panel page-panel-portrait">
      <h2 className="page-title">Player Card Preview</h2>
      <p className="page-copy">Temporary route to inspect generated card assets from uploaded frame, shirt, and face sheets.</p>

      <div className="inline" style={{ marginBottom: 12 }}>
        <span className="label-pill">Route: /playercards</span>
        <span className="label-pill">Faces: 126</span>
        <span className="label-pill">Shirts: 48</span>
      </div>

      <div className="player-grid">
        {previewPlayers.map((player) => {
          const art = getPlayerCardArt(`${player.id}-${player.name}-${player.shirtNumber}`);
          const shirtStyle: CSSProperties = { backgroundPosition: art.shirtPosition };
          const faceStyle: CSSProperties = { backgroundPosition: art.facePosition };

          return (
            <article key={player.id} className={`player-card rarity-${toRarityFrame(player.rarity)}`}>
              <div className="player-card-head has-avatar">
                <div className="player-avatar" aria-hidden>
                  <span className="player-avatar-shirt" style={shirtStyle} />
                  <span className="player-avatar-face" style={faceStyle} />
                </div>

                <div className="player-card-head-main">
                  <h3>{player.name}</h3>
                  <p>
                    #{player.shirtNumber} • {player.position} • {player.rarity}
                  </p>
                  <p>Level {player.level}</p>
                </div>

                <div className="player-overall">{player.overall.toFixed(1)}</div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
