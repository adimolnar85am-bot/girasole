# Girasole Sanity Studio

Panoul de administrare pentru continutul site-ului Girasole.

## Configurare

1. Creeaza un proiect in Sanity si un dataset numit `production`.
2. Copiaza Project ID din Sanity Manage.
3. In folderul `studio`, seteaza variabilele:
   - `SANITY_STUDIO_PROJECT_ID`
   - `SANITY_STUDIO_DATASET=production`
4. Ruleaza `npm install`, apoi `npm run dev`.

Project ID-ul este identificator public al proiectului. Nu introduce tokenuri secrete in variabile cu prefixul `SANITY_STUDIO_`, deoarece acestea pot ajunge in bundle-ul Studio.

## Continut

- `siteSettings`: texte, SEO, cover, galerie, despre, contact si footer.
- `menuCategory`: categorii si produse, cu ordine configurabila.

Importul datelor si al fotografiilor se face dupa crearea proiectului Sanity si confirmarea Project ID-ului. Nu sunt incluse credentiale in repository.
