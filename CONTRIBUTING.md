# Contribuer à EditorX

Merci de votre intérêt ! Ce document décrit les conventions à respecter pour que votre
contribution soit intégrée rapidement.

---

## Prérequis

- **Node.js ≥ 18** (20 LTS recommandé) et npm
- Aucune autre dépendance système : le projet est 100 % front-end

```bash
npm install
npm run dev        # http://localhost:8080/app/ — le /app/ final est obligatoire
```

---

## Avant d'ouvrir une Pull Request

`npm run test:all` doit passer intégralement :

```bash
npm run lint        # ESLint — 0 erreur exigée (les 4 avertissements shadcn existants tolérés)
npm run typecheck   # tsc --noEmit — strict: true, noUnusedLocals/Parameters actifs
npm run test:run    # 139 tests unitaires Vitest
npm run test:e2e    # Build + Playwright (Chromium, Firefox, WebKit, Pixel 7)
```

Un test rouge n'est jamais « à corriger plus tard ». En itération rapide :
`npm run test:e2e:chromium`.

---

## Règles impératives

Ces invariants sont détaillés dans [continue.md](./continue.md) — chacun correspond à un défaut
ayant réellement existé. Les lire avant toute modification :

1. **Aucune requête réseau vers un tiers** : Monaco et les polices sont embarqués. Un test E2E
   échoue à la moindre requête externe. Pas de CDN, pas d'API distante.
2. **Tout import statique du chunk d'entrée doit être précaché**, sinon l'application ne démarre
   pas hors ligne. Les modules lourds (`jszip`, `prettier`) passent par `import()` dynamique.
3. **`files` est un nouveau tableau à chaque frappe** : ne jamais en faire dépendre un effet ou un
   composant directement ; dériver une signature d'ids ou mémoïser sur les métadonnées.
4. **Un fichier `binary` ne subit aucun traitement texte** (recherche, remplacement, formatage,
   aperçu) : un `replace` sur du base64 détruit le fichier.
5. **Fermer un onglet ne supprime jamais un fichier.**
6. **Aucune écriture ne doit lever** : les échecs remontent par `SaveOutcome`.
7. **L'iframe d'aperçu garde `sandbox` sans `allow-same-origin`.**
8. **Le contenu Markdown passe toujours par `renderMarkdown()`** (DOMPurify).

---

## Conventions de code

- **Français** pour l'interface, les commentaires et les messages de commit ;
  **anglais** pour les identifiants de code.
- **TypeScript `strict`**, pas de `any`.
- **Commentaires utiles uniquement** : expliquer *pourquoi*, pas *quoi*. Les commentaires
  existants documentent souvent un bug réel — ne pas les supprimer sans comprendre.
- Un composant par fichier ; hooks dans `src/hooks/`, logique pure dans `src/utils/`.
- **Pas de nouvelle dépendance** sans nécessité démontrée.

### Interface

L'interface est **en français uniquement** — l'internationalisation a été écartée par décision
produit. Les sélecteurs E2E s'appuient sur les noms accessibles français : toute nouveauté
d'interface doit fournir son nom accessible.

---

## Tests

- **Toute correction de bug s'accompagne d'un test de non-régression** dans
  `e2e/regressions.spec.ts` (un test par défaut ayant réellement existé — ne jamais en supprimer).
- **La logique pure se teste en Vitest**, sans navigateur, colocalisé `*.test.ts`.
- **Pas de `retry` ni de `waitForTimeout`** pour masquer une instabilité : rejouer en série
  (`--repeat-each=3 --workers=1`) pour déterminer s'il s'agit du test ou du code.
- Pièges connus (IndexedDB, persistance réelle, remontée de Monaco…) : voir
  [continue.md](./continue.md) §5.

---

## Format des commits

Style **Conventional Commits**, en français :

```
feat: ajout du sélecteur de format d'écran dans l'aperçu
fix: conservation des binaires lors d'un remplacement global
docs: mise à jour de structure.md après la 1.7.0
test: non-régression fermeture d'onglet
refactor: extraction de useSearch du panneau de recherche
chore: retrait de la lockfile bun obsolète
```

- Périmètre optionnel : `fix(preview): …`
- Une PR = un sujet cohérent. Le message décrit le *pourquoi*, le diff décrit le *comment*.

---

## Documentation

Toute évolution de fonctionnalité met à jour, selon le cas : `features.md` (statut),
`changelog.md` (entrée `[Non publié]`), `structure.md` (architecture). Les chiffres affichés
(tailles de chunks, précache, comptages de tests) sont **mesurés, pas estimés** — cf.
« Vérifier avant d'affirmer » dans [agents.md](./agents.md).

---

## Licence

En contribuant, vous acceptez que vos contributions soient publiées sous licence
[MIT](./LICENSE).
