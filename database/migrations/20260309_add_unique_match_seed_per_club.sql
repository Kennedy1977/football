SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'matches'
    AND index_name = 'uq_matches_club_seed'
);

SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE matches ADD UNIQUE KEY uq_matches_club_seed (club_id, simulation_seed)',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
