# Apply playbook

How to fill an application form safely.

1. Save the job with `add-lead`. This only writes a note to `leads.json`.
2. Ask the person if they want to apply. They must say yes first.
3. Only after a yes, run `approve-apply`. It records the approval in `apply-approvals.json`.
4. Run `apply --dry-run`. It refuses to continue without an approval. With one, it prints a plan: company, title, `confirmSubmit`, and where the profile is read from.
5. The default never submits. `--confirm-submit` is the only path that submits, and even then only when no required field is missing.

Rules:

- The profile lives in `<workspace>/apply-profile.json`. It is gitignored. Copy `examples/apply-profile.example.json` to start.
- If a required field has no profile value (for example an empty phone), it is reported as missing. The tool never invents values.
- Apply never sets a role to `applied`. Use `set-status` yourself after you really apply.
- Tests use a fake form function, not a live job site.
- `export-pdf` needs LibreOffice (`soffice` on PATH). It never launches Microsoft Word.
