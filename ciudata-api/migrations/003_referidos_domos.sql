-- Migración 003: domos IoT, lecturas, tabla de referidos
-- Aplicar con: psql $DATABASE_URL -f migrations/003_referidos_domos.sql

-- ── domos: estaciones fijas de monitoreo IoT ──────────────────────────────
CREATE TABLE IF NOT EXISTS domos (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT    NOT NULL,
  lat        FLOAT8  NOT NULL,
  lng        FLOAT8  NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── lecturas_domos: serie temporal de lecturas de sensores ────────────────
CREATE TABLE IF NOT EXISTS lecturas_domos (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  domo_id   UUID    NOT NULL REFERENCES domos(id),
  pm25      FLOAT8,
  anomalia  BOOLEAN NOT NULL DEFAULT FALSE,
  leida_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lecturas_domo_time
  ON lecturas_domos (domo_id, leida_at DESC);

-- Índice de búsqueda temporal para validación ±30 min
CREATE INDEX IF NOT EXISTS idx_lecturas_anomalia_time
  ON lecturas_domos (leida_at DESC) WHERE anomalia = TRUE;

-- ── referidos ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referidos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id    UUID        NOT NULL REFERENCES usuarios(id),
  referred_id    UUID        UNIQUE NOT NULL REFERENCES usuarios(id),
  ciclo_id       UUID        NOT NULL REFERENCES ciclos(id),
  acreditado     BOOLEAN     NOT NULL DEFAULT FALSE,
  acreditado_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referidos_referred
  ON referidos (referred_id, acreditado);
