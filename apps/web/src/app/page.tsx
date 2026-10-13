import { BarbersSection } from '@/components/landing/BarbersSection'
import { ContactsSection } from '@/components/landing/ContactsSection'
import { Footer } from '@/components/landing/Footer'
import { GallerySection } from '@/components/landing/GallerySection'
import { Header } from '@/components/landing/Header'
import { Hero } from '@/components/landing/Hero'
import { ReviewsSection } from '@/components/landing/ReviewsSection'
import { ServicesSection } from '@/components/landing/ServicesSection'
import { SmoothScroll } from '@/components/landing/SmoothScroll'
import { loadCatalog, loadPublicReviews } from '@/lib/catalog'

/** Услуги, барберы и отзывы — из API (кеш 60 с); без API — демо-данные. */
export default async function HomePage() {
  const [catalog, { reviews }] = await Promise.all([loadCatalog(), loadPublicReviews()])

  return (
    <SmoothScroll>
      {/* .landing — тёмная тема главной (globals.css); /book и /admin её не используют. */}
      <div className="landing">
        <Header />
        <main>
          <Hero barbers={catalog.barbers} />
          <ServicesSection services={catalog.services} />
          <BarbersSection barbers={catalog.barbers} />
          <GallerySection barbers={catalog.barbers} />
          <ReviewsSection reviews={reviews} />
          <ContactsSection />
        </main>
        <Footer />
      </div>
    </SmoothScroll>
  )
}
