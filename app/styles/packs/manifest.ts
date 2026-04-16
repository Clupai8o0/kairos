// Static registry of built-in theme packs.
// New built-ins: add the CSS file to this directory and append an entry here.

export interface BuiltInPack {
  id: string;
  name: string;
  description: string;
  colorScheme: 'light' | 'dark';
  preview: {
    canvas: string;
    surface: string;
    fg: string;
    accent: string;
  };
}

export const BUILT_IN_PACKS: BuiltInPack[] = [
  {
    id: 'obsidian-linear',
    name: 'Obsidian Linear',
    description: 'Dark, dense UI inspired by Linear — the default.',
    colorScheme: 'dark',
    preview: {
      canvas: '#08090a',
      surface: '#0f1011',
      fg: '#f7f8f8',
      accent: '#7170ff',
    },
  },
  {
    id: 'morning-light',
    name: 'Morning Light',
    description: 'Clean paper-white light theme with indigo accents.',
    colorScheme: 'light',
    preview: {
      canvas: '#f0f1f2',
      surface: '#ffffff',
      fg: '#111112',
      accent: '#5b5bd6',
    },
  },
];

export const DEFAULT_PACK_ID = 'obsidian-linear';
