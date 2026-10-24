/**
 * Sample data for v1 (no backend yet).
 *
 * This module is the boundary between the app and any future backend:
 * `src/lib/catalog.ts` is the only file allowed to import from here.
 * When Supabase integration is finalized, this file is deleted/reduced
 * and catalog.ts is reimplemented against the real API.
 */

export { CAMPUSES } from './campuses'
export { PRODUCTS } from './products'
