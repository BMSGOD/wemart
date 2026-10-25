-- ============================================================================
-- Wemart — Category taxonomy restructure (idempotent, review-before-run)
-- database/0004_category_taxonomy.sql
--
-- DO NOT RUN AUTOMATICALLY. Review, then run manually in the Supabase SQL
-- editor (owner role). Safe to re-run (every step is guarded).
--
-- GOAL
--   Replace the overlapping two-level list (Gadgets / Footwear / Fashion /
--   Books / Furniture / Food / Beauty / Services) with 8 top-level
--   categories and clear subcategories. "Shoes" stops competing with
--   "Fashion"; "Phones"/"Laptops" stop competing with a Gadgets-top.
--
-- PRODUCTS ARE PRESERVED
--   No product row and no category row is EVER deleted. All restructuring
--   is done by RENAMING + RE-PARENTING the existing rows, so every existing
--   product keeps its category_id and remains correctly classified:
--     Footwear products (e.g. the live [TEST] Classic Trainers) keep their
--     id, which becomes the "Shoes & Footwear" subcategory under
--     "Fashion & Accessories" — a top-level Fashion filter INCLUDES them
--     via the app's IN (top + children) filtering.
--   Only brand-new rows are INSERTed (guarded against re-runs).
--
-- FINAL TAXONOMY (8 top-level, in the proposed order via sort_order)
--   1 Fashion & Accessories — Clothing, Shoes & Footwear, Bags,
--                             Watches & Jewellery, Other fashion accessories
--   2 Electronics & Gadgets — Phones, Laptops & Computers, Tablets,
--                             Audio devices, Other electronics
--   3 Home & Living         — Furniture, Mattresses, Kitchen items,
--                             Home appliances, Other household products
--   4 Beauty & Personal Care — Skincare, Haircare, Fragrances,
--                              Personal care products
--   5 Books & Education     — Textbooks, Educational materials, Stationery
--   6 Food & Groceries      — Food, Drinks, Groceries
--   7 Sports & Fitness      — Sportswear, Sports equipment,
--                             Fitness accessories
--   8 Other                 — (no children; catches everything else)
--   Services (existing top-level) is renamed to "Other" so its 0 products
--   and any future "does not fit" listing land somewhere honest.
--
-- ============================================================================

-- ============================================================================
-- PART 0 — inspection (read-only; run first and keep the output)
-- ============================================================================
-- SELECT id, name, parent_category_id, is_active, sort_order
-- FROM public.categories ORDER BY sort_order, name;
--
-- SELECT c.name, p.name AS parent, count(prod.id) AS products
-- FROM public.categories c
-- LEFT JOIN public.categories p ON p.id = c.parent_category_id
-- LEFT JOIN public.products prod ON prod.category_id = c.id
-- GROUP BY c.name, p.name ORDER BY 3 DESC;
--
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- PART A — RENAME the existing top-level rows (id-preserving). Each UPDATE
-- only fires when the row still carries its old name, so re-runs no-op.
-- ----------------------------------------------------------------------------
UPDATE public.categories
SET name = 'Fashion & Accessories',
    description = 'Clothing, shoes, bags, watches and other accessories',
    sort_order = 1
WHERE name = 'Fashion' AND parent_category_id IS NULL;

UPDATE public.categories
SET name = 'Electronics & Gadgets',
    description = 'Phones, laptops, tablets and other electronics',
    sort_order = 2
WHERE name = 'Gadgets' AND parent_category_id IS NULL;

UPDATE public.categories
SET name = 'Beauty & Personal Care',
    description = 'Skincare, haircare, fragrances and personal care',
    sort_order = 4
WHERE name = 'Beauty' AND parent_category_id IS NULL;

UPDATE public.categories
SET name = 'Books & Education',
    description = 'Textbooks, educational materials and stationery',
    sort_order = 5
WHERE name = 'Books' AND parent_category_id IS NULL;

UPDATE public.categories
SET name = 'Food & Groceries',
    description = 'Meals, snacks, drinks and groceries',
    sort_order = 6
WHERE name = 'Food' AND parent_category_id IS NULL;

UPDATE public.categories
SET name = 'Other',
    description = 'Products that do not fit the categories above',
    sort_order = 8
WHERE name = 'Services' AND parent_category_id IS NULL;

-- ----------------------------------------------------------------------------
-- PART B — INSERT the two top-level rows that do not exist yet.
-- ----------------------------------------------------------------------------
INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Home & Living', 'Furniture, mattresses, kitchen items and home appliances', NULL, true, 3
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories
  WHERE name = 'Home & Living' AND parent_category_id IS NULL
);

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Sports & Fitness', 'Sportswear, sports equipment and fitness accessories', NULL, true, 7
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories
  WHERE name = 'Sports & Fitness' AND parent_category_id IS NULL
);

