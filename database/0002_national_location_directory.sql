-- ============================================================================
-- Wemart — National location directory (PHASE 1: review-ready seed)
-- database/0002_national_location_directory.sql
-- ============================================================================
--
-- SCOPE (see the review report in AGENTS.md):
--   Adds (1) all 36 Nigerian states + the Federal Capital Territory and
--   (2) one main-campus row for every federal/state-owned university
--   covered, plus clearly official secondary campuses. Universities WITHOUT
--   vendors or products appear too — the directory must not depend on
--   vendors existing first.
--
--   The university→campus three-tier hierarchy (state → university → campus)
--   is a SEPARATE, gating migration: database/0003_university_tier_DRAFT.sql.
--   DO NOT run that draft before Part 0 here has been evaluated.
--
-- WHY THIS IS SAFE TO RUN:
--   * Uses ONLY the two location_type values already present and working
--     ('state' and 'campus'), so no CHECK constraint is touched in Phase 1.
--   * Campuses parent DIRECTLY to their state, exactly like the existing
--     live rows (e.g. 'Kaduna State University (KASU)' → 'Kaduna'), so the
--     campus_directory view and the catalog view keep their current single
--     hop semantics.
--   * Fully idempotent: every INSERT is guarded by NOT EXISTS on
--     (name, location_type). Safe to run more than once.
--   * No UPDATEs, no DELETEs, no RLS changes, no new policies, no column
--     changes. A commented, OPTIONAL test-row cleanup is the only tweak.
--   * Run with the project owner role (Supabase SQL editor), NOT the anon
--     key — the anon write path is (and must stay) closed by RLS.
--
-- DATASET BASIS (AGENTS rule: never invent institutions):
--   Federal/state universities from the NUC-held list of Nigerian
--   universities (private universities are deliberately out of scope).
--   Naming follows the existing live convention "<Name> (ABBR), <City>".
--   Rows/campus facts marked `-- REVIEW` are the ones to verify against
--   the official NUC gazette / institution site before treating as final:
--   mainly recent renames and secondary campuses.
--
-- IDENTITY NOTES for existing rows this seed intentionally does NOT
-- duplicate (they already exist in the live project):
--   'Ahmadu Bello University (ABU), Zaria' / 'Air Force Institute of
--   Technology (AFIT)' / 'Kaduna State University (KASU)' (Kaduna) and
--   'Federal University Otuoke (FUO)' / 'Niger Delta University (NDU)'
--   (Bayelsa). 'Kaduna State Polytechnic (KadPoly)' is kept as-is (a
--   polytechnic, not a university, but already a working campus row).
--
-- ============================================================================

