# Grove Manager

FM-style esports manager for *The Ancient Grove*, a custom MOBA. Play: open the GitHub Pages site (deployed from `main`).

## Run locally
Serve the folder over http (the 3D viewer is an ES module, which browsers won't load from `file://`):

    npx serve .        # or: python3 -m http.server

## Tests
    npm ci && npx playwright install chromium
    npm run test:unit      # headless simulation + finance tests (fast, no browser)
    npm run test:browser   # UI tests in Chromium
    npm run playtest       # bot plays a full split on desktop + phone through the real UI → test-results/
    npm run pacing         # match balance/pacing stats over N simulated games

All of these run in CI on every push/PR (see `.github/workflows/tests.yml`); playtest screenshots are uploaded as an artifact.