-- ----------------------------------------------------------------------------
-- PART C — child-level RENAMES + RE-PARENTS (id-preserving). The old child
-- rows "Footwear", "Laptops", "Gadget Accessories" keep their ids (and thus
-- their existing products) while joining the right parent.
-- ----------------------------------------------------------------------------
UPDATE public.categories c
SET name = 'Shoes & Footwear',
    parent_category_id = (
      SELECT p.id FROM public.categories p
      WHERE p.name = 'Fashion & Accessories' AND p.parent_category_id IS NULL
    ),
    sort_order = 2,
    description = 'Trainers, sandals, slides and other footwear'
WHERE c.name = 'Footwear' AND c.parent_category_id IS NULL;

UPDATE public.categories c
SET name = 'Laptops & Computers',
    parent_category_id = (
      SELECT p.id FROM public.categories p
      WHERE p.name = 'Electronics & Gadgets' AND p.parent_category_id IS NULL
    ),
    sort_order = 2,
    description = 'Laptops, desktops and computer accessories'
WHERE c.name = 'Laptops' AND c.parent_category_id IS NULL;

UPDATE public.categories c
SET name = 'Other electronics',
    parent_category_id = (
      SELECT p.id FROM public.categories p
      WHERE p.name = 'Electronics & Gadgets' AND p.parent_category_id IS NULL
    ),
    sort_order = 5,
    description = 'Chargers, earphones and other electronics'
WHERE c.name = 'Gadget Accessories' AND c.parent_category_id IS NULL;

UPDATE public.categories c
SET parent_category_id = (
      SELECT p.id FROM public.categories p
      WHERE p.name = 'Home & Living' AND p.parent_category_id IS NULL
    ),
    sort_order = 1,
    description = 'Beds, desks, chairs and hostel items'
WHERE c.name = 'Furniture' AND c.parent_category_id IS NULL;

-- ----------------------------------------------------------------------------
-- PART D — INSERT the missing subcategories under the right parent.
-- Pattern per child: NOT EXISTS on (name, parent) so they are idempotent.
-- ----------------------------------------------------------------------------
-- 1. Fashion & Accessories
INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Clothing', 'Clothes and wearables', p.id, true, 1
FROM public.categories p
WHERE p.name = 'Fashion & Accessories' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Clothing' AND c.parent_category_id = p.id
  );

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Bags', 'Backpacks, handbags and luggage', p.id, true, 3
FROM public.categories p
WHERE p.name = 'Fashion & Accessories' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Bags' AND c.parent_category_id = p.id
  );

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Watches & Jewellery', 'Watches, beads and jewellery', p.id, true, 4
FROM public.categories p
WHERE p.name = 'Fashion & Accessories' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Watches & Jewellery' AND c.parent_category_id = p.id
  );

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Other fashion accessories', 'Belts, scarves and other accessories', p.id, true, 5
FROM public.categories p
WHERE p.name = 'Fashion & Accessories' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Other fashion accessories' AND c.parent_category_id = p.id
  );

-- 2. Electronics & Gadgets ("Phones" already exists under the renamed
--    Electronics & Gadgets parent — no insert needed)
INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Tablets', 'Tablets and readers', p.id, true, 3
FROM public.categories p
WHERE p.name = 'Electronics & Gadgets' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Tablets' AND c.parent_category_id = p.id
  );

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Audio devices', 'Speakers, earphones and audio gear', p.id, true, 4
FROM public.categories p
WHERE p.name = 'Electronics & Gadgets' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Audio devices' AND c.parent_category_id = p.id
  );

-- 3. Home & Living
INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Mattresses', 'Mattresses and bedding', p.id, true, 2
FROM public.categories p
WHERE p.name = 'Home & Living' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Mattresses' AND c.parent_category_id = p.id
  );

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Kitchen items', 'Pots, cookware and kitchen tools', p.id, true, 3
FROM public.categories p
WHERE p.name = 'Home & Living' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Kitchen items' AND c.parent_category_id = p.id
  );

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Home appliances', 'Fans, kettles, irons and appliances', p.id, true, 4
FROM public.categories p
WHERE p.name = 'Home & Living' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Home appliances' AND c.parent_category_id = p.id
  );

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Other household products', 'Other items for the home', p.id, true, 5
FROM public.categories p
WHERE p.name = 'Home & Living' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Other household products' AND c.parent_category_id = p.id
  );

