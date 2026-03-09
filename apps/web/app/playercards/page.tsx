import type { CSSProperties } from "react";
import { toRarityFrame } from "../../src/lib/rarity-frame";
import { getPlayerCardArt } from "../../src/lib/player-card-art";

type PreviewRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
type PreviewPosition = "GK" | "DEF" | "MID" | "ATT";

interface PreviewPlayer {
  id: number;
  name: string;
  position: PreviewPosition;
  rarity: PreviewRarity;
  overall: number;
  shirtNumber: number;
  stats: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    strength: number;
    goalkeeping: number;
    stamina: number;
  };
}

const previewPlayers: PreviewPlayer[] = [
  {
    id: 101,
    name: "Leo Hart",
    position: "ATT",
    rarity: "LEGENDARY",
    overall: 94,
    shirtNumber: 9,
    stats: { pace: 96, shooting: 99, passing: 86, dribbling: 95, defending: 58, strength: 89, goalkeeping: 14, stamina: 93 },
  },
  {
    id: 102,
    name: "Noah Silva",
    position: "MID",
    rarity: "EPIC",
    overall: 88,
    shirtNumber: 8,
    stats: { pace: 87, shooting: 84, passing: 92, dribbling: 90, defending: 80, strength: 78, goalkeeping: 12, stamina: 91 },
  },
  {
    id: 103,
    name: "Mason Cole",
    position: "DEF",
    rarity: "RARE",
    overall: 82,
    shirtNumber: 5,
    stats: { pace: 78, shooting: 56, passing: 72, dribbling: 68, defending: 90, strength: 87, goalkeeping: 10, stamina: 89 },
  },
  {
    id: 104,
    name: "Ruben Kane",
    position: "GK",
    rarity: "COMMON",
    overall: 76,
    shirtNumber: 1,
    stats: { pace: 49, shooting: 34, passing: 72, dribbling: 61, defending: 74, strength: 81, goalkeeping: 92, stamina: 87 },
  },
  {
    id: 105,
    name: "Kai Mercer",
    position: "ATT",
    rarity: "EPIC",
    overall: 90,
    shirtNumber: 11,
    stats: { pace: 92, shooting: 95, passing: 82, dribbling: 91, defending: 54, strength: 84, goalkeeping: 9, stamina: 90 },
  },
  {
    id: 106,
    name: "Ezra Quinn",
    position: "MID",
    rarity: "RARE",
    overall: 85,
    shirtNumber: 7,
    stats: { pace: 84, shooting: 79, passing: 88, dribbling: 87, defending: 76, strength: 74, goalkeeping: 11, stamina: 88 },
  },
  {
    id: 107,
    name: "Jude Nolan",
    position: "DEF",
    rarity: "COMMON",
    overall: 74,
    shirtNumber: 3,
    stats: { pace: 70, shooting: 48, passing: 66, dribbling: 62, defending: 82, strength: 80, goalkeeping: 8, stamina: 84 },
  },
  {
    id: 108,
    name: "Ira Bennett",
    position: "ATT",
    rarity: "LEGENDARY",
    overall: 95,
    shirtNumber: 10,
    stats: { pace: 97, shooting: 98, passing: 88, dribbling: 96, defending: 57, strength: 90, goalkeeping: 12, stamina: 94 },
  },
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
  player: PreviewPlayer;
}) {
  const art = getPlayerCardArt(`${player.id}-${player.name}-${player.shirtNumber}`);
  const shirtStyle: CSSProperties = { backgroundPosition: art.shirtPosition };
  const faceStyle: CSSProperties = { backgroundPosition: art.facePosition };
  const rarityClass = `rarity-${toRarityFrame(player.rarity)}`;

  return (
    <article className="preview-player-stack">
      <div className={`preview-player-card ${rarityClass}`}>
        <div className="preview-player-art" aria-hidden>
          <span className="preview-player-shirt" style={shirtStyle} />
          <span className="preview-player-face" style={faceStyle} />
        </div>
        <span className="preview-player-rating">{toTwoDigitRating(player.overall)}</span>
        <span className="preview-player-name">{formatDisplayName(player.name)}</span>
        <span className="preview-player-meta">
          #{player.shirtNumber} • {player.position}
        </span>
      </div>
      <CardKeyStats player={player} />
    </article>
  );
}

function LandscapePreviewCard({
  player,
}: {
  player: PreviewPlayer;
}) {
  const art = getPlayerCardArt(`${player.id}-${player.name}-${player.shirtNumber}`);
  const shirtStyle: CSSProperties = { backgroundPosition: art.shirtPosition };
  const faceStyle: CSSProperties = { backgroundPosition: art.facePosition };
  const rarityClass = `rarity-${toRarityFrame(player.rarity)}`;

  return (
    <article className="preview-player-stack preview-player-stack-landscape">
      <div className={`preview-player-card-landscape ${rarityClass}`}>
        <div className="preview-player-art-landscape" aria-hidden>
          <span className="preview-player-shirt preview-player-shirt-landscape" style={shirtStyle} />
          <span className="preview-player-face preview-player-face-landscape" style={faceStyle} />
        </div>
        <span className="preview-player-rating preview-player-rating-landscape">{toTwoDigitRating(player.overall)}</span>
        <h4 className="preview-player-name-landscape">{formatDisplayName(player.name)}</h4>
        <p className="preview-player-meta-landscape">
          #{player.shirtNumber} • {player.position} • {player.rarity}
        </p>
      </div>
      <CardKeyStats player={player} />
    </article>
  );
}

function CardKeyStats({ player }: { player: PreviewPlayer }) {
  const keyStats = getKeyStats(player);

  return (
    <dl className="preview-player-key-stats" aria-label={`Key stats for ${player.name}`}>
      {keyStats.map((entry) => (
        <div key={`${player.id}-${entry.label}`} className="preview-player-key-stat">
          <dt>{entry.label}</dt>
          <dd>{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function getKeyStats(player: PreviewPlayer): Array<{ label: string; value: string }> {
  const values =
    player.position === "GK"
      ? [
          { label: "Position", value: "GK" },
          { label: "Goalkeeping", value: String(player.stats.goalkeeping) },
          { label: "Defending", value: String(player.stats.defending) },
          { label: "Passing", value: String(player.stats.passing) },
          { label: "Strength", value: String(player.stats.strength) },
          { label: "Stamina", value: String(player.stats.stamina) },
        ]
      : player.position === "DEF"
        ? [
            { label: "Position", value: "DEF" },
            { label: "Defending", value: String(player.stats.defending) },
            { label: "Strength", value: String(player.stats.strength) },
            { label: "Pace", value: String(player.stats.pace) },
            { label: "Passing", value: String(player.stats.passing) },
            { label: "Stamina", value: String(player.stats.stamina) },
          ]
        : player.position === "MID"
          ? [
              { label: "Position", value: "MID" },
              { label: "Passing", value: String(player.stats.passing) },
              { label: "Dribbling", value: String(player.stats.dribbling) },
              { label: "Pace", value: String(player.stats.pace) },
              { label: "Defending", value: String(player.stats.defending) },
              { label: "Stamina", value: String(player.stats.stamina) },
            ]
          : [
              { label: "Position", value: "ATT" },
              { label: "Shooting", value: String(player.stats.shooting) },
              { label: "Dribbling", value: String(player.stats.dribbling) },
              { label: "Pace", value: String(player.stats.pace) },
              { label: "Strength", value: String(player.stats.strength) },
              { label: "Stamina", value: String(player.stats.stamina) },
            ];

  return values;
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
