ALTER TABLE "countries"
ADD COLUMN "iso" CHAR(2);

UPDATE "countries"
SET "iso" = CASE "name"
  WHEN 'Германия' THEN 'DE'
  WHEN 'Япония' THEN 'JP'
  WHEN 'Китай' THEN 'CN'
  WHEN 'США' THEN 'US'
  WHEN 'Франция' THEN 'FR'
  WHEN 'Италия' THEN 'IT'
  WHEN 'Швейцария' THEN 'CH'
  WHEN 'Южная Корея' THEN 'KR'
  WHEN 'Россия' THEN 'RU'
  ELSE UPPER(SUBSTRING(MD5("name") FROM 1 FOR 2))
END
WHERE "iso" IS NULL;

ALTER TABLE "countries"
ALTER COLUMN "iso" SET NOT NULL;

CREATE UNIQUE INDEX "countries_iso_key" ON "countries"("iso");