-- ============================================================================
-- PART 0 — RUN FIRST (read-only inspection, run separately and keep output)
-- ============================================================================
-- These confirm the two facts this migration plan depends on:
--   0a  the current location_type CHECK constraint (must it allow the
--       'university' type before the Phase 2 draft?), and
--   0b  the exact campus_directory + catalog view definitions (the Phase 2
--       draft must not break how they resolve a campus's state).
--
-- 0a — check constraints touching location_type:
--   SELECT conname, pg_get_constraintdef(oid) AS definition
--   FROM pg_constraint
--   WHERE conrelid = 'public.locations'::regclass AND contype = 'c';
--
-- 0b — view definitions:
--   SELECT pg_get_viewdef('public.campus_directory'::regclass, true);
--   SELECT pg_get_viewdef('public.catalog'::regclass, true);
--
-- 0c — vendor → location relationship (Phase 2 safety check):
--   SELECT table_name, column_name
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'vendor_locations';
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'public.vendor_locations'::regclass;
--
-- 0d — pre-existing duplicates sanity check (expect: none besides [TEST]):
--   SELECT name, location_type, count(*) FROM public.locations
--   GROUP BY 1, 2 HAVING count(*) > 1;
--
-- ============================================================================

-- ============================================================================
-- PART 1 — SEED (transactional so partial failures roll back)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1a. States — all 36 states + the FCT, as 'state' rows (FCT is modelled as a
--     state-level unit because a separate 'fct' type is not in the live set).
--     Existing 'Bayelsa' and 'Kaduna' rows are skipped by the guard.
--     Names are plain per the existing convention ('Bayelsa', 'Kaduna').
-- ----------------------------------------------------------------------------
INSERT INTO public.locations (name, location_type, parent_location_id)
SELECT v.name, 'state', NULL
FROM (VALUES
  ('Abia'), ('Adamawa'), ('Akwa Ibom'), ('Anambra'), ('Bauchi'), ('Bayelsa'),
  ('Benue'), ('Borno'), ('Cross River'), ('Delta'), ('Ebonyi'), ('Edo'),
  ('Ekiti'), ('Enugu'), ('Abuja (FCT)'), ('Gombe'), ('Imo'), ('Jigawa'),
  ('Kaduna'), ('Kano'), ('Katsina'), ('Kebbi'), ('Kogi'), ('Kwara'),
  ('Lagos'), ('Nasarawa'), ('Niger'), ('Ogun'), ('Ondo'), ('Osun'), ('Oyo'),
  ('Plateau'), ('Rivers'), ('Sokoto'), ('Taraba'), ('Yobe'), ('Zamfara')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.locations l
  WHERE l.location_type = 'state' AND l.name = v.name
);

-- ----------------------------------------------------------------------------
-- 1b. University main campuses (federal/state universities only, no
--     private universities). Each line: (state_name, campus_name).
--     Parent = the state row from 1a — SAME relationship shape as the live
--     rows, so no view or catalog change is needed.
--     `-- REVIEW` = verify against the NUC gazette / institution site.
-- ----------------------------------------------------------------------------
INSERT INTO public.locations (name, location_type, parent_location_id)
SELECT v.campus_name, 'campus', s.id
FROM (VALUES
  -- Abia
  ('Abia', 'Abia State University (ABSU), Uturu'),
  ('Abia', 'Michael Okpara University of Agriculture (MOUAU), Umudike'),
  -- Adamawa
  ('Adamawa', 'Adamawa State University (ADSU), Mubi'),
  ('Adamawa', 'Modibbo Adama University (MAU), Yola'), -- formerly MAUTECH; REVIEW rename
  ('Bauchi', 'Abubakar Tafawa Balewa University (ATBU), Bauchi'),
  ('Bauchi', 'Federal University of Health Sciences, Azare (FUHSA)'),
  ('Bauchi', 'Bauchi State University (BASUG), Gadau'), -- REVIEW: also Bauchi city campus
  -- ('Bauchi', 'Bauchi State University (BASUG), Bauchi Town Campus'), -- REVIEW before adding as a separate campus
  -- Akwa Ibom
  ('Akwa Ibom', 'University of Uyo (UNIUYO), Uyo'),
  ('Akwa Ibom', 'Akwa Ibom State University (AKSU), Mkpat Enin'), -- REVIEW: Obio Akpa campus
  -- Anambra
  ('Anambra', 'Nnamdi Azikiwe University (UNIZIK), Awka'), -- REVIEW: Agulu + Nnewi college campuses are official
  ('Anambra', 'Chukwuemeka Odumegwu Ojukwu University (COOU), Igbariam'), -- REVIEW: Uli campus official
  -- Bayelsa (already present, guards skip: FUO + NDU)
  ('Bayelsa', 'Federal University Otuoke (FUO)'),
  ('Bayelsa', 'Niger Delta University (NDU)'),
  -- Benue
  ('Benue', 'Benue State University (BSU), Makurdi'),
  ('Benue', 'Joseph Sarwuan Tarka University (JOSTUM), Makurdi'), -- formerly Federal University of Agriculture, Makurdi; REVIEW rename
  ('Benue', 'Federal University of Health Sciences, Otukpo (FUHSO)'), -- REVIEW: still phasing in
  -- Borno
  ('Borno', 'University of Maiduguri (UNIMAID), Maiduguri'),
  ('Borno', 'Borno State University (BOSU), Maiduguri'),
  ('Borno', 'Nigerian Army University (NAUB), Biu'), -- federal (Army-owned); REVIEW scope with NUC list
  -- Cross River
  ('Cross River', 'University of Calabar (UNICAL), Calabar'),
  ('Cross River', 'University of Cross River State (UNICROSS), Calabar'), -- formerly CRUTECH; REVIEW rename
  -- Delta
  ('Delta', 'Federal University of Petroleum Resources (FUPRE), Effurun'),
  ('Delta', 'Delta State University (DELSU), Abraka'), -- REVIEW: Oleh + Anwai campuses official
  ('Delta', 'University of Delta (UNIDEL), Agbor'), -- REVIEW: recently federalised
  ('Delta', 'Dennis Osadebe University (DOU), Asaba'), -- REVIEW: newest state university
  -- Ebonyi
  ('Ebonyi', 'Alex Ekwueme Federal University, Ndufu-Alike (FUNAI)'),
  ('Ebonyi', 'Ebonyi State University (EBSU), Abakaliki'),
  -- Edo
  ('Edo', 'University of Benin (UNIBEN), Benin City'), -- REVIEW: Ekenwan campus official
  ('Edo', 'Ambrose Alli University (AAU), Ekpoma'),
  ('Edo', 'Edo State University (EDSU), Uzairue'), -- REVIEW: formerly Iyamho
  -- Ekiti
  ('Ekiti', 'Ekiti State University (EKSU), Ado-Ekiti'),
  ('Ekiti', 'Federal University Oye-Ekiti (FUOYE), Oye Ekiti'), -- REVIEW: Ikole campus official
  -- Enugu
  ('Enugu', 'University of Nigeria (UNN), Nsukka'),
  ('Enugu', 'University of Nigeria (UNN), Enugu Campus'), -- official second campus (College of Medicine Enugu)
  ('Enugu', 'Enugu State University of Science and Technology (ESUT), Agbani'),
  -- FCT Abuja
  ('Abuja (FCT)', 'University of Abuja (UNIABUJA), Gwagwalada'),
  ('Abuja (FCT)', 'National Open University of Nigeria (NOUN), Abuja'), -- REVIEW: open/distance university, HQ + nationwide study centres
  -- Gombe
  ('Gombe', 'Federal University, Kashere (FUKAShere)'),
  ('Gombe', 'Gombe State University (GSU), Gombe'),
  -- Imo
  ('Imo', 'Federal University of Technology (FUTO), Owerri'),
  ('Imo', 'Imo State University (IMSU), Owerri'),
  -- Jigawa
  ('Jigawa', 'Federal University, Dutse (FUD)'),
  ('Jigawa', 'Sule Lamido University (SLU), Kafin Hausa'),
  -- Kano
  ('Kano', 'Bayero University, Kano (BUK), Gwarzo Road'), -- REVIEW: old town campus is also official
  ('Kano', 'Aliko Dangote University of Science and Technology (ADUST), Wudil'), -- formerly Kano State University of Science and Technology; REVIEW rename
  ('Kano', 'Yusuf Maitama Sule University (YUMSU), Kano'), -- formerly North West University Kano; REVIEW rename
  -- Kaduna (already present, guards skip: ABU Zaria / AFIT / KASU)
  ('Kaduna', 'Ahmadu Bello University (ABU), Zaria'),
  ('Kaduna', 'Air Force Institute of Technology (AFIT)'),
  ('Kaduna', 'Kaduna State University (KASU)'),
  -- Katsina
  ('Katsina', 'Umaru Musa Yar''adua University (UMYU), Katsina'),
  ('Katsina', 'Federal University, Dutsin-Ma (FUDMA)'),
  -- Kebbi
  ('Kebbi', 'Federal University, Birnin Kebbi (FUBK)'),
  ('Kebbi', 'Kebbi State University of Science and Technology (KSUSTA), Aliero'),
  -- Kogi
  ('Kogi', 'Prince Abubakar Audu University (PAAU), Anyigba'), -- formerly Kogi State University; REVIEW rename
  ('Kogi', 'Federal University, Lokoja (FULOKOJA)'),
  -- Kwara
  ('Kwara', 'University of Ilorin (UNILORIN), Ilorin'),
  ('Kwara', 'Kwara State University (KWASU), Malete'),
  -- Lagos
  ('Lagos', 'University of Lagos (UNILAG), Akoka'),
  ('Lagos', 'University of Lagos (UNILAG), Idi-Araba (CMUL)'), -- official College of Medicine campus
  ('Lagos', 'Lagos State University (LASU), Ojo'), -- REVIEW: Epe campus official
  ('Lagos', 'Lagos State University of Science and Technology (LASUSTECH), Ikorodu'), -- REVIEW: formerly LASPOTECH, renamed 2021/22
  ('Lagos', 'Lagos State University of Education (LASUED), Epe'), -- REVIEW: formerly MOCPED, renamed 2021/22
  -- Nasarawa
  ('Nasarawa', 'Federal University, Lafia (FULafia)'),
  ('Nasarawa', 'Nasarawa State University (NSUK), Keffi'), -- REVIEW: Lafia campus official
  -- Niger
  ('Niger', 'Federal University of Technology (FUT), Minna'), -- REVIEW: Gidan Kwano main + Bosso campus official
  ('Niger', 'Ibrahim Badamasi Babangida University (IBBU), Lapai'),
  -- Ogun
  ('Ogun', 'Federal University of Agriculture (FUNAAB), Alabata'),
  ('Ogun', 'Olabisi Onabanjo University (OOU), Ago-Iwoye'),
  ('Ogun', 'Tai Solarin University of Education (TASUED), Ijagun'),
  -- Ondo
  ('Ondo', 'Federal University of Technology (FUTA), Akure'),
  ('Ondo', 'Adekunle Ajasin University (AAUA), Akungba-Akoko'),
  ('Ondo', 'University of Medical Sciences (UNIMED), Ondo'),
  -- Osun
  ('Osun', 'Obafemi Awolowo University (OAU), Ile-Ife'),
  ('Osun', 'Osun State University (UNIOSUN), Osogbo'), -- REVIEW: multi-campus model (Ikire, Okuku, Ejigbo, Ifetedo)
  -- Oyo
  ('Oyo', 'University of Ibadan (UI), Ibadan'),
  ('Oyo', 'Ladoke Akintola University of Technology (LAUTECH), Ogbomoso'), -- REVIEW: sole Oyo ownership now (Osun campus transferred to UNIOSUN)
  ('Oyo', 'First Technical University (TECH-U), Ibadan'),
  -- Plateau
  ('Plateau', 'University of Jos (UNIJOS), Jos'),
  ('Plateau', 'Plateau State University (PLASU), Bokkos'),
  -- Rivers
  ('Rivers', 'University of Port Harcourt (UNIPORT), Choba'),
  ('Rivers', 'Rivers State University (RSU), Port Harcourt'),
  -- Sokoto
  ('Sokoto', 'Usmanu Danfodiyo University (UDUSOK), Sokoto'),
  ('Sokoto', 'Sokoto State University (SSU), Sokoto'),
  -- Taraba
  ('Taraba', 'Taraba State University (TSU), Jalingo'),
  ('Taraba', 'Federal University, Wukari (FUWUKARI)'),
  -- Yobe
  ('Yobe', 'Federal University, Gashua (FUGASHUA)'),
  ('Yobe', 'Yobe State University (YSU), Damaturu'),
  -- Zamfara
  ('Zamfara', 'Federal University, Gusau (FUGUS)'),
  ('Zamfara', 'Zamfara State University (ZAMSU), Talata Mafara')
) AS v(state_name, campus_name)
JOIN public.locations s
  ON s.location_type = 'state' AND s.name = v.state_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.locations l
  WHERE l.location_type = 'campus' AND l.name = v.campus_name
);

