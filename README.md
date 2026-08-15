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

1. **Vercel Dashboard** → proiectul `girasole` → **Settings** → **Environment Variables**
2. Adaugă:
   - `ADMIN_PASSWORD` — parola ta pentru login
   - `ADMIN_SECRET` — un șir lung aleator (ex. `openssl rand -hex 32`)
3. **Storage** → **Create Blob Store** → conectează la proiect (generează automat `BLOB_READ_WRITE_TOKEN`)
4. Redeploy după setarea variabilelor

### Utilizare

1. Mergi la `/admin`
2. Autentifică-te cu parola setată
3. Editează secțiunile dorite
4. Apasă **Salvează modificările** — site-ul public se actualizează imediat

Modificările se salvează în Vercel Blob. Fără Blob configurat, site-ul afișează conținutul din `data/site-content.json`, dar salvarea din admin nu funcționează.

## Conținut

- Hero cu logo și imagini
- Meniul săptămânii + meniu Panini / Caffè
- Formular rezervări (email configurabil din admin)
- Contact + hartă (Strada Austrului nr. 1)

Imaginile se referă prin cale relativă (ex. `assets/coffee.jpg`). Pentru imagini noi, încarcă fișierul în `assets/` via Git sau Vercel, apoi actualizează calea în admin.
