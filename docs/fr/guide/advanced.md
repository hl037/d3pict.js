# Avancé

Ce qui se passe sous les objets. Vous n'en avez pas besoin pour dessiner des graphiques ; vous en avez besoin pour écrire vos propres objets, pour tester, ou pour comprendre une surprise.

## Événements et bus

Un événement est un `Symbol` unique qui porte le type de sa charge (`D3PEvent<P>`). Deux objets ne peuvent se parler que s'ils tiennent le même symbole : il n'y a pas de noms d'événements en chaînes. Chaque objet a une table de ses propres événements, `object.e` : `axis.e.scaleChanged`, `chart.e.resized`, `series.e.dataChanged`.

```ts
const off = bus.on(series.e.dataChanged, () => console.log('nouvelles données'))
off() // arrêter d'écouter
```

Le bus (`D3PBus`) **ne livre jamais de façon synchrone** :

- la livraison a lieu dans une microtâche ultérieure, dans l'ordre d'émission (premier entré, premier sorti) ;
- la liste des abonnés est lue au moment de la livraison, donc un abonné peut s'abonner ou se désabonner ;
- une erreur dans un abonné est journalisée et n'arrête pas les autres ;
- `emit` renvoie une promesse ; `bus.idle()` et `d3pSettle(bus)` attendent que plus rien ne soit en vol, ce dont les tests ont besoin.

Les événements par graphique (`mousemove`, `tooltipShow`...) s'adressent avec `chart.event('mousemove')`, et portent les types de `D3PChartEventMap`.

## Services

Chaque graphique tient un registre de services : `chart.get(CLÉ)`, `chart.provide(CLÉ, service)`, `chart.services.watch(CLÉ, callback)`. Une clé est un symbole typé (`d3pServiceKey<T>()`), donc chacun peut en ajouter. Le gestionnaire d'axes, celui de rendus, les coordonnées, la zone d'interaction, la sonde et la mise en page sont des services du graphique.

## Objets attachables

Un objet qui s'attache à des graphiques étend `D3PAttachable<D>`, où `D` est ce qu'il garde pour chaque graphique. Il implémente `createData(chart)` (construire l'état par graphique), `attached(chart, data, subs)` (s'abonner, créer du DOM ; les abonnements ajoutés à `subs` sont libérés au détachement) et `detached(chart, data)` (nettoyer). Il est détaché quand son graphique est détruit. `render(chart)` est appelé quand il demande un redessin avec `tagDirty(chart)`.

Les props se font avec `createProps(defaults, { afterSet })` : appelables, fusionnées en profondeur, avec un crochet pour redessiner.

## Dessiner par lots

`tagDirty` ne dessine pas : il met `(graphique, objet)` en file. Le gestionnaire de rendu du bus dédoublonne la file et l'exécute une fois par image d'animation (`requestAnimationFrame`, ou un délai sans navigateur). Une demande avec transition l'emporte sur une demande sans transition dans la même image.

## Animations

Un rendu dessine avec une transition (200 ms) quand ses données, ses props ou sa série changent, et sans quand l'échelle change (zoom, déplacement) ou que le graphique est redimensionné.

