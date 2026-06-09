-- ============================================================
--  CIUDATA — Datos semilla para desarrollo y demo
--  Ejecutar DESPUÉS de schema.sql desde el SQL Editor de Supabase.
--  Incluye domos reales de Tacna, Perú y un ciclo piloto.
-- ============================================================

-- ── Sponsor piloto ────────────────────────────────────────────────────────
INSERT INTO public.sponsors (id, nombre, api_key, activo) VALUES
  ('11111111-0000-0000-0000-000000000001',
   'Pizzería Del Pilar Tacna',
   'dev_sponsor_key_pizzeria_del_pilar_2026',
   TRUE)
ON CONFLICT (id) DO NOTHING;

-- ── Ciclo piloto: junio 2026 ─────────────────────────────────────────────
INSERT INTO public.ciclos (id, mes, anio, estado, sponsor_id_fk, sponsor_nombre) VALUES
  ('22222222-0000-0000-0000-000000000001',
   6, 2026, 'active',
   '11111111-0000-0000-0000-000000000001',
   'Pizzería Del Pilar Tacna')
ON CONFLICT (mes, anio) DO NOTHING;

-- ── Domos IoT en la ciudad de Tacna, Perú ────────────────────────────────
-- Coordenadas verificadas para puntos representativos de Tacna.
INSERT INTO public.domos (id, nombre, lat, lng, activo) VALUES
  ('33333333-0000-0000-0000-000000000001',
   'Domo UPT — Campus Principal',
   -18.0127, -70.2547, TRUE),

  ('33333333-0000-0000-0000-000000000002',
   'Domo Plaza de Armas de Tacna',
   -18.0124, -70.2542, TRUE),

  ('33333333-0000-0000-0000-000000000003',
   'Domo Av. Bolognesi / Mercado Central',
   -18.0148, -70.2509, TRUE),

  ('33333333-0000-0000-0000-000000000004',
   'Domo Terminal Terrestre Tacna',
   -18.0082, -70.2442, TRUE),

  ('33333333-0000-0000-0000-000000000005',
   'Domo Av. Industrial / Zona Franca ZOFRATACNA',
   -17.9978, -70.2390, TRUE),

  ('33333333-0000-0000-0000-000000000006',
   'Domo Ovalo Cuzco',
   -18.0021, -70.2523, TRUE)

ON CONFLICT (id) DO NOTHING;

-- ── Lecturas demo (PM2.5 normal y con anomalía) ───────────────────────────
-- Anomalía en domo UPT hace 10 minutos (para probar validación de reportes).
INSERT INTO public.lecturas_domos (domo_id, pm25, anomalia, leida_at) VALUES
  ('33333333-0000-0000-0000-000000000001', 31.4, TRUE,  NOW() - INTERVAL '10 minutes'),
  ('33333333-0000-0000-0000-000000000001', 18.2, FALSE, NOW() - INTERVAL '40 minutes'),
  ('33333333-0000-0000-0000-000000000002', 12.8, FALSE, NOW() - INTERVAL '8 minutes'),
  ('33333333-0000-0000-0000-000000000003', 22.5, FALSE, NOW() - INTERVAL '12 minutes'),
  ('33333333-0000-0000-0000-000000000004', 27.1, TRUE,  NOW() - INTERVAL '5 minutes'),
  ('33333333-0000-0000-0000-000000000005', 38.9, TRUE,  NOW() - INTERVAL '15 minutes'),
  ('33333333-0000-0000-0000-000000000006', 14.3, FALSE, NOW() - INTERVAL '20 minutes');

-- ── Encuesta semana 1 del ciclo piloto ────────────────────────────────────
INSERT INTO public.encuestas (ciclo_id, semana, preguntas, activa, inicio, fin) VALUES
(
  '22222222-0000-0000-0000-000000000001',
  1,
  '[
    {"id":"q1_1","texto":"¿Cómo calificarías la calidad del aire en tu ruta habitual hoy?",
     "opciones":["Muy mala","Mala","Regular","Buena","Excelente"]},
    {"id":"q1_2","texto":"¿Usaste transporte público esta semana?",
     "opciones":["Nunca","1-2 veces","3-4 veces","5 o más veces"]},
    {"id":"q1_3","texto":"¿Observaste congestión vehicular inusual?",
     "opciones":["Sí, mucha","Sí, moderada","Poca","No"]},
    {"id":"q1_4","texto":"¿Recomendarías CIUDATA a un vecino?",
     "opciones":["Definitivamente sí","Probablemente sí","No sé","No"]}
  ]'::jsonb,
  TRUE,
  NOW(),
  NOW() + INTERVAL '7 days'
)
ON CONFLICT (ciclo_id, semana) DO NOTHING;
