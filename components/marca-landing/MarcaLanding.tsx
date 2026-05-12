/**
 * components/marca-landing/MarcaLanding.tsx
 *
 * Orquestador de la landing rica de marca. Renderiza solo las secciones
 * que el contenido define (todas son opcionales en MarcaLandingContent).
 */

import type { MarcaLandingContent } from '@/lib/content/marca-landing/types'
import type { CatalogModel } from '@/lib/supabase/queries/catalog_grouped'
import type { Marca } from '@/types/database'
import Hero from './Hero'
import Manifesto from './Manifesto'
import System from './System'
import Features from './Features'
import Video from './Video'
import VideoStory from './VideoStory'
import Solutions from './Solutions'
import Lineas from './Lineas'
import Featured from './Featured'
import Closeout from './Closeout'
import styles from './landing.module.css'

interface MarcaLandingProps {
  marca: Marca
  content: MarcaLandingContent
  featuredModels: CatalogModel[]
}

export default function MarcaLanding({
  marca,
  content,
  featuredModels,
}: MarcaLandingProps) {
  return (
    <main className={styles.root} data-marca={marca.slug}>
      {content.hero && <Hero content={content.hero} />}
      {content.manifesto && <Manifesto content={content.manifesto} />}
      {content.features && <Features content={content.features} />}
      {content.system && <System content={content.system} />}
      {content.video &&
        (content.video.story ? (
          <VideoStory content={content.video} />
        ) : (
          <Video content={content.video} />
        ))}
      {content.solutions && (
        <Solutions content={content.solutions} models={featuredModels} />
      )}
      {content.lineas && <Lineas content={content.lineas} />}
      {content.featured && (
        <Featured content={content.featured} models={featuredModels} />
      )}
      {content.closeout && <Closeout content={content.closeout} />}
    </main>
  )
}
