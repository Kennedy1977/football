ALTER TABLE pack_rewards
  ADD COLUMN IF NOT EXISTS reward_payload_json JSON NULL AFTER generated_player_id;
