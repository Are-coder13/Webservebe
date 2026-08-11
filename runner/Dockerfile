# Runner image for Railway/Render/Fly. Build context = REPO ROOT (the runner
# imports the shared "brain" from ../worker, so both folders must be present).
# Set the service's Dockerfile path to `runner/Dockerfile`.
#
# Uses the official Playwright image, which ships Chromium + all system libs —
# no `npx playwright install --with-deps` needed. Keep the tag's version in sync
# with the "playwright" version in runner/package.json.
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

ENV NODE_ENV=production
WORKDIR /app

# Install deps first (better layer caching)
COPY runner/package.json ./runner/
RUN cd runner && npm install --omit=dev

# Source: the runner + the shared worker modules it imports
COPY worker/ ./worker/
COPY runner/ ./runner/

WORKDIR /app/runner
# Railway/Render inject PORT; server.js reads process.env.PORT (default 8787)
CMD ["node", "server.js"]
