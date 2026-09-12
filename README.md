# Bruner Carnivale Venice 2027

Private guest site for **Bruner Carnivale Venice 2027** — [bcv2027.com](https://bcv2027.com).

**Save the Date: February 5 & 6, 2027 — Venice, Italy.** Aileen & Chris Bruner's
(late) 25th wedding anniversary celebration, held during Carnevale di Venezia.

- Fully private: email must be on the whitelist, then guests create a password
- Auth + whitelist: **Supabase**
- Hosting: **GitHub Pages** (static shell)

## Guest flow

1. Enter email → humorous “checking the list…”
2. Not whitelisted → polite denial
3. Whitelisted → create password (first visit) or sign in
4. Returning guests can reset a forgotten password or resend confirmation
5. Signed-in guest home: **Yes / Maybe / No RSVP** first, then weekend details,
   WhatsApp group, and travel/masks as they firm up
6. Aileen & Chris (hosts) also see a **guest responses** report they can download as CSV

## Guest whitelist

Managed in the Supabase table `allowed_emails`, which is the source of truth.

`supabase/guests.sql` loads the 42 guests we have addresses for (from
`NameEmail.xlsx`) and is safe to re-run. **It is gitignored on purpose** — this
repo is public, and that file holds real names and email addresses. Keep your
local copy, or regenerate it from the spreadsheet; never commit it.

Eight more people are on the list but have no email yet; they're listed in a
comment at the bottom of that file. Add each one as their address turns up:

```sql
insert into public.allowed_emails (email, note)
values ('friend@example.com', 'Tom Chapman')
on conflict (email) do nothing;
```

They open the site, enter that email, and create their own password.

## Supabase setup (one-time)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → New query → paste and run all of [`supabase/schema.sql`](supabase/schema.sql).
3. **Authentication → Providers → Email**: Email must be **Enabled**. Leave other providers off.
4. **Authentication → URL Configuration**: set the Site URL to `https://bcv2027.com` and add these Redirect URLs so confirmation and password-reset links return to the site:
   - `https://bcv2027.com/**`
   - `http://127.0.0.1:8765/**` (local preview only)
5. **Authentication → Providers → Email → Confirm email**: turn this **Off**. Guests can then create a password and enter immediately. If it stays on, they must confirm by email first; the site can resend that message, but sign-in will fail until they do.
6. **Project Settings → API**: copy the **Project URL** and **publishable** (or legacy anon public) key into [`config.js`](config.js):

```js
window.BCV_CONFIG = {
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseAnonKey: "sb_publishable_...",
  whatsappGroupUrl: "https://chat.whatsapp.com/YOUR_INVITE",
};
```

Never put the **service_role** or secret key in this repo or in the browser.

7. Commit/push `config.js` (the publishable key is public by design) or inject it in deploy — either is fine.
8. Local preview:

```bash
cd ~/Code/bcv2027
python3 -m http.server 8765
```

On Windows without Python, any static server works — e.g. with Node installed:

```bash
npx serve -l 8765
```

Open http://127.0.0.1:8765 (ES modules need a local server, not `file://`).
Add `?preview` to skip the gate and review layout (`http://127.0.0.1:8765/?preview`).

## RSVP (existing project)

If the site is already live, also run [`supabase/rsvp.sql`](supabase/rsvp.sql) in the
SQL Editor. That adds:

- `allowed_emails.is_host` — Aileen, Chris, and Claudia are flagged; add another host with
  `update public.allowed_emails set is_host = true where email = 'you@example.com';`
- `rsvps` — one Yes / No / Maybe per invited email, changeable anytime
- RPCs: `get_my_rsvp`, `set_my_rsvp`, `i_am_host`, `guest_rsvp_report`

Guests never see the full list. Only hosts can load the report (name, email,
RSVP, whether they have created an account).

## WhatsApp group

Put the invite URL in `config.js` as `whatsappGroupUrl`. The signed-in page then
shows a link and a QR code. Leave it blank to hide that card.

## Deploy

Pushes to `main` publish via GitHub Pages. Custom domain: `bcv2027.com` (`CNAME` file).

## Project layout

| Path | Purpose |
|------|---------|
| `index.html` | Gate + private shell |
| `app.js` | Supabase auth + whitelist check |
| `config.js` | Supabase URL + publishable key |
| `styles.css` | UI |
| `supabase/schema.sql` | Whitelist table, RPC, signup trigger, RSVP |
| `supabase/rsvp.sql` | Additive RSVP + host report for the existing project |
| `supabase/guests.sql` | Guest email whitelist — **gitignored, local only** |
| `images/` | Venice skyline + Carnevale mask illustrations |

## Security notes

- Full email list is **not** readable by the client; only `is_email_allowed(email)` → true/false.
- Signups are blocked in the database if the email is not whitelisted (even if someone calls the Auth API directly).
- Private **content** should stay behind auth as we add it; avoid putting sensitive details only in git if the repo is public (we can move rich content into Supabase later).
