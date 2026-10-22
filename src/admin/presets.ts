// Compression presets (kept separate so the dashboard can show them without loading pdf.js).
export type Preset = 'original' | 'balanced' | 'document' | 'smallest';
export const PRESETS: Record<Exclude<Preset, 'original'>, { label: string; hint: string; maxSide: number; quality: number; clean: boolean }> = {
  balanced: { label: 'Balanced', hint: 'Keeps colour. Good for photos and covers.', maxSide: 2000, quality: 0.72, clean: false },
  document: { label: 'Clean document', hint: 'Black text on white paper. Best for scanned pages.', maxSide: 1800, quality: 0.6, clean: true },
  smallest: { label: 'Smallest', hint: 'Lower resolution. For very long books.', maxSide: 1300, quality: 0.5, clean: true },
};

