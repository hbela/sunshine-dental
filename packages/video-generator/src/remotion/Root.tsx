import { Composition, registerRoot } from "remotion";
import { DemoVideo } from "./DemoVideo";
import { brandText } from "../lib/brand-text";
import { FPS, type ExtraAudio, type SceneWithAudio } from "../lib/schema";

export const RemotionRoot = () => {
  return (
    <Composition
      id="DemoVideo"
      component={DemoVideo}
      durationInFrames={1}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{
        scenes: [] as SceneWithAudio[],
        extraAudio: { intro: null, hero: null, outro: null } as ExtraAudio,
        lang: "en",
      }}
      calculateMetadata={({ props }) => {
        const { introSeconds, heroSeconds, outroSeconds } = brandText(props.lang ?? "en");
        return {
          durationInFrames: Math.max(
            1,
            Math.round((introSeconds + heroSeconds + outroSeconds) * FPS) +
              props.scenes.reduce((sum, s) => sum + Math.round(s.durationSeconds * FPS), 0),
          ),
        };
      }}
    />
  );
};

registerRoot(RemotionRoot);
