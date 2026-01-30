# Video Synchronization Features

## Overview
This document describes the enhanced video synchronization features implemented in the Watch Party application.

## Features Implemented

### 1. **New User Join Synchronization**
When a new user joins the room while a video is already playing:
- ✅ The new user's video player automatically seeks to the current playback position
- ✅ The video starts playing from where other users are watching (not from the beginning)
- ✅ The playback state (playing/paused) is synchronized

**Implementation**: 
- Backend sends current `videoState` (including `playedSeconds`) in the `sync-state` event when a user joins
- Frontend `onReady` handler seeks to `videoState.playedSeconds` when the video loads
- A temporary `isSeeking` flag prevents state broadcasts during initial sync

### 2. **Timeline Seek Synchronization**
When any user (especially the director) moves the video timeline:
- ✅ The `onSeek` event is captured and broadcasts the new timestamp
- ✅ All other users' videos automatically jump to the same position
- ✅ No duplicate or conflicting seek events (prevented by `isSeeking` flag)

**Implementation**:
- Added `onSeek` handler to ReactPlayer that broadcasts seek position via `onStateChange`
- Added `useEffect` to watch for `videoState.playedSeconds` changes from other users
- Auto-seeks when timestamp difference > 2 seconds and update came from another user

### 3. **Continuous Playback Synchronization**
During normal playback:
- ✅ Video position is periodically updated to keep all users in sync
- ✅ Drift detection: if users get more than 3 seconds out of sync, position is updated
- ✅ Updates are throttled to avoid network spam (only when drift > 3 seconds)

**Implementation**:
- `onProgress` handler monitors playback and detects drift
- Only the user who triggered the current state broadcasts position updates
- Other users continuously check for drift and re-sync as needed

### 4. **User Identification in State Updates**
- ✅ Every video state change includes `updatedBy` field with the userId
- ✅ Users don't react to their own state changes (prevents infinite loops)
- ✅ Other users only sync when state was updated by someone else

**Implementation**:
- `useRoom.ts`: `updateVideoState` automatically adds `updatedBy: userId`
- Backend preserves `updatedBy` field when broadcasting state
- Frontend checks `videoState.updatedBy !== userId` before syncing

## Technical Details

### Modified Files

1. **`components/VideoPlayer.tsx`**
   - Added `isSeeking` ref to prevent recursive state updates
   - Added `lastSeekTime` state for seek tracking
   - New `useEffect` to sync playback position from other users
   - Enhanced `onReady` to seek to current position for new joiners
   - Added `onSeek` handler to broadcast timeline changes
   - Improved `onProgress` with drift detection and periodic sync

2. **`hooks/useRoom.ts`**
   - Modified `updateVideoState` to include `updatedBy` field
   - Updated dependency array to include `userId`

3. **`server/index.js`**
   - Enhanced `video-state` handler with better comments
   - Ensures `updatedBy` and `playedSeconds` are properly stored and broadcast

### Key Mechanisms

#### Preventing Infinite Loops
```typescript
const isSeeking = useRef(false);

// When receiving seek from another user
isSeeking.current = true;
playerRef.current.seekTo(targetTime, 'seconds');
setTimeout(() => { isSeeking.current = false; }, 500);

// In event handlers
if (!isSeeking.current) {
  // Only broadcast if not currently syncing
  onStateChange({ playedSeconds: seconds });
}
```

#### User-Specific Updates
```typescript
// Only sync if update came from another user
if (videoState?.url && videoState.updatedBy !== userId) {
  setUrl(videoState.url);
}

// Seek to sync position
if (videoState.updatedBy !== userId && Math.abs(currentTime - targetTime) > 2) {
  playerRef.current.seekTo(targetTime, 'seconds');
}
```

## Testing Scenarios

### Scenario 1: New User Joins Mid-Video
1. User A starts a video and plays for 2 minutes
2. User B joins the room
3. **Expected**: User B's video seeks to 2:00 and starts playing in sync

### Scenario 2: Director Seeks Forward
1. Multiple users are watching at 1:00
2. Director drags timeline to 3:00
3. **Expected**: All users' videos jump to 3:00 simultaneously

### Scenario 3: Playback Drift Correction
1. Users are watching but network lag causes User B to drift to 1:05 while others are at 1:10
2. Drift detection kicks in
3. **Expected**: User B automatically re-syncs to 1:10

### Scenario 4: Rapid State Changes
1. User rapidly pauses, plays, and seeks
2. **Expected**: No infinite loops, no duplicate events, smooth experience for all users

## Future Improvements

- [ ] Add visual indicator when auto-syncing (e.g., "Syncing with director...")
- [ ] Implement buffer/latency visualization
- [ ] Add manual "re-sync" button for users experiencing issues
- [ ] Consider reducing sync threshold from 2s to 1s for tighter synchronization
- [ ] Add analytics to track sync quality and network performance

## Configuration Parameters

You can adjust these values in `VideoPlayer.tsx`:

```typescript
// Seek sync threshold (seconds)
const SEEK_SYNC_THRESHOLD = 2; // Line ~31

// Progress update threshold (seconds)
const PROGRESS_UPDATE_THRESHOLD = 3; // Line ~90

// Seek cooldown (milliseconds)
const SEEK_COOLDOWN = 500; // Line ~38
```
