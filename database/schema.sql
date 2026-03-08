CREATE DATABASE IF NOT EXISTS u749960985_football;
USE u749960985_football;

-- Auth/account identity (Clerk user link)
CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  clerk_user_id VARCHAR(128) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS managers (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  account_id BIGINT UNSIGNED NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL,
  age TINYINT UNSIGNED NULL,
  gender VARCHAR(24) NULL,
  avatar_json JSON NOT NULL,
  avatar_frame VARCHAR(64) NULL,
  level SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  exp INT UNSIGNED NOT NULL DEFAULT 0,
  total_wins INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_managers_account FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS clubs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  account_id BIGINT UNSIGNED NOT NULL UNIQUE,
  manager_id BIGINT UNSIGNED NOT NULL UNIQUE,
  is_cpu BOOLEAN NOT NULL DEFAULT FALSE,
  club_name VARCHAR(64) NOT NULL,
  city VARCHAR(64) NOT NULL,
  stadium_name VARCHAR(64) NOT NULL,
  badge_json JSON NOT NULL,
  home_kit_json JSON NOT NULL,
  away_kit_json JSON NOT NULL,
  coins INT UNSIGNED NOT NULL DEFAULT 0,
  team_overall DECIMAL(5,2) NOT NULL DEFAULT 40,
  current_league_code VARCHAR(32) NOT NULL,
  last_login_at TIMESTAMP NULL,
  cpu_since TIMESTAMP NULL,
  reset_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_clubs_account FOREIGN KEY (account_id) REFERENCES accounts(id),
  CONSTRAINT fk_clubs_manager FOREIGN KEY (manager_id) REFERENCES managers(id),
  INDEX idx_clubs_cpu (is_cpu),
  INDEX idx_clubs_league (current_league_code)
);

