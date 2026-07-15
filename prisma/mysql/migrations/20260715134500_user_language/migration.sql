ALTER TABLE `User` ADD COLUMN `language` VARCHAR(191) NULL;

UPDATE `User`
SET `language` = CASE
  WHEN JSON_UNQUOTE(JSON_EXTRACT(`settings`, '$.language')) LIKE 'en%' THEN 'en'
  WHEN JSON_UNQUOTE(JSON_EXTRACT(`settings`, '$.language')) LIKE 'zh%' THEN 'zh-CN'
  ELSE NULL
END
WHERE `settings` IS NOT NULL;