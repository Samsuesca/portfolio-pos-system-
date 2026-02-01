import { notFound } from 'next/navigation';
import { ReactNode } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface School {
  id: string;
  name: string;
  slug: string;
}

async function validateSchool(slug: string): Promise<School | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/schools/slug/${slug}`, {
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!res.ok) {
      return null;
    }

    return res.json();
  } catch (error) {
    console.error('Error validating school:', error);
    return null;
  }
}

interface SchoolLayoutProps {
  children: ReactNode;
  params: Promise<{ school_slug: string }>;
}

export default async function SchoolLayout({ children, params }: SchoolLayoutProps) {
  const { school_slug } = await params;
  const school = await validateSchool(school_slug);

  if (!school) {
    notFound();
  }

  return <>{children}</>;
}