-- ----------------------------------------------------------------------------
-- 1c. OPTIONAL CLEANUP — left as comments; requires explicit approval and
--     verification before running (DESTRUCTIVE):
--     '[TEST] AFIT Campus' duplicates the real 'Air Force Institute of
--     Technology (AFIT)'. Deleting the [TEST] campus row is only safe after
--     confirming no vendor_locations or product rows point at its id:
--
-- DELETE FROM public.locations WHERE name = '[TEST] AFIT Campus';
-- DELETE FROM public.locations WHERE name LIKE '[TEST]%' AND location_type = 'city';
--     The [TEST] state rows still hold the [TEST] campus as a child while
--     the real state rows hold ABU/KASU/AFIT/KadPoly — Phase 2 re-parents
--     everything properly, so leaving the [TEST] state rows until then is
--     the low-risk path.
-- ----------------------------------------------------------------------------

COMMIT;

-- ============================================================================
-- PART 2 — VERIFICATION (read-only, run after Part 1)
-- ============================================================================
--   SELECT location_type, count(*) FROM public.locations
--   GROUP BY 1 ORDER BY 1;
--   -- Expect total: state = 40 (37 real + 3 [TEST]),
--   --              campus = 92 (90 seeded + already-live KadPoly and
--   --                         [TEST] AFIT Campus),
--   --              city = 3 ([TEST], untouched)
--
--   SELECT s.name AS state_name, count(c.id) AS campuses
--   FROM public.locations s
--   LEFT JOIN public.locations c
--     ON c.location_type = 'campus' AND c.parent_location_id = s.id
--   WHERE s.location_type = 'state' AND s.name NOT LIKE '[TEST]%'
--   GROUP BY 1 HAVING count(c.id) = 0;
--   -- Expect: ZERO rows — every state/FCT must have at least one campus.
-- ============================================================================

-- ============================================================================
-- NEXT STEP (management, not SQL): phase 2 university rows live in
-- database/0003_university_tier_DRAFT.sql — run it only after Part 0 output
-- has been reviewed against the live view definitions.
-- ============================================================================