CREATE TABLE IF NOT EXISTS league_tiers (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(32) NOT NULL UNIQUE,
  display_name VARCHAR(64) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL,
  is_legends BOOLEAN NOT NULL DEFAULT FALSE,
  team_count SMALLINT UNSIGNED NOT NULL,
  promotion_threshold_points INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS league_memberships (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  club_id BIGINT UNSIGNED NOT NULL UNIQUE,
  league_tier_id BIGINT UNSIGNED NOT NULL,
  legends_division SMALLINT UNSIGNED NULL,
  matches_played INT UNSIGNED NOT NULL DEFAULT 0,
  wins INT UNSIGNED NOT NULL DEFAULT 0,
  draws INT UNSIGNED NOT NULL DEFAULT 0,
  losses INT UNSIGNED NOT NULL DEFAULT 0,
  goals_for INT UNSIGNED NOT NULL DEFAULT 0,
  goals_against INT UNSIGNED NOT NULL DEFAULT 0,
  goal_difference INT NOT NULL DEFAULT 0,
  points INT UNSIGNED NOT NULL DEFAULT 0,
  rank_position SMALLINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lm_club FOREIGN KEY (club_id) REFERENCES clubs(id),
  CONSTRAINT fk_lm_tier FOREIGN KEY (league_tier_id) REFERENCES league_tiers(id),
  INDEX idx_lm_tier_points (league_tier_id, points DESC, goal_difference DESC, goals_for DESC)
);

CREATE TABLE IF NOT EXISTS formation_unlocks (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  manager_id BIGINT UNSIGNED NOT NULL,
  formation_code VARCHAR(16) NOT NULL,
  unlocked_by ENUM('default', 'wins', 'progression', 'shop') NOT NULL,
  unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fu_manager FOREIGN KEY (manager_id) REFERENCES managers(id),
  UNIQUE KEY uq_fu_manager_formation (manager_id, formation_code)
);

CREATE TABLE IF NOT EXISTS players (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  club_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(96) NOT NULL,
  age TINYINT UNSIGNED NOT NULL,
  shirt_number TINYINT UNSIGNED NOT NULL,
  position ENUM('GK', 'DEF', 'MID', 'ATT') NOT NULL,
  rarity ENUM('COMMON', 'RARE', 'EPIC', 'LEGENDARY') NOT NULL,
  overall_rating DECIMAL(5,2) NOT NULL,
  level SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  exp INT UNSIGNED NOT NULL DEFAULT 0,
  exp_to_next INT UNSIGNED NOT NULL DEFAULT 100,
  pace TINYINT UNSIGNED NOT NULL,
  shooting TINYINT UNSIGNED NOT NULL,
  passing TINYINT UNSIGNED NOT NULL,
  dribbling TINYINT UNSIGNED NOT NULL,
  defending TINYINT UNSIGNED NOT NULL,
  strength TINYINT UNSIGNED NOT NULL,
  goalkeeping TINYINT UNSIGNED NOT NULL,
  stamina DECIMAL(5,2) NOT NULL DEFAULT 100,
  is_starting BOOLEAN NOT NULL DEFAULT FALSE,
  is_bench BOOLEAN NOT NULL DEFAULT FALSE,
  portrait_seed VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_players_club FOREIGN KEY (club_id) REFERENCES clubs(id),
  UNIQUE KEY uq_club_shirt (club_id, shirt_number),
  INDEX idx_players_club_position (club_id, position),
  INDEX idx_players_club_starting (club_id, is_starting)
);

CREATE TABLE IF NOT EXISTS lineups (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  club_id BIGINT UNSIGNED NOT NULL UNIQUE,
  formation_code VARCHAR(16) NOT NULL,
  starting_player_ids JSON NOT NULL,
  bench_player_ids JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lineups_club FOREIGN KEY (club_id) REFERENCES clubs(id)
);

CREATE TABLE IF NOT EXISTS matches (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  club_id BIGINT UNSIGNED NOT NULL,
  opponent_club_id BIGINT UNSIGNED NULL,
  league_tier_id BIGINT UNSIGNED NOT NULL,
  result ENUM('WIN', 'DRAW', 'LOSS') NOT NULL,
  club_goals TINYINT UNSIGNED NOT NULL,
  opponent_goals TINYINT UNSIGNED NOT NULL,
  ended_reason ENUM('THREE_GOAL_LEAD', 'TEN_TOTAL_GOALS', 'TIMER_EXPIRED') NOT NULL,
  duration_seconds SMALLINT UNSIGNED NOT NULL,
  points_awarded TINYINT UNSIGNED NOT NULL,
  coin_reward INT UNSIGNED NOT NULL,
  manager_exp_gain INT UNSIGNED NOT NULL,
  starter_exp_gain TINYINT UNSIGNED NOT NULL,
  stamina_loss_pct DECIMAL(5,2) NOT NULL,
  simulation_seed VARCHAR(128) NOT NULL,
  simulation_payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_matches_club FOREIGN KEY (club_id) REFERENCES clubs(id),
  CONSTRAINT fk_matches_opp FOREIGN KEY (opponent_club_id) REFERENCES clubs(id),
  CONSTRAINT fk_matches_tier FOREIGN KEY (league_tier_id) REFERENCES league_tiers(id),
  INDEX idx_matches_club_created (club_id, created_at DESC)
);

CREATE TABLE IF NOT EXISTS daily_reward_claims (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  club_id BIGINT UNSIGNED NOT NULL,
  reward_date DATE NOT NULL,
  coins_awarded INT UNSIGNED NOT NULL,
  claimed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_daily_club FOREIGN KEY (club_id) REFERENCES clubs(id),
  UNIQUE KEY uq_daily_once_per_day (club_id, reward_date)
);

CREATE TABLE IF NOT EXISTS promotion_reward_claims (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  club_id BIGINT UNSIGNED NOT NULL,
  league_tier_id BIGINT UNSIGNED NOT NULL,
  coins_awarded INT UNSIGNED NOT NULL,
  manager_exp_awarded INT UNSIGNED NOT NULL,
  claimed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prc_club FOREIGN KEY (club_id) REFERENCES clubs(id),
  CONSTRAINT fk_prc_tier FOREIGN KEY (league_tier_id) REFERENCES league_tiers(id),
  UNIQUE KEY uq_promo_claim_once (club_id, league_tier_id)
);

CREATE TABLE IF NOT EXISTS pack_catalogue (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL,
  price_coins INT UNSIGNED NOT NULL,
  reward_count TINYINT UNSIGNED NOT NULL,
  rarity_hint VARCHAR(64) NOT NULL,
  reward_focus VARCHAR(64) NOT NULL,
  odds_json JSON NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pack_purchases (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  club_id BIGINT UNSIGNED NOT NULL,
  pack_id BIGINT UNSIGNED NOT NULL,
  total_cost INT UNSIGNED NOT NULL,
  opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pp_club FOREIGN KEY (club_id) REFERENCES clubs(id),
  CONSTRAINT fk_pp_pack FOREIGN KEY (pack_id) REFERENCES pack_catalogue(id),
  INDEX idx_pp_club_opened (club_id, opened_at DESC)
);

CREATE TABLE IF NOT EXISTS pack_rewards (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  pack_purchase_id BIGINT UNSIGNED NOT NULL,
  reward_type ENUM('PLAYER', 'COINS', 'PLAYER_EXP') NOT NULL,
  generated_player_id BIGINT UNSIGNED NULL,
  reward_payload_json JSON NULL,
  coin_amount INT UNSIGNED NULL,
  exp_amount INT UNSIGNED NULL,
  keep_or_convert ENUM('KEEP', 'CONVERT_COINS', 'CONVERT_EXP') NOT NULL,
  resolved_at TIMESTAMP NULL,
  CONSTRAINT fk_pr_purchase FOREIGN KEY (pack_purchase_id) REFERENCES pack_purchases(id),
  CONSTRAINT fk_pr_player FOREIGN KEY (generated_player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS economy_transactions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  club_id BIGINT UNSIGNED NOT NULL,
  source_type ENUM('MATCH', 'DAILY_REWARD', 'PACK_PURCHASE', 'PACK_CONVERT', 'PROMOTION', 'PLAYER_SALE', 'ADMIN') NOT NULL,
  direction ENUM('IN', 'OUT') NOT NULL,
  amount INT NOT NULL,
  reference_id BIGINT UNSIGNED NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_et_club FOREIGN KEY (club_id) REFERENCES clubs(id),
  INDEX idx_et_club_created (club_id, created_at DESC)
);

INSERT INTO league_tiers (code, display_name, sort_order, is_legends, team_count, promotion_threshold_points)
VALUES
  ('BEGINNER_I', 'Beginner I', 1, FALSE, 28, 25),
  ('BEGINNER_II', 'Beginner II', 2, FALSE, 28, 50),
  ('BEGINNER_III', 'Beginner III', 3, FALSE, 28, 75),
  ('BRONZE_I', 'Bronze I', 4, FALSE, 28, 125),
  ('BRONZE_II', 'Bronze II', 5, FALSE, 28, 175),
  ('BRONZE_III', 'Bronze III', 6, FALSE, 28, 225),
  ('SILVER_I', 'Silver I', 7, FALSE, 28, 300),
  ('SILVER_II', 'Silver II', 8, FALSE, 28, 375),
  ('SILVER_III', 'Silver III', 9, FALSE, 28, 450),
  ('GOLD_I', 'Gold I', 10, FALSE, 28, 550),
  ('GOLD_II', 'Gold II', 11, FALSE, 28, 650),
  ('GOLD_III', 'Gold III', 12, FALSE, 28, 750),
  ('PLATINUM_I', 'Platinum I', 13, FALSE, 28, 1000),
  ('PLATINUM_II', 'Platinum II', 14, FALSE, 28, 1500),
  ('PLATINUM_III', 'Platinum III', 15, FALSE, 28, 2000),
  ('LEGENDS', 'Legends', 16, TRUE, 50, NULL)
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

INSERT INTO pack_catalogue (code, name, price_coins, reward_count, rarity_hint, reward_focus, odds_json)
VALUES
  ('PACK_250', 'Starter Scout Pack', 250, 1, 'High Common chance', 'Balanced Rewards', JSON_OBJECT('common', 0.78, 'rare', 0.20, 'epic', 0.02, 'legendary', 0.00)),
  ('PACK_500', 'Club Growth Pack', 500, 2, 'Low Rare chance', 'Player Focus', JSON_OBJECT('common', 0.65, 'rare', 0.28, 'epic', 0.06, 'legendary', 0.01)),
  ('PACK_1000', 'Elite Mix Pack', 1000, 3, 'High Rare chance', 'Balanced Rewards', JSON_OBJECT('common', 0.48, 'rare', 0.38, 'epic', 0.12, 'legendary', 0.02)),
  ('PACK_2500', 'Pro Club Pack', 2500, 4, 'Low Epic chance', 'Player Focus', JSON_OBJECT('common', 0.28, 'rare', 0.46, 'epic', 0.22, 'legendary', 0.04)),
  ('PACK_5000', 'Champion Pack', 5000, 5, 'High Epic chance', 'EXP Focus', JSON_OBJECT('common', 0.15, 'rare', 0.40, 'epic', 0.36, 'legendary', 0.09)),
  ('PACK_10000', 'Legends Vault', 10000, 6, 'Legendary chance', 'Player Focus', JSON_OBJECT('common', 0.06, 'rare', 0.30, 'epic', 0.42, 'legendary', 0.22))
ON DUPLICATE KEY UPDATE name = VALUES(name);
