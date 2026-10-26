-- ============================================================================
-- Wemart — 0007 DESIGN B NAME RECONCILIATION (READ-ONLY, safe anywhere)
-- database/0007_designB_name_reconciliation.sql
--
-- *** NO-CHANGE INSPECTION — contains only SELECT statements. Run by the
-- *** owner in the SQL Editor BEFORE migration 0003; share ALL output.
--
-- Purpose (owner decision 9, 2026-10-26): resolve campus-name provenance
-- BEFORE running the Design B university migration. It diffs every live
-- campus row against the 89 (state, campus) pairs that migration links.
--
-- NOTE ON "UNIVERSITY ASSOCIATION": the link column
-- (locations.university_location_id) does NOT exist until 0003 runs, so
-- today no campus carries an association value. R3's output IS the
-- definitive "campuses that would remain unassociated after 0003" list.
-- Nothing here renames, deletes, re-parents, creates, or links anything.
--
-- Output labels:
--   R1 — live campus inventory: id, name, parent state (university
--        association = none yet; see the note above)
--   R2 — EXACT MATCHES: proposed pair found in live data verbatim
--        (state AND campus name both match)
--   R3 — UNMATCHED LIVE CAMPUSES: exist in the database but would remain
--        UNASSOCIATED by 0003 (the reconciliation worklist)
--   R4 — PROPOSED LINKS WITH NO LIVE CAMPUS: migration guards would
--        silently no-op (report exactly these names for manual review)
--   R5 — AMBIGUOUS: live campus NAME matches a proposed campus but in a
--        different STATE (mis-grouped or duplicated name)
--   R6 — duplicate live campus names (same normalized name, multiple
--        states/rows)
--   R7 — NEAR-MISS: containment hints (spacing/casing/wording variants)
--        to help turn R3/R5 rows into exact matches for the patch
--
-- Expected good run: R2 = 89 rows, R3 small (pre-existing [TEST]/extra
-- rows only), R4 = 0, R5 = 0, R6 = 0.
-- ============================================================================

-- R1 — live campus inventory (id, name, parent state)
SELECT 'R1' AS part, c.id AS campus_id, c.name AS campus_name,
       s.name AS state_name
FROM public.locations c
LEFT JOIN public.locations s ON s.id = c.parent_location_id
WHERE c.location_type = 'campus'
ORDER BY state_name, campus_name;

-- R2 — exact matches (proposed pair found verbatim in live data)
SELECT 'R2' AS part, p.state_name, p.campus_name, c.id AS campus_id
FROM (
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
) AS p(state_name, campus_name)
JOIN public.locations c ON c.name = p.campus_name AND c.location_type = 'campus'
JOIN public.locations s ON s.id = c.parent_location_id AND s.name = p.state_name
ORDER BY p.state_name, p.campus_name;

-- R3 — unmatched live campuses (would remain UNASSOCIATED by 0003)
SELECT 'R3' AS part, c.name AS unmatched_live_campus, s.name AS state_name
FROM public.locations c
LEFT JOIN public.locations s ON s.id = c.parent_location_id
LEFT JOIN (
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
) AS p(state_name, campus_name)
  ON p.campus_name = c.name AND p.state_name = s.name
WHERE c.location_type = 'campus' AND p.campus_name IS NULL
ORDER BY state_name, unmatched_live_campus;

-- R4 — proposed links with NO live campus (guards would no-op)
SELECT 'R4' AS part, p.state_name, p.campus_name
FROM (
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
) AS p(state_name, campus_name)
LEFT JOIN public.locations c ON c.name = p.campus_name AND c.location_type = 'campus'
LEFT JOIN public.locations s ON s.id = c.parent_location_id AND s.name = p.state_name
WHERE c.id IS NULL
ORDER BY p.state_name, p.campus_name;

-- R5 — ambiguous: name matches a proposal but the STATE differs
SELECT 'R5' AS part, p.campus_name, s.name AS live_state,
       p.state_name AS proposed_state
FROM (
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
) AS p(state_name, campus_name)
JOIN public.locations c ON c.name = p.campus_name AND c.location_type = 'campus'
JOIN public.locations s ON s.id = c.parent_location_id
WHERE s.name <> p.state_name
ORDER BY p.campus_name;

-- R6 — duplicate live campus names (same normalized name, multiple rows)
SELECT 'R6' AS part, lower(btrim(c.name)) AS normalized_name,
       count(*) AS copies, string_agg(s.name, ', ' ORDER BY s.name) AS states
FROM public.locations c
LEFT JOIN public.locations s ON s.id = c.parent_location_id
WHERE c.location_type = 'campus'
GROUP BY lower(btrim(c.name))
HAVING count(*) > 1
ORDER BY normalized_name;

-- R7 — near-miss containment hints (spacing/casing/wording variants)
SELECT 'R7' AS part, c.name AS live_name, s.name AS live_state,
       p.campus_name AS proposed_pair_name
FROM public.locations c
LEFT JOIN public.locations s ON s.id = c.parent_location_id
JOIN (
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
) AS p(state_name, campus_name)
  ON p.campus_name NOT ILIKE c.name AND c.name NOT ILIKE p.campus_name
 AND (position(lower(btrim(c.name)) IN lower(p.campus_name)) > 0
   OR position(lower(btrim(p.campus_name)) IN lower(c.name)) > 0)
WHERE c.location_type = 'campus'
ORDER BY p.campus_name;
