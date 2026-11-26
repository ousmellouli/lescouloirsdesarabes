# Couloirs Arabes — site public

Site statique bilingue (FR `/`, AR `/ar/`) sur les nageurs arabes aux Championnats du monde de natation.
Publié sur GitHub Pages (branche `gh-pages` = contenu de `dist`, via `scripts/deploy.sh`).

- `src/app.html` : la plateforme (données + rendu), identique à l'artefact Claude.
- `src/site.css`, `src/site.js` : couche site (URL partageables, menu actif, barre de progression, onglets mobile, partage, résultats en direct, tableaux en cartes sur mobile).
- `data/results.json` : résultats arabes de Pékin 2026 (`{"updated":"FR|AR","results":[[jour,épreuve,NAT,nomFR,nomAR,phase,rang,temps,flag]]}`), relu par les visiteurs toutes les 5 minutes pendant les Mondiaux.
- `site.config.json` : URL publique (à changer pour un domaine personnalisé, puis reconstruire).
- `node scripts/build.mjs` : pré-rendu FR/AR (Playwright), métadonnées Open Graph, images de partage, sitemap, robots, manifest → `dist/`.
