-- ============================================================
--  CIUDATA — Schema Supabase (PostgreSQL 15+)
--  Ejecutar completo desde: Supabase → SQL Editor → Run
--
--  Notas:
--  • puntos_eventos NO está particionada aquí para preservar
--    Realtime y el UI de Supabase. Particionamiento disponible
--    vía migrations/004_auth_partitioning.sql para producción.
--  • El backend (ciudata-api) conecta con SERVICE_ROLE key,
--    que bypasea RLS. Las políticas protegen acceso directo
--    anónimo desde el cliente.
-- ============================================================

-- ── EXTENSIONES ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── TABLA: usuarios ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usuarios (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash  TEXT        UNIQUE NOT NULL,
  fcm_token   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.usuarios IS 'Usuarios ciudadanos de la app CIUDATA';

-- ── TABLA: sponsors ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sponsors (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT    NOT NULL,
  api_key     TEXT    UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  activo      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── TABLA: ciclos ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ciclos (
  id              UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  mes             SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio            SMALLINT NOT NULL CHECK (anio >= 2024),
  estado          TEXT     NOT NULL DEFAULT 'active'
                    CHECK (estado IN ('active', 'closed', 'rewarded')),
  sponsor_id_fk   UUID     REFERENCES public.sponsors(id),
  sponsor_nombre  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mes, anio)
);

-- ── TABLA: puntos_eventos ────────────────────────────────────────────────
-- Incluye 'referido' y puntos >= 0 (rutas inician con 0 y se actualizan al confirmar).
CREATE TABLE IF NOT EXISTS public.puntos_eventos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  ciclo_id    UUID        NOT NULL REFERENCES public.ciclos(id),
  tipo        TEXT        NOT NULL
                CHECK (tipo IN ('encuesta', 'ruta', 'reporte', 'referido')),
  puntos      SMALLINT    NOT NULL CHECK (puntos >= 0),
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pe_usuario_ciclo
  ON public.puntos_eventos (usuario_id, ciclo_id);
CREATE INDEX IF NOT EXISTS idx_pe_ciclo_created
  ON public.puntos_eventos (ciclo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pe_tipo_ciclo
  ON public.puntos_eventos (tipo, ciclo_id);

-- ── TABLA: encuestas ─────────────────────────────────────────────────────
-- Bloques semanales de 4 preguntas: preguntas = [{id, texto, opciones[]}]
CREATE TABLE IF NOT EXISTS public.encuestas (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id    UUID     NOT NULL REFERENCES public.ciclos(id),
  semana      SMALLINT NOT NULL CHECK (semana BETWEEN 1 AND 5),
  preguntas   JSONB    NOT NULL DEFAULT '[]',
  activa      BOOLEAN  NOT NULL DEFAULT FALSE,
  inicio      TIMESTAMPTZ,
  fin         TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ciclo_id, semana)
);

CREATE INDEX IF NOT EXISTS idx_encuestas_ciclo_activa
  ON public.encuestas (ciclo_id, activa);

-- ── TABLA: ranking_mensual ────────────────────────────────────────────────
-- Se puebla al cierre del ciclo; no se recalcula en tiempo real.
CREATE TABLE IF NOT EXISTS public.ranking_mensual (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id     UUID    NOT NULL REFERENCES public.ciclos(id),
  usuario_id   UUID    NOT NULL REFERENCES public.usuarios(id),
  posicion     INTEGER NOT NULL,
  total_puntos INTEGER NOT NULL,
  generado_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ciclo_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_rm_ciclo_posicion
  ON public.ranking_mensual (ciclo_id, posicion ASC);

-- ── TABLA: codigos_qr ────────────────────────────────────────────────────
-- 100 = producto gratis · 50 = 50% descuento · 30 = 30% descuento
CREATE TABLE IF NOT EXISTS public.codigos_qr (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  token           TEXT    UNIQUE NOT NULL,
  usuario_id      UUID    REFERENCES public.usuarios(id),
  ciclo_id        UUID    REFERENCES public.ciclos(id),
  tipo_descuento  TEXT    NOT NULL CHECK (tipo_descuento IN ('100', '50', '30')),
  canjeado        BOOLEAN NOT NULL DEFAULT FALSE,
  canjeado_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_token
  ON public.codigos_qr (token);

-- ── TABLA: domos ──────────────────────────────────────────────────────────
-- Estaciones fijas de monitoreo IoT de calidad del aire.
CREATE TABLE IF NOT EXISTS public.domos (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT    NOT NULL,
  lat         FLOAT8  NOT NULL,
  lng         FLOAT8  NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── TABLA: lecturas_domos ─────────────────────────────────────────────────
-- Serie temporal de lecturas de PM2.5 con flag de anomalía (> 25 μg/m³ ECA-Aire).
CREATE TABLE IF NOT EXISTS public.lecturas_domos (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  domo_id   UUID    NOT NULL REFERENCES public.domos(id),
  pm25      FLOAT8,
  anomalia  BOOLEAN NOT NULL DEFAULT FALSE,
  leida_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lecturas_domo_time
  ON public.lecturas_domos (domo_id, leida_at DESC);
CREATE INDEX IF NOT EXISTS idx_lecturas_anomalia_time
  ON public.lecturas_domos (leida_at DESC) WHERE anomalia = TRUE;

-- ── TABLA: referidos ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referidos (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id    UUID    NOT NULL REFERENCES public.usuarios(id),
  referred_id    UUID    UNIQUE NOT NULL REFERENCES public.usuarios(id),
  ciclo_id       UUID    NOT NULL REFERENCES public.ciclos(id),
  acreditado     BOOLEAN NOT NULL DEFAULT FALSE,
  acreditado_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referidos_referred
  ON public.referidos (referred_id, acreditado);

-- ── TABLA: otp_tokens ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.otp_tokens (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash  TEXT     NOT NULL,
  otp_hash    TEXT     NOT NULL,
  intentos    SMALLINT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
  used        BOOLEAN  NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un solo OTP activo por número: índice parcial único.
CREATE UNIQUE INDEX IF NOT EXISTS idx_otp_phone_active
  ON public.otp_tokens (phone_hash)
  WHERE used = FALSE;

-- ── TABLA: sesiones ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sesiones (
  jti         TEXT    PRIMARY KEY,
  usuario_id  UUID    REFERENCES public.usuarios(id) ON DELETE CASCADE,
  revocado    BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario
  ON public.sesiones (usuario_id, revocado);

-- ── TABLA: notificaciones_log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notificaciones_log (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID  REFERENCES public.usuarios(id),
  ciclo_id    UUID  REFERENCES public.ciclos(id),
  tipo        TEXT  NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  enviado_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── VISTA: ranking_provisional ────────────────────────────────────────────
-- Usada por el job nocturno para poblar la caché Redis (TTL 1 h).
CREATE OR REPLACE VIEW public.vw_ranking_provisional AS
SELECT
  pe.ciclo_id,
  pe.usuario_id,
  SUM(pe.puntos)                                   AS total_puntos,
  RANK() OVER (
    PARTITION BY pe.ciclo_id
    ORDER BY SUM(pe.puntos) DESC
  )                                                AS posicion
FROM public.puntos_eventos pe
WHERE pe.puntos > 0
GROUP BY pe.ciclo_id, pe.usuario_id;

-- ── FUNCIÓN: auto-crear partición mensual (para escalar a producción) ────
CREATE OR REPLACE FUNCTION public.crear_particion_mes(p_anio INTEGER, p_mes INTEGER)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  inicio DATE := make_date(p_anio, p_mes, 1);
  fin    DATE := inicio + INTERVAL '1 month';
  nombre TEXT := FORMAT('puntos_eventos_%s_%s', p_anio, LPAD(p_mes::TEXT, 2, '0'));
BEGIN
  RETURN 'Nota: particionamiento solo disponible fuera de Supabase managed. Ver migration 004.';
END;
$$;

-- ============================================================
--  ROW LEVEL SECURITY
--  El backend conecta con SERVICE_ROLE (bypasea RLS).
--  Las políticas bloquean acceso directo anónimo a datos sensibles.
-- ============================================================

ALTER TABLE public.usuarios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ciclos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puntos_eventos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encuestas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_mensual   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codigos_qr        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecturas_domos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referidos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones_log ENABLE ROW LEVEL SECURITY;

-- ── Ciclos: lectura pública (muestra el ciclo activo en la app) ──────────
CREATE POLICY "ciclos_select_public"
  ON public.ciclos FOR SELECT USING (true);

-- ── Encuestas: lectura pública (la app obtiene la encuesta activa) ───────
CREATE POLICY "encuestas_select_public"
  ON public.encuestas FOR SELECT USING (activa = TRUE);

-- ── Ranking mensual: lectura pública (pantalla de ranking en la app) ─────
CREATE POLICY "ranking_select_public"
  ON public.ranking_mensual FOR SELECT USING (true);

-- ── Domos: lectura pública (mapa de calidad del aire) ────────────────────
CREATE POLICY "domos_select_public"
  ON public.domos FOR SELECT USING (activo = TRUE);

CREATE POLICY "lecturas_select_public"
  ON public.lecturas_domos FOR SELECT USING (true);

-- ── Resto de tablas: solo service_role (todo acceso va por la API) ───────
-- usuarios
CREATE POLICY "usuarios_service_role"
  ON public.usuarios
  USING (auth.role() = 'service_role');

-- sponsors
CREATE POLICY "sponsors_service_role"
  ON public.sponsors
  USING (auth.role() = 'service_role');

-- puntos_eventos
CREATE POLICY "pe_service_role"
  ON public.puntos_eventos
  USING (auth.role() = 'service_role');

-- codigos_qr
CREATE POLICY "qr_service_role"
  ON public.codigos_qr
  USING (auth.role() = 'service_role');

-- referidos
CREATE POLICY "referidos_service_role"
  ON public.referidos
  USING (auth.role() = 'service_role');

-- otp_tokens
CREATE POLICY "otp_service_role"
  ON public.otp_tokens
  USING (auth.role() = 'service_role');

-- sesiones
CREATE POLICY "sesiones_service_role"
  ON public.sesiones
  USING (auth.role() = 'service_role');

-- notificaciones_log
CREATE POLICY "notif_service_role"
  ON public.notificaciones_log
  USING (auth.role() = 'service_role');

-- ============================================================
--  REALTIME
--  Activa suscripciones en tiempo real para el panel web.
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.lecturas_domos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ranking_mensual;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ciclos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.puntos_eventos;
