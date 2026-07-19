import {
  AbsoluteFill,
  Audio as RemotionAudio,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { brandText } from "../lib/brand-text";
import { FPS } from "../lib/schema";
import { FONT_STACK } from "./BrandLogo";

/**
 * Full-bleed hero scene: the clinic receptionist on the phone, with a slow
 * Ken Burns zoom and caption lines that fade in over a bottom gradient.
 */
export function BrandHero({ audio, lang }: { audio: string | null; lang: string }) {
  const frame = useCurrentFrame();
  const { hero, heroSeconds } = brandText(lang);
  const heroFrames = Math.round(heroSeconds * FPS);

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [heroFrames - 25, heroFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, heroFrames], [1, 1.08]);

  const titleOpacity = interpolate(frame, [30, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleTranslateY = interpolate(frame, [30, 55], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [70, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "black", opacity: fadeIn * fadeOut }}>
      {audio ? <RemotionAudio src={staticFile(audio)} /> : null}
      <Img
        src={staticFile("brand/receptionist.png")}
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
          inset: 0,
          background: "linear-gradient(to top, rgba(20, 26, 17, 0.82) 0%, rgba(20, 26, 17, 0) 45%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 90,
          left: 100,
          right: 100,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <p
          style={{
            color: "white",
            fontSize: 64,
            fontWeight: 700,
            fontFamily: FONT_STACK,
            margin: 0,
            opacity: titleOpacity,
            transform: `translateY(${titleTranslateY}px)`,
            textShadow: "0 4px 24px rgba(0,0,0,0.5)",
          }}
        >
          {hero.title}
        </p>
        <p
          style={{
            color: "rgba(255, 255, 255, 0.85)",
            fontSize: 34,
            fontWeight: 400,
            fontFamily: FONT_STACK,
            margin: 0,
            opacity: subOpacity,
            textShadow: "0 2px 16px rgba(0,0,0,0.5)",
          }}
        >
          {hero.subtitle}
        </p>
      </div>
    </AbsoluteFill>
  );
}
