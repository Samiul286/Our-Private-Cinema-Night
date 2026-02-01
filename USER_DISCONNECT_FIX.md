# User Disconnect Issue - Fixed

## Problem
When a user left the room (closed tab, navigated away, or disconnected), they were still shown as present in the room for other users.

## Root Causes

1. **Server-side**: The `disconnecting` event handler was iterating through all socket rooms, including the socket's own ID room, which could cause issues.

2. **Client-side VideoCall component**: The `callInitiatedFor` ref was tracking which users had been called, but was never cleaned up when users disconnected, potentially causing stale state.

3. **Missing explicit leave handler**: There was no explicit `leave-room` event handler on the server, relying only on the `disconnecting` event which may not always fire reliably.

4. **Client-side tracking**: The VideoCall component wasn't properly cleaning up its internal tracking when the users list changed.

## Solutions Implemented

### 1. Server-side (server/index.js)

- **Added socket.id filter**: Modified the `disconnecting` event handler to skip the socket's own room ID
- **Added explicit leave-room handler**: Created a new `leave-room` event handler that explicitly removes users from rooms when they navigate away

### 2. Client-side (hooks/useRoom.ts)

- **Emit leave-room on unmount**: Added `socket.emit('leave-room', { roomId, userId })` in the cleanup function
- **Updated leaveRoom function**: Made it explicitly emit the leave-room event instead of being a no-op

### 3. Client-side (components/VideoCall.tsx)

- **Added user-disconnected listener**: Added a listener for the `user-disconnected` event that cleans up the `callInitiatedFor` ref
- **Added users list sync**: Modified the users effect to clean up tracking for users who are no longer in the room

## How It Works Now

1. When a user closes the tab or navigates away:
   - The `useRoom` hook's cleanup function emits `leave-room`
   - Server receives the event and removes the user from the room
   - Server emits `user-disconnected` and `update-users` to remaining users

2. When a user's connection drops unexpectedly:
   - Socket.io's `disconnecting` event fires
   - Server removes the user and notifies others
   - Fallback ensures cleanup even if explicit leave wasn't sent

3. On the client side:
   - `useRoom` updates the users list when receiving `update-users`
   - `useWebRTC` cleans up peer connections when receiving `user-disconnected`
   - `VideoCall` cleans up its internal tracking refs

## Testing

To verify the fix:
1. Open the app in two browser windows
2. Join the same room from both windows
3. Close one window or navigate away
4. The other window should immediately show the user as disconnected
5. The "Together Now" count should update correctly
