import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getPublishedModels } from '@/lib/supabase/queries/models'
import {
  getHouseImagesByVariantCodes,
  buildStorageUrl,
} from '@/lib/supabase/queries/house_images'
import CatalogPage from '@/components/catalog/CatalogPage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ConstruirFácil',
  description: 'La casa que queres, al precio que necesitás. Construir nunca fue tan fácil.',
}

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
  console.log('[DEBUG] HomePage start')
  try {
    console.log('[DEBUG] creating client')
    const supabase = await createClient()
    console.log('[DEBUG] client created')
    const houses = await getPublishedModels(supabase)
    console.log('[DEBUG] houses count:', houses.length)

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
      const lqip_color = galleryImgs[0]?.lqip_color ?? '#1c2d1a'

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
        lqip_color,
        tags: [h.variant_style, h.recommended_use].filter(Boolean),
      }
    })

    return <CatalogPage houses={normalized} />
  } catch (err) {
    console.error('[HomePage]', err)
    return <CatalogPage houses={[]} />
  }
}