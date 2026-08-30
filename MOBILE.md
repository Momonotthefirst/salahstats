# Salah Companion — application mobile (Capacitor)

L'app web continue de fonctionner normalement dans le navigateur. Capacitor permet en plus
de générer des applications natives iOS et Android avec de vraies notifications locales
(heure de prière + rappel « Tu as prié ? » 10 minutes après).

Configuration :

- `capacitor.config.ts` — `appId: app.lovable.salahcompanion`, `appName: Salah Companion`, `webDir: dist`
- Plugin utilisé : `@capacitor/local-notifications` (planification 7 jours à l'avance sur l'appareil)

## Étapes à suivre en local

1. **Exporter vers GitHub** depuis Lovable (bouton GitHub en haut à droite → Export to GitHub).
2. **Cloner le dépôt et installer** :
   ```sh
   git clone <url-de-ton-repo>
   cd <dossier-du-repo>
   npm install
   ```
3. **Ajouter les plateformes** :
   ```sh
   npx cap add ios
   npx cap add android
   ```
4. **Builder le web** (le dossier de sortie doit correspondre à `webDir: dist`) :
   ```sh
   npm run build
   ```
   Si le build produit `.output/public` au lieu de `dist`, copie-le :
   ```sh
   cp -r .output/public dist
   ```
5. **Synchroniser** le build et les plugins natifs :
   ```sh
   npx cap sync
   ```
6. **Lancer** :
   ```sh
   npx cap run ios       # nécessite un Mac + Xcode
   npx cap run android   # nécessite Android Studio
   ```
   Ou ouvrir les projets natifs : `npx cap open ios` / `npx cap open android`.

Après chaque modification du code web : `npm run build && npx cap sync`.

## Notifications

- Au premier lancement, l'app demande la permission de notification (native sur mobile).
- Une fois accordée, les notifications des 7 prochains jours sont planifiées sur l'appareil ;
  elles arrivent même si l'app est fermée.
- Sur Android 13+, la permission POST_NOTIFICATIONS est demandée automatiquement par le plugin.
- Sur iOS, les notifications locales fonctionnent sans compte développeur payant en simulateur,
  mais un appareil réel nécessite une signature Xcode (compte Apple gratuit suffisant pour tester).
