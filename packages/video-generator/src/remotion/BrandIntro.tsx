import {
  AbsoluteFill,
  Audio as RemotionAudio,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { brandText } from "../lib/brand-text";
import { FPS } from "../lib/schema";
import { BRAND_DARK, BRAND_NAME, FONT_STACK } from "./BrandLogo";

/**
 * Animated brand intro (same "Logo Bounce Drop" structure as the Founder CRM
 * video). The logo drops from above with a spring bounce, squashes on landing,
 * then the clinic name, tagline, and feature lines fade in.
 */
export function BrandIntro({ audio, lang }: { audio: string | null; lang: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { tagline, features, introSeconds } = brandText(lang);
  const introFrames = Math.round(introSeconds * FPS);

  // Logo drops from above with spring bounce
  const drop = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 120, mass: 0.8 },
  });
  const translateY = interpolate(drop, [0, 1], [-500, 0]);

  // Squash and stretch on landing
  const squashProgress = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 6, stiffness: 200, mass: 0.5 },
  });
  const scaleX = interpolate(squashProgress, [0, 0.5, 1], [1.3, 1.1, 1]);
  const scaleY = interpolate(squashProgress, [0, 0.5, 1], [0.7, 0.9, 1]);

  // Clinic name fades in after bounce
  const nameOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const nameTranslateY = interpolate(frame, [25, 45], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Tagline fades in after the name
  const taglineOpacity = interpolate(frame, [50, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Smooth fade-out after narration finishes
  const fadeOut = interpolate(frame, [introFrames - 25, introFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND_DARK,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
      }}
    >
      {audio ? <RemotionAudio src={staticFile(audio)} /> : null}
      <div
        style={{
          transform: `translateY(${translateY}px) scaleX(${scaleX}) scaleY(${scaleY})`,
        }}
      >
        <Img
          src={staticFile("brand/logo.png")}
          style={{ width: 220, height: 220, objectFit: "contain", borderRadius: 44 }}
        />
      </div>
      <p
        style={{
          color: "white",
          fontSize: 72,
          fontWeight: 700,
          fontFamily: FONT_STACK,
          opacity: nameOpacity,
          transform: `translateY(${nameTranslateY}px)`,
          margin: 0,
          paddingTop: 40,
        }}
      >
        {BRAND_NAME}
      </p>
      <p
        style={{
          color: "rgba(255, 255, 255, 0.65)",
          fontSize: 32,
          fontWeight: 400,
          fontFamily: FONT_STACK,
          marginTop: 16,
          opacity: taglineOpacity,
          margin: 0,
        }}
      >
        {tagline}
      </p>
      <div
        style={{
          marginTop: 48,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          alignItems: "center",
        }}
      >
        {features.map((feature, i) => {
          const start = 75 + i * 15;
          const featureOpacity = interpolate(frame, [start, start + 15], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const featureTranslateY = interpolate(frame, [start, start + 15], [20, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <p
              key={i}
              style={{
                color: "rgba(255, 255, 255, 0.88)",
                fontSize: 30,
                fontWeight: 400,
                fontFamily: FONT_STACK,
                margin: 0,
                opacity: featureOpacity,
                transform: `translateY(${featureTranslateY}px)`,
              }}
            >
              {feature}
            </p>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
