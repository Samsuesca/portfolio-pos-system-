import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/mi-cuenta', '/pago', '/registro', '/recuperar-password'],
      },
    ],
    sitemap: 'https://yourdomain.com/sitemap.xml',
  };
}
