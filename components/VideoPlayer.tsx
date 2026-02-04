import { useRef, useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { VideoState, SyncStatus } from '@/types';

interface VideoPlayerProps {
  videoState: VideoState | null;
  onStateChange: (state: Partial<VideoState>) => void;
  userId: string;
  isHost: boolean;
  syncStatus: SyncStatus;
  onReportPosition: (playedSeconds: number, isBuffering: boolean) => void;
}

export default function VideoPlayer({
  videoState,
  onStateChange,
  userId,
  isHost,
  syncStatus,
  onReportPosition
}: VideoPlayerProps) {
  const playerRef = useRef<ReactPlayer>(null);
  const [url, setUrl] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [localBuffering, setLocalBuffering] = useState(false);
  const [lastSeekTime, setLastSeekTime] = useState<number | null>(null);
  const [showSyncIndicator, setShowSyncIndicator] = useState(false);
  const isSeeking = useRef(false);
  const lastBroadcastTime = useRef<number>(0);
  const lastSyncTime = useRef<number>(0);

  // Sync videoState.url to local state only when it comes from another user
  useEffect(() => {
    if (videoState?.url && videoState.updatedBy !== userId) {
      setUrl(videoState.url);
    }
  }, [videoState?.url, videoState?.updatedBy, userId]);

  // Sync playback position and state
  useEffect(() => {
    if (!isReady || !playerRef.current || !videoState) return;

    const currentTime = playerRef.current.getCurrentTime();
    const targetTime = videoState.playedSeconds || 0;

    // Calculate precise target time based on server timestamp if available
    // precision: adjustedTarget = targetTime + (now - serverTimestamp) if playing
    let adjustedTarget = targetTime;
    if (videoState.isPlaying && videoState.serverTimestamp) {
      // Add latency compensation (approximate)
      const latencyStr = (Date.now() - videoState.serverTimestamp) / 1000;
      // Cap latency compensation to avoid overshooting on huge lags
      const latency = Math.min(latencyStr, 2.0);
      adjustedTarget += latency;
    }

    const drift = Math.abs(currentTime - adjustedTarget);

    // Sync logic:
    // 1. If paused, always sync if drift > 0.1
    // 2. If playing, sync if drift > 0.5 (tighter threshold than before)
    // 3. Ignore if updated by self (unless forced resync)

    const shouldSync = (videoState.updatedBy !== userId) ||
      (Math.abs(currentTime - targetTime) > 2.0); // Force sync if HUGE drift even if self

    if (shouldSync) {
      // Handle Playing State
      if (videoState.isPlaying !== (!playerRef.current.getInternalPlayer()?.paused)) {
        // ReactPlayer playing prop handles this, but sometimes we need to enforce
        // strictly relying on prop usually works
      }

      // Handle Seek / Position Sync
      if (drift > 0.3) { // Tighter sync threshold (reduced from 0.5s)
        console.log(`[Sync] Correcting drift: ${drift.toFixed(2)}s. Seeking to ${adjustedTarget.toFixed(2)}s`);
        setShowSyncIndicator(true);
        isSeeking.current = true;
        playerRef.current.seekTo(adjustedTarget, 'seconds');

        // Short timeout to prevent seek loops and hide sync indicator
        setTimeout(() => {
          isSeeking.current = false;
          setShowSyncIndicator(false);
        }, 1000);
      }
    }
  }, [videoState, userId, isReady]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onStateChange({ url: url.trim(), isPlaying: true, playedSeconds: 0 });
      setIsReady(false);
    }
  };

  const handleProgress = ({ playedSeconds }: { playedSeconds: number }) => {
    // Report position to server for drift monitoring logic, regardless of anything
    onReportPosition(playedSeconds, localBuffering);

    if (!isSeeking.current && videoState?.isPlaying && isHost) {
      const now = Date.now();
      const timeSinceLastBroadcast = (now - lastBroadcastTime.current) / 1000;

      // Host broadcasts periodically to keep everyone aligned
      // Broadcast every 1.5 seconds for tighter sync (reduced from 2s)
      if (timeSinceLastBroadcast > 1.5) {
        onStateChange({ playedSeconds });
        lastBroadcastTime.current = now;
      }
    }
  };

  return (
    <div className="w-full space-y-3 sm:space-y-4">
      {/* Search Input */}
      <div className="bg-white/90 backdrop-blur-md rounded-[20px] p-2 sm:p-4 border border-couple-soft shadow-sm relative overflow-hidden">
        {isHost && <div className="absolute top-0 right-0 p-1 bg-couple-pink/10 rounded-bl-xl text-[8px] font-black text-couple-pink px-2">YOU ARE HOST</div>}

        <form onSubmit={handleUrlSubmit} className="flex flex-col sm:flex-row gap-2 sm:gap-3 relative z-10">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste movie link here..."
            className="flex-1 px-4 py-3 bg-couple-soft/40 rounded-[14px] text-[14px] sm:text-sm outline-none focus:bg-white transition-all border border-transparent focus:border-couple-pink/20"
            disabled={!isHost && videoState?.isPlaying} // Optional: restrict changing URL while playing if not host?
          />
          <button
            type="submit"
            className={`love-button-primary px-6 sm:px-8 h-11 sm:h-12 rounded-[14px] text-[14px] sm:text-sm whitespace-nowrap ${!isHost ? 'opacity-80 grayscale-[0.3]' : ''}`}
            title={!isHost ? "Only host can change video" : "Watch Now"}
          >
            {isHost ? 'Watch Now' : 'Suggest'}
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
                const currentTime = playerRef.current?.getCurrentTime() || 0;
                onStateChange({ isPlaying: true, playedSeconds: currentTime });
              }
            }}
            onPause={() => {
              if (!isSeeking.current) {
                const currentTime = playerRef.current?.getCurrentTime() || 0;
                onStateChange({ isPlaying: false, playedSeconds: currentTime });
              }
            }}
            onSeek={(seconds: number) => {
              if (!isSeeking.current) {
                setLastSeekTime(seconds);
                onStateChange({
                  playedSeconds: seconds,
                  isPlaying: videoState?.isPlaying ?? false
                });
              }
            }}
            onProgress={handleProgress}
            onBuffer={() => setLocalBuffering(true)}
            onBufferEnd={() => setLocalBuffering(false)}
            onReady={() => {
              setIsReady(true);
              // Initial sync
              if (videoState?.playedSeconds !== undefined) {
                playerRef.current?.seekTo(videoState.playedSeconds, 'seconds');
              }
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 p-4 text-center">
            {/* ... Placeholder content ... */}
            <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-white/5 flex items-center justify-center animate-beat mb-3 sm:mb-4">
              <svg className="w-6 h-6 sm:w-10 sm:h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
            </div>
            <p className="text-[10px] sm:text-[12px] font-black tracking-[0.2em] uppercase opacity-60">Waiting for Our Romance to Start</p>
          </div>
        )}

        {/* Sync Status Overlay */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col items-end gap-2">
          {/* Host Badge */}
          {isHost && (
            <div className="love-glass-pill py-1 px-2 flex items-center gap-1">
              <span className="text-[8px] sm:text-[10px] font-black uppercase text-couple-pink">👑 HOST</span>
            </div>
          )}

          {/* Sync Indicator */}
          {videoState && (
            <div className="flex flex-col items-end gap-1">
              <div className={`love-glass-pill py-1 px-2 flex items-center gap-1.5 transition-colors ${!syncStatus.isSynced ? 'bg-red-500/20 border-red-500/30' : showSyncIndicator ? 'bg-blue-500/20 border-blue-500/30' : ''}`}>
                <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-pulse ${
                  showSyncIndicator ? 'bg-blue-400 shadow-[0_0_8px_#60a5fa]' :
                  syncStatus.isBuffering ? 'bg-yellow-400 shadow-[0_0_8px_#facc15]' :
                  !syncStatus.isSynced ? 'bg-red-400 shadow-[0_0_8px_#f87171]' :
                    'bg-green-400 shadow-[0_0_8px_#4ade80]'
                  }`}></div>
                <span className="text-[8px] sm:text-[10px] font-black uppercase text-couple-text">
                  {showSyncIndicator ? 'SYNCING...' : 
                   syncStatus.isBuffering ? 'BUFFERING' : 
                   (!syncStatus.isSynced ? `DRIFT: ${syncStatus.drift.toFixed(1)}s` : 'SYNCED')}
                </span>
              </div>
              
              {/* Manual Re-sync Button */}
              {!syncStatus.isSynced && (
                <button
                  onClick={() => {
                    if (videoState && playerRef.current) {
                      const targetTime = videoState.playedSeconds || 0;
                      setShowSyncIndicator(true);
                      isSeeking.current = true;
                      playerRef.current.seekTo(targetTime, 'seconds');
                      setTimeout(() => { 
                        isSeeking.current = false; 
                        setShowSyncIndicator(false);
                      }, 1000);
                      console.log(`[Manual Sync] Re-syncing to ${targetTime.toFixed(2)}s`);
                    }
                  }}
                  className="love-glass-pill py-1 px-2 text-[8px] font-black uppercase text-couple-pink hover:bg-couple-pink/20 transition-colors"
                >
                  🔄 SYNC
                </button>
              )}
              
              {/* Connection Quality Indicator */}
              {syncStatus.connectionQuality && syncStatus.connectionQuality !== 'good' && (
                <div className={`love-glass-pill py-1 px-2 text-[8px] font-black uppercase ${
                  syncStatus.connectionQuality === 'fair' ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  📶 {syncStatus.connectionQuality.toUpperCase()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Bar */}
      <div className="flex items-center justify-between px-1 py-1 gap-2">
        {/* ... (as before or simplified) ... */}
        <div className="text-[10px] text-couple-secondary opacity-60 font-bold uppercase">
          {isHost ? 'You are controlling playback' : 'Synced with Host'}
        </div>
        <div className="flex items-center">
          <span className="text-[10px] sm:text-[12px] font-bold text-couple-pink whitespace-nowrap">
            {videoState?.isPlaying ? 'STREAMING LIVE' : 'PAUSED'}
          </span>
        </div>
      </div>
    </div>
  );
}


