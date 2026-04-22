'use client'

// ─────────────────────────────────────────────────────────────────────────────
// components/admin/HouseImageUploader.tsx
//
// Drop this into your /admin page. Lets authenticated users select a model,
// upload multiple photos, reorder them, and delete.
//
// Usage inside an /admin page component:
//   <HouseImageUploader variantCodes={['HPR02_1_I', 'HPR01_2_I', ...]} />
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type DbImage = {
  id: string
  variant_code: string
  storage_path: string
  alt_text: string | null
  order_idx: number
  lqip_color: string | null
}

type ImageWithUrl = DbImage & { publicUrl: string }

export default function HouseImageUploader({
  variantCodes,
}: {
  variantCodes: string[]
}) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [selectedCode, setSelectedCode] = useState<string>(variantCodes[0] ?? '')
  const [images, setImages] = useState<ImageWithUrl[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load images for the selected model
  const loadImages = useCallback(async (code: string) => {
    setError(null)
    const { data, error } = await supabase
      .from('house_images')
      .select('id, variant_code, storage_path, alt_text, order_idx, lqip_color')
      .eq('variant_code', code)
      .order('order_idx', { ascending: true })

    if (error) {
      setError(error.message)
      setImages([])
      return
    }

    const withUrls: ImageWithUrl[] = (data ?? []).map(img => ({
      ...img,
      publicUrl: supabase.storage.from('house-photos').getPublicUrl(img.storage_path).data.publicUrl,
    }))
    setImages(withUrls)
  }, [supabase])

  useEffect(() => {
    if (selectedCode) loadImages(selectedCode)
  }, [selectedCode, loadImages])

  // Handle file input
  const handleUpload = async (files: FileList | null) => {
    if (!files || !selectedCode) return
    setUploading(true)
    setError(null)
    setProgress({ done: 0, total: files.length })

    try {
      // Next order_idx
      const maxOrder = images.reduce((m, i) => Math.max(m, i.order_idx), -1)

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const filename = `${Date.now()}_${i}.${ext}`
        const path = `${selectedCode}/${filename}`

        // 1. Upload to Storage
        const { error: upErr } = await supabase.storage
          .from('house-photos')
          .upload(path, file, { upsert: false, contentType: file.type })

        if (upErr) throw new Error(`Upload falló: ${upErr.message}`)

        // 2. Insert DB row
        const { error: dbErr } = await supabase.from('house_images').insert({
          variant_code: selectedCode,
          storage_path: path,
          alt_text: file.name,
          order_idx: maxOrder + 1 + i,
        })

        if (dbErr) throw new Error(`DB insert falló: ${dbErr.message}`)

        setProgress({ done: i + 1, total: files.length })
      }

      await loadImages(selectedCode)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setUploading(false)
      setProgress(null)
    }
  }

  // Delete image (both DB row and Storage file)
  const handleDelete = async (img: ImageWithUrl) => {
    if (!confirm(`¿Eliminar ${img.storage_path}? Esta acción no se puede deshacer.`)) return

    const { error: storageErr } = await supabase.storage
      .from('house-photos')
      .remove([img.storage_path])
    if (storageErr) { setError(storageErr.message); return }

    const { error: dbErr } = await supabase.from('house_images').delete().eq('id', img.id)
    if (dbErr) { setError(dbErr.message); return }

    await loadImages(selectedCode)
  }

  // Move image up/down in order
  const handleReorder = async (img: ImageWithUrl, direction: 'up' | 'down') => {
    const currentIdx = images.findIndex(i => i.id === img.id)
    const swapIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1
    if (swapIdx < 0 || swapIdx >= images.length) return

    const swap = images[swapIdx]

    // Swap order_idx between the two in the DB
    await supabase.from('house_images').update({ order_idx: swap.order_idx }).eq('id', img.id)
    await supabase.from('house_images').update({ order_idx: img.order_idx }).eq('id', swap.id)

    await loadImages(selectedCode)
  }

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Fotos por modelo</h2>

      {/* Model picker */}
      <div style={styles.picker}>
        <label style={styles.label}>Modelo</label>
        <select
          value={selectedCode}
          onChange={e => setSelectedCode(e.target.value)}
          style={styles.select}
        >
          {variantCodes.map(code => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
      </div>

      {/* Uploader */}
      <div style={styles.uploader}>
        <label style={{ ...styles.uploadBtn, opacity: uploading ? 0.5 : 1 }}>
          {uploading
            ? `Subiendo ${progress?.done ?? 0}/${progress?.total ?? 0}…`
            : 'Seleccionar fotos'}
          <input
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            disabled={uploading}
            onChange={e => handleUpload(e.target.files)}
          />
        </label>
        <span style={styles.hint}>
          Se guardan en <code>house-photos/{selectedCode}/</code> y aparecen en el orden en que las subís.
        </span>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* Image grid */}
      <div style={styles.grid}>
        {images.length === 0 && (
          <div style={styles.empty}>
            Todavía no hay fotos para <strong>{selectedCode}</strong>.
          </div>
        )}
        {images.map((img, idx) => (
          <div key={img.id} style={styles.card}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.publicUrl} alt={img.alt_text ?? ''} style={styles.thumb} />
            <div style={styles.cardBody}>
              <div style={styles.orderRow}>
                <button
                  onClick={() => handleReorder(img, 'up')}
                  disabled={idx === 0}
                  style={styles.orderBtn}
                  title="Subir"
                >↑</button>
                <span style={styles.orderIdx}>#{img.order_idx}</span>
                <button
                  onClick={() => handleReorder(img, 'down')}
                  disabled={idx === images.length - 1}
                  style={styles.orderBtn}
                  title="Bajar"
                >↓</button>
                <button
                  onClick={() => handleDelete(img)}
                  style={{ ...styles.orderBtn, marginLeft: 'auto', color: '#c00' }}
                  title="Eliminar"
                >×</button>
              </div>
              <div style={styles.path}>{img.storage_path.split('/').pop()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap:      { maxWidth: 1100, margin: '0 auto', padding: 32, fontFamily: 'Geist, system-ui, sans-serif' },
  title:     { fontSize: 20, fontWeight: 500, marginBottom: 24, letterSpacing: '-0.02em' },
  picker:    { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  label:     { fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#999' },
  select:    { padding: '8px 12px', fontSize: 14, border: '1px solid #e0e0e0', borderRadius: 6, fontFamily: 'inherit', minWidth: 200 },
  uploader:  { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: 20, border: '1px dashed #d0d0d0', borderRadius: 8, background: '#fafafa' },
  uploadBtn: { display: 'inline-flex', alignItems: 'center', padding: '10px 20px', background: '#0a0a0a', color: '#fff', fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 100, cursor: 'pointer', userSelect: 'none' },
  hint:      { fontSize: 12, color: '#888' },
  error:     { padding: 12, background: '#fee', color: '#c00', fontSize: 13, borderRadius: 6, marginBottom: 16 },
  grid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 },
  empty:     { gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: '#999', fontSize: 13 },
  card:      { border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden', background: '#fff' },
  thumb:     { width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' },
  cardBody:  { padding: 10 },
  orderRow:  { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
  orderBtn:  { width: 26, height: 26, border: '1px solid #e0e0e0', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' },
  orderIdx:  { fontSize: 11, color: '#888', fontWeight: 500 },
  path:      { fontSize: 10, color: '#aaa', fontFamily: 'ui-monospace, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
}
