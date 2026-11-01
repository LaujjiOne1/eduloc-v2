# Vidéo de présentation EduLoc : storyboard et direction motion design

**Format** : 90 secondes (version principale), déclinaisons 30 s (réseaux) et 15 s (publicité). 16:9, avec recadrage vertical 9:16.
**Message** : « Un bon tuteur, au bon endroit, au bon moment, et quelqu'un pour vous aider si besoin. »
**Promesse à ne pas trahir** : l'application *et* des humains. Ne rien montrer qui ne soit réellement livré (paiement, assistance
téléphonique) tant que la fonctionnalité n'est pas disponible ; sinon retirer la scène ou la marquer « bientôt ».

## 1. Public et ton

| Public | Besoin | Ton |
|---|---|---|
| Parents / étudiants (demandeurs) | Trouver vite un tuteur de confiance près de chez eux | Rassurant, simple, concret |
| Tuteurs | Trouver des élèves, être payé correctement | Valorisant, clair sur le revenu |
| Partenaires (lieux d'étude) | Visibilité et fréquentation | Professionnel |

Voix : chaleureuse, tutoiement ou vouvoiement à trancher (recommandé : vouvoiement pour le parent, ton direct dans la version réseaux). Langue : français, sous-titrage obligatoire ; version malgache à prévoir.

## 2. Direction artistique

- **Style** : motion 2D à plat, formes géométriques arrondies, quelques détails de lieux malgaches reconnaissables (rues, taxis-be, cafés, bibliothèque). Pas d'images génériques de banque d'images.
- **Palette** : reprendre la charte de l'application (`CHART VISUEL.md`) ; une couleur d'action unique, une couleur d'alerte, fond clair. Contraste AA minimum.
- **Typographie** : celle de la charte ; titres ≤ 6 mots à l'écran, 1 idée par plan.
- **Motion** : easing doux (ease-out 250-400 ms), ressorts légers pour les cartes et boutons, aucune animation qui dure plus de 700 ms sans raison. Transitions par **continuité** (le point de la carte devient l'avatar du tuteur, l'avatar devient la carte de réservation).
- **Interface** : écrans réels de l'application, recomposés en animation (jamais d'écran inventé qui diffère du produit).
- **Son** : musique légère sans paroles, effets discrets synchronisés aux actions (tap, confirmation), niveau voix −3 dB au-dessus de la musique.

## 3. Storyboard principal (90 s)

