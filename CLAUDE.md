# Midway

Jeux de capture de leads brandés pour marques DTC, vendus en white-label à des agences.
Business de services d'abord : chaque campagne est un build sur mesure. `play.$brandSlug.$campaignSlug.tsx`
est un stand de référence, pas le produit. Le contrat de `/api/play/...` est ce qui doit rester stable.

Stack, commandes, archi : voir README.md.

## Invariants (ne pas casser)
- Tout accès brand/campaign passe par `requireBrand` / `requireCampaign` dans `src/server/functions.ts`. Pas de query directe.
- Les codes promo ne partent jamais au navigateur avant la capture de l'email. La page de jeu ne reçoit que les labels.
- Une capture répétée sur le même email (insensible à la casse) renvoie le prix d'origine.
- Seules les campagnes `live` sont joignables. Les campagnes draft ou ended renvoient un 404 identique à une campagne inexistante.
- `playCount` n'augmente que sur l'action `play`, jamais sur une vue de page.
- `getAuth()` doit lever une erreur si `BETTER_AUTH_SECRET` ou `BETTER_AUTH_URL` manque.

## Règles
- Dépendances épinglées exactement (politique `minimumReleaseAge`) : pas de `pnpm update` global.
- Changement de schéma : modifier `src/db/schema.ts`, puis `pnpm db:generate`. Ne jamais éditer une migration existante.
- Dans un worktree neuf, lancer `pnpm setup:worktree` avant `pnpm dev` ou `verify`.
- La CI exécute `pnpm lint && pnpm typecheck && pnpm test && pnpm build` ; tout doit passer.
