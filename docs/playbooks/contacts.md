# Contacts playbook

**Contacts** tracks your professional network — referrals, former colleagues, recruiters,
informational-interview contacts — independently of any specific tracked role. A contact can
exist before, during, or after any role's lifecycle: you might meet someone months before
applying anywhere, or a role's rejection might turn into a referral for a different opening. The
workflow is `add-contact` → `set-contact-status` (as the relationship progresses) →
`build-contacts-tracker` (to see the whole network at a glance).

Before you start:

- The candidate should have completed intake (grill playbook), though contacts don't strictly
  depend on `profile.json`/`evidence.jsonl` the way resume generation does.
- You'll add a contact whenever the candidate mentions meeting someone relevant — a referral, a
  recruiter reaching out, a former colleague at a target company.
- You'll update a contact's status as the relationship progresses, the same way `set-status`
  tracks a role's application progress.

---

## Start the contacts workflow

**Propose a recommended approach:**

"Whenever you mention meeting someone relevant to your search — a referral, a recruiter, a former
colleague — I'll add them to your contact tracker. As the relationship progresses (you reach out,
they respond, you meet), I'll update their status and keep a running tracker of who to follow up
with and when."

**Confirm you're ready:**

- [ ] You have write access to `candidate/contacts.json` (created automatically on first
      `add-contact`).

---

## Section 1: Add a contact

```bash
npm run workspace:add-contact -- --workspace candidate \
  --name "<Full Name>" --relationship <relationship> \
  [--company "<Company>"] [--linked-role <role-id>] [--notes "<text>"]
```

`--relationship` is required, one of: `referral`, `former-colleague`, `recruiter`,
`informational-interview`, `other`. `--linked-role` is repeatable — pass it once per tracked role
this contact relates to (a referral inside a specific company you're targeting, for example);
omit it entirely for a contact with no specific role link yet. A newly-added contact starts at
status `identified` — no `nextAction` yet.

## Section 2: Update status as the relationship progresses

```bash
npm run workspace:set-contact-status -- --workspace candidate \
  --id <contact-id> --status <status> [--date <YYYY-MM-DD>]
```

`--status` is one of: `identified`, `reached-out`, `responded`, `meeting-scheduled`, `met`,
`referred`, `no-response`, `dormant`. Each transition auto-proposes a `nextAction` the same way
`set-status` does for tracked roles — see [Workspace schemas](../workspace-schemas.md#contactsjson)
for the full rule table. `no-response` and `dormant` are terminal (close out the follow-up, no new
`nextAction`); the rest set a follow-up due date a few days out.

**Example:** a referral responds to your outreach —

```bash
npm run workspace:set-contact-status -- --workspace candidate --id contact-001 --status responded
```

— proposes a follow-up ("schedule a call or meeting") due in 3 days.

## Section 3: Build the contacts tracker

```bash
npm run workspace:contacts-tracker -- --workspace candidate [--format md|html]
```

Renders `outputs/contacts.md` (default) or an interactive `outputs/contacts.html`, sorted by
`nextAction.dueDate` ascending — contacts with no pending follow-up sort last, so the people
needing attention soonest are always at the top. This is a separate view from the role tracker
(`build-tracker`) — a contact isn't a role, and not every contact links to one.

## Related pages

- [Workspace schemas](../workspace-schemas.md#contactsjson) — the full `contacts.json` schema,
  status enum, and next-action rule table.
- [`tailor.md`](tailor.md) — contacts often surface mid-tailor (a referral for the exact role
  you're drafting); there's no required sequencing between the two workflows.
