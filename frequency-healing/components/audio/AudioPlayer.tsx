'use client';

import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { formatFrequencyList } from '@/lib/utils/helpers';

interface AudioPlayerProps {
  title: string;
  audioUrl?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  sharePath?: string | null;
  frequencies: number[];
  onPlay?: () => void;
}

export default function AudioPlayer({
  title,
  audioUrl,
  videoUrl,
  thumbnailUrl,
  sharePath,
  frequencies,
  onPlay
}: AudioPlayerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [useExternalAudioTrack, setUseExternalAudioTrack] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const externalAudioRef = useRef<HTMLAudioElement | null>(null);

  const hasVideo = Boolean(videoUrl);
  const hasAudio = Boolean(audioUrl);
  const supportsExternalAudioSync = hasVideo && hasAudio;

  const resolveShareUrl = () => {
    if (!sharePath) {
      return null;
    }

    if (/^https?:\/\//i.test(sharePath)) {
      return sharePath;
    }

    const normalizedPath = sharePath.startsWith('/') ? sharePath : `/${sharePath}`;
    if (typeof window === 'undefined') {
      return normalizedPath;
    }

    return `${window.location.origin}${normalizedPath}`;
  };

  useEffect(() => {
    if (supportsExternalAudioSync) {
      return;
    }

    setUseExternalAudioTrack(false);
  }, [supportsExternalAudioSync]);

  useEffect(() => {
    if (useExternalAudioTrack) {
      return;
    }

    if (externalAudioRef.current) {
      externalAudioRef.current.pause();
    }
  }, [useExternalAudioTrack]);

  const syncExternalAudioFromVideo = () => {
    if (!useExternalAudioTrack || !videoRef.current || !externalAudioRef.current) {
      return;
    }

    const video = videoRef.current;
    const audio = externalAudioRef.current;
    audio.currentTime = video.currentTime;
    audio.playbackRate = video.playbackRate;
    audio.muted = video.muted;
    audio.volume = video.volume;
  };

  const handleVideoPlay = async () => {
    onPlay?.();
    if (!useExternalAudioTrack || !externalAudioRef.current) {
      return;
    }

    syncExternalAudioFromVideo();
    try {
      await externalAudioRef.current.play();
    } catch (error) {
      console.warn('External audio track could not start.', error);
    }
  };

  const handleVideoPause = () => {
    if (!externalAudioRef.current) {
      return;
    }
    externalAudioRef.current.pause();
  };

  const handleCopyLink = async () => {
    const url = resolveShareUrl();
    if (!url) {
      return;
    }

    if (!navigator.clipboard?.writeText) {
      setShareStatus('Clipboard access is unavailable in this browser.');
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareStatus('Share link copied.');
    } catch (error) {
      console.error(error);
      setShareStatus('Could not copy share link.');
    }
  };

  const handleNativeShare = async () => {
    const url = resolveShareUrl();
    if (!url) {
      return;
    }

    if (!navigator.share) {
      await handleCopyLink();
      return;
    }

    try {
      await navigator.share({
        title,
        text: 'Listen to this frequency session.',
        url
      });
      setShareStatus('Shared.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error(error);
      setShareStatus('Share failed.');
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-sm text-ink/60">{formatFrequencyList(frequencies)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsOpen((prev) => !prev)}>
          {isOpen ? 'Hide player' : 'Open player'}
        </Button>
      </div>
      {isOpen ? (
        <div className="mt-4 space-y-3">
          {videoUrl ? (
            <div className="space-y-3">
              <video
                ref={videoRef}
                controls
                playsInline
                poster={thumbnailUrl ?? undefined}
                className="w-full rounded-2xl border border-ink/10 bg-black"
                onPlay={handleVideoPlay}
                onPause={handleVideoPause}
                onSeeking={syncExternalAudioFromVideo}
                onRateChange={syncExternalAudioFromVideo}
                onVolumeChange={syncExternalAudioFromVideo}
                onEnded={() => {
                  if (externalAudioRef.current) {
                    externalAudioRef.current.pause();
                    externalAudioRef.current.currentTime = 0;
                  }
                }}
              >
                <source src={videoUrl} />
              </video>

              {supportsExternalAudioSync ? (
                <>
                  <label className="flex items-center gap-2 text-xs text-ink/65">
                    <input
                      type="checkbox"
                      checked={useExternalAudioTrack}
                      onChange={(event) => setUseExternalAudioTrack(event.target.checked)}
                    />
                    Use exported audio track (recommended if video has no sound)
                  </label>
                  <audio ref={externalAudioRef} src={audioUrl ?? undefined} preload="auto" className="hidden" />
                </>
              ) : null}
            </div>
          ) : audioUrl ? (
            <audio controls className="w-full" onPlay={onPlay}>
              <source src={audioUrl} />
            </audio>
          ) : (
            <p className="text-sm text-ink/60">Media file not yet generated for this composition.</p>
          )}

          {sharePath ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleCopyLink}>
                Copy link
              </Button>
              <Button size="sm" variant="outline" onClick={handleNativeShare}>
                Share
              </Button>
            </div>
          ) : null}
          {shareStatus ? <p className="text-xs text-ink/60">{shareStatus}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
