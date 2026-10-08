# Repo owner's resume (real example)

This is the repo owner's own resume, kept here on purpose as a realistic test input: a real career, a Word file with an embedded image, and non-ASCII characters. The owner gave permission to commit it.

Email and phone are scrubbed. The email is replaced with `email-removed@example.com` in the visible text and in the hidden `mailto:` link. The file never had a phone number. Public profile links (LinkedIn, GitHub, website) were left as the owner asked.

- `owner-resume.docx` is the original Word file with the email scrubbed.
- `owner-resume.txt` is the same text as UTF-8 plain text.

Rules:
- Do not put an email address or phone number back in either file. `tests/core/real-resume-example.test.js` fails if you do.
- Do not add anyone else's real resume to the repo.
- Use it like a persona's `inputs/resumes/` file: copy it into a temp or private workspace and ingest it. Never write generated output next to it.
