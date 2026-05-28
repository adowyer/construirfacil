-- =============================================================================
-- ConstruirFácil — Backfill semántico de model_content
-- Migration: 0021_model_content_semantic_backfill.sql
-- =============================================================================
-- Depende de 0020 (columnas vibe/perfect_for/not_for/emotional_anchors/vs_alternatives).
--
-- Dos bloques, ambos idempotentes (UPDATE determinista, las 19 filas ya existen):
--
--   A. CEDRO (BOSQUE) — TEMPLATE completo de los 5 campos nuevos. Todo derivado
--      de su `body` real + specs. Sirve de molde para escalar a los otros 18.
--
--   B. 7 modelos con la capa semántica EXISTENTE incompleta (tagline /
--      lifestyle_tags / recommended_use / family_size NULL): ALECRÍN, AMBA'Y,
--      CAMBOATÁ, GUAYUBIRÁ, INGÁ, TIMBÓ (BOSQUE) + LANÍN (TERRA).
--      Todo grounded en el `body` de cada modelo — cero invención.
--
-- IMPORTANTE: las claves (style_name, linea) replican EXACTAMENTE los valores
-- actuales de model_content (con acentos; linea = 'BOSQUE'/'TERRA' sin prefijo).
-- Si la normalización de la mina #2 cambia `linea`, re-keyear este backfill.
-- NO toca el catálogo online (model_content.tagline/lifestyle_tags solo se
-- enriquecen donde estaban NULL; es mejora, no ruptura).
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- A. CEDRO — template de los 5 campos nuevos
-- ---------------------------------------------------------------------------
update public.model_content set
  vibe = 'Presencia imponente y cálida — la casa que se nota al entrar al barrio, sin gritar.',
  perfect_for = array[
    'Familia consolidada (3-6) que quiere una casa con identidad fuerte',
    'Quien valora la madera y el contraste arquitectónico por sobre la neutralidad',
    'Lote donde la fachada se ve y se quiere jerarquizar el acceso'
  ],
  not_for = array[
    'Quien busca bajo perfil o una caja blanca minimalista (ahí va ANCHICO)',
    'Quien quiere todo en una planta liviana y luminosa (ESCANDINAVIA / ANCHICO V1)'
  ],
  emotional_anchors = array[
    'la madera oscura que abraza el frente',
    'el marco negro que enmarca como una escultura',
    'voladizos que proyectan sombra y carácter'
  ],
  vs_alternatives = jsonb_build_object(
    'ANCHICO', 'Si querés luminosidad y minimalismo blanco en vez de presencia y madera oscura.',
    'INGÁ',    'Si preferís la honestidad del hormigón visto a la calidez dominante de la madera.'
  )
where style_name = 'CEDRO' and linea = 'BOSQUE';

-- ---------------------------------------------------------------------------
-- B. Backfill de la capa semántica existente (7 modelos incompletos)
-- ---------------------------------------------------------------------------

update public.model_content set
  tagline = 'Volúmenes puros y madera cálida: minimalismo con carácter',
  lifestyle_tags = array['moderno','minimalista','hormigón','madera','sofisticado'],
  recommended_use = 'primera_vivienda',
  family_size_min = 2, family_size_max = 5
where style_name = 'ALECRÍN' and linea = 'BOSQUE';

update public.model_content set
  tagline = 'Muro verde y madera: la naturaleza como protagonista',
  lifestyle_tags = array['moderno','naturaleza','verde','madera','minimalista'],
  recommended_use = 'primera_vivienda',
  family_size_min = 2, family_size_max = 5
where style_name = 'AMBA''Y' and linea = 'BOSQUE';

update public.model_content set
  tagline = 'Franjas horizontales y ventanales de esquina: liviandad y paisaje',
  lifestyle_tags = array['moderno','dinámico','madera','luminoso','escultórico'],
  recommended_use = 'primera_vivienda',
  family_size_min = 2, family_size_max = 5
where style_name = 'CAMBOATÁ' and linea = 'BOSQUE';

update public.model_content set
  tagline = 'Flexible y dúctil: se adapta a tu lote sin perder identidad',
  lifestyle_tags = array['moderno','flexible','madera','adaptable','sofisticado'],
  recommended_use = 'primera_vivienda',
  family_size_min = 2, family_size_max = 5
where style_name = 'GUAYUBIRÁ' and linea = 'BOSQUE';

update public.model_content set
  tagline = 'Hormigón visto y madera vertical: honestidad material',
  lifestyle_tags = array['moderno','hormigón','madera','honesto','distintivo'],
  recommended_use = 'primera_vivienda',
  family_size_min = 2, family_size_max = 5
where style_name = 'INGÁ' and linea = 'BOSQUE';

update public.model_content set
  tagline = 'Fachada oscura y raja vertical: presencia teatral',
  lifestyle_tags = array['moderno','audaz','oscuro','teatral','sofisticado'],
  recommended_use = 'primera_vivienda',
  family_size_min = 2, family_size_max = 5
where style_name = 'TIMBÓ' and linea = 'BOSQUE';

update public.model_content set
  tagline = 'Blanco mediterráneo: luz, paz y sofisticación atemporal',
  lifestyle_tags = array['mediterráneo','blanco','luminoso','sereno','atemporal'],
  recommended_use = 'primera_vivienda',
  family_size_min = 2, family_size_max = 4
where style_name = 'LANÍN' and linea = 'TERRA';

commit;

-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- -- Cobertura semántica (debería dar 0 filas con huecos tras escalar):
-- select style_name, linea,
--        (tagline is null) nul_tag, (lifestyle_tags is null) nul_tags,
--        (vibe is null) nul_vibe, (vs_alternatives is null) nul_vs
--   from public.model_content order by linea, style_name;
-- =============================================================================
