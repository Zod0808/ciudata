-- Migración 004: autenticación OTP + JWT, particionamiento de puntos_eventos
-- Aplicar con: psql $DATABASE_URL -f migrations/004_auth_partitioning.sql
-- IMPORTANTE: ejecutar en una ventana de mantenimiento (requiere bloqueo en puntos_eventos).

-- ── 1. TABLAS DE AUTENTICACIÓN ────────────────────────────────────────────

-- Almacena OTP (hash bcrypt) pendientes de verificación.
CREATE TABLE IF NOT EXISTS otp_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash TEXT        NOT NULL,
  otp_hash   TEXT        NOT NULL,
  intentos   SMALLINT    NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
  used       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Un solo OTP activo por número de teléfono.
CREATE UNIQUE INDEX IF NOT EXISTS idx_otp_phone_active
  ON otp_tokens (phone_hash) WHERE used = FALSE AND expires_at > NOW();

-- Tabla de sesiones para revocación de JWT (opcional; usada para logout).
CREATE TABLE IF NOT EXISTS sesiones (
  jti        TEXT        PRIMARY KEY,  -- JWT ID único
  usuario_id UUID        REFERENCES usuarios(id) ON DELETE CASCADE,
  revocado   BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario
  ON sesiones (usuario_id, revocado);

-- ── 2. PARTICIONAMIENTO DE puntos_eventos ─────────────────────────────────
-- Estrategia: RANGE mensual por created_at.
-- PK: (id, created_at) — requerido por PostgreSQL para tablas particionadas.
-- Tipo 'referido' añadido al CHECK constraint respecto a la versión original.

-- 2a. Preserve datos existentes.
ALTER TABLE puntos_eventos RENAME TO puntos_eventos_legacy;

-- Los índices y constraints originales se conservan en la tabla legacy.
-- Renombramos para evitar colisiones de nombre.
ALTER INDEX IF EXISTS idx_pe_usuario_ciclo  RENAME TO idx_pe_usuario_ciclo_legacy;
ALTER INDEX IF EXISTS idx_pe_ciclo_created  RENAME TO idx_pe_ciclo_created_legacy;

-- 2b. Nueva tabla particionada.
CREATE TABLE puntos_eventos (
  id         UUID        NOT NULL DEFAULT gen_random_uuid(),
  usuario_id UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ciclo_id   UUID        NOT NULL REFERENCES ciclos(id),
  tipo       TEXT        NOT NULL
               CHECK (tipo IN ('encuesta', 'ruta', 'reporte', 'referido')),
  puntos     SMALLINT    NOT NULL CHECK (puntos >= 0),
  metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 2c. Particiones mensuales 2026 (añadir años futuros con la función de abajo).
CREATE TABLE puntos_eventos_2026_01 PARTITION OF puntos_eventos FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE puntos_eventos_2026_02 PARTITION OF puntos_eventos FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE puntos_eventos_2026_03 PARTITION OF puntos_eventos FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE puntos_eventos_2026_04 PARTITION OF puntos_eventos FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE puntos_eventos_2026_05 PARTITION OF puntos_eventos FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE puntos_eventos_2026_06 PARTITION OF puntos_eventos FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE puntos_eventos_2026_07 PARTITION OF puntos_eventos FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE puntos_eventos_2026_08 PARTITION OF puntos_eventos FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE puntos_eventos_2026_09 PARTITION OF puntos_eventos FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE puntos_eventos_2026_10 PARTITION OF puntos_eventos FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE puntos_eventos_2026_11 PARTITION OF puntos_eventos FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE puntos_eventos_2026_12 PARTITION OF puntos_eventos FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Partición DEFAULT captura cualquier fecha fuera del rango definido.
CREATE TABLE puntos_eventos_overflow PARTITION OF puntos_eventos DEFAULT;

-- 2d. Índices en la tabla raíz (se propagan a cada partición automáticamente).
CREATE INDEX idx_pe_usuario_ciclo ON puntos_eventos (usuario_id, ciclo_id);
CREATE INDEX idx_pe_ciclo_created ON puntos_eventos (ciclo_id, created_at DESC);
CREATE INDEX idx_pe_tipo_ciclo    ON puntos_eventos (tipo, ciclo_id);

-- 2e. Migra datos del legado (una sola vez, en mantenimiento).
INSERT INTO puntos_eventos (id, usuario_id, ciclo_id, tipo, puntos, metadata, created_at)
SELECT id, usuario_id, ciclo_id,
  -- Normaliza tipo antiguo 'referido' si existe; mantiene los demás tal cual.
  CASE WHEN tipo = 'referido' THEN 'referido' ELSE tipo END,
  puntos, metadata, created_at
FROM puntos_eventos_legacy;

-- ── 3. FUNCIÓN: auto-crear partición del mes siguiente ───────────────────
-- Llamar desde el job ciclo-apertura o manualmente cada mes.
CREATE OR REPLACE FUNCTION crear_particion_mes(p_año INTEGER, p_mes INTEGER)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  inicio  DATE := make_date(p_año, p_mes, 1);
  fin     DATE := inicio + INTERVAL '1 month';
  nombre  TEXT := FORMAT('puntos_eventos_%s_%s', p_año, LPAD(p_mes::TEXT, 2, '0'));
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = nombre AND n.nspname = 'public'
  ) THEN
    EXECUTE FORMAT(
      'CREATE TABLE %I PARTITION OF puntos_eventos FOR VALUES FROM (%L) TO (%L)',
      nombre, inicio, fin
    );
    RETURN 'Partición creada: ' || nombre;
  END IF;
  RETURN 'Ya existe: ' || nombre;
END;
$$;

-- Ejemplo de uso: SELECT crear_particion_mes(2027, 1);
