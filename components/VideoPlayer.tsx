import { useRef, useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { VideoState } from '@/types';

interface VideoPlayerProps {
  videoState: VideoState | null;
  onStateChange: (state: Partial<VideoState>) => void;
  userId: string;
}

export default function VideoPlayer({ videoState, onStateChange, userId }: VideoPlayerProps) {
  const playerRef = useRef<ReactPlayer>(null);
  const [url, setUrl] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [lastSeekTime, setLastSeekTime] = useState<number | null>(null);
  const isSeeking = useRef(false);
  const lastBroadcastTime = useRef<number>(0);

  // Sync videoState.url to local state only when it comes from another user
  // This allows the current user to freely edit their input field
  useEffect(() => {
    // Only update local url if:
    // 1. There's a videoState.url
    // 2. It's different from current local url
    // 3. It wasn't updated by the current user (to avoid overwriting their input)
    if (videoState?.url && videoState.updatedBy !== userId) {
      setUrl(videoState.url);
    }
  }, [videoState?.url, videoState?.updatedBy, userId]);

  // Sync playback position when videoState changes from another user
  useEffect(() => {
    if (!isReady || !playerRef.current || !videoState) return;

    const currentTime = playerRef.current.getCurrentTime();
    const targetTime = videoState.playedSeconds || 0;

    // If the video state was updated by another user and there's a significant time difference, seek to sync
    if (videoState.updatedBy !== userId && Math.abs(currentTime - targetTime) > 1.5) {
      console.log(`[Sync] Seeking from ${currentTime.toFixed(2)}s to ${targetTime.toFixed(2)}s (updated by other user)`);
      isSeeking.current = true;
      playerRef.current.seekTo(targetTime, 'seconds');
      setTimeout(() => {
        isSeeking.current = false;
      }, 500);
    }
  }, [videoState?.playedSeconds, videoState?.updatedBy, userId, isReady]);

  // Sync playing state changes
  useEffect(() => {
    if (!isReady || !playerRef.current || !videoState) return;

    // Don't sync our own play/pause changes
    if (videoState.updatedBy === userId) return;

    // The ReactPlayer playing prop handles this automatically via the playing={videoState?.isPlaying} prop
    // But we log for debugging
    console.log(`[Sync] Play state changed to: ${videoState.isPlaying ? 'playing' : 'paused'}`);
  }, [videoState?.isPlaying, videoState?.updatedBy, userId, isReady]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onStateChange({ url: url.trim(), isPlaying: true, playedSeconds: 0 });
      setIsReady(false); // Reset ready state for new video
    }
  };

  return (
    <div className="w-full space-y-3 sm:space-y-4">
      {/* Source Input Overlay or Header */}
      <div className="bg-white/90 backdrop-blur-md rounded-[20px] p-2 sm:p-4 border border-couple-soft shadow-sm">
        <form onSubmit={handleUrlSubmit} className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste movie link here..."
            className="flex-1 px-4 py-3 bg-couple-soft/40 rounded-[14px] text-[14px] sm:text-sm outline-none focus:bg-white transition-all border border-transparent focus:border-couple-pink/20"
          />
          <button type="submit" className="love-button-primary px-6 sm:px-8 h-11 sm:h-12 rounded-[14px] text-[14px] sm:text-sm whitespace-nowrap">
            Watch Now
          </button>
        </form>
      </div>

      {/* Video Canvas */}
      <div className="relative aspect-video rounded-[20px] sm:rounded-[24px] overflow-hidden bg-black shadow-love-lg group ring-2 sm:ring-4 ring-white/50">
        {(videoState?.url || url) ? (
          <ReactPlayer
            ref={playerRef}
            url={videoState?.url || url}
            width="100%"
            height="100%"
            playing={videoState?.isPlaying ?? false}
            controls={true}
            onPlay={() => {
              if (!isSeeking.current) {
                console.log('[Event] Play pressed');
                const currentTime = playerRef.current?.getCurrentTime() || 0;
                onStateChange({ isPlaying: true, playedSeconds: currentTime });
                lastBroadcastTime.current = Date.now();
              }
            }}
            onPause={() => {
              if (!isSeeking.current) {
                console.log('[Event] Pause pressed');
                const currentTime = playerRef.current?.getCurrentTime() || 0;
                onStateChange({ isPlaying: false, playedSeconds: currentTime });
                lastBroadcastTime.current = Date.now();
              }
            }}
            onSeek={(seconds: number) => {
              // When user seeks (moves timeline), broadcast the new position
              if (!isSeeking.current) {
                console.log(`[Event] User seeked to ${seconds.toFixed(2)}s`);
                setLastSeekTime(seconds);
                onStateChange({
                  playedSeconds: seconds,
                  isPlaying: videoState?.isPlaying ?? false
                });
                lastBroadcastTime.current = Date.now();
              }
            }}
            onProgress={({ playedSeconds }) => {
              // Periodically broadcast playback position to keep everyone in sync
              if (!isSeeking.current && videoState?.isPlaying) {
                const now = Date.now();
                const timeSinceLastBroadcast = (now - lastBroadcastTime.current) / 1000;
                const drift = Math.abs(playedSeconds - (videoState?.playedSeconds || 0));
                
                // Broadcast if: significant drift (>3s) OR it's been 10 seconds since last broadcast
                if (drift > 3 || timeSinceLastBroadcast > 10) {
                  console.log(`[Progress] Broadcasting position: ${playedSeconds.toFixed(2)}s (drift: ${drift.toFixed(2)}s, time since last: ${timeSinceLastBroadcast.toFixed(1)}s)`);
                  onStateChange({ playedSeconds });
                  lastBroadcastTime.current = now;
                }
              }
            }}
            onReady={() => {
              setIsReady(true);
              console.log('[Ready] Video player ready');
              // When new user joins or video loads, seek to current playback position
              // Always sync if there is a known state, regardless of value, unless it's undefined
              if (videoState?.playedSeconds !== undefined) {
                console.log(`[Ready] Seeking to ${videoState.playedSeconds.toFixed(2)}s`);
                isSeeking.current = true;
                playerRef.current?.seekTo(videoState.playedSeconds, 'seconds');
                setTimeout(() => {
                  isSeeking.current = false;
                }, 500);
              }
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 p-4 text-center">
            <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-white/5 flex items-center justify-center animate-beat mb-3 sm:mb-4">
              <svg className="w-6 h-6 sm:w-10 sm:h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
            </div>
            <p className="text-[10px] sm:text-[12px] font-black tracking-[0.2em] uppercase opacity-60">Waiting for Our Romance to Start</p>
          </div>
        )}

        {/* Sync Indicator */}
        {videoState && (
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 love-glass-pill py-1 sm:py-1.5 flex items-center gap-1.5 sm:gap-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_#4ade80]"></div>
            <span className="text-[8px] sm:text-[10px] font-black uppercase text-couple-text">Synchronized</span>
          </div>
        )}
      </div>

      {/* Playback Status Bar */}
      <div className="flex items-center justify-between px-1 py-1 gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-couple-secondary opacity-40">With:</span>
          <div className="flex -space-x-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-couple-pink border-2 border-white text-[8px] sm:text-[10px] flex items-center justify-center text-white font-bold">ME</div>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-couple-deep border-2 border-white text-[8px] sm:text-[10px] flex items-center justify-center text-white font-bold">U</div>
          </div>
        </div>
        <div className="flex items-center">
          <span className="text-[10px] sm:text-[12px] font-bold text-couple-pink whitespace-nowrap">
            {videoState?.isPlaying ? 'STREAMING LIVE' : 'PAUSED IN LOVE'}
          </span>
        </div>
      </div>
    </div>
  );
}
