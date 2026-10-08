# Posting snapshots

Each job gets files named after a short slug, for example `6sense-staff-pm-agentic-platform`:

| File | Required | What it is |
| --- | --- | --- |
| `<slug>.md` | yes | The posting text, the way the other personas' postings are written. First line is `# <job title>`, then `Company: <name>` and `Location: <where>` lines, then the page text as published. Keep the original wording. |
| `<slug>.html` | no | The saved web page (browser "Save Page As, HTML only"). Strip nothing; it shows what the page looked like. |
| `<slug>.png` or `.pdf` | no | A screenshot or a printed copy of the page. |

Put these lines right under the company and location lines of the `.md` file:

```
Source: <the page URL>
Retrieved: <YYYY-MM-DD>
```

If the page is gone later, the `.md` snapshot is what the tests and the showcase use.

## What is committed here

Three real postings, saved on 2026-10-08. Each has the posting text (`.md`) and an offline screenshot (`.jpg`) rendered from the saved web page with all network requests blocked.

The saved web pages themselves are not committed: they are 200 to 700 KB each, carry the sites' tracking scripts, and one has a photo of a person. The Bentley screenshot is cropped below that photo. The pages looked different when they were live; the screenshots show the saved copy, which lost some styling when it was saved.
