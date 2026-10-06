-- ============================================================
-- EduLoc V2 — Contraintes non exprimables en Prisma.
-- À coller dans la première migration créée avec :
--   npx prisma migrate dev --create-only
-- puis appliquée avec : npx prisma migrate dev
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ------------------------------------------------------------
-- PostGIS (ADR-11, exclusif — pas d'OSRM) : colonne générée
-- sur places + index GIST pour la recherche géographique UC-B03.
-- ------------------------------------------------------------
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS places_location_gist ON places USING gist (location);
CREATE INDEX IF NOT EXISTS offers_search_idx ON offers ("subjectId", "educationLevelId") WHERE "isActive";

-- ------------------------------------------------------------
-- Anti-chevauchement : filet de sécurité final de UC-T03.
-- tsrange (et non tstzrange) car Prisma crée des colonnes
-- timestamp sans fuseau : l'expression d'index doit être immuable.
-- Les PENDING ne bloquent PAS (décision attachment : arbitrage
-- à l'acceptation + auto-refus SYSTEM).
-- ------------------------------------------------------------
ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    "tutorProfileId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE (status IN ('CONFIRMED', 'IN_PROGRESS'));

-- ------------------------------------------------------------
-- CHECK de cohérence
-- ------------------------------------------------------------
ALTER TABLE bookings ADD CONSTRAINT bookings_time_order CHECK ("endAt" > "startAt");
ALTER TABLE reviews ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5);
ALTER TABLE availabilities
  ADD CONSTRAINT availabilities_dow CHECK ("dayOfWeek" BETWEEN 0 AND 6),
  ADD CONSTRAINT availabilities_fmt CHECK ("startTime" ~ '^([01]\d|2[0-3]):[0-5]\d$'
                                         AND "endTime"   ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  ADD CONSTRAINT availabilities_order CHECK ("endTime" > "startTime");

-- Une seule candidature PENDING par tuteur (UC-G05/G06)
CREATE UNIQUE INDEX tutor_applications_one_pending
  ON tutor_applications ("tutorProfileId") WHERE status = 'PENDING';
