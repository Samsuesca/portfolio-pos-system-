import type { MetadataRoute } from 'next';
import { fetchSchools } from '@/lib/serverApi';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const schools = await fetchSchools();

  const schoolUrls: MetadataRoute.Sitemap = schools.map((school) => ({
    url: `https://yourdomain.com/${school.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [
    {
      url: 'https://yourdomain.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://yourdomain.com/soporte',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: 'https://yourdomain.com/encargos-personalizados',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    ...schoolUrls,
  ];
}
