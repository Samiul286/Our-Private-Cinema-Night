# Video Call Connection Fix

## Problem
The video call was getting stuck on "Waiting for your love..." because:
1.  **Stale Peer Connections**: The code was reusing existing PeerConnection objects without checking if they were `closed` or `failed`.
2.  **Ignored Offers**: The signaling logic had a bug where incoming `offer` signals were ignored if a `peerConnection` object already existed (even if it was broken), due to an empty `if` block.

## Solution
I have updated `hooks/useWebRTC.ts` to:

1.  **Refactor `createPeerConnection`**:
    - Now checks `connectionState`. If it's `closed` or `failed`, it automatically cleans up the old connection and creates a fresh one.
    - Only reuses valid, active connections.

2.  **Fix Offer Handling**:
    - Completely removed the flawed logic that checked for existing connections and did nothing.
    - Now always calls `createPeerConnection(peerId)` when an offer is received. This guarantees we get a valid connection object (either an existing good one or a brand new one) to process the offer.

## Result
Incoming calls will now correctly trigger the creation of a working PeerConnection, allowing the video stream to be established and removing the "Waiting..." message.
