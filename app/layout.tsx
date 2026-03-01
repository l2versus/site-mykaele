import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://mykaprocopio.com.br'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#b76e79',
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Mykaele Procópio | Estética Avançada & Arquitetura Corporal em Fortaleza',
    template: '%s | Mykaele Procópio Home Spa',
  },
  description: 'Fisioterapeuta Dermatofuncional especializada em Arquitetura Corporal. Protocolos personalizados, resultados reais. Atendimento premium em Fortaleza-CE e domicílio (Home Spa). Agende online.',
  keywords: [
    'estética avançada fortaleza', 'arquitetura corporal', 'fisioterapeuta dermatofuncional',
    'home spa fortaleza', 'drenagem linfática', 'limpeza de pele', 'peeling',
    'microagulhamento', 'tratamento facial', 'massagem modeladora', 'gordura localizada',
    'mykaele procópio', 'estética sapiranga', 'procedimento estético fortaleza',
    'antes e depois estética', 'protocolo corporal personalizado',
  ],
  authors: [{ name: 'Mykaele Procópio', url: SITE_URL }],
  creator: 'Mykaele Procópio Home Spa',
  publisher: 'Mykaele Procópio Home Spa',
  formatDetection: { telephone: true, email: true },
  // Open Graph
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: 'Mykaele Procópio Home Spa',
    title: 'Mykaele Procópio | Estética Avançada & Arquitetura Corporal',
    description: 'Protocolos personalizados de estética avançada com resultados reais. Fisioterapeuta Dermatofuncional em Fortaleza. Agende online.',
    images: [
      {
        url: `${SITE_URL}/media/logo-branding/logocorreta.png`,
        width: 1200,
        height: 630,
        alt: 'Mykaele Procópio Home Spa - Estética Avançada',
      },
    ],
  },
  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'Mykaele Procópio | Estética Avançada',
    description: 'Arquitetura Corporal e Estética Premium em Fortaleza. Resultados reais, protocolos personalizados.',
    images: [`${SITE_URL}/media/logo-branding/logocorreta.png`],
  },
  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Alternates
  alternates: {
    canonical: SITE_URL,
  },
  // Verification (adicionar IDs reais depois)
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || '',
    // other: { 'facebook-domain-verification': process.env.FB_DOMAIN_VERIFICATION || '' },
  },
};

// JSON-LD Structured Data
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HealthAndBeautyBusiness',
  name: 'Mykaele Procópio Home Spa',
  alternateName: 'Mykaele Procópio Estética Avançada',
  description: 'Fisioterapeuta Dermatofuncional especializada em Arquitetura Corporal. Protocolos personalizados de estética avançada com tecnologia de ponta.',
  url: SITE_URL,
  logo: `${SITE_URL}/media/logo-branding/logocorreta.png`,
  image: `${SITE_URL}/media/logo-branding/logocorreta.png`,
  telephone: '+5585999086924',
  email: 'contato@mykaprocopio.com.br',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Rua Francisco Martiniano Barbosa, 888',
    addressLocality: 'Fortaleza',
    addressRegion: 'CE',
    postalCode: '60833-010',
    addressCountry: 'BR',
    neighborhood: 'Sapiranga',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: -3.7994,
    longitude: -38.4768,
  },
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], opens: '08:00', closes: '19:00' },
  ],
  priceRange: 'R$80 - R$500',
  currenciesAccepted: 'BRL',
  paymentAccepted: 'Cash, Credit Card, PIX',
  areaServed: {
    '@type': 'City',
    name: 'Fortaleza',
    '@id': 'https://www.wikidata.org/wiki/Q171453',
  },
  sameAs: [
    'https://www.instagram.com/mykaeleprocopio',
  ],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Serviços de Estética',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Arquitetura Corporal', description: 'Protocolo personalizado de remodelagem corporal' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Drenagem Linfática', description: 'Drenagem manual e mecânica para redução de medidas' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Tratamento Facial', description: 'Limpeza, peeling e microagulhamento facial' } },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const GA_ID = process.env.NEXT_PUBLIC_GA4_ID
  const FB_PIXEL = process.env.NEXT_PUBLIC_FB_PIXEL_ID

  return (
    <html lang="pt-BR" className="scroll-smooth">
      <head>
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Myka Spa" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#b76e79" />
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} antialiased bg-[#faf9f7] text-[#1a1a1a]`}
      >
        {/* Fix scroll - fallback wheel handler */}
        <Script id="scroll-fix" strategy="afterInteractive">
          {`(function(){
            var lastY = window.pageYOffset;
            document.addEventListener('wheel', function(e) {
              setTimeout(function() {
                // If scroll didn't happen naturally, force it
                if (window.pageYOffset === lastY && !e.defaultPrevented) {
                  window.scrollBy(0, e.deltaY);
                }
                lastY = window.pageYOffset;
              }, 10);
            }, { passive: true });
          })();`}
        </Script>
        {children}
        <ClientProviders />

        {/* Google Analytics 4 */}
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}',{page_path:window.location.pathname});`}
            </Script>
          </>
        )}

        {/* Meta Pixel (Facebook/Instagram) */}
        {FB_PIXEL && (
          <Script id="fb-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${FB_PIXEL}');fbq('track','PageView');`}
          </Script>
        )}
      </body>
    </html>
  );
}
