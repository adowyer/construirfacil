// ─────────────────────────────────────────────────────────────────────────────
// app/page.tsx  (or wherever your HomePage lives)
// ─────────────────────────────────────────────────────────────────────────────
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getPublishedModels } from '@/lib/supabase/queries/models'
import {
  getHouseImagesByVariantCodes,
  buildStorageUrl,
} from '@/lib/supabase/queries/house_images'
import CatalogPage from '@/components/catalog/CatalogPage'
import { MOCK_HOUSES } from '@/lib/supabase/mock-data'

const mappedMockHouses = MOCK_HOUSES.map((m: any) => ({
  ...m,
  variant_code: m.slug,
  area_m2: m.total_area_m2,
  min_bedrooms: m.bedrooms,
  max_bedrooms: m.bedrooms,
  beds: String(m.bedrooms),
  recommended_use: m.description,
  construction_system: m.construction_system?.name ?? null,
  public_price_usd: m.price_lista_usd ?? m.price_from_usd,
  brochure_url: null,
})) as any

export const metadata: Metadata = {
  title: 'Catálogo de modelos — ConstruirFácil',
  description: 'Explorá modelos de casas en Steel Frame y Wood Frame de constructoras verificadas en Argentina.',
}

export const revalidate = 60

// Legacy cover map — kept as fallback while you migrate photos to Supabase Storage
const B = 'https://posadasalrio.construirfacil.com/wp-content/uploads/2025/11/'
const COVER_IMAGE_MAP: Record<string, string> = {
  HPR02_1_I: B + 'living-t2.png',
  HPR01_2_I: B + 'Estilo-2-6.png',
  HPR03_1_I: B + 'casa3_opc1_2_posadas_PBjpg.jpg',
  HPR01_3_I: B + 'Image-from-Google-Drive-1-1-2.png',
  HPR01_1_II: B + 'Interiores-Typologia-1-IMG2-2-e1764112587890.png',
  HPR02_3_II: B + 'R-2-PLANTAS-D3.1.jpg',
  HPR03_3_I: B + '3opc2_PB_posadas.png',
  HPR02_2_II: B + 'R-2-PLANTAS-D-2.4.jpg',
  HPR02_1_II: B + 'R-2-PLANTAS-D1.2-1.jpg',
  HPR01_3_II: B + 'Image-from-Google-Drive-2-2.png',
  HPR02_3_I: B + 'R-1-PLANTA-D3.1.jpg',
  HPR01_1_I: B + 'Image-from-Google-Drive-4.png',
  HPR03_3_II: B + 'casa_opc3_1_posadas-2.jpg',
  HPR03_2_II: B + '3OPC2_2_posadas-2.png',
  HPR01_2_II: B + 'Image-from-Google-Drive-1-3.png',
  HPR03_1_II: B + 'casa3_opc1_2_posadas-2-1.jpg',
  HPR02_2_I: B + 'living-t2.png',
  HPR03_2_I: B + '3opc2_PB_posadas.png',
}

export default async function HomePage() {
  try {
    const supabase = await createClient()
    const houses = await getPublishedModels(supabase)

    if (!houses.length) {
      return <CatalogPage houses={mappedMockHouses} />
    }

    // 1. Fetch all images for these models in one query
    const variantCodes = houses.map((h: { variant_code: string }) => h.variant_code).filter(Boolean)
    const imagesByVariant = await getHouseImagesByVariantCodes(supabase, variantCodes)

    // 2. Normalize each house, injecting gallery_images when present
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalized = houses.map((h: any) => {
      const galleryImgs = imagesByVariant[h.variant_code] ?? []

      const gallery_images = galleryImgs.map(img => ({
        storage_url: buildStorageUrl(supabase, img.storage_path),
        alt_text: img.alt_text,
      }))

      // Cover: first gallery image → fallback to legacy map → fallback to null
      const legacyCover = COVER_IMAGE_MAP[h.variant_code] ?? null
      const cover_image =
        gallery_images[0]
          ? { storage_url: gallery_images[0].storage_url, alt_text: gallery_images[0].alt_text }
          : h.cover_image
            ? h.cover_image
            : legacyCover
              ? { storage_url: legacyCover, alt_text: h.name }
              : null

      // LQIP: use the first gallery image's color if present, else deterministic fallback
      const lqip_color = galleryImgs[0]?.lqip_color ?? getLqipColor(h.id ?? h.variant_code ?? h.name)

      return {
        ...h,
        slug: h.variant_code,
        beds: h.min_bedrooms === h.max_bedrooms || !h.max_bedrooms
          ? String(h.min_bedrooms ?? '–')
          : `${h.min_bedrooms}–${h.max_bedrooms}`,
        price_pozo_usd: h.public_price_usd
          ? h.public_price_usd * (1 - (h.presale_discount_pct ?? 0) / 100)
          : null,
        cover_image,
        gallery_images,                            // ← array of {storage_url, alt_text}, empty if none
        gradient_key: getGradientKey(h.id ?? h.variant_code ?? h.name),
        lqip_color,
        tags: [h.variant_style, h.recommended_use].filter(Boolean),
      }
    })

    return <CatalogPage houses={normalized} />
  } catch (err) {
    console.error('[HomePage]', err)
    return <CatalogPage houses={mappedMockHouses} />
  }
}

const GRADIENT_KEYS = [
  'ph-timbo2', 'ph-cedro1', 'ph-cedro2', 'ph-roble3',
  'ph-alamo1', 'ph-pino4', 'ph-sauce1', 'ph-nogal2',
  'ph-eucalip3', 'ph-jacar1', 'ph-quebr2', 'ph-lapach1',
]

const LQIP_PALETTE = [
  '#1c2d1a', '#0d1f35', '#2a1f3d', '#3a1a0a',
  '#2a2620', '#0c1f18', '#0a1c28', '#281a08',
  '#1a1e1a', '#1e0c0c', '#0e0e2a', '#1a2010',
]

function hashId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (Math.imul(31, hash) + id.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getGradientKey(id: string): string {
  return GRADIENT_KEYS[hashId(id) % GRADIENT_KEYS.length]
}

function getLqipColor(id: string): string {
  return LQIP_PALETTE[hashId(id) % LQIP_PALETTE.length]
}
