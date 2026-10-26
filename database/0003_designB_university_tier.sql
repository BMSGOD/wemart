
-- ============================================================================
-- Wemart — 0003 DESIGN B: University tier via a companion association column
-- database/0003_designB_university_tier.sql
--
-- *** OWNER-EXECUTED MIGRATION — DO NOT RUN WITHOUT FINAL EXPLICIT
-- *** APPROVAL. Nothing in this repo executes SQL. Run by hand, once,
-- *** in the Supabase SQL Editor after the owner review.
--
-- RECONCILIATION APPLIED (2026-10-27, not-yet-executed): §3B was re-based on
-- the verified live campus inventory (0007 combined run) and owner decisions
-- 1–7 were applied. 84/89 links bind by verified campus UUID; the remaining
-- 5 sit COMMENTED in §3R (4 deferred + 1 declined). §1/§2/RECOVERY/V1–V10
-- are unchanged. Not one live campus name, state or vendor row is touched.
--
-- APPROVED-FOR-REVIEW design (2026-10-25):
--   * Universities become 'university'-typed location rows, parented to
--     their state (42 federal incl. specialized, 45 state-owned = 87).
--   * Campuses KEEP parent_location_id = state — NOTHING is re-parented,
--     so the catalog view, campus_directory view, catalog_search and
--     catalog_near_campus are untouched by construction (verified from
--     their literal definitions in inspection 0f).
--   * Each campus gains a nullable university_location_id FK link.
--   * Preserves: all product listings, vendors, inventory, location rows,
--     campus-state relationships, RPC names/signatures/filtering/ranking.
--   * Idempotent: constraint swap skips if 'university' already allowed;
--     INSERT guarded by NOT EXISTS; FK added via guarded DO block; link
--     UPDATEs re-fire harmlessly (same result). Re-running is always safe.
--   * WRAPS IN ONE TRANSACTION: BEGIN ... COMMIT — if any statement
--     errors mid-run, the SQL Editor aborts and the transaction rolls
--     back automatically. Failure modes are additive-only; see RECOVERY
--     below in the unlikely case a rollback is needed after COMMIT.
--
-- Verification queries (V1–V10) follow the COMMIT. Run them and share
-- ALL output for the reconciliation review.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. CONSTRAINT — allow 'university' as a location_type (idempotent).
--    Keeps ALL SIX live values confirmed in Part 0a:
--    ('state','city','campus','warehouse','pickup_point','other').
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  constraint_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    WHERE con.conrelid = 'public.locations'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%location_type%'
      AND pg_get_constraintdef(con.oid) ILIKE '%university%'
  ) THEN
    FOR constraint_name IN
      SELECT con.conname FROM pg_constraint con
      WHERE con.conrelid = 'public.locations'::regclass
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) ILIKE '%location_type%'
    LOOP
      EXECUTE format('ALTER TABLE public.locations DROP CONSTRAINT %I', constraint_name);
    END LOOP;
    EXECUTE 'ALTER TABLE public.locations'
      || ' ADD CONSTRAINT locations_location_type_check'
      || ' CHECK (location_type IN (''state'', ''city'', ''campus'','
      || ' ''warehouse'', ''pickup_point'', ''other'', ''university''))';
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. UNIVERSITY ROWS — 87 records, 36 states + FCT, parented to states.
--    NOT EXISTS(name, 'university') guard = re-running can never duplicate.
--    Classification: 42 federal (incl. specialized NAUB/AFIT/NOUN),
--    45 state-owned; private universities deliberately excluded.
--
--    OWNER PROVISIONAL DECISIONS (2026-10-26, apply unless changed):
--    * AFIT grouping row kept; FUT renamed to
--      'Federal University of Technology, Minna (FUTMINNA)' (verify
--      officially before/after); LAUTECH kept (verify Oyo ownership);
--      NOUN = FCT HQ only; UNIMED name kept as-is.
--    * UNVERIFIED/OFFICIAL-NAME FLAGS — do not treat as confirmed:
--      MAU (ex-MAUTECH), JOSTUM (ex-FUNAAB-Makurdi), ADUST, YUMSU, PAAU,
--      LASUSTECH (ex-LASPOTECH), LASUED (ex-MOCPED), UNICROSS
--      (ex-CRUTECH), COOU, EDSU (ex-Iyamho), UNIDEL, DOU, FUHSO
--      (phasing in), NAUB (Army scope), AFIT pairing, FUTMINNA (new
--      name), LAUTECH ownership. Verify against the NUC gazette /
--      institution sites; the V3 run output lists them for audit.
-- ----------------------------------------------------------------------------
INSERT INTO public.locations (name, location_type, parent_location_id)
SELECT v.uni_name, 'university', s.id
FROM (VALUES
  ('Abia', 'Abia State University (ABSU)'),
  ('Abia', 'Michael Okpara University of Agriculture (MOUAU)'),
  ('Adamawa', 'Adamawa State University (ADSU)'),
  ('Adamawa', 'Modibbo Adama University (MAU)'),
  ('Bauchi', 'Abubakar Tafawa Balewa University (ATBU)'),
  ('Bauchi', 'Federal University of Health Sciences, Azare (FUHSA)'),
  ('Bauchi', 'Bauchi State University (BASUG)'),
  ('Akwa Ibom', 'University of Uyo (UNIUYO)'),
  ('Akwa Ibom', 'Akwa Ibom State University (AKSU)'),
  ('Anambra', 'Nnamdi Azikiwe University (UNIZIK)'),
  ('Anambra', 'Chukwuemeka Odumegwu Ojukwu University (COOU)'),
  ('Bayelsa', 'Federal University Otuoke (FUO)'),
  ('Bayelsa', 'Niger Delta University (NDU)'),
  ('Benue', 'Benue State University (BSU)'),
  ('Benue', 'Joseph Sarwuan Tarka University (JOSTUM)'),
  ('Benue', 'Federal University of Health Sciences, Otukpo (FUHSO)'),
  ('Borno', 'University of Maiduguri (UNIMAID)'),
  ('Borno', 'Borno State University (BOSU)'),
  ('Borno', 'Nigerian Army University (NAUB)'),
  ('Cross River', 'University of Calabar (UNICAL)'),
  ('Cross River', 'University of Cross River State (UNICROSS)'),
  ('Delta', 'Federal University of Petroleum Resources (FUPRE)'),
  ('Delta', 'Delta State University (DELSU)'),
  ('Delta', 'University of Delta (UNIDEL)'),
  ('Delta', 'Dennis Osadebe University (DOU)'),
  ('Ebonyi', 'Alex Ekwueme Federal University, Ndufu-Alike (FUNAI)'),
  ('Ebonyi', 'Ebonyi State University (EBSU)'),
  ('Edo', 'University of Benin (UNIBEN)'),
  ('Edo', 'Ambrose Alli University (AAU)'),
  ('Edo', 'Edo State University (EDSU)'),
  ('Ekiti', 'Ekiti State University (EKSU)'),
  ('Ekiti', 'Federal University Oye-Ekiti (FUOYE)'),
  ('Enugu', 'University of Nigeria (UNN)'),
  ('Enugu', 'Enugu State University of Science and Technology (ESUT)'),
  ('Abuja (FCT)', 'University of Abuja (UNIABUJA)'),
  ('Abuja (FCT)', 'National Open University of Nigeria (NOUN)'),
  ('Gombe', 'Federal University, Kashere (FUKAShere)'),
  ('Gombe', 'Gombe State University (GSU)'),
  ('Imo', 'Federal University of Technology (FUTO)'),
  ('Imo', 'Imo State University (IMSU)'),
  ('Jigawa', 'Federal University, Dutse (FUD)'),
  ('Jigawa', 'Sule Lamido University (SLU)'),
  ('Kano', 'Bayero University, Kano (BUK)'),
  ('Kano', 'Aliko Dangote University of Science and Technology (ADUST)'),
  ('Kano', 'Yusuf Maitama Sule University (YUMSU)'),
  ('Kaduna', 'Air Force Institute of Technology (AFIT)'),
  ('Kaduna', 'Ahmadu Bello University (ABU)'),
  ('Kaduna', 'Kaduna State University (KASU)'),
  ('Katsina', 'Umaru Musa Yar''adua University (UMYU)'),
  ('Katsina', 'Federal University, Dutsin-Ma (FUDMA)'),
  ('Kebbi', 'Federal University, Birnin Kebbi (FUBK)'),
  ('Kebbi', 'Kebbi State University of Science and Technology (KSUSTA)'),
  ('Kogi', 'Prince Abubakar Audu University (PAAU)'),
  ('Kogi', 'Federal University, Lokoja (FULOKOJA)'),
  ('Kwara', 'University of Ilorin (UNILORIN)'),
  ('Kwara', 'Kwara State University (KWASU)'),
  ('Lagos', 'University of Lagos (UNILAG)'),
  ('Lagos', 'Lagos State University (LASU)'),
  ('Lagos', 'Lagos State University of Science and Technology (LASUSTECH)'),
  ('Lagos', 'Lagos State University of Education (LASUED)'),
  ('Nasarawa', 'Federal University, Lafia (FULafia)'),
  ('Nasarawa', 'Nasarawa State University (NSUK)'),
  ('Niger', 'Federal University of Technology, Minna (FUTMINNA)'),
  ('Niger', 'Ibrahim Badamasi Babangida University (IBBU)'),
  ('Ogun', 'Federal University of Agriculture (FUNAAB)'),
  ('Ogun', 'Olabisi Onabanjo University (OOU)'),
  ('Ogun', 'Tai Solarin University of Education (TASUED)'),
  ('Ondo', 'Federal University of Technology (FUTA)'),
  ('Ondo', 'Adekunle Ajasin University (AAUA)'),
  ('Ondo', 'University of Medical Sciences (UNIMED)'),
  ('Osun', 'Obafemi Awolowo University (OAU)'),
  ('Osun', 'Osun State University (UNIOSUN)'),
  ('Oyo', 'University of Ibadan (UI)'),
  ('Oyo', 'Ladoke Akintola University of Technology (LAUTECH)'),
  ('Oyo', 'First Technical University (TECH-U)'),
  ('Plateau', 'University of Jos (UNIJOS)'),
  ('Plateau', 'Plateau State University (PLASU)'),
  ('Rivers', 'University of Port Harcourt (UNIPORT)'),
  ('Rivers', 'Rivers State University (RSU)'),
  ('Sokoto', 'Usmanu Danfodiyo University (UDUSOK)'),
  ('Sokoto', 'Sokoto State University (SSU)'),
  ('Taraba', 'Taraba State University (TSU)'),
  ('Taraba', 'Federal University, Wukari (FUWUKARI)'),
  ('Yobe', 'Federal University, Gashua (FUGASHUA)'),
  ('Yobe', 'Yobe State University (YSU)'),
  ('Zamfara', 'Federal University, Gusau (FUGUS)'),
  ('Zamfara', 'Zamfara State University (ZAMSU)')
) AS v(state_name, uni_name)
JOIN public.locations s ON s.location_type = 'state' AND s.name = v.state_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.locations l
  WHERE l.location_type = 'university' AND l.name = v.uni_name
);

