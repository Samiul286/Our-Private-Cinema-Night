# Deployment Guide

This app is now split into two parts:
1. **Frontend**: Next.js application (Deploy to Vercel)
2. **Backend**: Node.js + Socket.IO server (Deploy to Render/Railway)

## 1. Backend Deployment (Render.com)

1.  Push your code to GitHub.
2.  Go to [Render Dashboard](https://dashboard.render.com).
3.  Click **New +** -> **Web Service**.
4.  Connect your GitHub repository.
5.  **Root Directory**: Set to `server`.
6.  **Build Command**: `npm install`
7.  **Start Command**: `node index.js`
8.  **Environment Variables**:
    -   `PORT`: `3001` (or let Render assign one, usually PORT is auto-assigned)
    -   Add `CORS_ORIGIN` if you implemented strict CORS (optional for now).
9.  Click **Create Web Service**.
10. Copy the **Service URL** (e.g., `https://watch-party-server.onrender.com`).

## 2. Frontend Deployment (Vercel)

1.  Go to [Vercel Dashboard](https://vercel.com/dashboard).
2.  Import your GitHub repository.
3.  **Framework Preset**: Next.js (Default).
4.  **Environment Variables**:
    -   `NEXT_PUBLIC_SOCKET_URL`: Paste the **Backend Service URL** from Render (e.g., `https://watch-party-server.onrender.com`).
5.  Click **Deploy**.

## Verification
-   Open your Vercel deployment URL.
-   Create a room.
-   Open console (F12) -> Check if "Socket connected" message appears.
-   If you see connection errors, ensure `NEXT_PUBLIC_SOCKET_URL` does NOT have a trailing slash (unless your code handles it, but usually standard is without).
