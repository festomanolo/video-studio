// Photo rig for the owner's avatar. Source: assets/avatar-src (collage of 4 selfies), backgrounds
// removed with Apple Vision (scripts/cutout.swift) + white sticker outline, copied to studio/public/avatar/. Coordinates are pixels in each PNG.
//  lipL / lipR / lipMid: the line where the lips meet (the jaw is cut along it)
//  chin: bottom of the chin; maxOpen: jaw drop at full loudness.

export type Mood = 'smile' | 'grin' | 'serious' | 'angry';

export type Rig = {
  src: string;
  w: number;
  h: number;
  lipL: [number, number];
  lipR: [number, number];
  lipMid: [number, number];
  chin: number;
  maxOpen: number;
};

export const RIG: Record<Mood, Rig> = {
  smile: { src: 'avatar/1-smile.png', w: 603, h: 859, lipL: [272, 390], lipR: [377, 372], lipMid: [325, 392], chin: 467, maxOpen: 22 },
  grin: { src: 'avatar/2-grin.png', w: 656, h: 864, lipL: [285, 358], lipR: [383, 350], lipMid: [333, 368], chin: 445, maxOpen: 16 },
  serious: { src: 'avatar/3-serious.png', w: 589, h: 860, lipL: [275, 431], lipR: [385, 425], lipMid: [330, 436], chin: 490, maxOpen: 22 },
  angry: { src: 'avatar/4-angry.png', w: 652, h: 856, lipL: [300, 405], lipR: [392, 395], lipMid: [348, 420], chin: 480, maxOpen: 14 },
};
