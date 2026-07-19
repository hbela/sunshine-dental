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
import { BRAND_DARK, FONT_STACK } from "./BrandLogo";

/**
 * Animated outro scene. The logo fades in, then each line of text appears
 * in sync with the narration audio, finishing with a smooth fade-out.
 */
export function BrandOutro({ audio, lang }: { audio: string | null; lang: string }) {
  const frame = useCurrentFrame();
  const { outroLines, outroSeconds } = brandText(lang);
  const outroFrames = Math.round(outroSeconds * FPS);

  const logoOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(frame, [outroFrames - 25, outroFrames], [1, 0], {
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
        padding: "0 160px",
      }}
    >
      {audio ? <RemotionAudio src={staticFile(audio)} /> : null}
      <Img
        src={staticFile("brand/logo.png")}
        style={{
          width: 170,
          height: 170,
          objectFit: "contain",
          borderRadius: 34,
          opacity: logoOpacity,
          marginBottom: 60,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 32,
          alignItems: "center",
          textAlign: "center",
          maxWidth: 1400,
        }}
      >
        {outroLines.map((line, i) => {
          const opacity = interpolate(frame, [line.start, line.start + 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const translateY = interpolate(frame, [line.start, line.start + 20], [30, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <p
              key={i}
              style={{
                color: i === 0 ? "white" : "rgba(255, 255, 255, 0.82)",
                fontSize: line.size,
                fontWeight: line.weight,
                fontFamily: FONT_STACK,
                margin: 0,
                opacity,
                transform: `translateY(${translateY}px)`,
                lineHeight: 1.4,
              }}
            >
              {line.text}
            </p>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