-- 4. Beauty & Personal Care
INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Skincare', 'Creams, lotions and skincare', p.id, true, 1
FROM public.categories p
WHERE p.name = 'Beauty & Personal Care' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Skincare' AND c.parent_category_id = p.id
  );

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Haircare', 'Hair products and accessories', p.id, true, 2
FROM public.categories p
WHERE p.name = 'Beauty & Personal Care' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Haircare' AND c.parent_category_id = p.id
  );

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Fragrances', 'Perfumes and body sprays', p.id, true, 3
FROM public.categories p
WHERE p.name = 'Beauty & Personal Care' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Fragrances' AND c.parent_category_id = p.id
  );

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Personal care products', 'Everyday personal care items', p.id, true, 4
FROM public.categories p
WHERE p.name = 'Beauty & Personal Care' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Personal care products' AND c.parent_category_id = p.id
  );

-- 5. Books & Education
INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Textbooks', 'Course textbooks and past questions', p.id, true, 1
FROM public.categories p
WHERE p.name = 'Books & Education' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Textbooks' AND c.parent_category_id = p.id
  );

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Educational materials', 'Study guides and learning materials', p.id, true, 2
FROM public.categories p
WHERE p.name = 'Books & Education' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Educational materials' AND c.parent_category_id = p.id
  );

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Stationery', 'Pens, notebooks and supplies', p.id, true, 3
FROM public.categories p
WHERE p.name = 'Books & Education' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Stationery' AND c.parent_category_id = p.id
  );

-- 6. Food & Groceries
INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Food', 'Meals and snacks', p.id, true, 1
FROM public.categories p
WHERE p.name = 'Food & Groceries' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Food' AND c.parent_category_id = p.id
  );

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Drinks', 'Bottled and prepared drinks', p.id, true, 2
FROM public.categories p
WHERE p.name = 'Food & Groceries' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Drinks' AND c.parent_category_id = p.id
  );

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Groceries', 'Groceries and provisions', p.id, true, 3
FROM public.categories p
WHERE p.name = 'Food & Groceries' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Groceries' AND c.parent_category_id = p.id
  );

-- 7. Sports & Fitness
INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Sportswear', 'Jerseys, shorts and sportswear', p.id, true, 1
FROM public.categories p
WHERE p.name = 'Sports & Fitness' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Sportswear' AND c.parent_category_id = p.id
  );

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Sports equipment', 'Balls, rackets and sports gear', p.id, true, 2
FROM public.categories p
WHERE p.name = 'Sports & Fitness' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Sports equipment' AND c.parent_category_id = p.id
  );

INSERT INTO public.categories (name, description, parent_category_id, is_active, sort_order)
SELECT 'Fitness accessories', 'Dumbbells, bands and fitness gear', p.id, true, 3
FROM public.categories p
WHERE p.name = 'Sports & Fitness' AND p.parent_category_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.name = 'Fitness accessories' AND c.parent_category_id = p.id
  );

-- ----------------------------------------------------------------------------
-- PART E — VERIFICATION (read-only, run after the transaction commits)
-- ----------------------------------------------------------------------------
-- SELECT name AS top_level, sort_order FROM public.categories
-- WHERE parent_category_id IS NULL AND is_active ORDER BY sort_order;
-- -- Expect exactly 8 rows in the order: Fashion & Accessories,
-- -- Electronics & Gadgets, Home & Living, Beauty & Personal Care,
-- -- Books & Education, Food & Groceries, Sports & Fitness, Other
--
-- SELECT p.name AS parent, count(c.id) AS children FROM public.categories c
-- JOIN public.categories p ON p.id = c.parent_category_id
-- GROUP BY p.name ORDER BY p.name;
-- -- Expect: Fashion & Accessories 5, Electronics & Gadgets 5,
-- --         Home & Living 5, Beauty & Personal Care 4,
-- --         Books & Education 3, Food & Groceries 3, Sports & Fitness 3
--
-- SELECT count(*) FROM public.products;  -- must be UNCHANGED (2 today)
-- SELECT c.name, count(prod.id) FROM public.categories c
-- LEFT JOIN public.products prod ON prod.category_id = c.id
-- GROUP BY c.name;  -- every product still counts exactly once
--
-- Frontend check after running: category chips reload as the 8 top-level
-- rows; "Shoes & Footwear" appears as a sub-chip under Fashion & Accessories;
-- filtering "Fashion & Accessories" includes the Trainers offers (IN query).
-- ============================================================================
