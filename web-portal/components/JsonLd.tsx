import { getBusinessInfo } from '@/lib/businessInfo';

export async function LocalBusinessJsonLd() {
  const info = await getBusinessInfo();

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': 'https://yourdomain.com/#business',
    name: info.business_name,
    description: 'Tienda de uniformes escolares en Medellin. Catalogo por colegio con precios, tallas y pedidos online.',
    url: 'https://yourdomain.com',
    telephone: info.phone_main,
    email: info.email_contact,
    image: 'https://yourdomain.com/logo.png',
    address: {
      '@type': 'PostalAddress',
      streetAddress: info.address_line1,
      addressLocality: info.city,
      addressRegion: info.state,
      addressCountry: 'CO',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 6.2518,
      longitude: -75.5636,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '08:00',
        closes: '18:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Saturday',
        opens: '09:00',
        closes: '14:00',
      },
    ],
    priceRange: '$$',
    currenciesAccepted: 'COP',
    paymentAccepted: 'Efectivo, Nequi, Transferencia, Tarjeta',
    areaServed: {
      '@type': 'City',
      name: 'Medellin',
      '@id': 'https://www.wikidata.org/wiki/Q48278',
    },
  };

  // JSON-LD is the standard way to add structured data in Next.js
  // Content is JSON.stringify of server-generated data, not user input
  const jsonLdString = JSON.stringify(schema);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdString }}
    />
  );
}

interface ProductJsonLdProps {
  schoolName: string;
  products: Array<{
    name: string;
    price: number;
    garment_type_images?: Array<{ image_url: string }>;
  }>;
}

export function ProductListJsonLd({ schoolName, products }: ProductJsonLdProps) {
  const items = products.slice(0, 20).map((product) => ({
    '@type': 'Product',
    name: `${product.name} — ${schoolName}`,
    description: `${product.name} uniforme escolar para ${schoolName} en Medellin`,
    image: product.garment_type_images?.[0]?.image_url || 'https://yourdomain.com/logo.png',
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'COP',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'LocalBusiness',
        '@id': 'https://yourdomain.com/#business',
      },
    },
  }));

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Uniformes escolares para ${schoolName}`,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item,
    })),
  };

  const jsonLdString = JSON.stringify(schema);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdString }}
    />
  );
}
