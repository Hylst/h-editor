# AGENTS.md — EditorX

Instructions pour les agents de codage (opencode, Claude Code, Cursor…).
Lire aussi `continue.md` pour le contexte détaillé et les pièges connus.

## Commandes

```bash
npm run dev                # Serveur de développement — http://localhost:8080/app/
npm run build              # Build de production → ./dist/
npm run lint               # ESLint (doit rester à 0 erreur)
npm run typecheck          # tsc --noEmit, mode strict
npm run test:run           # 139 tests unitaires (Vitest), une passe
npm run test:e2e:chromium  # E2E sur Chromium seul — itération rapide
npm run test:e2e           # E2E sur Chromium, Firefox, WebKit, Pixel 7
npm run test:all           # Tout, dans l'ordre
```

**Avant de rendre la main** : `npm run test:all` doit passer intégralement.
Un test rouge n'est jamais « à corriger plus tard ».

## Nature du projet

Éditeur de code **100 % front-end**. Pas de backend, pas de compte, **aucune requête vers un tiers**.
React 18 · TypeScript `strict` · Vite · Monaco · Tailwind · shadcn/ui. Déployé sous `/app/`.

## Règles impératives

1. **Ne jamais introduire de dépendance réseau** (CDN, police distante, API). Monaco et la police
   sont embarqués ; un test E2E échoue à la moindre requête externe.
2. **Tout import statique du chunk d'entrée doit être précaché**, sinon l'application ne démarre pas
   hors ligne. Les modules lourds (`jszip`, `prettier`) sont chargés par `import()` dynamique.
3. **`files` est un nouveau tableau à chaque frappe.** Ne pas en faire dépendre un effet ou un
   composant : dériver une signature d'ids, ou mémoïser sur les métadonnées.
4. **Un fichier `binary` ne subit aucun traitement texte** (recherche, remplacement, formatage,
   aperçu) : un `replace` sur du base64 détruit le fichier.
5. **Fermer un onglet ne supprime jamais un fichier.**
6. **Aucune écriture ne doit lever** : les échecs remontent par `SaveOutcome`.
7. **L'iframe d'aperçu garde `sandbox` sans `allow-same-origin`.** Ne jamais l'assouplir : c'est ce
   qui empêche une page prévisualisée de lire le stockage de l'éditeur. La console interactive y
   évalue du code : conserver la garde `event.source !== parent` dans le pont.
8. **Le contenu Markdown passe toujours par `renderMarkdown()`** (DOMPurify) avant injection.

## Conventions de code

- **Français** pour l'interface, les commentaires et les messages de commit ; anglais pour les
  identifiants de code.
- **Commentaires utiles uniquement** : expliquer *pourquoi*, pas *quoi*. Les commentaires existants
  documentent souvent un bug réel — ne pas les supprimer sans comprendre.
- **Pas de `any`.** `strict` est activé et doit le rester.
- **Composants** : un fichier par composant, hooks dans `src/hooks/`, logique pure dans `src/utils/`.
- **Ne pas ajouter de dépendance** sans nécessité démontrée : 27 paquets inutilisés ont été retirés.
- shadcn/ui : seuls les composants réellement utilisés sont conservés
  (`npx shadcn@latest add <nom>` pour en ajouter un).

## Tests

- **Toute correction de bug s'accompagne d'un test de non-régression.** `e2e/regressions.spec.ts`
  contient un test par défaut ayant réellement existé : ne jamais en supprimer.
- **La logique pure se teste en Vitest**, sans navigateur (`sitePreview`, `fileNames`, `settings`,
  `compression`…). Les tests E2E couvrent l'intégration.
- **Ne pas masquer une instabilité par un `retry` ou un `waitForTimeout`** : rejouer le test en
  série (`--repeat-each=3 --workers=1`) pour déterminer s'il s'agit du test ou du code. Deux
  « instabilités » se sont révélées être de vrais défauts.

### Pièges E2E connus

- Ne **jamais** appeler `indexedDB.deleteDatabase()` pendant que l'application tourne.
- Attendre la persistance réelle (`waitForPersisted`), pas l'affichage « Enregistré à ».
- Monaco est remonté à chaque changement de fichier : `typeInEditor` attend le focus.
- `formatOnType` réécrit le texte pendant la frappe : ne pas comparer à l'identique.

## Décisions produit à respecter

- **Pas d'internationalisation.** L'interface reste en français ; les sélecteurs E2E s'appuient
  sur les noms accessibles français.
- **Pas de backend.** Si une fonctionnalité semble en exiger un, chercher d'abord la voie
  navigateur — c'est ainsi que l'aperçu de site multi-fichiers a été réalisé.
- **Les limites se documentent, elles ne se maquillent pas.** Mieux vaut une limite assumée qu'une
  promesse inexacte : l'application a affirmé « fonctionne hors ligne » pendant trois versions alors
  que c'était faux.

## Vérifier avant d'affirmer

Ce projet a une histoire : plusieurs affirmations de la documentation se sont révélées fausses à
l'exécution (Monaco prétendument embarqué mais chargé depuis un CDN, IndexedDB annoncé mais absent,
hors ligne annoncé mais cassé). En conséquence :

- mesurer plutôt que supposer, y compris pour les performances (`e2e/performance.spec.ts` contient
  les chiffres de référence) ;
- vérifier une configuration **par exécution**, pas par lecture ;
- signaler ce qui n'a pas été fait ou testé, plutôt que de l'omettre.
