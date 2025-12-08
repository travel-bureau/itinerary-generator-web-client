import React, { useEffect, useRef, useState } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";

interface VideoPlayerProps {
  videoURL: string;
  onReady?: (player: any) => void; // Use videojs.VideoJsPlayer
}

const videoURLType = "video/webm";

export const VideoPlayer: React.FC<VideoPlayerProps> = (props) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null); // Correct type
  const [playbackRate, setPlaybackRate] = useState(1);
  const { videoURL, onReady } = props;

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.playbackRate(playbackRate);
    }
  }, [playbackRate]);

  useEffect(() => {
    // Initialize the player only if it hasn't been initialized yet
    if (!playerRef.current) {
      const videoElement = document.createElement("video-js");
      videoElement.classList.add("vjs-big-play-centered");
      videoRef.current?.appendChild(videoElement);

      const player = (playerRef.current = videojs(
        videoElement,
        {
          autoplay: false,
          controls: true,
          responsive: true,
          fluid: true,
          experimentalSvgIcons: true,
          playbackRates: [0.5, 1, 1.5, 2],
          userActions: { hotkeys: true },
          sources: [
            {
              src: videoURL,
              type: videoURLType,
            },
          ],
          controlBar: {
            skipButtons: {
              forward: 10,
              backward: 10,
            },
            pictureInPictureToggle: true,
            enableSmoothSeeking: true,
            responsive: true,
          },
          preload: "auto",
        },
        () => {
          onReady && onReady(player);
        }
      ));

      player.on("dispose", () => {
        playerRef.current = null;
      });
    } else {
      // Update player source if it already exists
      const player = playerRef.current;
      player.autoplay(true);
      player.src([
        {
          src: videoURL,
          type: videoURLType,
        },
      ]);
    }
  }, []);

  return (
    <div data-vjs-player>
      <div ref={videoRef} />
    </div>
  );
};

export default VideoPlayer;
