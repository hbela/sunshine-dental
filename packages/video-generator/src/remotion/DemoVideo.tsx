import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { brandText } from "../lib/brand-text";
import { FPS, type ExtraAudio, type SceneWithAudio } from "../lib/schema";
import { BrandHero } from "./BrandHero";
import { BrandIntro } from "./BrandIntro";
import { BrandOutro } from "./BrandOutro";
import { BRAND_BG, BRAND_DARK, BRAND_PRIMARY, FONT_STACK } from "./BrandLogo";

const NO_EXTRA_AUDIO: ExtraAudio = { intro: null, hero: null, outro: null };

export function DemoVideo({
  scenes = [],
  extraAudio = NO_EXTRA_AUDIO,
  lang = "en",
}: {
  scenes: SceneWithAudio[];
  extraAudio?: ExtraAudio;
  lang?: string;
}) {
  const { introSeconds, heroSeconds, outroSeconds } = brandText(lang);
  const introFrames = Math.round(introSeconds * FPS);
  const heroFrames = Math.round(heroSeconds * FPS);
  const outroFrames = Math.round(outroSeconds * FPS);

  let offset = introFrames + heroFrames;
  const segments = scenes.map((scene) => {
    const durationInFrames = Math.max(1, Math.round(scene.durationSeconds * FPS));
    const from = offset;
    offset += durationInFrames;
    return { scene, from, durationInFrames };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND_BG }}>
      <Sequence from={0} durationInFrames={introFrames}>
        <BrandIntro audio={extraAudio.intro} lang={lang} />
      </Sequence>
      <Sequence from={introFrames} durationInFrames={heroFrames}>
        <BrandHero audio={extraAudio.hero} lang={lang} />
      </Sequence>
      {segments.map(({ scene, from, durationInFrames }) => (
        <Sequence key={scene.id} from={from} durationInFrames={durationInFrames}>
          <SceneFrame scene={scene} durationInFrames={durationInFrames} />
        </Sequence>
      ))}
      <Sequence from={offset} durationInFrames={outroFrames}>
        <BrandOutro audio={extraAudio.outro} lang={lang} />
      </Sequence>
    </AbsoluteFill>
  );
}

function SceneFrame({
  scene,
  durationInFrames,
}: {
  scene: SceneWithAudio;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  // Slow Ken Burns zoom across the scene.
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.06]);

  return (
    <AbsoluteFill
      style={{
        // Branded gradient backdrop so the framing margins read as intentional.
        background: `linear-gradient(135deg, ${BRAND_DARK} 0%, ${BRAND_PRIMARY} 100%)`,
        padding: "72px 96px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {scene.audio ? <Audio src={staticFile(scene.audio)} /> : null}
      <div
        style={{
          position: "relative",
          height: "100%",
          maxWidth: "100%",
          // Screenshots are captured at the 1920×1080 viewport (16:9), so the
          // card matches that aspect ratio — the image fills it edge-to-edge.
          aspectRatio: "16 / 9",
          borderRadius: 28,
          overflow: "hidden",
          boxShadow: "0 40px 90px rgba(0, 0, 0, 0.45)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
        }}
      >
        <Img
          src={staticFile(scene.screenshot)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 32,
            left: 40,
            fontSize: 48,
            fontWeight: 700,
            fontFamily: FONT_STACK,
            color: BRAND_DARK,
            background: "white",
            padding: "20px 32px",
            borderRadius: 20,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
          }}
        >
          {scene.title}
        </div>
      </div>
    </AbsoluteFill>
  );
}
