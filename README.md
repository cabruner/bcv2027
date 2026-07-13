# Bruner Carnivale Venice 2027

Private guest site for **Bruner Carnivale Venice 2027** — [bcv2027.com](https://bcv2027.com).

- Fully private: email must be on the whitelist, then guests create a password
- Auth + whitelist: **Supabase**
- Hosting: **GitHub Pages** (static shell)

## Guest flow

1. Enter email → humorous “checking the list…”
2. Not whitelisted → polite denial
3. Whitelisted → create password (first visit) or sign in
4. Signed-in home (content coming soon)

## Initial whitelist

Managed in Supabase table `allowed_emails` (not in the public repo as the source of truth):

- `aileenpb@gmail.com`
- `christian.a.bruner@gmail.com`
- `claudia@theweddinglibrary.com`

### Add more guests later

In Supabase → SQL:

```sql
insert into public.allowed_emails (email, note)
values ('friend@example.com', 'wave 2');
```

They open the site, enter that email, and create their own password.

## Supabase setup (one-time)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → New query → paste and run all of [`supabase/schema.sql`](supabase/schema.sql).
3. **Authentication → Providers → Email**: enable Email.
4. **Authentication → Providers → Email** (or Auth settings): for a smooth guest experience on a small list, turn **off** “Confirm email” so create-password signs them in immediately. You can turn confirmation on later if you prefer.
5. **Project Settings → API**: copy **Project URL** and **anon public** key into [`config.js`](config.js):

```js
window.BCV_CONFIG = {
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseAnonKey: "eyJhbGciOi...",
};
```

Never put the **service_role** key in this repo or in the browser.

6. Commit/push `config.js` (anon key is public by design) or inject it in deploy — either is fine.
7. Local preview:

```bash
cd ~/Code/bcv2027
python3 -m http.server 8765
```

Open http://127.0.0.1:8765 (ES modules need a local server, not `file://`).

## Deploy

Pushes to `main` publish via GitHub Pages. Custom domain: `bcv2027.com` (`CNAME` file).

## Project layout

| Path | Purpose |
|------|---------|
| `index.html` | Gate + private shell |
| `app.js` | Supabase auth + whitelist check |
| `config.js` | Supabase URL + anon key |
| `styles.css` | UI |
| `supabase/schema.sql` | Whitelist table, RPC, signup trigger |

## Security notes

- Full email list is **not** readable by the client; only `is_email_allowed(email)` → true/false.
- Signups are blocked in the database if the email is not whitelisted (even if someone calls the Auth API directly).
- Private **content** should stay behind auth as we add it; avoid putting sensitive details only in git if the repo is public (we can move rich content into Supabase later).
