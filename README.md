# HostelBites (zenvy) - Deployment Guide

Bro, this is a **multi-service ecosystem**. You cannot deploy it as a single "Web Service" from the root.

## 🚀 Correct Deployment (Render Blueprints)
To deploy everything correctly (Backend + 3 Apps), follow these steps:

1. Go to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** at the top right.
3. Select **Blueprint**.
4. Connect the `zenvy` repository.
5. Render will automatically read the `render.yaml` file and create all 4 services for you!

## 🛠️ Manual Deployment (If you only want one service)
If you must deploy a single service (e.g., just the Backend):
1. Create a **New Web Service**.
2. Connect the repo.
3. In the settings, set **Root Directory** to `backend` (or `frontend`, etc.).
4. Use `npm install` for build and `npm start` for runtime.
