Voici la charte graphique, la palette de couleurs et les spécifications du logo officiel d'edUloc telles qu'implémentées dans le projet.
1. 🎓 Le Logo edUloc
Structure & Composition
Le logo d'edUloc se compose de deux éléments :
L'emblème (icône de marque) : Le chapeau de diplômé / mortier d'étudiant (Graduation Cap), inscrit dans un carré aux angles adoucis (border-radius: 18px).
Le mot-symbole (Wordmark) : La typographie bicolore edUloc avec le « U » majuscule central marquant la liaison :
edU : Teinte encre profonde (#14162B) sur fond clair, ou blanc pur (#FFFFFF) sur fond sombre.
loc : Teinte primaire signature (#332E86).
La Baseline officielle
« Le bon accompagnement, au bon endroit. »
Code SVG officiel de l'icône (symbole)
code
Xml
<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#332E86" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 4 2.5 9 12 14l9.5-5Z" />
  <path d="M6.5 11.4V16c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4.6" />
</svg>
2. 🎨 La Palette de Couleurs (Design Tokens)
🔵 Couleurs Principales (Brand Identity)
Rôle	Nom du Token	Code HEX	Code RGB	Utilisation
Primaire (Signature)	--color-primary	#332E86	rgb(51, 46, 134)	Boutons principaux, accents du logo, éléments actifs
Primaire Foncé	--color-primary-dark	#211C5E	rgb(33, 28, 94)	États :hover et :active des boutons primaires
Primaire Teinté	--color-primary-tint	#ECEAF9	rgb(236, 234, 249)	Badges, puces sélectionnées, fonds d'icônes
Violet Accent	--color-violet	#8D7FE3	rgb(141, 127, 227)	Dégradés dynamiques, touches secondaires
Violet Teinté	--color-violet-tint	#F3F0FC	rgb(243, 240, 252)	Arrière-plans doux, cartes secondaires
🟢 Accentuation & Statuts
Rôle	Nom du Token	Code HEX	Code RGB	Utilisation
Accent Émeraude	--color-accent	#0E9C82	rgb(14, 156, 130)	Badges "Validé", succès, certifications
Accent Teinté	--color-accent-tint	#E1F5EF	rgb(225, 245, 239)	Arrière-plan des badges de validation
Avertissement	--color-warning	#BD7E28	rgb(189, 126, 40)	Étoiles de notation, alertes modérées
Avertissement Teinté	--color-warning-tint	#FAF0DE	rgb(250, 240, 222)	Fonds de notification d'avertissement
Erreur / Danger	--color-error	#AC4A40	rgb(172, 74, 64)	Bouton déconnexion, refus, annulations
Erreur Teintée	--color-error-tint	#F6E9E6	rgb(246, 233, 230)	États d'erreur de formulaire
🖋️ Neutres, Textes & Surfaces
Rôle	Nom du Token	Code HEX	Utilisation
Encre (Texte principal)	--color-ink	#14162B	Titres, textes à fort contraste
Encre Adoucie	--color-ink-soft	#585B78	Sous-titres, libellés de champs, icônes secondaires
Encre Atténuée	--color-ink-faint	#9799AF	Placeholders, chevrons, textes secondaires
Fond Papier (Body)	--color-paper	#FAF9F4	Arrière-plan global de l'application (légèrement crème)
Surface Blanche	--color-surface	#FFFFFF	Cartes, champs de saisie, popovers
Ligne / Bordure	--color-line	#E7E3D7	Bordures de cartes et séparateurs principaux
Ligne Douce	--color-line-soft	#F0EDE3	Séparateurs légers dans les listes
3. 📐 Règles Typographiques & Système Visuel
Typographies
Titres & Identité : Space Grotesk (ou sans-serif géométrique), graisse 700 (Bold).
Corps de texte & Interface : Inter (ou sans-serif moderne neutre), graisses 400 (Regular), 500 (Medium), 600 (Semi-bold).
Rayons de courbure (Border Radius)
Petits éléments / Badges : --radius-sm: 8px
Champs de saisie & Cartes de listes : --radius-md: 12px
Grandes cartes & Conteneurs : --radius-lg: 16px
Pill Buttons & Puces rondes : border-radius: 9999px ou 10rem
Dégradé de Marque (Signature edUloc Glow)
Utilisé pour les animations de mise en avant et les effets lumineux :
code
CSS
linear-gradient(
  90deg,
  #332E86 0%,   /* Bleu nuit Primaire */
  #8D7FE3 49%,  /* Violet éclatant */
  #0E9C82 100%  /* Émeraude Accent */
)
