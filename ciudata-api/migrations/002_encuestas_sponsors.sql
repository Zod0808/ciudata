-- Migración 002: tablas encuestas y sponsors, FCM token en usuarios
-- Aplicar con: psql $DATABASE_URL -f migrations/002_encuestas_sponsors.sql

-- ── sponsors ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sponsors (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT    NOT NULL,
  api_key    TEXT    UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── encuestas (bloques semanales, 4 preguntas c/u) ────────────────────────
-- preguntas es un array JSONB: [{id, texto, opciones: [string]}]
CREATE TABLE IF NOT EXISTS encuestas (
  id         UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id   UUID     NOT NULL REFERENCES ciclos(id),
  semana     SMALLINT NOT NULL CHECK (semana BETWEEN 1 AND 5),
  preguntas  JSONB    NOT NULL DEFAULT '[]',
  activa     BOOLEAN  NOT NULL DEFAULT FALSE,
  inicio     TIMESTAMPTZ,
  fin        TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ciclo_id, semana)
);

CREATE INDEX IF NOT EXISTS idx_encuestas_ciclo_activa
  ON encuestas (ciclo_id, activa);

-- ── FCM push token por usuario ────────────────────────────────────────────
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- ── sponsor_id referenciado en ciclos ─────────────────────────────────────
ALTER TABLE ciclos ADD COLUMN IF NOT EXISTS sponsor_id_fk UUID REFERENCES sponsors(id);
ALTER TABLE ciclos ADD COLUMN IF NOT EXISTS sponsor_nombre TEXT;

-- ── log de notificaciones enviadas ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notificaciones_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id),
  ciclo_id   UUID REFERENCES ciclos(id),
  tipo       TEXT NOT NULL,  -- 'ganador', 'ranking', 'encuesta_nueva'
  payload    JSONB DEFAULT '{}',
  enviado_at TIMESTAMPTZ DEFAULT NOW()
);
