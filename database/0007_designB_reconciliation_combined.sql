-- ============================================================================
-- Wemart — 0007 DESIGN B NAME RECONCILIATION — COMBINED (READ-ONLY)
-- database/0007_designB_reconciliation_combined.sql
--
-- Companion to 0007_designB_name_reconciliation.sql (kept as the original).
-- Runs R1–R7 in ONE statement: CTEs + PostgreSQL JSON aggregation, ONE
-- JSON object with seven named sections, every matching record included.
--
-- *** NO-CHANGE: the statement contains ONLY a SELECT (WITH/CTE + jsonb).
-- no INSERT, UPDATE, DELETE, ALTER, DROP, TRUNCATE, or permission/POLICY
-- statements anywhere. Run by the owner in the Supabase SQL Editor; paste
-- the single JSON cell back for the reconciliation review.
--
-- Sections (identical logic to the original file; fixed alias R5 s.name):
--   R1 — live campus inventory (campus_id, campus_name, state_name)
--   R2 — exact matches (proposed pair found verbatim: state AND name)
--   R3 — unmatched live campuses (would remain unassociated by 0003)
--   R4 — proposed links with no state-qualified live campus (no-op guards)
--   R5 — ambiguous: campus NAME matches a proposal but the STATE differs
--        (parent-state-NULL rows surface in R3 instead — unchanged logic)
--   R6 — duplicate live campus names (same normalized name, multiple rows)
--   R7 — near-miss containment hints (spacing/casing/wording variants)
--
-- Sections with zero results come back as [] via COALESCE, never null.
-- Expected good run: R2 = 89 entries, R4 = [], R5 = [], R6 = [].
-- ============================================================================

