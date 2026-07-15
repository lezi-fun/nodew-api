ALTER TABLE "User" ADD COLUMN "language" TEXT;

UPDATE "User"
SET "language" = CASE
  WHEN "settings"->>'language' LIKE 'en%' THEN 'en'
  WHEN "settings"->>'language' LIKE 'zh%' THEN 'zh-CN'
  ELSE NULL
END
WHERE "settings" IS NOT NULL;