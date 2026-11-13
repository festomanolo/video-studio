import React from 'react';
import { CalculateMetadataFunction, Composition, getStaticFiles, staticFile } from 'remotion';
import { Video } from './Video';
import type { Timeline } from './types';
import { demoTimeline } from './demo';

type Props = { src?: string; timeline?: Timeline };

/** Loads public/p/<id>/timeline.json (written by `vs build`) and sizes the composition from it. */
const calculateMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const timeline: Timeline = props.timeline ?? (await fetch(staticFile(props.src!)).then((r) => r.json()));
  return {
    durationInFrames: Math.max(1, timeline.durationInFrames),
    fps: timeline.fps,
    width: timeline.width,
    height: timeline.height,
    props: { ...props, timeline },
  };
};

const Comp: React.FC<Props> = ({ timeline }) => (timeline ? <Video timeline={timeline} /> : null);

export const Root: React.FC = () => {
  // One composition per built project, named by its id: `npx remotion render src/index.ts <id>`.
  const built = getStaticFiles()
    .map((f) => f.name)
    .filter((n) => /^p\/[a-z0-9-]+\/timeline\.json$/.test(n));
  return (
    <>
      <Composition id="Demo" component={Comp} calculateMetadata={calculateMetadata} defaultProps={{ timeline: demoTimeline }} durationInFrames={300} fps={30} width={1080} height={1920} />
      {built.map((name) => (
        <Composition key={name} id={name.split('/')[1]} component={Comp} calculateMetadata={calculateMetadata} defaultProps={{ src: name }} durationInFrames={300} fps={30} width={1080} height={1920} />
      ))}
    </>
  );
};
