# Onboarding home

Static HTML for the public three-tab dashboard: Introduction, FAQ, and Jobs.

Introduction stays in plain words. Exact `candidate/inputs/` paths are in the collapsed "For your AI agent" note, not in the visible steps. Jobs **Go to setup** opens the Introduction tab, shows the About you form if it is hidden, scrolls to it, and focuses the first field. **Open folder** asks the server to open `my-documents`. The fallback note appears only when the server reports failure or the request fails. Success leaves the note hidden.

Open it with `npm run home`. It listens on port 4321 by default. The home page has an "Open my tracker" link to http://localhost:4321/tracker.html, which serves `candidate/outputs/tracker.html`. If that file is missing, the route explains how to build it with `npm run workspace:tracker:html -- --workspace candidate`.
