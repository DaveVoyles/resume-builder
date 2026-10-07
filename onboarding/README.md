# Onboarding home

Static HTML for the public three-tab dashboard: Introduction, FAQ, and Jobs.

Open it with `npm run home`. It listens on port 4321 by default. The home page has an "Open my tracker" link to http://localhost:4321/tracker.html, which serves `candidate/outputs/tracker.html`. If that file is missing, the route explains how to build it with `npm run workspace:tracker:html -- --workspace candidate`.
