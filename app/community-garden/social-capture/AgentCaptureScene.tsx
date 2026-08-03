"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GardenCanvas,
  type GardenCanvasHandle,
  type GardenUiState,
} from "../components/GardenCanvas";
import styles from "./social-capture.module.css";

const CAPTURE_WIDTH = 1080;
const CAPTURE_HEIGHT = 1920;

type TimedWord = { text: string; start: number; end: number };
type CaptionCue = { text: string; start: number; end: number; words?: TimedWord[] };
type AgentOverlay = {
  header?: string;
  gameplayLabel?: string;
  progressLabel?: string;
  progressValue?: string;
  footer?: string;
};

const PATHS: Record<string, Array<[number, number]>> = {
  "garden-status": [[-4, 3], [-1, 1], [3, 2], [5, -1], [1, -3], [-3, -2]],
  "garden-composition": [[-5, -2], [-2, 1], [1, 3], [4, 1], [2, -2], [-2, -3]],
  "watering-how-to": [[-3, 2], [0, 1], [3, 0], [5, 2], [1, 4]],
  "weed-cleanup": [[-4, -3], [-1, -1], [2, 0], [4, 3], [0, 4]],
  "habitat-discovery": [[-5, 2], [-2, 3], [1, 2], [4, 0], [2, -3]],
  "builder-mode": [[-3, 0], [-1, 2], [2, 2], [4, 0], [1, -2]],
};

const FALLBACK_CAPTIONS: CaptionCue[] = [
  { start: 0, end: 30, text: "Wren is tending Basil." },
];

function captionAt(cues: CaptionCue[], seconds: number) {
  return cues.find((cue) => seconds >= cue.start && seconds < cue.end) ?? null;
}

export function AgentCaptureScene({ scene }: { scene: string }) {
  const gardenRef = useRef<GardenCanvasHandle>(null);
  const playbackStartedRef = useRef(false);
  const playbackTimerRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [captionCues, setCaptionCues] = useState<CaptionCue[]>(FALLBACK_CAPTIONS);
  const [overlay, setOverlay] = useState<AgentOverlay>({});
  const activeCaption = useMemo(
    () => captionAt(captionCues, seconds),
    [captionCues, seconds],
  );
  const path = PATHS[scene] ?? PATHS["garden-status"];

  const onStateChange = useCallback((state: GardenUiState) => {
    if (state.connection === "online") setReady(true);
  }, []);

  const startPlayback = useCallback(() => {
    if (playbackStartedRef.current) return;
    playbackStartedRef.current = true;
    let index = 0;
    const move = () => {
      const next = path[index % path.length];
      gardenRef.current?.walkToGridPosition(next[0], next[1]);
      index += 1;
    };
    gardenRef.current?.setCaptureFollowActor(4.35);
    move();
    playbackTimerRef.current = window.setInterval(move, 2_350);
  }, [path]);

  useEffect(() => {
    const fallback = window.setTimeout(() => setReady(true), 8_000);
    window.__BASIL_SOCIAL_CAPTURE__ = {
      dimensions: { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT },
      captureMode: "realtime",
      setTime: async (nextSeconds) => setSeconds(nextSeconds),
      setCaptionCues: async (nextCues) => setCaptionCues(nextCues),
      setBulletinOverlay: async (nextOverlay) => setOverlay(nextOverlay),
      startPlayback,
    };
    return () => {
      window.clearTimeout(fallback);
      if (playbackTimerRef.current !== null) {
        window.clearInterval(playbackTimerRef.current);
      }
      delete window.__BASIL_SOCIAL_CAPTURE__;
    };
  }, [startPlayback]);

  const words = activeCaption?.words ?? (
    activeCaption
      ? [{ text: activeCaption.text, start: activeCaption.start, end: activeCaption.end }]
      : []
  );

  return (
    <main
      className={`${styles.capture} ${styles.agentCapture}`}
      data-capture-ready={ready ? "true" : "false"}
      aria-label="Wren's clean Basil gameplay capture"
    >
      <GardenCanvas
        ref={gardenRef}
        actorAppearance="wren"
        mode="community"
        personalGarden={null}
        onStateChange={onStateChange}
      />
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.agentBrand} aria-label="Basil">BASIL</div>
      <div className={styles.agentIdentity}>
        <strong>WREN</strong>
        <span>AI GARDEN STEWARD</span>
      </div>
      {overlay.progressValue ? (
        <div className={styles.agentFact}>
          <strong>{overlay.progressValue}</strong>
          <span>{overlay.progressLabel}</span>
        </div>
      ) : null}
      {activeCaption ? (
        <div className={styles.caption}>
          <p>
            {words.map((word, index) => {
              const spoken = seconds >= word.start;
              const active = seconds >= word.start && seconds < word.end;
              return (
                <span
                  key={`${word.start}-${index}`}
                  className={active ? styles.activeWord : spoken ? styles.spokenWord : undefined}
                >
                  {word.text}{" "}
                </span>
              );
            })}
          </p>
        </div>
      ) : null}
      <div className={styles.agentDisclosure}>
        AI-directed · actions validated and logged by Basil
      </div>
    </main>
  );
}
