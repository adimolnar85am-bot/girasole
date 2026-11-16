# Girasole Sanity Studio

Panoul de administrare pentru continutul site-ului Girasole.

## Proiect conectat

- Sanity Project ID: `zw7ud6de`
- Dataset: `production`
- Studio local: folderul `studio`

## Pornire Studio

Din terminal, in folderul `studio`:

```bash
npm install
npm run dev
```

Pentru publicarea panoului in contul Sanity:

```bash
npx sanity deploy
```

Publicarea Studio este separata de publicarea site-ului. Nu modifica domeniul public al site-ului.

## Import initial al continutului

Importul preia textele, toate cele 6 categorii, cele 62 de produse si imaginile existente din `data/site-content.json` si `assets/`.

1. In Sanity Manage, verifica daca dataset-ul `production` exista. Daca nu exista, creeaza-l si seteaza vizibilitatea **Public**. Site-ul citeste continutul public fara token.
2. In Project Settings > API, genereaza un token cu drepturi de scriere pentru import.
3. Copiaza `.env.example` ca `.env` in acest folder.
4. Completeaza local `SANITY_PROJECT_ID=zw7ud6de`, `SANITY_DATASET=production` si `SANITY_API_TOKEN` cu tokenul generat.
5. Din folderul `studio`, ruleaza:

```bash
npm run import:content
```

Tokenul este folosit doar local de scriptul de import. Nu il trimite in chat, nu il adauga in Git si nu il folosi in frontend.

Scriptul verifica faptul ca sursa contine exact 62 de produse inainte sa scrie in Sanity. Poate fi rulat din nou, actualizand documentele cu aceleasi ID-uri.

## Continut editabil

- `Continut site`: SEO, cover, despre, galerie, introducere meniu, contact si footer.
- `Categorii meniu`: cele 6 categorii, fiecare cu produsele sale.

## Conectarea site-ului

Frontend-ul incearca mai intai sa citeasca continutul public din Sanity. Daca Sanity nu raspunde sau continutul nu a fost importat, foloseste fisierul local `data/site-content.json`.

Pentru ca browserul sa poata citi API-ul Sanity, adauga origin-urile site-ului in Sanity Manage > API > CORS Origins. Adauga exact URL-ul Cloudflare Pages de preview si, dupa validare, domeniul final. Pentru citire publica nu activa optiunea Allow credentials. Nu folosi wildcard.

## Cloudflare Pages

Configuratie build:
- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `migration/cloudflare-sanity` doar pentru testare izolata, fara domeniul final de productie.

Nu conecta domeniul public final si nu schimba `master` pana cand testarea nu este aprobata.
