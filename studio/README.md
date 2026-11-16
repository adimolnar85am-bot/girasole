# Girasole Sanity Studio

Panoul de administrare pentru continutul site-ului Girasole.

## Configurare

Proiect Sanity: `zw7ud6de`.
Dataset: `production`.

In folderul `studio`, ruleaza `npm install`, apoi `npm run dev`. Project ID-ul este deja configurat in `sanity.config.js`.

Project ID-ul este identificator public al proiectului. Nu introduce tokenuri secrete in variabile cu prefixul `SANITY_STUDIO_`, deoarece acestea pot ajunge in bundle-ul Studio.

## Continut

- `siteSettings`: texte, SEO, cover, galerie, despre, contact si footer.
- `menuCategory`: categorii si produse, cu ordine configurabila.

Importul datelor si al fotografiilor se face dupa configurarea accesului la proiectul Sanity. Nu sunt incluse credentiale in repository.
