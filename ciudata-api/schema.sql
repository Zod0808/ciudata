-- CIUDATA — Esquema PostgreSQL
-- Requiere PostgreSQL 14+ (gen_random_uuid, JSONB, particionamiento)

-- ─── EXTENSIONES ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── TABLA: usuarios ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash  TEXT        UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLA: ciclos ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ciclos (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  mes        SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio       SMALLINT NOT NULL CHECK (anio >= 2024),
  estado     TEXT     NOT NULL DEFAULT 'active'
               CHECK (estado IN ('active', 'closed', 'rewarded')),
  sponsor_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (mes, anio)
);

-- ─── TABLA: puntos_eventos ──────────────────────────────────────────────────
-- Registro transaccional; JSONB permite payloads distintos por tipo de evento.
CREATE TABLE IF NOT EXISTS puntos_eventos (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ciclo_id   UUID        NOT NULL REFERENCES ciclos(id),
  tipo       TEXT        NOT NULL
               CHECK (tipo IN ('encuesta', 'ruta', 'reporte', 'referido')),
  puntos     SMALLINT    NOT NULL CHECK (puntos >= 0),
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pe_usuario_ciclo
  ON puntos_eventos (usuario_id, ciclo_id);

CREATE INDEX IF NOT EXISTS idx_pe_ciclo_created
  ON puntos_eventos (ciclo_id, created_at DESC);

-- ─── TABLA: ranking_mensual ─────────────────────────────────────────────────
-- Materializada al cierre del ciclo; no se recalcula en tiempo real.
CREATE TABLE IF NOT EXISTS ranking_mensual (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id     UUID        NOT NULL REFERENCES ciclos(id),
  usuario_id   UUID        NOT NULL REFERENCES usuarios(id),
  posicion     INTEGER     NOT NULL,
  total_puntos INTEGER     NOT NULL,
  generado_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ciclo_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_ciclo_posicion
  ON ranking_mensual (ciclo_id, posicion ASC);

-- ─── TABLA: codigos_qr ──────────────────────────────────────────────────────
-- 100 = producto gratis, 50 = 50 % descuento, 30 = 30 % descuento
CREATE TABLE IF NOT EXISTS codigos_qr (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token            TEXT        UNIQUE NOT NULL,
  usuario_id       UUID        REFERENCES usuarios(id),
  ciclo_id         UUID        REFERENCES ciclos(id),
  tipo_descuento   TEXT        NOT NULL
                     CHECK (tipo_descuento IN ('100', '50', '30')),
  canjeado         BOOLEAN     NOT NULL DEFAULT FALSE,
  canjeado_at      TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_token
  ON codigos_qr (token);

-- ─── VISTA: ranking_provisional ─────────────────────────────────────────────
-- Usada por el job nocturno para poblar la caché Redis (TTL 1 h).
-- No exponerla directamente a la app; consultar via caché.
CREATE OR REPLACE VIEW vw_ranking_provisional AS
SELECT
  pe.ciclo_id,
  pe.usuario_id,
  SUM(pe.puntos)                            AS total_puntos,
  RANK() OVER (
    PARTITION BY pe.ciclo_id
    ORDER BY SUM(pe.puntos) DESC
  )                                         AS posicion
FROM puntos_eventos pe
GROUP BY pe.ciclo_id, pe.usuario_id;
