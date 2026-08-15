# Girasole — Panini e Caffè

Site minimal pentru [Girasole București](https://www.instagram.com/girasole.bucuresti/).

**Live:** https://girasole-seven.vercel.app  
**Admin:** https://girasole-seven.vercel.app/admin  
**Repo:** https://github.com/adimolnar85am-bot/girasole

## Pe alt device

```bash
git clone https://github.com/adimolnar85am-bot/girasole.git
cd girasole
```

Deschide folderul în Cursor, apoi `index.html` în browser.

## Local

Deschide `index.html` în browser. Conținutul se încarcă din `data/site-content.json`.

## Panou admin

Proprietarul site-ului poate edita tot conținutul (texte, meniuri, contact, imagini) la **`/admin`**.

### Configurare Vercel (o singură dată)

1. **GitHub token** (pentru salvare):
   - GitHub → **Settings** → **Developer settings** → **Personal access tokens**
   - Creează un token (classic sau fine-grained) cu permisiune **Contents: Read and write** pe repo-ul `girasole`
   - Copiază token-ul

2. **Vercel Dashboard** → proiectul `girasole` → **Settings** → **Environment Variables**:
   - `ADMIN_PASSWORD` — parola ta pentru login
   - `ADMIN_SECRET` — un șir lung aleator (ex. `openssl rand -hex 32`)
   - `GITHUB_TOKEN` — token-ul GitHub de mai sus
   - `GITHUB_REPO` — opțional, implicit `adimolnar85am-bot/girasole`
   - `GITHUB_BRANCH` — opțional, implicit `master`

3. **Redeploy** după setarea variabilelor

### Utilizare

1. Mergi la `/admin`
2. Autentifică-te cu parola setată
3. Editează secțiunile dorite
4. Apasă **Salvează modificările** — conținutul se scrie în `data/site-content.json` pe GitHub și site-ul se actualizează imediat

Modificările sunt salvate direct în repository (versionate în git). Nu e nevoie de Vercel Blob sau alt serviciu de stocare.

## Conținut

- Hero cu logo și imagini
- Meniul săptămânii + meniu Panini / Caffè
- Formular rezervări (email configurabil din admin)
- Contact + hartă (Strada Austrului nr. 1)

Imaginile se referă prin cale relativă (ex. `assets/coffee.jpg`). Pentru imagini noi, încarcă fișierul în `assets/` via GitHub, apoi actualizează calea în admin.