| # | Durée | Plan (image) | Motion | Voix off / texte | Son |
|---|---|---|---|---|---|
| 1 | 0-6 s | Parent le soir, devoirs d'un enfant qui bloque sur les équations. Pièce sobre. | Zoom lent, la feuille se détache du décor | « Quand votre enfant bloque, chaque soir compte. » | Ambiance calme |
| 2 | 6-12 s | La feuille devient une barre de recherche. Texte tapé : « aide pour équations, 3e, examen ». | Machine à écrire + pulsation | « Décrivez simplement votre besoin. » | Frappe |
| 3 | 12-22 s | Carte de la ville, points qui apparaissent, un filtre « près de chez moi ». | Les points tombent en cascade, zoom sur un quartier | « EduLoc vous propose des tuteurs qualifiés, vérifiés, proches de vous. » | Notes ascendantes |
| 4 | 22-30 s | Profil du tuteur : photo, matières, niveau, avis, tarif. Badge « profil vérifié ». | Le point de la carte se transforme en carte profil | « Profils validés, tarifs clairs, avis réels. » | Clic doux |
| 5 | 30-40 s | Calendrier : créneaux libres, choix d'un lieu (bibliothèque partenaire) ou en ligne. | Le créneau choisi se remplit en couleur | « Choisissez un créneau, un lieu d'étude, en salle ou en ligne. » | Tap |
| 6 | 40-48 s | Récapitulatif : prix lisible (cours + déplacement + frais), bouton « Envoyer la demande ». | Les lignes de prix s'additionnent en fondu | « Le prix est affiché avant de vous engager. » | Tap |
| 7 | 48-56 s | Demande envoyée, minuteur de validité, le tuteur reçoit une notification et accepte. | Split écran parent / tuteur, ligne de connexion qui se remplit | « Le tuteur répond. Vous payez, le créneau est à vous. » | Notification |
| 8 | 56-64 s | Paiement Visa / Mobile Money, coche de confirmation. | Coche dessinée en trait | « Paiement sécurisé. Le tuteur n'est rémunéré qu'après le cours. » | Confirmation |
| 9 | 64-74 s | Séance : tuteur et enfant à une table ; fin du cours, deux boutons « terminé » / « confirmer ». | Le double accord forme un cercle complet | « Le cours terminé, les deux parties valident. » | Accord musical |
| 10 | 74-82 s | Conseillère au téléphone avec un casque, écran Odoo ; un parent sans application la contacte. | Bulle de téléphone qui devient une carte de réservation | « Pas d'application ? Notre équipe réserve avec vous, par téléphone. » | Sonnerie douce |
| 11 | 82-88 s | Collage : tuteur payé, enfant qui sourit, avis laissé. | Étoiles qui se remplissent | « Un suivi avant, pendant et après chaque séance. » | Crescendo |
| 12 | 88-90 s | Logo EduLoc, boutons de téléchargement, ligne de contact. | Logo se construit depuis les formes précédentes | « EduLoc. Apprendre, près de chez vous. » | Signature sonore |

> Les textes de voix off sont des propositions ; les promesses de la scène 8 (reversement après le cours) et de la scène 10 dépendent de
> la décision finale du modèle économique et du lancement de la réservation téléphonique.

## 4. Versions courtes

**30 s** : plans 2, 3, 4, 7, 8, 12. Voix : « Un tuteur, près de chez vous, réservé en quelques gestes. »
**15 s (vertical)** : plan 3 (carte), plan 5 (créneau), plan 12 (logo). Texte seul, sans voix.
**Version tuteur (45 s)** : inscription → profil validé → tarifs → demandes reçues → paiement après le cours → logo.

## 5. Production

| Étape | Livrable | Responsable | Délai indicatif |
|---|---|---|---|
| Script + voix témoin | Texte validé, enregistrement guide | A9 | 2 jours |
| Styleframes | 3 images clés (plans 3, 4, 9) validées | A9 + design | 3 jours |
| Animatique | Storyboard animé minuté sur la voix témoin | A9 | 3 jours |
| Animation | Plans animés (After Effects, ou Figma + export vidéo selon la chaîne retenue) | Motion designer | 8 jours |
| Son | Voix finale, musique libre de droits, mixage | Studio | 3 jours |
| Validation | Relecture produit, juridique (promesses, marque), accessibilité | Direction | 2 jours |
| Export | MP4 16:9 et 9:16, sous-titres .srt FR et MG | A9 | 1 jour |

## 6. Gabarit de fiche de plan (pour le motion designer)

```
Plan n° : …            Durée : … s            Format : 16:9 / 9:16
Image : …                                   Éléments d'interface : écran « … »
Animation d'entrée : … (durée, easing)       Animation de sortie : …
Texte à l'écran : …                           Voix off : …
Son : …                                       Transition vers le plan suivant : …
```

## 7. Points de vigilance

- Aucune donnée réelle d'enfant ou de client à l'écran ; personnages fictifs, consentement pour tout figurant.
- Les prix montrés sont des exemples marqués comme tels tant que la tarification n'est pas arrêtée.
- Ne pas promettre « paiement sécurisé » avec un logo de prestataire non encore contractualisé.
- Sous-titres lisibles (contraste, 2 lignes max), pas d'information portée par la couleur seule, pas de clignotement rapide.
- Vérifier chaque scène contre le produit livré à la date de publication.
