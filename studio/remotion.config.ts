import { Config } from '@remotion/cli/config';

// JPEG frames are much faster to capture and encode than PNG; quality is set per render by `vs`.
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setDelayRenderTimeoutInMilliseconds(120000);
Config.setChromiumOpenGlRenderer('angle');
