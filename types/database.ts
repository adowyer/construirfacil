// =============================================================================
// ConstruirFácil — Database types
// Keep in sync with supabase/migrations/0001_initial_schema.sql
// For full type safety, run: npx supabase gen types typescript --local > types/supabase.ts
// =============================================================================

export type UserRole = 'admin' | 'constructora_owner' | 'buyer'

export type ConstructoraStatus = 'pending' | 'approved' | 'rejected'

export type HouseModelStatus = 'draft' | 'pending_review' | 'published' | 'rejected'

// ---------------------------------------------------------------------------
// Row types (what comes out of the DB)
// ---------------------------------------------------------------------------

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  created_at: string
}

export interface ConstructionSystem {
  id: string
  name: string
  slug: string
  sort_order: number
  created_at: string
}

export interface Constructora {
  id: string
  owner_id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  website_url: string | null
  phone: string | null
  city: string | null
  province: string | null
  status: ConstructoraStatus
  rejection_reason: string | null
  approved_at: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
}

export interface AttributeType {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  created_at: string
}

export interface AttributeValue {
  id: string
  attribute_type_id: string
  label: string
  sort_order: number
  created_at: string
}

export interface HouseModel {
  id: string
  constructora_id: string
  name: string
  slug: string
  description: string | null
  construction_system_id: string | null
  bedrooms: number
  bathrooms: number
  total_area_m2: number
  covered_area_m2: number | null
  lot_area_m2: number | null
  garage_spaces: number | null
  price_from_ars: number | null
  price_from_usd: number | null
  status: HouseModelStatus
  rejection_reason: string | null
  published_at: string | null
  reviewed_by: string | null
  created_at: string
  updated_at: string
}

export interface HouseModelAttribute {
  id: string
  house_model_id: string
  attribute_value_id: string
}

export interface HouseModelImage {
  id: string
  house_model_id: string
  storage_url: string
  alt_text: string
  is_cover: boolean
  sort_order: number
  created_at: string
}

export interface HouseModelFloorPlan {
  id: string
  house_model_id: string
  storage_url: string
  label: string
  sort_order: number
  created_at: string
}

// ---------------------------------------------------------------------------
// Insert types (what you send to the DB)
// ---------------------------------------------------------------------------

export type InsertConstructora = Omit<
  Constructora,
  'id' | 'created_at' | 'updated_at' | 'approved_at' | 'approved_by' | 'rejection_reason'
> & {
  status?: ConstructoraStatus
}

export type InsertHouseModel = Omit<
  HouseModel,
  'id' | 'created_at' | 'updated_at' | 'published_at' | 'reviewed_by' | 'rejection_reason'
> & {
  status?: HouseModelStatus
}

// ---------------------------------------------------------------------------
// Joined / enriched types used in the UI
// ---------------------------------------------------------------------------

export interface HouseModelWithConstructora extends HouseModel {
  constructora: Pick<Constructora, 'id' | 'name' | 'slug' | 'logo_url' | 'city' | 'province'>
  construction_system: Pick<ConstructionSystem, 'id' | 'name' | 'slug'> | null
  cover_image: Pick<HouseModelImage, 'storage_url' | 'alt_text'> | null
}

export interface HouseModelAttributeWithValue {
  id: string
  house_model_id: string
  attribute_value_id: string
  attribute_value: AttributeValue & { attribute_type: AttributeType }
}

export interface HouseModelDetail extends HouseModel {
  constructora: Constructora
  construction_system: ConstructionSystem | null
  images: HouseModelImage[]
  floor_plans: HouseModelFloorPlan[]
  attributes: HouseModelAttributeWithValue[]
}

export interface AttributeTypeWithValues extends AttributeType {
  attribute_values: AttributeValue[]
}

// ---------------------------------------------------------------------------
// Filter types for the public catalog
// ---------------------------------------------------------------------------

export interface CatalogFilters {
  construction_system_slug?: string
  bedrooms?: number
  price_min_usd?: number
  price_max_usd?: number
  province?: string
}