WITH proposed(state_name, campus_name) AS (
  VALUES
('Abia', 'Abia State University (ABSU), Uturu'),
('Abia', 'Michael Okpara University of Agriculture (MOUAU), Umudike'),
('Adamawa', 'Adamawa State University (ADSU), Mubi'),
('Adamawa', 'Modibbo Adama University (MAU), Yola'),
('Bauchi', 'Abubakar Tafawa Balewa University (ATBU), Bauchi'),
('Bauchi', 'Federal University of Health Sciences, Azare (FUHSA)'),
('Bauchi', 'Bauchi State University (BASUG), Gadau'),
('Akwa Ibom', 'University of Uyo (UNIUYO), Uyo'),
('Akwa Ibom', 'Akwa Ibom State University (AKSU), Mkpat Enin'),
('Anambra', 'Nnamdi Azikiwe University (UNIZIK), Awka'),
('Anambra', 'Chukwuemeka Odumegwu Ojukwu University (COOU), Igbariam'),
('Bayelsa', 'Federal University Otuoke (FUO)'),
('Bayelsa', 'Niger Delta University (NDU)'),
('Benue', 'Benue State University (BSU), Makurdi'),
('Benue', 'Joseph Sarwuan Tarka University (JOSTUM), Makurdi'),
('Benue', 'Federal University of Health Sciences, Otukpo (FUHSO)'),
('Borno', 'University of Maiduguri (UNIMAID), Maiduguri'),
('Borno', 'Borno State University (BOSU), Maiduguri'),
('Borno', 'Nigerian Army University (NAUB), Biu'),
('Cross River', 'University of Calabar (UNICAL), Calabar'),
('Cross River', 'University of Cross River State (UNICROSS), Calabar'),
('Delta', 'Federal University of Petroleum Resources (FUPRE), Effurun'),
('Delta', 'Delta State University (DELSU), Abraka'),
('Delta', 'University of Delta (UNIDEL), Agbor'),
('Delta', 'Dennis Osadebe University (DOU), Asaba'),
('Ebonyi', 'Alex Ekwueme Federal University, Ndufu-Alike (FUNAI)'),
('Ebonyi', 'Ebonyi State University (EBSU), Abakaliki'),
('Edo', 'University of Benin (UNIBEN), Benin City'),
('Edo', 'Ambrose Alli University (AAU), Ekpoma'),
('Edo', 'Edo State University (EDSU), Uzairue'),
('Ekiti', 'Ekiti State University (EKSU), Ado-Ekiti'),
('Ekiti', 'Federal University Oye-Ekiti (FUOYE), Oye Ekiti'),
('Enugu', 'University of Nigeria (UNN), Nsukka'),
('Enugu', 'University of Nigeria (UNN), Enugu Campus'),
('Enugu', 'Enugu State University of Science and Technology (ESUT), Agbani'),
('Abuja (FCT)', 'University of Abuja (UNIABUJA), Gwagwalada'),
('Abuja (FCT)', 'National Open University of Nigeria (NOUN), Abuja'),
('Gombe', 'Federal University, Kashere (FUKAShere)'),
('Gombe', 'Gombe State University (GSU), Gombe'),
('Imo', 'Federal University of Technology (FUTO), Owerri'),
('Imo', 'Imo State University (IMSU), Owerri'),
('Jigawa', 'Federal University, Dutse (FUD)'),
('Jigawa', 'Sule Lamido University (SLU), Kafin Hausa'),
('Kano', 'Bayero University, Kano (BUK), Gwarzo Road'),
('Kano', 'Aliko Dangote University of Science and Technology (ADUST), Wudil'),
('Kano', 'Yusuf Maitama Sule University (YUMSU), Kano'),
('Kaduna', 'Ahmadu Bello University (ABU), Zaria'),
('Kaduna', 'Air Force Institute of Technology (AFIT)'),
('Kaduna', 'Kaduna State University (KASU)'),
('Katsina', 'Umaru Musa Yar''adua University (UMYU), Katsina'),
('Katsina', 'Federal University, Dutsin-Ma (FUDMA)'),
('Kebbi', 'Federal University, Birnin Kebbi (FUBK)'),
('Kebbi', 'Kebbi State University of Science and Technology (KSUSTA), Aliero'),
('Kogi', 'Prince Abubakar Audu University (PAAU), Anyigba'),
('Kogi', 'Federal University, Lokoja (FULOKOJA)'),
('Kwara', 'University of Ilorin (UNILORIN), Ilorin'),
('Kwara', 'Kwara State University (KWASU), Malete'),
('Lagos', 'University of Lagos (UNILAG), Akoka'),
('Lagos', 'University of Lagos (UNILAG), Idi-Araba (CMUL)'),
('Lagos', 'Lagos State University (LASU), Ojo'),
('Lagos', 'Lagos State University of Science and Technology (LASUSTECH), Ikorodu'),
('Lagos', 'Lagos State University of Education (LASUED), Epe'),
('Nasarawa', 'Federal University, Lafia (FULafia)'),
('Nasarawa', 'Nasarawa State University (NSUK), Keffi'),
('Niger', 'Federal University of Technology (FUT), Minna'),
('Niger', 'Ibrahim Badamasi Babangida University (IBBU), Lapai'),
('Ogun', 'Federal University of Agriculture (FUNAAB), Alabata'),
('Ogun', 'Olabisi Onabanjo University (OOU), Ago-Iwoye'),
('Ogun', 'Tai Solarin University of Education (TASUED), Ijagun'),
('Ondo', 'Federal University of Technology (FUTA), Akure'),
('Ondo', 'Adekunle Ajasin University (AAUA), Akungba-Akoko'),
('Ondo', 'University of Medical Sciences (UNIMED), Ondo'),
('Osun', 'Obafemi Awolowo University (OAU), Ile-Ife'),
('Osun', 'Osun State University (UNIOSUN), Osogbo'),
('Oyo', 'University of Ibadan (UI), Ibadan'),
('Oyo', 'Ladoke Akintola University of Technology (LAUTECH), Ogbomoso'),
('Oyo', 'First Technical University (TECH-U), Ibadan'),
('Plateau', 'University of Jos (UNIJOS), Jos'),
('Plateau', 'Plateau State University (PLASU), Bokkos'),
('Rivers', 'University of Port Harcourt (UNIPORT), Choba'),
('Rivers', 'Rivers State University (RSU), Port Harcourt'),
('Sokoto', 'Usmanu Danfodiyo University (UDUSOK), Sokoto'),
('Sokoto', 'Sokoto State University (SSU), Sokoto'),
('Taraba', 'Taraba State University (TSU), Jalingo'),
('Taraba', 'Federal University, Wukari (FUWUKARI)'),
('Yobe', 'Federal University, Gashua (FUGASHUA)'),
('Yobe', 'Yobe State University (YSU), Damaturu'),
('Zamfara', 'Federal University, Gusau (FUGUS)'),
('Zamfara', 'Zamfara State University (ZAMSU), Talata Mafara')
),
live AS (
  SELECT c.id AS campus_id, c.name AS campus_name,
         s.name AS state_name,
         lower(btrim(c.name)) AS n_name
  FROM public.locations c
  LEFT JOIN public.locations s ON s.id = c.parent_location_id
  WHERE c.location_type = 'campus'
),
r1 AS (
  SELECT jsonb_agg(jsonb_build_object(
           'campus_id', campus_id,
           'campus_name', campus_name,
           'state_name', state_name)
         ORDER BY state_name, campus_name) AS data
  FROM live
),
r2 AS (
  SELECT jsonb_agg(jsonb_build_object(
           'state_name', p.state_name,
           'campus_name', p.campus_name,
           'campus_id', c.campus_id)
         ORDER BY p.state_name, p.campus_name) AS data
  FROM proposed p
  JOIN live c
    ON c.campus_name = p.campus_name AND c.state_name = p.state_name
),
r3 AS (
  SELECT jsonb_agg(jsonb_build_object(
           'campus_name', c.campus_name,
           'state_name', c.state_name)
         ORDER BY c.state_name, c.campus_name) AS data
  FROM live c
  LEFT JOIN proposed p
    ON p.campus_name = c.campus_name AND p.state_name = c.state_name
  WHERE p.campus_name IS NULL
),
r4 AS (
  SELECT jsonb_agg(jsonb_build_object(
           'state_name', p.state_name,
           'campus_name', p.campus_name)
         ORDER BY p.state_name, p.campus_name) AS data
  FROM proposed p
  LEFT JOIN live c
    ON c.campus_name = p.campus_name AND c.state_name = p.state_name
  WHERE c.campus_id IS NULL
),
r5 AS (
  SELECT jsonb_agg(jsonb_build_object(
           'campus_name', p.campus_name,
           'live_state', c.state_name,
           'proposed_state', p.state_name)
         ORDER BY p.campus_name) AS data
  FROM proposed p
  JOIN live c
    ON c.campus_name = p.campus_name
  WHERE c.state_name <> p.state_name
),
r6 AS (
  SELECT jsonb_agg(jsonb_build_object(
           'normalized_name', d.n_name,
           'copies', d.copies,
           'states', d.states)
         ORDER BY d.n_name) AS data
  FROM (
    SELECT n_name, count(*) AS copies,
           string_agg(state_name, ', ' ORDER BY state_name) AS states
    FROM live
    GROUP BY n_name
    HAVING count(*) > 1
  ) d
),
r7 AS (
  SELECT jsonb_agg(jsonb_build_object(
           'live_name', c.campus_name,
           'live_state', c.state_name,
           'proposed_pair_name', p.campus_name)
         ORDER BY p.campus_name) AS data
  FROM live c
  JOIN proposed p
    ON p.campus_name NOT ILIKE c.campus_name
   AND c.campus_name NOT ILIKE p.campus_name
   AND (position(lower(btrim(c.campus_name)) IN lower(p.campus_name)) > 0
    OR position(lower(btrim(p.campus_name)) IN lower(c.campus_name)) > 0)
)
SELECT jsonb_build_object(
  'R1', COALESCE((SELECT data FROM r1), '[]'::jsonb),
  'R2', COALESCE((SELECT data FROM r2), '[]'::jsonb),
  'R3', COALESCE((SELECT data FROM r3), '[]'::jsonb),
  'R4', COALESCE((SELECT data FROM r4), '[]'::jsonb),
  'R5', COALESCE((SELECT data FROM r5), '[]'::jsonb),
  'R6', COALESCE((SELECT data FROM r6), '[]'::jsonb),
  'R7', COALESCE((SELECT data FROM r7), '[]'::jsonb)
) AS reconciliation;