- **Une courbe** garde ce qu'elle montre à l'écran : pour chaque point, sa position en pixels et sa clé, la valeur sur l'axe x d'où il a été placé (un nombre, ou le temps d'une date ; pour des catégories, la position). Un nouveau dessin est une interpolation de ces positions vers les nouvelles, donc une transition interrompue repart de ce qui est visible. La première fois, la courbe grandit depuis la ligne de base, le bas de l'axe. Cacher une série est la même interpolation dans l'autre sens.
- **Deux listes de points de longueurs différentes** sont rendues aussi longues l'une que l'autre avant d'être interpolées, en fusionnant les deux listes selon leurs **clés** avec un curseur dans chacune. Les points de même clé sont appariés, quels que soient leurs pixels : un point qui n'a pas changé est apparié à lui-même, même si l'échelle a bougé. Un point sans partenaire est apparié au point le plus proche de l'autre liste (le dernier pris ou le suivant, celui dont la clé est la plus proche). Un point qui apparaît naît sur son voisin et un point qui disparaît meurt sur lui, donc rien ne saute. L'utilitaire est `d3pInterpolateSeries(from, to)`, où `from` et `to` sont `{ keys, points }` ; il renvoie une fonction de `t` entre 0 et 1. `from` peut être un nombre, la ligne de base.
- **Les barres** sont appariées par la valeur x de leur point de données (pas par leur indice) : retirer la première ligne ne fait pas prendre à chaque barre la forme de sa voisine. Elles entrent à la base avec une hauteur de 0 et grandissent, et sortent en retournant à la base. Position, taille et couleur sont toutes interpolées.
- **Quand des demandes se rencontrent.** Les redessins sont rassemblés par image ; si l'un d'eux vient d'un changement des données, des props ou de la série, le redessin est animé, même si l'échelle change dans la même image (un domaine automatique qui s'ajuste aux nouvelles données). Un changement d'échelle seul (zoom, déplacement) est dessiné aussitôt.

## Projections

Trois mots disent comment une valeur devient une position, et inversement : `projectTo` va vers les pixels, `projectFrom` en revient.

- `axis.projectTo(chart, value)` : la position en range d'une valeur ; `axis.projectFrom(point)` : la valeur sous un point du tracé (un `D3PViewportPoint`).
- `system.projectTo(chart, a, b)` : le point d'un couple d'unités de range ; `system.projectFrom(point)` : les unités de range sous un point, `undefined` hors du système sauf avec `{ strict: false }`.
- `renderer.projectTo(chart, x, y)` et `renderer.projectFrom(point)` : toute la chaîne pour un point de données.

### L'événement du pointeur et son cache

La zone d'interaction émet un `D3PPointerEvent` pour chaque événement souris (`D3PWheelEvent`, `D3PDragEvent` pour la molette et le glisser). Il porte le pixel (`event.point`) et c'est un **cache de projections** : rien n'est calculé à l'émission, et ce que demandent l'infobulle, le curseur, les markers ou un outil n'est calculé qu'une fois.

```ts
bus.on(chart.event('mousemove'), (event) => {
  const value = xAxis.projectFrom(event.point, undefined, event) // le cache est le dernier argument
  const again = xAxis.projectFrom(event.point, undefined, event) // pas recalculé
})
```

Tout `projectTo` et `projectFrom` prend un `D3PProjectionCache` optionnel ; le cache est indexé par projecteur, graphique et arguments, donc un événement sert tous les graphiques auxquels il est donné. Un événement est valable jusqu'au prochain redessin : il lit l'état courant du graphique.

### Snapshots

Un geste qui se compare à son point de départ prend un snapshot au lieu de garder l'événement : `event.snapshot()` renvoie un `D3PViewSnapshot`, les axes et systèmes du graphique tels qu'ils sont à cet instant (`snapshot.getAxis(axis)` a le `domain`, l'échelle et le `system` figés, avec les mêmes projections). L'outil de déplacement mesure chaque mouvement contre le snapshot de son `mousedown`, donc il ne dérive pas pendant qu'il écrit le domaine courant.

## La sonde et les markers

`d3pProbe(chart)` est le service qui dit ce qui est sous un événement du pointeur : `probe.projectFrom(event, axis)` est la valeur d'un axe (en suivant les jointures, et les événements d'autres graphiques), `probe.hit(event, renderer)` ce qu'un rendu y trouve (un `D3PProbeHit` : le point, les formateurs, la couleur, la position, la cellule d'une barre), les deux calculés une fois par événement. L'infobulle est construite à partir des hits.

Un marker (`D3PMarker`) montre un hit : `show(chart, hit, event)`, `hide(chart)`, `remove(chart)`. La sonde montre et cache les markers des rendus au fil du pointeur, avec ou sans infobulle.

```ts
renderer.marker = { show(chart, hit, event) { /* dessiner */ }, hide(chart) {}, remove(chart) {} } // le vôtre
new D3PLineRenderer({ bus, series, marker: new D3PDotMarker(renderer, { radius: 6 }) })
```

## Moteurs de rendu d'axe

Un axe garde le domaine et l'échelle ; un **moteur de rendu d'axe** décide de son apparence. Chaque position a un défaut : `D3PCartesianAxisRenderer` (les côtés), `D3PAngleAxisRenderer` (anneau et graduations), `D3PRadiusAxisRenderer` (un rayon à angle fixe). `D3PCursorRadiusAxisRenderer` est un axe de rayon dont le trait tourne pour suivre le pointeur ; `D3PRadarAngleAxisRenderer` dessine le polygone d'un radar.

Un moteur déclare les positions et les sortes de système qu'il gère, et l'axe lève une erreur explicite quand cela ne convient pas (`axis "r" (position "radius") is not supported by the axis renderer D3PCartesianAxisRenderer; it supports: bottom, top, left, right`). Écrivez le vôtre en étendant `D3PAxisRenderer`.

## Vos propres objets

Les titres et les légendes sont le modèle : un slot pour la place (voir la [mise en page](/fr/guide/layout)), des props pour les réglages, des services publics pour les données. Les composants standard n'utilisent rien d'autre.
