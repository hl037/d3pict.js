# Concepts

Les idées de D3Pict, et les mots que la documentation emploie.

## De la donnée au pixel

Tout ce que fait la bibliothèque est une chaîne qui va de vos valeurs à une position à l'écran :

```text
vos valeurs ──▶ domain ──axe──▶ range ──système──▶ pixels
 (une date, 42.5,  (la partie des     (les unités du    (le tracé
  une catégorie)    données qu'un      système de        du graphique)
                    axe montre)        coordonnées)
```

| Espace | Ce que c'est | Exemple |
|---|---|---|
| domain | les valeurs de vos données le long d'un axe | une date, `42.5`, une catégorie |
| range | les unités d'un système de coordonnées | pixels (cartésien), radians et distance (polaire) |
| pixel | le tracé du graphique | un point du SVG |

Un **axe** projette un domain sur un range avec une *échelle*. Un **système de coordonnées** projette un range sur des pixels. Un **rendu** lit une série, demande des positions aux axes et au système, et dessine. Comme le rendu ne parle qu'aux axes et au système, le même rendu dessine dans un rectangle ou sur un disque : changez les axes, pas le rendu.

## Le graphique et ses objets

Un `D3PChart` est un SVG vide dans un conteneur. Tout le reste est un **objet** attaché avec `addToChart(chart)` (ou listé dans les `objects` d'un graphique Vue ou React) : axes, rendus, curseur, infobulle, outils, titres. Un objet sert autant de graphiques qu'on lui en attache : le même outil peut piloter deux graphiques, et une infobulle peut en couvrir plusieurs.

Les objets se créent avec des options, et la plupart ont des `props` : des réglages qu'on peut lire et changer à tout moment (`line.props({ style: { color: 'tomato' } })`). Le graphique se redessine tout seul.

On retire un objet avec `removeFromChart(chart)` et on le libère avec `destroy()`. Détruire un graphique détache tout ce qui lui est attaché.

Chaque objet prend un `bus` : le canal par lequel les objets se parlent. Utilisez le même partout ([Avancé](/fr/guide/advanced) dit ce qui y passe). Un graphique et les objets qui lui sont attachés doivent partager un bus.

## Séries

Une `D3PSeries` est vos données : un nom, et des lignes de valeurs. La première colonne est `x`, la deuxième la valeur principale ; une série peut avoir d'autres colonnes, nommées (un `min` et un `max`, un `open`, `high`, `low` et `close`). Elle accepte des nombres, des lignes positionnelles, des objets, des colonnes, tout itérable. Quand ses données changent, ce qui la dessine suit. Voir l'[étape 3](/fr/guide/series-and-style).

Des séries peuvent être dérivées : `D3PStack`, `D3PWaterfall` et `D3PHistogram` prennent des séries et en produisent d'autres, qu'ils tiennent à jour.

## Domaines, axes et échelles

Un **domaine** (`D3PAxisDomain`) est la plage de valeurs qu'un axe montre : deux nombres, deux dates, ou une liste de catégories. Il ne sait rien d'autre, pas même ce qu'est un axe. On peut l'écrire, et tout ce qui en dépend suit : zoomer, c'est écrire un domaine.

Un **axe** (`D3PAxis`) a un domaine, un nom, une position (`bottom`, `top`, `left`, `right`, ou `angle` et `radius` en polaire) et un type d'échelle (`linear`, `time`, `log`, `band`...). Il construit son échelle à partir du domaine et de la taille du graphique, se dessine (graduations, étiquettes, grille), et répond à deux questions : où est cette valeur (`axis.projectTo`), et quelle valeur est ici (`axis.projectFrom`).

Un **domaine automatique** (`D3PAutoDomain`) règle des domaines d'après les données de séries, et les tient à jour. Voir l'[étape 2](/fr/guide/axes-and-domains).

**Plusieurs axes.** Un graphique prend autant d'axes qu'on lui en donne, des deux côtés, avec des échelles de natures différentes. Un rendu nomme les axes avec lesquels il dessine par son option `axes` ; sans elle, il prend le premier axe x et le premier axe y du même système. Voir l'[étape 7](/fr/guide/several-axes).

## Systèmes de coordonnées

Un **système** donne un sens aux pixels du tracé. Il en existe deux : *cartésien* (x vers la droite, y vers le haut : le range est en pixels) et *polaire* (un angle et une distance au centre : le range est en radians et en pixels). Un axe appartient à un système par sa position : `bottom`, `top`, `left`, `right` sont cartésiens ; `angle` et `radius` sont polaires. Le système est créé avec le premier axe qui en a besoin ; créez-le vous-même pour régler ses options (`D3PPolarSystem` : angle de départ, sens, étendue, trou, portée).

Plusieurs systèmes peuvent partager un graphique (une rose avec un anneau en son centre, par exemple) : nommez-les, et dirigez axes et rendus vers eux avec l'option `system`.

Là où un système n'a pas de place pour une valeur (hors du disque, dans le trou, au-delà de la plage d'angle), rien n'est dessiné et le pointeur n'a pas de valeur. Voir l'[étape 9](/fr/guide/polar).

