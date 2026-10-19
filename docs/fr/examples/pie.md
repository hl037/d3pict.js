# Camembert et anneau

`D3PPieRenderer` dessine une série de paires `[nom, taille]` en parts : pas d'axes, un seul rendu. Il dessine dans un [système de coordonnées polaire](/fr/guide/concepts#systèmes-de-coordonnées) et en reprend le centre, le rayon, l'angle de départ, le sens et le trou : les réglages du système façonnent donc les camemberts comme les graphiques polaires. Un anneau est un camembert dans un système dont `innerRadius` est supérieur à 0.

Survolez une part pour la déplacer et voir sa part du total dans l'infobulle ; cliquez sur une entrée de la légende pour masquer une part, et les autres remplissent le cercle.

<ExampleLive id="pie" />

## Ce qu'il fait

- **Parts.** Une par point de taille positive, dans l'ordre des données (ou triées avec `sort: 'ascending' | 'descending'`). Les valeurs qui ne sont pas des nombres positifs n'ont pas de part. `padAngle` (degrés) et `cornerRadius` (pixels) les façonnent ; `style.colors` remplace la palette par défaut.
- **Légende.** Sa légende a une entrée **par part**, et non une pour le rendu : chaque rendu liste ses propres entrées (`legendEntries()`), et le `toggle()` d'une entrée montre ou masque ce qu'elle représente. Les légendes personnalisées utilisent `entry.label`, `entry.color`, `entry.visible` et `entry.toggle()`.
- **Infobulle.** Sans axes, il n'y a pas de valeur à lire sous le pointeur : le rendu répond en **testant le pointeur contre ses parts** (son `probeHit`). La ligne montre le nom, la taille et la part (`label`, `percent`), et la boîte suit le pointeur. Vos propres rendus peuvent faire de même.
- **Survol.** La part sous le pointeur s'écarte de `explode` pixels. C'est le **marker** par défaut du camembert (`marker: false` le retire, `hover: false` désactive l'effet ; le rendu ne demande alors pas de zone d'interaction).
- **Étiquettes.** La part de chaque tranche, au-delà de `labels.minPercent` ; `labels.format` remplace le texte.
- **Camemberts imbriqués.** `radius: [de, à]` (fractions de l'anneau du système) donne à chacun sa bande : deux camemberts sur un graphique forment des anneaux concentriques.
- **À côté d'axes polaires.** Un camembert peut partager le système, et le graphique, de séries polaires : le rendu ignore les axes.

Un camembert exige un système polaire : avec un système cartésien, il lève une erreur explicite à l'attachement.
