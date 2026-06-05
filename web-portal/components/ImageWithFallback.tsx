'use client';

import { useState } from 'react';
import Image, { type ImageProps } from 'next/image';

interface ImageWithFallbackProps extends Omit<ImageProps, 'onError'> {
  fallback?: React.ReactNode;
}

export default function ImageWithFallback({ fallback, ...props }: ImageWithFallbackProps) {
  const [error, setError] = useState(false);

  if (error) {
    return <>{fallback}</>;
  }

  return <Image {...props} onError={() => setError(true)} />;
}
