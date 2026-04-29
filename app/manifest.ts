import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kairos',
    short_name: 'Kairos',
    description: 'AI-native scheduling and task management',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#0f1011',
    theme_color: '#0f1011',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    categories: ['productivity', 'utilities'],
  };
}
