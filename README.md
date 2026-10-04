# Polyglotte

Application web progressive (PWA) personnelle pour apprendre des langues pendant les trajets du quotidien : **espagnol**, **chinois** et **japonais**, avec l'allemand en simple entretien. Elle suit un planning hebdomadaire fixe, propose des sessions courtes jouables hors connexion, et mémorise vos progrès par répétition espacée.

Application en ligne : https://caldheron.github.io/polyglotte/

## Rôle de l'application

Le planning dit, pour chaque jour, quelle langue travailler et pendant combien de temps. L'application propose ensuite la session correspondante :

| Langue | Contenu | Origine du contenu |
|---|---|---|
| Espagnol | Vocabulaire, texte ou dialogue, questions, production écrite, en trois niveaux de difficulté | Généré sur le PC avec un modèle de langue local (Qwen 3, via Ollama) |
| Chinois | Cartes de vocabulaire (HSK 3.0, niveaux 1 à 3) avec pinyin et sens en français | Dictionnaire libre CFDICT, sans modèle de langue |
| Japonais | Cartes de kanji du niveau N5 (lectures, sens), plus des articles Wikipédia | Dictionnaire libre KANJIDIC2, sans modèle de langue |

Principe de qualité : les faits (mots, pinyin, kanji, sens, liens) viennent de données libres traitées par des scripts, jamais d'un modèle. Le modèle de langue n'écrit que l'espagnol, dont le contenu n'est pas relu par un humain et peut contenir des erreurs.

Autres fonctions : répétition espacée (SM-2), niveau de difficulté adapté aux résultats (espagnol), lecture audio par la voix du téléphone, tableau de bord de progression, évaluation facultative des productions écrites par le modèle local, sauvegarde et restauration complètes des données (fichier JSON), mise à jour de l'application sur accord.

## Structure du dépôt

```
polyglotte/
  index.html, package.json, vite.config.js
  .github/workflows/deploy.yml   publication automatique sur GitHub Pages
  public/
    batches/                     lots hebdomadaires d'espagnol (générés, versionnés)
    kanji-n5.json                cartes de kanji (généré)
    zh-vocab.json                cartes de chinois (généré)
    culture.json                 liens Wikipédia vérifiés (généré)
  src/
    App.svelte                   écran du jour, onglets
    Session / Revision / Cartes / Lecture / Lecteur /
    Evaluation / Progres / Sauvegarde / Credits .svelte
    lib/                         planning, répétition espacée, lots, statistiques, évaluation, audio
    scheduler/config.json        le planning de la semaine
  content-engine/                scripts exécutés sur le PC (Node 18+, sans dépendance)
    generate.mjs, config.json    lots d'espagnol avec Qwen via Ollama
    dico-zh.mjs                  cartes de chinois depuis CFDICT et une liste de mots
    kanji.mjs                    cartes de kanji depuis KANJIDIC2
    culture.mjs                  liens Wikipédia depuis une liste de sujets
  donnees/                       fichiers sources téléchargés, ignorés par git
```

## Workflow

**Préparation du contenu (sur le PC, de temps en temps)**

1. Espagnol : lancer Ollama avec Qwen 3 puis `node content-engine/generate.mjs --semaine AAAA-Wxx`. Un fichier de lot est écrit dans `public/batches/`.
2. Chinois : placer `cfdict.u8` et une liste de mots `mots-zh.txt` (un mot en simplifié par ligne) dans `donnees/`, puis `node content-engine/dico-zh.mjs`.
3. Japonais : `node content-engine/kanji.mjs` (télécharge KANJIDIC2) ; `node content-engine/culture.mjs` pour les liens Wikipédia.
4. Valider les fichiers produits (le script signale les échecs et les mots absents), puis les committer et pousser.

**Publication** : à chaque push sur `main`, GitHub Actions compile l'application (Vite) et la publie sur GitHub Pages.

**Usage quotidien (sur le téléphone)** : ouvrir l'application installée, choisir la session du jour, jouer hors connexion. Les cartes, résultats et productions restent sur l'appareil (IndexedDB). Les productions écrites sont évaluées automatiquement si le serveur local du modèle est joignable, sinon plus tard.

**Sauvegarde** : exporter régulièrement depuis l'onglet Synchro, et toujours avant de vider les données du site ou de changer de téléphone.

**Développement** : `npm install`, puis `npm run dev`, `npm run build`.

Rien de secret n'est stocké dans ce dépôt public : l'adresse du serveur local est saisie dans l'application et reste sur l'appareil.

## Remerciements et références

Ce projet n'existerait pas sous cette forme sans le travail de celles et ceux qui partagent leurs données et leurs outils. Un grand merci à :

- **CFDICT et Chine Informations** — le dictionnaire chinois-français libre créé et entretenu depuis 2010 par **David Houstin** et tous les contributeurs de [Chine Informations](https://chine.in). Page officielle : https://chine.in/mandarin/dictionnaire/CFDICT/. Licence [Creative Commons BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/deed.fr). Les données ont été modifiées (pinyin converti en accents, mots à plusieurs lectures regroupés sur une carte, nombre de sens limité) ; le fichier dérivé `public/zh-vocab.json` reste sous la même licence.
- **ivankra/hsk30** — la liste de vocabulaire HSK 3.0 ([github.com/ivankra/hsk30](https://github.com/ivankra/hsk30), licence MIT), établie d'après la liste officielle du ministère chinois de l'Éducation.
- **KANJIDIC2 et l'EDRDG** — le dictionnaire de kanji du [Electronic Dictionary Research and Development Group](https://www.edrdg.org) (Jim Breen et contributeurs), licence Creative Commons BY-SA. Le fichier dérivé `public/kanji-n5.json` reste sous la même licence.
- **Wikipédia** — les articles liés ou affichés, sous licence [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.fr), grâce à ses rédacteurs et à son API.
- **Qwen 3** (Alibaba Cloud) et **Ollama** — le modèle et l'outil qui génèrent le contenu d'espagnol en local.
- **SM-2 / SuperMemo** — l'algorithme de répétition espacée de Piotr Woźniak.
- **Svelte, Vite, vite-plugin-pwa et Zod** — les outils de l'application (licence MIT).
- **Tailscale** — pour joindre en privé le serveur local depuis le téléphone (usage facultatif).

Les pages du site chine.in autres que le fichier CFDICT (leçons, listes en ligne) sont des contenus protégés : elles ne sont ni copiées ni redistribuées ici.

## Licences

Les fichiers de données dérivés suivent les licences de leurs sources, indiquées ci-dessus. Aucune licence n'est encore déclarée pour le code de l'application : tant qu'elle ne l'est pas, tous droits sont réservés à l'auteure.
