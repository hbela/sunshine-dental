/**
 * Per-language copy for the fixed brand scenes (intro / hero / outro).
 * Browser-safe: imported by Remotion components, so no Node APIs or env here —
 * the active language arrives as a prop from the render/studio scripts.
 */

export type OutroLine = { text: string; start: number; size: number; weight: number };

export type BrandText = {
  tagline: string;
  features: string[];
  hero: { title: string; subtitle: string };
  outroLines: OutroLine[];
  /** Brand-scene lengths in seconds, sized to the language's narration (TTS
   * pacing differs per language; audio is hard-cut at the Sequence end). */
  introSeconds: number;
  heroSeconds: number;
  outroSeconds: number;
};

const en: BrandText = {
  tagline: "Your AI-powered front desk",
  features: [
    "AI receptionists that chat and answer calls 24/7.",
    "Appointments land in live provider calendars.",
    "Patient records encrypted at rest.",
    "Call and chat logs with full transcripts.",
    "Trilingual: English, Hungarian, and German.",
  ],
  hero: {
    title: "Reception that never sleeps",
    subtitle: "Every call and every chat answered instantly — day or night.",
  },
  outroLines: [
    { text: "Thank you for watching.", start: 10, size: 64, weight: 700 },
    {
      text: "Sunshine Dental is an AI-powered front desk for dental clinics — chat, voice, scheduling, and secure records in one calm app.",
      start: 60,
      size: 34,
      weight: 400,
    },
    {
      text: "If you'd like custom features or a version tailored to your practice, feel free to get in touch — contact details are below.",
      start: 250,
      size: 34,
      weight: 400,
    },
    {
      text: "Don't forget to like the video and subscribe for more software demos and tutorials.",
      start: 440,
      size: 34,
      weight: 400,
    },
  ],
  introSeconds: 22, // intro.mp3 (en) runs 21.2 s
  heroSeconds: 12, // hero.mp3 (en) runs 9.4 s
  outroSeconds: 20, // outro.mp3 (en) runs 19.1 s
};

const hu: BrandText = {
  tagline: "AI-recepció a fogorvosi rendelőknek",
  features: [
    "AI recepciósok, akik éjjel-nappal csevegnek és telefonálnak.",
    "Az időpontok azonnal az élő orvosi naptárakba kerülnek.",
    "A páciensadatok titkosítva tárolódnak.",
    "Hívás- és csevegésnapló teljes átiratokkal.",
    "Háromnyelvű: magyar, angol és német.",
  ],
  hero: {
    title: "Recepció, amely sosem alszik",
    subtitle: "Minden hívás és csevegés azonnal választ kap — éjjel és nappal.",
  },
  outroLines: [
    { text: "Köszönjük, hogy megnézted a videót!", start: 10, size: 64, weight: 700 },
    {
      text: "A Sunshine Dental AI-alapú recepció fogorvosi rendelőknek — csevegés, hívások, időpontfoglalás és biztonságos páciensadatok egyetlen letisztult alkalmazásban.",
      start: 85,
      size: 34,
      weight: 400,
    },
    {
      text: "Ha egyedi funkciókra vagy a rendelődre szabott változatra van szükséged, keress bátran — az elérhetőségek lent találhatók.",
      start: 355,
      size: 34,
      weight: 400,
    },
    {
      text: "Ne felejts el lájkolni és feliratkozni a további szoftverbemutatókért!",
      start: 625,
      size: 34,
      weight: 400,
    },
  ],
  introSeconds: 26, // intro.mp3 (hu) runs 24.9 s
  heroSeconds: 17, // hero.mp3 (hu) runs 15.8 s
  outroSeconds: 28.5, // outro.mp3 (hu) runs 27.1 s
};

const BRAND_TEXT: Record<string, BrandText> = { en, hu };

export function brandText(lang: string): BrandText {
  return BRAND_TEXT[lang] ?? en;
}