## Rendus

Un **rendu** (*renderer*) dessine une série : courbes, aires, barres, points, chandeliers, une carte de chaleur, un camembert... Il reçoit son apparence de ses `props` (couleur, courbe, épaisseur...), et peut dire ce qui est sous le pointeur et comment le marquer. Certains rendus n'ont de sens qu'en cartésien (un chandelier) et le disent quand on leur donne des axes polaires. Voir l'[étape 8](/fr/guide/chart-kinds) et les [types de graphiques](/fr/examples/gallery).

Un rendu donne aussi des entrées à la légende (un camembert en a une par part) et un **marker** : le point, le contour ou la mise en évidence qui montre le point sous le pointeur. Le marker appartient au rendu parce que lui seul sait quoi mettre en évidence ; donnez-en un autre, ou aucun.

## Le pointeur

Trois éléments interviennent pour le pointeur, et chacun s'utilise seul.

- **La zone d'interaction** est un rectangle transparent sur le tracé : la seule source des événements souris (`mousemove`, `mousedown`, `wheel`, `drag`...). Les graphiques Vue et React la créent ; en TypeScript pur, `d3pAutoInteractionArea(chart)` le fait.
- **Les outils** agissent sur le graphique : déplacement, zoom, zoom sur sélection, réinitialisation. Un outil ne fait qu'une chose : il écrit les domaines des axes qu'on lui donne. Voir l'[étape 5](/fr/guide/zoom-and-pan).
- **Le curseur, l'infobulle et les markers** montrent ce qui est sous le pointeur. Ils interrogent la *sonde* (*probe*) du graphique, qui trouve pour un événement la valeur de chaque axe et le point que chaque rendu montrerait. Voir l'[étape 4](/fr/guide/hover).

## Mise en page

La place autour du tracé est distribuée en **bandes** : des bandes le long d'un côté du graphique qu'un objet réserve, et que le tracé cède. Un **slot** est une bande et un élément HTML placé dessus. Les titres, les titres d'axes et la légende standard sont faits de slots ; vos propres composants peuvent l'être. Voir l'[étape 6](/fr/guide/layout).

## Plusieurs graphiques

Deux axes construits sur le même domaine montrent la même plage, même sur deux graphiques : faites glisser sur l'un et l'autre suit. Les outils, le curseur et l'infobulle peuvent être attachés à plusieurs graphiques à la fois ; ils trouvent les axes de chaque graphique par leur **nom**, donc donnez les mêmes noms aux axes qui veulent dire la même chose.

Une **jointure** (*join*) dit que des axes de noms différents, ou de systèmes différents, décrivent la même grandeur : un temps sur un axe x cartésien et l'angle d'un graphique polaire. Avec elle, le pointeur passe de l'un à l'autre, avec une conversion si les unités diffèrent.

```ts
// le temps (0-100) de l'axe cartésien est un angle (0-360 degrés) sur le polaire
chart.coords.join({ axes: ['time', 'angle'], convert: (value) => (value as number) * 3.6 })

// ou seulement pour une infobulle
new D3PTooltip({ bus, joins: [{ axes: ['angle', 'time'], convert: (v, from) => (from === 'time' ? (v as number) * 3.6 : (v as number) / 3.6) }] })
```

Les axes de même nom, et les axes qui partagent un domaine, sont joints sans qu'on le dise. Voir les exemples [graphiques synchronisés](/fr/examples/synced) et [cartésien et polaire, synchronisés](/fr/examples/polarsync).

## Quand les choses sont dessinées

Écrire est immédiat, dessiner ne l'est pas. Quand vous changez un domaine, une prop ou des données, le graphique ne se redessine pas aussitôt : les changements d'une image sont rassemblés et dessinés ensemble à la prochaine image d'animation. Lire juste après avoir écrit est toujours juste (un axe reconstruit son échelle depuis le domaine à chaque lecture), mais le SVG est à jour un instant plus tard. En test, `await d3pSettle(bus)` attend que tout soit dessiné.

Le dessin est animé quand les données changent et pas quand l'utilisateur zoome ou déplace, pour que le glissement ne traîne jamais derrière le pointeur.

## Couches

Un graphique dessine par couches, depuis le fond : `background`, `axis`, `data`, `annotation`, `markers` (points et contours sous le pointeur), `overlay` (le curseur et l'infobulle), `interaction`. `frame` est à part : il est dans les coordonnées du SVG, pas du tracé, et porte ce qui entoure le tracé.

## Aller plus loin

- [Avancé](/fr/guide/advanced) : événements, bus, services, projections, écrire ses propres objets.
- [Référence des types de graphiques](/fr/guide/chart-types) : comment chaque type est construit.
- [Exemples](/fr/examples/showcase) : des graphiques en direct avec leur code.