-- ----------------------------------------------------------------------------
-- 3A. ADD COLUMN + FK (idempotent: IF NOT EXISTS + guarded DO block).
--     The FK guarantees the target row exists; the UPDATEs below enforce
--     that the target is 'university'-typed on the SAME state as the
--     campus, so a wrong link cannot be created by this migration.
-- ----------------------------------------------------------------------------
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS university_location_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    WHERE con.conrelid = 'public.locations'::regclass
      AND con.conname = 'locations_university_location_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.locations'
      || ' ADD CONSTRAINT locations_university_location_id_fkey'
      || ' FOREIGN KEY (university_location_id) REFERENCES public.locations(id)';
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 3B. CAMPUS → UNIVERSITY LINKS — ID-VERIFIED, 84 statements + 5 review-only
--    (COMPUTED RECONCILIATION 2026-10-27 from the 0007 combined run.
--    live discovery: R1=111 campuses; R2=6 byte-exact; R3=105 unmatched;
--    R5=0 ambiguous; R6=0 duplicates. Conclusion: live campus names use a
--    DIFFERENT naming convention than the 0007 proposals
--    ("Base, City (ABBR)" vs "Base (ABBR), City"), so plain name matching
--    linked only 6/89 and would have left 83 links as silent no-ops.
--    OWNER DECISIONS 3–7 applied 2026-10-27: NOUN left unlinked (noise
--    risk only), UNN Enugu Campus / UNILAG CMUL / UNIMED / FUHSO deferred;
--
--    FIX: every link now targets c.id (verified live campus UUID from the
--    combined reconciliation output) instead of c.name. Guards on
--    u.name (byte-identical to §2) and s.name (live state name) and
--    c.parent_location_id = s.id are KEPT. parent_location_id is NEVER
--    modified; every live campus name/state/vendor relationship is
--    untouched. 5 uncertain cases remain COMMENTED (never executed)
--    in §3R below: 4 deferred pending a future new campus row and
--    1 declined (NOUN — owner decision 3).
--
--    Tier legend: T1 exact; T2 format-verified; T3 variant-verified
--    (abbrev or token variance); T4 manual/spelling or city-label variant
--    incl. owner-verified institution renames (TASUED→TASFUED,
--    TECH-U→Abiola Ajimobi Technical University — the live rows KEEP
--    their live names; the NOTE below carries the provenance).
--    Idempotent: re-running yields the same links.
-- ----------------------------------------------------------------------------

-- Federal University of Health Sciences, Azare (FUHSA) → Federal University of Health Sciences, Azare (FUHSA) (Bauchi) [T1: byte-exact name in live data]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University of Health Sciences, Azare (FUHSA)'
  AND s.location_type = 'state' AND s.name = 'Bauchi'
  AND c.location_type = 'campus' AND c.id = '484533f1-e9ad-4bbc-9cf5-dad2ae802329'
  AND c.parent_location_id = s.id;

-- Federal University Otuoke (FUO) → Federal University Otuoke (FUO) (Bayelsa) [T1: byte-exact name in live data]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University Otuoke (FUO)'
  AND s.location_type = 'state' AND s.name = 'Bayelsa'
  AND c.location_type = 'campus' AND c.id = '2d5beaeb-67dc-4b62-b423-9124d3d227ab'
  AND c.parent_location_id = s.id;

-- Niger Delta University (NDU) → Niger Delta University (NDU) (Bayelsa) [T1: byte-exact name in live data]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Niger Delta University (NDU)'
  AND s.location_type = 'state' AND s.name = 'Bayelsa'
  AND c.location_type = 'campus' AND c.id = 'a9e01d91-a933-4d91-9ddb-879f06aa7ec0'
  AND c.parent_location_id = s.id;

-- Ahmadu Bello University (ABU), Zaria → Ahmadu Bello University (ABU), Zaria (Kaduna) [T1: byte-exact name in live data]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Ahmadu Bello University (ABU)'
  AND s.location_type = 'state' AND s.name = 'Kaduna'
  AND c.location_type = 'campus' AND c.id = '409b779e-52f1-435f-8507-c6dafb2ab454'
  AND c.parent_location_id = s.id;

-- Air Force Institute of Technology (AFIT) → Air Force Institute of Technology (AFIT) (Kaduna) [T1: byte-exact name in live data]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Air Force Institute of Technology (AFIT)'
  AND s.location_type = 'state' AND s.name = 'Kaduna'
  AND c.location_type = 'campus' AND c.id = '5a51d9e1-07ca-4443-9b79-5e7f408b9485'
  AND c.parent_location_id = s.id;

-- Kaduna State University (KASU) → Kaduna State University (KASU) (Kaduna) [T1: byte-exact name in live data]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Kaduna State University (KASU)'
  AND s.location_type = 'state' AND s.name = 'Kaduna'
  AND c.location_type = 'campus' AND c.id = 'a5e21d46-aab7-45a7-b4df-15ad78876eaf'
  AND c.parent_location_id = s.id;

-- Abia State University (ABSU), Uturu → Abia State University, Uturu (ABSU) (Abia) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Abia State University (ABSU)'
  AND s.location_type = 'state' AND s.name = 'Abia'
  AND c.location_type = 'campus' AND c.id = 'c3d34e23-9b1a-470c-be0f-f5d2b8dc62c5'
  AND c.parent_location_id = s.id;

-- Michael Okpara University of Agriculture (MOUAU), Umudike → Michael Okpara University of Agriculture, Umudike (MOUAU) (Abia) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Michael Okpara University of Agriculture (MOUAU)'
  AND s.location_type = 'state' AND s.name = 'Abia'
  AND c.location_type = 'campus' AND c.id = '44aca114-89b9-4f24-8368-931e8b7e3ba9'
  AND c.parent_location_id = s.id;

-- Adamawa State University (ADSU), Mubi → Adamawa State University, Mubi (ADSU) (Adamawa) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Adamawa State University (ADSU)'
  AND s.location_type = 'state' AND s.name = 'Adamawa'
  AND c.location_type = 'campus' AND c.id = '92dc6475-9789-481d-8c85-20c79e78042b'
  AND c.parent_location_id = s.id;

-- Modibbo Adama University (MAU), Yola → Modibbo Adama University, Yola (MAU) (Adamawa) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Modibbo Adama University (MAU)'
  AND s.location_type = 'state' AND s.name = 'Adamawa'
  AND c.location_type = 'campus' AND c.id = 'b401c084-1a9b-4a40-ab27-49f612ad37ea'
  AND c.parent_location_id = s.id;

-- Abubakar Tafawa Balewa University (ATBU), Bauchi → Abubakar Tafawa Balewa University (ATBU) (Bauchi) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Abubakar Tafawa Balewa University (ATBU)'
  AND s.location_type = 'state' AND s.name = 'Bauchi'
  AND c.location_type = 'campus' AND c.id = 'aba1ec31-8cdc-4cd0-ab0f-3f50bfe710d3'
  AND c.parent_location_id = s.id;

-- Bauchi State University (BASUG), Gadau → Bauchi State University, Gadau (BASUG) (Bauchi) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Bauchi State University (BASUG)'
  AND s.location_type = 'state' AND s.name = 'Bauchi'
  AND c.location_type = 'campus' AND c.id = 'e3b9459e-c1ec-4220-8689-13345b4c7d02'
  AND c.parent_location_id = s.id;

-- University of Uyo (UNIUYO), Uyo → University of Uyo (UNIUYO) (Akwa Ibom) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'University of Uyo (UNIUYO)'
  AND s.location_type = 'state' AND s.name = 'Akwa Ibom'
  AND c.location_type = 'campus' AND c.id = 'bd839e62-bdd0-4ee6-97cd-457339ecd269'
  AND c.parent_location_id = s.id;

-- Akwa Ibom State University (AKSU), Mkpat Enin → Akwa Ibom State University (AKSU) (Akwa Ibom) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Akwa Ibom State University (AKSU)'
  AND s.location_type = 'state' AND s.name = 'Akwa Ibom'
  AND c.location_type = 'campus' AND c.id = '742fbfe7-a69b-444d-85e6-d6ae236e496a'
  AND c.parent_location_id = s.id;

-- Nnamdi Azikiwe University (UNIZIK), Awka → Nnamdi Azikiwe University, Awka (UNIZIK) (Anambra) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Nnamdi Azikiwe University (UNIZIK)'
  AND s.location_type = 'state' AND s.name = 'Anambra'
  AND c.location_type = 'campus' AND c.id = 'af136871-8b67-4acd-9ce7-7f99392a74ad'
  AND c.parent_location_id = s.id;

-- Benue State University (BSU), Makurdi → Benue State University (BSU) (Benue) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Benue State University (BSU)'
  AND s.location_type = 'state' AND s.name = 'Benue'
  AND c.location_type = 'campus' AND c.id = '86a49ea2-bcd6-4ec2-be0d-1fcd77ab2e0b'
  AND c.parent_location_id = s.id;

-- Joseph Sarwuan Tarka University (JOSTUM), Makurdi → Joseph Sarwuan Tarka University, Makurdi (JOSTUM) (Benue) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Joseph Sarwuan Tarka University (JOSTUM)'
  AND s.location_type = 'state' AND s.name = 'Benue'
  AND c.location_type = 'campus' AND c.id = 'add050fd-91c2-4388-a501-b2abb0f26ae1'
  AND c.parent_location_id = s.id;

-- University of Maiduguri (UNIMAID), Maiduguri → University of Maiduguri (UNIMAID) (Borno) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'University of Maiduguri (UNIMAID)'
  AND s.location_type = 'state' AND s.name = 'Borno'
  AND c.location_type = 'campus' AND c.id = 'bc0d37b4-e726-48ec-9030-aa3556adb490'
  AND c.parent_location_id = s.id;

-- Borno State University (BOSU), Maiduguri → Borno State University (BOSU) (Borno) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Borno State University (BOSU)'
  AND s.location_type = 'state' AND s.name = 'Borno'
  AND c.location_type = 'campus' AND c.id = 'e82f0712-595c-4d48-b031-adbf24007d7d'
  AND c.parent_location_id = s.id;

-- Nigerian Army University (NAUB), Biu → Nigerian Army University, Biu (NAUB) (Borno) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Nigerian Army University (NAUB)'
  AND s.location_type = 'state' AND s.name = 'Borno'
  AND c.location_type = 'campus' AND c.id = 'a56266bd-bd6e-4f63-89e3-9ca31066d99f'
  AND c.parent_location_id = s.id;

-- University of Calabar (UNICAL), Calabar → University of Calabar (UNICAL) (Cross River) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'University of Calabar (UNICAL)'
  AND s.location_type = 'state' AND s.name = 'Cross River'
  AND c.location_type = 'campus' AND c.id = 'aadf025d-89ec-4559-889c-1b023d8a0ae2'
  AND c.parent_location_id = s.id;

-- University of Cross River State (UNICROSS), Calabar → University of Cross River State (UNICROSS) (Cross River) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'University of Cross River State (UNICROSS)'
  AND s.location_type = 'state' AND s.name = 'Cross River'
  AND c.location_type = 'campus' AND c.id = '9f8857eb-90f3-483f-83a9-ad321c45fa22'
  AND c.parent_location_id = s.id;

-- Federal University of Petroleum Resources (FUPRE), Effurun → Federal University of Petroleum Resources, Effurun (FUPRE) (Delta) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University of Petroleum Resources (FUPRE)'
  AND s.location_type = 'state' AND s.name = 'Delta'
  AND c.location_type = 'campus' AND c.id = '099ac30e-765a-4b46-bc77-d67a74a953dd'
  AND c.parent_location_id = s.id;

-- Delta State University (DELSU), Abraka → Delta State University, Abraka (DELSU) (Delta) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Delta State University (DELSU)'
  AND s.location_type = 'state' AND s.name = 'Delta'
  AND c.location_type = 'campus' AND c.id = '174cecbd-df01-46ab-a03f-6c39c42a1198'
  AND c.parent_location_id = s.id;

-- University of Delta (UNIDEL), Agbor → University of Delta, Agbor (UNIDEL) (Delta) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'University of Delta (UNIDEL)'
  AND s.location_type = 'state' AND s.name = 'Delta'
  AND c.location_type = 'campus' AND c.id = '4680c815-96d9-4cf3-bbba-e3259c4a1cc4'
  AND c.parent_location_id = s.id;

-- Ebonyi State University (EBSU), Abakaliki → Ebonyi State University (EBSU) (Ebonyi) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Ebonyi State University (EBSU)'
  AND s.location_type = 'state' AND s.name = 'Ebonyi'
  AND c.location_type = 'campus' AND c.id = '3cf8c38a-7dd3-4774-86db-a2f8200ca5f3'
  AND c.parent_location_id = s.id;

-- University of Benin (UNIBEN), Benin City → University of Benin (UNIBEN) (Edo) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'University of Benin (UNIBEN)'
  AND s.location_type = 'state' AND s.name = 'Edo'
  AND c.location_type = 'campus' AND c.id = 'cf2d2ef8-dec0-4b8b-be1f-81a54b65163e'
  AND c.parent_location_id = s.id;

-- Ambrose Alli University (AAU), Ekpoma → Ambrose Alli University, Ekpoma (AAU) (Edo) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Ambrose Alli University (AAU)'
  AND s.location_type = 'state' AND s.name = 'Edo'
  AND c.location_type = 'campus' AND c.id = 'fa4b857a-97d9-4234-8e5f-1082759af307'
  AND c.parent_location_id = s.id;

-- Edo State University (EDSU), Uzairue → Edo State University, Uzairue (EDSU) (Edo) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Edo State University (EDSU)'
  AND s.location_type = 'state' AND s.name = 'Edo'
  AND c.location_type = 'campus' AND c.id = 'c38c452a-9a49-434b-a5c2-3c10bd3d7c71'
  AND c.parent_location_id = s.id;

-- Ekiti State University (EKSU), Ado-Ekiti → Ekiti State University (EKSU) (Ekiti) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Ekiti State University (EKSU)'
  AND s.location_type = 'state' AND s.name = 'Ekiti'
  AND c.location_type = 'campus' AND c.id = '58ad43ee-1e9a-402b-9961-1a6d6ea264d5'
  AND c.parent_location_id = s.id;

-- Federal University Oye-Ekiti (FUOYE), Oye Ekiti → Federal University Oye-Ekiti (FUOYE) (Ekiti) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University Oye-Ekiti (FUOYE)'
  AND s.location_type = 'state' AND s.name = 'Ekiti'
  AND c.location_type = 'campus' AND c.id = 'd81fc517-8e4e-4f22-86a7-159375014cdd'
  AND c.parent_location_id = s.id;

-- University of Nigeria (UNN), Nsukka → University of Nigeria, Nsukka (UNN) (Enugu) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'University of Nigeria (UNN)'
  AND s.location_type = 'state' AND s.name = 'Enugu'
  AND c.location_type = 'campus' AND c.id = '22b28114-582e-4867-ba6e-c9878f70e498'
  AND c.parent_location_id = s.id;

-- Enugu State University of Science and Technology (ESUT), Agbani → Enugu State University of Science and Technology (ESUT) (Enugu) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Enugu State University of Science and Technology (ESUT)'
  AND s.location_type = 'state' AND s.name = 'Enugu'
  AND c.location_type = 'campus' AND c.id = '7a06b56d-60be-415a-83dd-57f30f0b845f'
  AND c.parent_location_id = s.id;

-- University of Abuja (UNIABUJA), Gwagwalada → University of Abuja (UNIABUJA) (Federal Capital Territory) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'University of Abuja (UNIABUJA)'
  AND s.location_type = 'state' AND s.name = 'Federal Capital Territory'
  AND c.location_type = 'campus' AND c.id = 'b7ee36fd-bf93-488c-9531-533541ee11b7'
  AND c.parent_location_id = s.id;

-- Gombe State University (GSU), Gombe → Gombe State University (GSU) (Gombe) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Gombe State University (GSU)'
  AND s.location_type = 'state' AND s.name = 'Gombe'
  AND c.location_type = 'campus' AND c.id = '0ab2b9a4-1888-47d2-b577-baa3ffb33d63'
  AND c.parent_location_id = s.id;

-- Federal University of Technology (FUTO), Owerri → Federal University of Technology, Owerri (FUTO) (Imo) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University of Technology (FUTO)'
  AND s.location_type = 'state' AND s.name = 'Imo'
  AND c.location_type = 'campus' AND c.id = '8b034966-2a26-4a06-83f0-d130f7ff90b5'
  AND c.parent_location_id = s.id;

-- Imo State University (IMSU), Owerri → Imo State University (IMSU) (Imo) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Imo State University (IMSU)'
  AND s.location_type = 'state' AND s.name = 'Imo'
  AND c.location_type = 'campus' AND c.id = '13a11d45-49c7-41e5-9bb8-b863691886d1'
  AND c.parent_location_id = s.id;

-- Sule Lamido University (SLU), Kafin Hausa → Sule Lamido University, Kafin-Hausa (SLU) (Jigawa) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Sule Lamido University (SLU)'
  AND s.location_type = 'state' AND s.name = 'Jigawa'
  AND c.location_type = 'campus' AND c.id = '372d4925-94d4-4ff9-acea-30035f29bf38'
  AND c.parent_location_id = s.id;

-- Umaru Musa Yar'adua University (UMYU), Katsina → Umaru Musa Yar''adua University, Katsina (UMYU) (Katsina) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Umaru Musa Yar''adua University (UMYU)'
  AND s.location_type = 'state' AND s.name = 'Katsina'
  AND c.location_type = 'campus' AND c.id = 'e3179774-7361-47d8-b829-c146708f7006'
  AND c.parent_location_id = s.id;

-- Kebbi State University of Science and Technology (KSUSTA), Aliero → Kebbi State University of Science and Technology, Aliero (KSUSTA) (Kebbi) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Kebbi State University of Science and Technology (KSUSTA)'
  AND s.location_type = 'state' AND s.name = 'Kebbi'
  AND c.location_type = 'campus' AND c.id = '1d31220d-12aa-4be9-9a9c-06c01e9c5f17'
  AND c.parent_location_id = s.id;

-- Prince Abubakar Audu University (PAAU), Anyigba → Prince Abubakar Audu University, Anyigba (PAAU) (Kogi) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Prince Abubakar Audu University (PAAU)'
  AND s.location_type = 'state' AND s.name = 'Kogi'
  AND c.location_type = 'campus' AND c.id = '139fab03-f6b3-4930-953f-1bcdd9a75fb3'
  AND c.parent_location_id = s.id;

-- University of Ilorin (UNILORIN), Ilorin → University of Ilorin (UNILORIN) (Kwara) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'University of Ilorin (UNILORIN)'
  AND s.location_type = 'state' AND s.name = 'Kwara'
  AND c.location_type = 'campus' AND c.id = '8f986a23-1dad-4877-b628-f33d686211db'
  AND c.parent_location_id = s.id;

-- Kwara State University (KWASU), Malete → Kwara State University, Malete (KWASU) (Kwara) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Kwara State University (KWASU)'
  AND s.location_type = 'state' AND s.name = 'Kwara'
  AND c.location_type = 'campus' AND c.id = '4a9223a5-127f-4050-acb7-64498e98f251'
  AND c.parent_location_id = s.id;

-- University of Lagos (UNILAG), Akoka → University of Lagos (UNILAG) (Lagos) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'University of Lagos (UNILAG)'
  AND s.location_type = 'state' AND s.name = 'Lagos'
  AND c.location_type = 'campus' AND c.id = '6d1a87fa-90d6-4252-b672-0b0eb4218307'
  AND c.parent_location_id = s.id;

-- Lagos State University (LASU), Ojo → Lagos State University (LASU) (Lagos) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Lagos State University (LASU)'
  AND s.location_type = 'state' AND s.name = 'Lagos'
  AND c.location_type = 'campus' AND c.id = 'e5dfa334-c98c-441b-841f-91fe789b24c6'
  AND c.parent_location_id = s.id;

-- Lagos State University of Science and Technology (LASUSTECH), Ikorodu → Lagos State University of Science and Technology (LASUSTECH) (Lagos) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Lagos State University of Science and Technology (LASUSTECH)'
  AND s.location_type = 'state' AND s.name = 'Lagos'
  AND c.location_type = 'campus' AND c.id = '1a223fcb-276d-4208-92a0-d732c43d84f0'
  AND c.parent_location_id = s.id;

-- Lagos State University of Education (LASUED), Epe → Lagos State University of Education (LASUED) (Lagos) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Lagos State University of Education (LASUED)'
  AND s.location_type = 'state' AND s.name = 'Lagos'
  AND c.location_type = 'campus' AND c.id = '3af24e09-9f11-4681-ad30-466edd8aa1bd'
  AND c.parent_location_id = s.id;

-- Nasarawa State University (NSUK), Keffi → Nasarawa State University, Keffi (NSUK) (Nasarawa) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Nasarawa State University (NSUK)'
  AND s.location_type = 'state' AND s.name = 'Nasarawa'
  AND c.location_type = 'campus' AND c.id = '7bc28f69-a85e-4ac8-ba46-3c1f70a7b7bd'
  AND c.parent_location_id = s.id;

-- Olabisi Onabanjo University (OOU), Ago-Iwoye → Olabisi Onabanjo University (OOU) (Ogun) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Olabisi Onabanjo University (OOU)'
  AND s.location_type = 'state' AND s.name = 'Ogun'
  AND c.location_type = 'campus' AND c.id = 'f5137d99-87a9-4427-8465-40f46050df6a'
  AND c.parent_location_id = s.id;

-- Federal University of Technology (FUTA), Akure → Federal University of Technology, Akure (FUTA) (Ondo) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University of Technology (FUTA)'
  AND s.location_type = 'state' AND s.name = 'Ondo'
  AND c.location_type = 'campus' AND c.id = '100c19ca-b2c0-42c5-975f-b53271379fe3'
  AND c.parent_location_id = s.id;

-- Adekunle Ajasin University (AAUA), Akungba-Akoko → Adekunle Ajasin University, Akungba-Akoko (AAUA) (Ondo) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Adekunle Ajasin University (AAUA)'
  AND s.location_type = 'state' AND s.name = 'Ondo'
  AND c.location_type = 'campus' AND c.id = '6a13ceaf-a730-4c5a-bf34-6802e50ed6f4'
  AND c.parent_location_id = s.id;

-- Obafemi Awolowo University (OAU), Ile-Ife → Obafemi Awolowo University, Ile-Ife (OAU) (Osun) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Obafemi Awolowo University (OAU)'
  AND s.location_type = 'state' AND s.name = 'Osun'
  AND c.location_type = 'campus' AND c.id = 'e3ce7317-3488-4051-a30d-5b2f42f539c1'
  AND c.parent_location_id = s.id;

-- Osun State University (UNIOSUN), Osogbo → Osun State University (UNIOSUN) (Osun) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Osun State University (UNIOSUN)'
  AND s.location_type = 'state' AND s.name = 'Osun'
  AND c.location_type = 'campus' AND c.id = 'c21d4ef3-019e-4600-9988-30e4738ee336'
  AND c.parent_location_id = s.id;

-- University of Ibadan (UI), Ibadan → University of Ibadan (UI) (Oyo) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'University of Ibadan (UI)'
  AND s.location_type = 'state' AND s.name = 'Oyo'
  AND c.location_type = 'campus' AND c.id = '7d076123-f49d-4d62-b2d4-85cf3c17182f'
  AND c.parent_location_id = s.id;

-- Ladoke Akintola University of Technology (LAUTECH), Ogbomoso → Ladoke Akintola University of Technology, Ogbomoso (LAUTECH) (Oyo) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Ladoke Akintola University of Technology (LAUTECH)'
  AND s.location_type = 'state' AND s.name = 'Oyo'
  AND c.location_type = 'campus' AND c.id = '0937f147-4799-43e9-ac76-fc88d51425b1'
  AND c.parent_location_id = s.id;

-- University of Jos (UNIJOS), Jos → University of Jos (UNIJOS) (Plateau) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'University of Jos (UNIJOS)'
  AND s.location_type = 'state' AND s.name = 'Plateau'
  AND c.location_type = 'campus' AND c.id = '9c926b4b-dfd8-45b1-808a-3ec1c7bda5aa'
  AND c.parent_location_id = s.id;

-- Plateau State University (PLASU), Bokkos → Plateau State University, Bokkos (PLASU) (Plateau) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Plateau State University (PLASU)'
  AND s.location_type = 'state' AND s.name = 'Plateau'
  AND c.location_type = 'campus' AND c.id = 'ef033bd5-b126-433e-a0f8-798f2e25c2ad'
  AND c.parent_location_id = s.id;

-- University of Port Harcourt (UNIPORT), Choba → University of Port Harcourt (UNIPORT) (Rivers) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'University of Port Harcourt (UNIPORT)'
  AND s.location_type = 'state' AND s.name = 'Rivers'
  AND c.location_type = 'campus' AND c.id = '6ba1fa9d-7ad8-46d0-824e-462512a12d9e'
  AND c.parent_location_id = s.id;

-- Rivers State University (RSU), Port Harcourt → Rivers State University (RSU) (Rivers) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Rivers State University (RSU)'
  AND s.location_type = 'state' AND s.name = 'Rivers'
  AND c.location_type = 'campus' AND c.id = 'ddf03f35-f23a-413b-95a9-87be52a5b8ac'
  AND c.parent_location_id = s.id;

-- Sokoto State University (SSU), Sokoto → Sokoto State University (SSU) (Sokoto) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Sokoto State University (SSU)'
  AND s.location_type = 'state' AND s.name = 'Sokoto'
  AND c.location_type = 'campus' AND c.id = 'baef0478-b2a2-4335-80d8-baec816ab261'
  AND c.parent_location_id = s.id;

-- Taraba State University (TSU), Jalingo → Taraba State University (TSU) (Taraba) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Taraba State University (TSU)'
  AND s.location_type = 'state' AND s.name = 'Taraba'
  AND c.location_type = 'campus' AND c.id = '7f4e2543-fc6f-4a42-8a6c-64a88c597bee'
  AND c.parent_location_id = s.id;

-- Yobe State University (YSU), Damaturu → Yobe State University (YSU) (Yobe) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Yobe State University (YSU)'
  AND s.location_type = 'state' AND s.name = 'Yobe'
  AND c.location_type = 'campus' AND c.id = '619b78dd-c732-40b7-8562-cb247be5d3d9'
  AND c.parent_location_id = s.id;

-- Zamfara State University (ZAMSU), Talata Mafara → Zamfara State University, Talata Mafara (ZAMSU) (Zamfara) [T2: name-format verified (paren/city order or dropped city)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Zamfara State University (ZAMSU)'
  AND s.location_type = 'state' AND s.name = 'Zamfara'
  AND c.location_type = 'campus' AND c.id = 'b0bfe784-bf63-4c77-af47-f3b80a6b0b27'
  AND c.parent_location_id = s.id;

-- Bayero University, Kano (BUK), Gwarzo Road → Bayero University Kano (BUK) (Kano) [T3: variant-verified: same abbrev, base/city token variance]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Bayero University, Kano (BUK)'
  AND s.location_type = 'state' AND s.name = 'Kano'
  AND c.location_type = 'campus' AND c.id = 'c8a4c9d4-2153-4e6e-990b-1ff634b47974'
  AND c.parent_location_id = s.id;

-- Aliko Dangote University of Science and Technology (ADUST), Wudil → Aliko Dangote University of Science and Technology, Wudil (ADUSTECH) (Kano) [T3: variant-verified: abbreviation differs (ADUST vs ADUSTECH), base+city identical]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Aliko Dangote University of Science and Technology (ADUST)'
  AND s.location_type = 'state' AND s.name = 'Kano'
  AND c.location_type = 'campus' AND c.id = '503e54be-c87a-4c5c-a551-ed36e8d99ab2'
  AND c.parent_location_id = s.id;

-- Yusuf Maitama Sule University (YUMSU), Kano → Yusuf Maitama Sule University, Kano (YUMSUK) (Kano) [T3: variant-verified: abbreviation differs (YUMSU vs YUMSUK), base+city identical]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Yusuf Maitama Sule University (YUMSU)'
  AND s.location_type = 'state' AND s.name = 'Kano'
  AND c.location_type = 'campus' AND c.id = '42281886-e405-4fbe-889e-b6640efa4e45'
  AND c.parent_location_id = s.id;

-- Federal University of Technology (FUT), Minna → Federal University of Technology, Minna (FUTMINNA) (Niger) [T3: variant-verified: abbreviation differs (FUT vs FUTMINNA), base+city identical]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University of Technology, Minna (FUTMINNA)'
  AND s.location_type = 'state' AND s.name = 'Niger'
  AND c.location_type = 'campus' AND c.id = '513044f1-3f6a-4e76-ae72-9df63b6884c7'
  AND c.parent_location_id = s.id;

-- Ibrahim Badamasi Babangida University (IBBU), Lapai → Ibrahim Badamasi Babangida University, Lapai (IBBUL) (Niger) [T3: variant-verified: abbreviation differs (IBBU vs IBBUL), base+city identical]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Ibrahim Badamasi Babangida University (IBBU)'
  AND s.location_type = 'state' AND s.name = 'Niger'
  AND c.location_type = 'campus' AND c.id = '40cb138d-2cfc-4207-abef-cc38fed47679'
  AND c.parent_location_id = s.id;

-- Usmanu Danfodiyo University (UDUSOK), Sokoto → Usmanu Danfodiyo University, Sokoto (UDUS) (Sokoto) [T3: variant-verified: abbreviation differs (UDUSOK vs UDUS), base+city identical]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Usmanu Danfodiyo University (UDUSOK)'
  AND s.location_type = 'state' AND s.name = 'Sokoto'
  AND c.location_type = 'campus' AND c.id = '17fd1f3a-6eb0-46f8-b615-28bb5f200655'
  AND c.parent_location_id = s.id;

-- Alex Ekwueme Federal University, Ndufu-Alike (FUNAI) → Alex Ekwueme Federal University, Ndufu-Alike (AE-FUNAI) (Ebonyi) [T3: variant-verified: abbreviation differs (FUNAI vs AE-FUNAI), base+city identical]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Alex Ekwueme Federal University, Ndufu-Alike (FUNAI)'
  AND s.location_type = 'state' AND s.name = 'Ebonyi'
  AND c.location_type = 'campus' AND c.id = '50826598-eb22-4d21-a97e-837730995b95'
  AND c.parent_location_id = s.id;

-- Federal University, Kashere (FUKAShere) → Federal University Kashere (FUKASHERE) (Gombe) [T3: variant-verified: same abbrev, base/city token variance]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University, Kashere (FUKAShere)'
  AND s.location_type = 'state' AND s.name = 'Gombe'
  AND c.location_type = 'campus' AND c.id = 'ec3b321c-3f84-4a8f-be07-33dff73f35f6'
  AND c.parent_location_id = s.id;

-- Federal University, Dutse (FUD) → Federal University Dutse (FUD) (Jigawa) [T3: variant-verified: same abbrev, base/city token variance]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University, Dutse (FUD)'
  AND s.location_type = 'state' AND s.name = 'Jigawa'
  AND c.location_type = 'campus' AND c.id = '656cbb46-f08e-47b8-86e6-195341f17fd5'
  AND c.parent_location_id = s.id;

-- Federal University, Dutsin-Ma (FUDMA) → Federal University Dutsin-Ma (FUDMA) (Katsina) [T3: variant-verified: same abbrev, base/city token variance]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University, Dutsin-Ma (FUDMA)'
  AND s.location_type = 'state' AND s.name = 'Katsina'
  AND c.location_type = 'campus' AND c.id = 'be573681-cc5d-4261-8d0c-6a9b23ceab79'
  AND c.parent_location_id = s.id;

-- Federal University, Birnin Kebbi (FUBK) → Federal University Birnin Kebbi (FUBK) (Kebbi) [T3: variant-verified: same abbrev, base/city token variance]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University, Birnin Kebbi (FUBK)'
  AND s.location_type = 'state' AND s.name = 'Kebbi'
  AND c.location_type = 'campus' AND c.id = '84dc8c72-a306-4c9c-bfa9-0e240b65a036'
  AND c.parent_location_id = s.id;

-- Federal University, Lokoja (FULOKOJA) → Federal University Lokoja (FULOKOJA) (Kogi) [T3: variant-verified: same abbrev, base/city token variance]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University, Lokoja (FULOKOJA)'
  AND s.location_type = 'state' AND s.name = 'Kogi'
  AND c.location_type = 'campus' AND c.id = 'ecf2c099-6ca8-42f1-a207-32a8bb8c21db'
  AND c.parent_location_id = s.id;

-- Federal University, Lafia (FULafia) → Federal University Lafia (FULAFIA) (Nasarawa) [T3: variant-verified: same abbrev, base/city token variance]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University, Lafia (FULafia)'
  AND s.location_type = 'state' AND s.name = 'Nasarawa'
  AND c.location_type = 'campus' AND c.id = 'cc5d9f74-1796-4c31-b768-d5c06dec4884'
  AND c.parent_location_id = s.id;

-- Federal University, Wukari (FUWUKARI) → Federal University Wukari (FUWUKARI) (Taraba) [T3: variant-verified: same abbrev, base/city token variance]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University, Wukari (FUWUKARI)'
  AND s.location_type = 'state' AND s.name = 'Taraba'
  AND c.location_type = 'campus' AND c.id = '3d101e05-21a4-46b9-8700-fb5659711bf2'
  AND c.parent_location_id = s.id;

-- Federal University, Gashua (FUGASHUA) → Federal University Gashua (FUGASHUA) (Yobe) [T3: variant-verified: same abbrev, base/city token variance]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University, Gashua (FUGASHUA)'
  AND s.location_type = 'state' AND s.name = 'Yobe'
  AND c.location_type = 'campus' AND c.id = 'efc8a03c-406a-4e6c-82a1-6c686519e94c'
  AND c.parent_location_id = s.id;

-- Federal University, Gusau (FUGUS) → Federal University Gusau (FUGUS) (Zamfara) [T3: variant-verified: same abbrev, base/city token variance]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University, Gusau (FUGUS)'
  AND s.location_type = 'state' AND s.name = 'Zamfara'
  AND c.location_type = 'campus' AND c.id = '79819b14-0534-483d-b728-438960b70c78'
  AND c.parent_location_id = s.id;

-- Dennis Osadebe University (DOU), Asaba → Dennis Osadebay University, Asaba (DOU) (Delta) [T4: manual: spelling variant Osadebe/Osadebay; abbrev DOU + Asaba city agree]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Dennis Osadebe University (DOU)'
  AND s.location_type = 'state' AND s.name = 'Delta'
  AND c.location_type = 'campus' AND c.id = 'a826506f-a475-4e3e-80d0-7a07186e177a'
  AND c.parent_location_id = s.id;

-- Chukwuemeka Odumegwu Ojukwu University (COOU), Igbariam → Chukwuemeka Odumegwu Ojukwu University, Uli (COOU) (Anambra) [T4: manual: same university: abbrev COOU + base name identical; proposal said Igbariam, live row says Uli (main campus)]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Chukwuemeka Odumegwu Ojukwu University (COOU)'
  AND s.location_type = 'state' AND s.name = 'Anambra'
  AND c.location_type = 'campus' AND c.id = '0f993d0b-acc4-41da-8a50-735195083358'
  AND c.parent_location_id = s.id;

-- Federal University of Agriculture (FUNAAB), Alabata → Federal University of Agriculture, Abeokuta (FUNAAB) (Ogun) [T4: manual: same university: abbrev FUNAAB + base name identical; proposal said Alabata, live row says Abeokuta]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Federal University of Agriculture (FUNAAB)'
  AND s.location_type = 'state' AND s.name = 'Ogun'
  AND c.location_type = 'campus' AND c.id = 'efa8472c-0303-433b-a29f-1152c36fd74d'
  AND c.parent_location_id = s.id;

-- Tai Solarin University of Education (TASUED), Ijagun → Tai Solarin Federal University of Education, Ijebu-Ode (TASFUED) (Ogun) [T4: manual: owner decision 1 + verified: FG adopted TASUED (Ijagun) as Tai Solarin Federal University of Education, Mar 2025 — same institution; live row retains the new TASFUED name (Ijebu-Ode); no live row renamed]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'Tai Solarin University of Education (TASUED)'
  AND s.location_type = 'state' AND s.name = 'Ogun'
  AND c.location_type = 'campus' AND c.id = '28dad84b-40e0-4dd4-924a-7ea10807372e'
  AND c.parent_location_id = s.id;

-- First Technical University (TECH-U), Ibadan → Abiola Ajimobi Technical University, Ibadan (Oyo) [T4: manual: owner decision 2 + verified: Oyo State law (May/Aug 2024) renamed First Technical University, Ibadan to Abiola Ajimobi Technical University — same institution; live row retains the new name; no live row renamed]
UPDATE public.locations c SET university_location_id = u.id
FROM public.locations u, public.locations s
WHERE u.location_type = 'university' AND u.name = 'First Technical University (TECH-U)'
  AND s.location_type = 'state' AND s.name = 'Oyo'
  AND c.location_type = 'campus' AND c.id = '9488f0f7-c416-4052-bec3-68e8a54fc132'
  AND c.parent_location_id = s.id;

-- ----------------------------------------------------------------------------
-- 3R. REVIEW-REQUIRED — COMMENTED OUT, NEVER EXECUTED. Do not uncomment
--     without a NEW explicit owner approval. 5 proposed links reflecting
--     owner decisions 3–7 (2026-10-27): 4 deferred until a separate/
--       (a) institution renamed since the proposal
--       (b) proposed campus has NO live row (would need a new campus
--           row — a separate owner decision, NOT part of this file)
--     Each commented statement is a template: approval fills c.id.
-- ----------------------------------------------------------------------------

-- PENDING — Federal University of Health Sciences, Otukpo (FUHSO) (proposed state: Benue)
--   status: DEFERRED (owner decision 7, 2026-10-27): NO association to FUHSA Azare (a different university in Bauchi); link only when a live Otukpo campus row exists. | lookup candidates: Benue State University (BSU) (Benue) | Joseph Sarwuan Tarka University, Makurdi (JOSTUM) (Benue) | Federal University of Health Sciences, Azare (FUHSA) (Bauchi)
-- UPDATE public.locations c SET university_location_id = u.id
-- FROM public.locations u, public.locations s
-- WHERE u.location_type = 'university' AND u.name = 'Federal University of Health Sciences, Otukpo (FUHSO)'
--   AND s.location_type = 'state' AND s.name = '<live state>'
--   AND c.location_type = 'campus' AND c.id = '<verified uuid>'
--   AND c.parent_location_id = s.id;

-- PENDING — University of Nigeria (UNN), Enugu Campus (proposed state: Enugu)
--   status: DEFERRED (owner decision 4, 2026-10-27): link only when a separate Enugu Campus row is added; the Nsukka row is already linked. Never an association to a different university. | lookup candidates: University of Nigeria, Nsukka (UNN) (Enugu) | Enugu State University of Science and Technology (ESUT) (Enugu) | National Open University of Nigeria (NOUN), Lagos (Lagos)
-- UPDATE public.locations c SET university_location_id = u.id
-- FROM public.locations u, public.locations s
-- WHERE u.location_type = 'university' AND u.name = 'University of Nigeria (UNN)'
--   AND s.location_type = 'state' AND s.name = '<live state>'
--   AND c.location_type = 'campus' AND c.id = '<verified uuid>'
--   AND c.parent_location_id = s.id;

-- PENDING — National Open University of Nigeria (NOUN), Abuja (proposed state: Federal Capital Territory)
--   status: DECLINED (owner decision 3, 2026-10-27): leave unlinked; do NOT associate with the Lagos NOUN row (HQ policy says FCT HQ proposed, live row is Lagos). | lookup candidates: University of Abuja (UNIABUJA) (Federal Capital Territory) | African Aviation and Aerospace University (AAAU) (Federal Capital Territory) | National Open University of Nigeria (NOUN), Lagos (Lagos)
-- UPDATE public.locations c SET university_location_id = u.id
-- FROM public.locations u, public.locations s
-- WHERE u.location_type = 'university' AND u.name = 'National Open University of Nigeria (NOUN)'
--   AND s.location_type = 'state' AND s.name = '<live state>'
--   AND c.location_type = 'campus' AND c.id = '<verified uuid>'
--   AND c.parent_location_id = s.id;

-- PENDING — University of Lagos (UNILAG), Idi-Araba (CMUL) (proposed state: Lagos)
--   status: DEFERRED (owner decision 5, 2026-10-27): link only when a separate CMUL row is added; the UNILAG Akoka row is already linked. Never an association to a different university. | lookup candidates: University of Lagos (UNILAG) (Lagos) | Lagos State University of Education (LASUED) (Lagos) | Lagos State University of Science and Technology (LASUSTECH) (Lagos)
-- UPDATE public.locations c SET university_location_id = u.id
-- FROM public.locations u, public.locations s
-- WHERE u.location_type = 'university' AND u.name = 'University of Lagos (UNILAG)'
--   AND s.location_type = 'state' AND s.name = '<live state>'
--   AND c.location_type = 'campus' AND c.id = '<verified uuid>'
--   AND c.parent_location_id = s.id;

-- PENDING — University of Medical Sciences (UNIMED), Ondo (proposed state: Ondo)
--   status: DEFERRED (owner decision 6, 2026-10-27): link only when a live Ondo campus row for UNIMED exists. Never an association to a different university. | lookup candidates: Adeyemi Federal University of Education (AFUED) (Ondo) | Federal University of Technology, Akure (FUTA) (Ondo) | Olusegun Agagu University of Science and Technology (OAUSTECH) (Ondo)
-- UPDATE public.locations c SET university_location_id = u.id
-- FROM public.locations u, public.locations s
-- WHERE u.location_type = 'university' AND u.name = 'University of Medical Sciences (UNIMED)'
--   AND s.location_type = 'state' AND s.name = '<live state>'
--   AND c.location_type = 'campus' AND c.id = '<verified uuid>'
--   AND c.parent_location_id = s.id;

-- ----------------------------------------------------------------------------
-- RECOVERY — reverse-order undo. COMMENTED OUT; uncomment ONLY if the
-- migration was committed and must be fully reverted. Every step is the
-- exact inverse of an additive change, in FK-safe order:
--   (links NULLed) → (constraint dropped) → (column dropped) →
--   (university rows deleted) → (CHECK reverted to the live 6 values).
-- ----------------------------------------------------------------------------
-- BEGIN;
-- UPDATE public.locations c
--   SET university_location_id = NULL
--   WHERE c.location_type = 'campus' AND c.university_location_id IS NOT NULL;
--
-- ALTER TABLE public.locations
--   DROP CONSTRAINT locations_university_location_id_fkey;
--
-- ALTER TABLE public.locations
--   DROP COLUMN IF EXISTS university_location_id;
--
-- DELETE FROM public.locations WHERE location_type = 'university';
--
-- ALTER TABLE public.locations
--   DROP CONSTRAINT locations_location_type_check;
-- ALTER TABLE public.locations
--   ADD CONSTRAINT locations_location_type_check
--   CHECK (location_type IN ('state', 'city', 'campus',
--                            'warehouse', 'pickup_point', 'other'));
-- COMMIT;
-- (After recovery, campus_directory + catalog are back to their exact
-- pre-migration state because they never referenced any of this.)

COMMIT;

-- ============================================================================
-- VERIFICATION (read-only, run as a separate editor session AFTER COMMIT).
-- Labels V1..V10. Copy ALL output back for the reconciliation review.
-- "Expect" lines state the pass condition; any deviation must be reported.
-- ============================================================================

-- V1 — CHECK constraint now accepts 'university' (expect the 7-value list
--      named locations_location_type_check)
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.locations'::regclass AND contype = 'c';

-- V2 — new column + FK exist (expect 1 row each)
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'locations'
  AND column_name = 'university_location_id';

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.locations'::regclass
  AND conname = 'locations_university_location_id_fkey';

-- V3 — university rows per state (expect 87 total; every one of the 37
--      units, i.e. 36 states + FCT, has at least 1)
SELECT s.name AS state, count(*) AS universities
FROM public.locations u
JOIN public.locations s ON s.id = u.parent_location_id AND s.location_type = 'state'
WHERE u.location_type = 'university'
GROUP BY 1 ORDER BY 1;

-- V3b — linked vs unlinked campuses; the unlinked list is the
--      reconciliation worklist (expect [TEST] rows, [TEST]-parented /
--      city-parented rows, and any live campus whose name differs from
--      the exact names in this file — e.g. KadPoly, AFIT-adjacent rows)
SELECT
  count(*) FILTER (WHERE c.university_location_id IS NULL)  AS unlinked,
  count(*) FILTER (WHERE c.university_location_id IS NOT NULL) AS linked,
  count(*) AS campuses
FROM public.locations c WHERE c.location_type = 'campus';

SELECT c.name AS unlinked_campus, s.name AS state
FROM public.locations c
LEFT JOIN public.locations s ON s.id = c.parent_location_id
WHERE c.location_type = 'campus' AND c.university_location_id IS NULL
ORDER BY 1;

-- V3c — universities with NO linked campus (these simply have no campus
--      row in the directory yet; review whether a campus should be seeded)
SELECT u.name AS university_without_campus, s.name AS state
FROM public.locations u
JOIN public.locations s ON s.id = u.parent_location_id
WHERE u.location_type = 'university'
  AND NOT EXISTS (
    SELECT 1 FROM public.locations c
    WHERE c.location_type = 'campus'
      AND c.university_location_id = u.id
  )
ORDER BY 1;

-- V5 — FK targets are university-typed (expect 0 rows)
SELECT c.name AS campus, l.name AS wrong_target, l.location_type
FROM public.locations c
JOIN public.locations l ON l.id = c.university_location_id
WHERE c.location_type = 'campus' AND l.location_type <> 'university';

-- V6 — university's state must equal the campus' state (expect 0 rows)
SELECT c.name AS campus, cs.name AS campus_state, us.name AS uni_state
FROM public.locations c
JOIN public.locations u  ON u.id  = c.university_location_id
JOIN public.locations cs ON cs.id = c.parent_location_id
JOIN public.locations us ON us.id = u.parent_location_id
WHERE c.location_type = 'campus' AND cs.id <> us.id;

-- V7 — no campus was re-parented: every campus's parent is still
--      state-typed or NULL (pre-existing [TEST]/city case only)
SELECT c.name, l.location_type AS parent_type
FROM public.locations c
LEFT JOIN public.locations l ON l.id = c.parent_location_id
WHERE c.location_type = 'campus'
  AND (l.location_type IS NULL OR l.location_type <> 'state');

-- V8 — views untouched: row count matches the pre-run number AND both
--      definitions must be BYTE-IDENTICAL to the Part 0 (0b1/0b2) output
SELECT count(*) AS campus_directory_rows FROM public.campus_directory;

SELECT pg_get_viewdef('public.campus_directory'::regclass, true);
SELECT pg_get_viewdef('public.catalog'::regclass, true);

-- V9 — duplicate check incl. university rows (expect 0 rows)
SELECT name, location_type, count(*) FROM public.locations
GROUP BY 1, 2 HAVING count(*) > 1;

-- V10 — frontend smoke (browser, anon only): same offers, same counts,
--       same section grouping and campus dropdown as before the run.
