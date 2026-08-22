# Cursor Cloud vs Mini

Cloud: `scripts/setup-cursor-cloud.sh` runs `npm ci` and `npm run validate` on the sample workspace.

Mini / local: real `candidate/` workspace, privacy check before share, any landing-floor close-out.

Never copy a live candidate folder or secrets into Cloud.

GitHub Actions: `.github/workflows/cursor-cloud-setup.yml` runs the same script on `ubuntu-latest` (Node 22 when the prove needs npm/pnpm).
