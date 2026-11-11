# Girasole — Panini e Caffè

Site de prezentare pentru Girasole București.

- Repository: https://github.com/adimolnar85am-bot/girasole
- Ramură izolată de test: `test/netlify-migration`

## Configurare Netlify

Conectează repository-ul și selectează ramura `test/netlify-migration`.

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

Setează în Netlify, cu scope Builds, Functions și Runtime:
- `GITHUB_REPO`: `adimolnar85am-bot/girasole`
- `GITHUB_BRANCH`: `test/netlify-migration`
- `GITHUB_TOKEN`: fine-grained token limitat la repository, Contents Read and write
- `ADMIN_PASSWORD`: parolă unică din password manager, minimum 16 caractere
- `ADMIN_SECRET`: secret aleator hexazecimal, minimum 64 caractere

Generează un secret nou local, de exemplu cu `openssl rand -hex 32`. Nu salva parola, tokenul sau secretul în Git, documentație sau fișiere publice.

După modificarea variabilelor, declanșează un nou deployment.

## Admin

Panoul este disponibil la `/admin/`. Autentificarea folosește exclusiv `ADMIN_PASSWORD` și `ADMIN_SECRET` din variabilele Netlify. Nu există parolă implicită sau fallback la un fișier din repository.

Sesiunile expiră după 12 ore. Login-ul aplică o limitare best-effort per instanță: 8 încercări în 15 minute și blocare temporară pentru 15 minute. Pentru protecție globală, activează și rate limiting la nivel de edge/WAF.

## Conținut și imagini

- Conținutul site-ului se salvează în `data/site-content.json`.
- Admin scrie exclusiv în ramura definită de `GITHUB_BRANCH`.
- Upload acceptă JPEG, PNG, GIF și WEBP valide, maximum 4 MB.
- SVG-urile existente pot apărea în biblioteca media, dar nu sunt acceptate la upload.

## Publicare și predare

Build-ul publică doar fișierele site-ului, Admin UI și `data/site-content.json`. Configurația privată și codul API rămân în afara folderului public `dist/`.

Înainte de domeniul clientului, mută repository-ul și site-ul în conturile clientului, regenerează toate credentialele în conturile lui și testează login, salvarea meniului și upload-ul.
