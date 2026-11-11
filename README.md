# Girasole — Panini e Caffè

Site de prezentare pentru Girasole București.

- Repository: https://github.com/adimolnar85am-bot/girasole
- Ramură izolată de test: `test/netlify-migration`

## Configurare Netlify

Conectează repository-ul și selectează ramura `test/netlify-migration`.

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

Configurează în contextul **Production** al site-ului Netlify:
- `GITHUB_REPO`: `adimolnar85am-bot/girasole`
- `GITHUB_BRANCH`: `test/netlify-migration`
- `GITHUB_TOKEN`: fine-grained token limitat la repository, Contents Read and write
- `ADMIN_PASSWORD`: parolă unică, aleasă în password manager, minimum 16 caractere
- `ADMIN_SECRET`: secret aleator hexazecimal, minimum 64 caractere

Toate aceste valori sunt folosite doar de Functions. Dacă interfața planului permite scope separat, selectează numai **Functions**. Nu include secretele în Build sau Post processing. Marchează valorile sensibile ca secrete.

Generează un secret nou local, de exemplu cu `openssl rand -hex 32`. Nu salva parola, tokenul sau secretul în Git, documentație sau fișiere publice. După modificarea variabilelor, declanșează un nou deployment.

## Admin și API

Panoul este disponibil la `/admin/`. Autentificarea folosește exclusiv `ADMIN_PASSWORD` și `ADMIN_SECRET` din variabilele Netlify. Nu există parolă implicită sau fallback la un fișier din repository.

Sesiunile expiră după 12 ore. Login-ul aplică și o limitare best-effort per instanță: 8 încercări în 15 minute și blocare temporară de 15 minute.

Netlify aplică suplimentar rate limiting la nivelul funcțiilor:
- `/api/content`: 60 cereri pe minut per IP și domeniu.
- `/api/assets`: 30 cereri pe minut per IP și domeniu.

## Conținut și imagini

- Conținutul site-ului se salvează în `data/site-content.json`.
- Admin scrie exclusiv în ramura definită de `GITHUB_BRANCH`.
- Upload acceptă JPEG, PNG, GIF și WEBP valide, maximum 4 MB.
- SVG-urile existente pot apărea în biblioteca media, dar nu sunt acceptate la upload.

## Publicare și predare

Build-ul publică doar fișierele site-ului, Admin UI și `data/site-content.json`. Configurația privată și codul API rămân în afara folderului public `dist/`.

Înainte de domeniul clientului, mută repository-ul și site-ul în conturile clientului, regenerează toate credentialele în conturile lui și testează login, salvarea meniului și upload-ul.
