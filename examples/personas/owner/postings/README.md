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
