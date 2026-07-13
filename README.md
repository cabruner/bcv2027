# Bruner Carnivale Venice 2027

Simple event website for **Bruner Carnivale Venice 2027** — [bcv2027.com](https://bcv2027.com).

## Stack

- Static HTML/CSS (no build step)
- Hosted on **GitHub Pages**
- Custom domain: `bcv2027.com`

## Local preview

Open `index.html` in a browser, or from this folder:

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080

## Deploy

Pushes to `main` publish via GitHub Pages (source: Deploy from branch → `/` root).

### Custom domain (bcv2027.com)

1. In the domain registrar DNS, add:
   - **A records** for apex `@` pointing to GitHub Pages IPs:
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
   - Optional **CNAME** for `www` → `cabruner.github.io`
2. In the GitHub repo: **Settings → Pages → Custom domain** → `bcv2027.com` (and enable HTTPS once DNS propagates).
3. The `CNAME` file in this repo keeps the domain wired after deploys.

## Edit content

Update copy, dates, and location in `index.html`. Styles live in `styles.css`.
