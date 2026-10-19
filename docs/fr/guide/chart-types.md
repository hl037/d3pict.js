# Référence des types de graphiques

Comment construire chaque type de graphique. Ce sont tous des objets du même genre : des axes, un ou plusieurs rendus, parfois une transformation qui dérive une série, parfois des annotations. La [galerie](/fr/examples/gallery) montre chacun d'eux, avec son code.

| Type de graphique | Comment |
|---|---|
| Ligne, aire, nuage de points | `D3PLineRenderer`, `D3PAreaRenderer`, `D3PScatterRenderer` |
| Spline, marches | `style.curve` : `monotone`, `step`, `stepBefore`, `stepAfter`, `basis`, `cardinal`, `catmullRom`, `natural` |
| Trous dans les données | `style.gaps: 'break'` (par défaut `connect`) |
| Colonnes | `D3PBarRenderer` sur un axe bande ; `count` et `index` placent plusieurs séries côte à côte |
| Barres horizontales | `D3PBarRenderer` avec `orientation: 'horizontal'`, catégories sur un axe bande à gauche |
| Empilé, 100 %, streamgraph | `D3PStack` avec `offset: 'none' \| 'expand' \| 'silhouette' \| 'wiggle'` (et `order`), dessiné par des aires ou des barres |
| Aire de plage | une série avec `columns: ['x', 'high', 'low']` et `D3PAreaRenderer({ props: { base: 'low' } })` |
| Colonne de plage, chronologie | `D3PBarRenderer` avec `base: 'start'` (et `orientation: 'horizontal'` pour une chronologie) |
| Histogramme | `D3PHistogram` (ou `d3pHistogram`) qui alimente `D3PBarRenderer` : les barres prennent leur largeur aux bornes des classes |
| Cascade (waterfall) | `D3PWaterfall` qui alimente `D3PBarRenderer` avec `style.colorBy: 'kind'` |
| Sucettes | `D3PBarRenderer` avec `style.shape: 'lollipop'` |
| Chandeliers | `D3PCandlestickRenderer` sur une série avec `open`, `high`, `low`, `close` |
| Boîtes à moustaches | `D3PBoxPlotRenderer` ; `d3pBoxPlotRows(groupes)` calcule quartiles, moustaches et valeurs aberrantes depuis des échantillons bruts |
| Haltères (dumbbell) | `D3PDumbbellRenderer` sur une série avec `start` et `end` |
| Bulles | `D3PBubbleRenderer` sur une série avec une colonne `size` |
| Carte de chaleur | `D3PHeatmapRenderer` avec une `D3PColorScale`, et une `D3PColorLegend` |
| Camembert, anneau, demi-anneau | `D3PPieRenderer` dans un `D3PPolarSystem` (`innerRadius`, `sweep`) |
| Radar | axes polaires avec `D3PRadarAngleAxisRenderer`, et lignes ou aires avec `curve: 'straight'` et `closed: true` |
| Aire polaire (rose) | `D3PBarRenderer` sur des axes polaires, catégories sur l'angle |
| Barres radiales, jauge | `D3PBarRenderer` avec `orientation: 'horizontal'` sur des axes polaires, catégories sur le rayon ; `sweep: 180` pour une jauge |
| Entonnoir (funnel) | `D3PFunnelRenderer` (sans axes) |
| Pentes (slope) | lignes sur un axe point avec une catégorie vide à chaque bout |
| Sparkline | `d3pSparkline({ container, data, type })` |
| Annotations | `D3PAnnotationLine`, `D3PAnnotationBand`, `D3PAnnotationPoint`, `D3PAnnotationText` |

Non inclus : treemap, sunburst et icicle (ils demandent des données hiérarchiques), violin et raincloud, waffle, unit et beeswarm, et les fonctions multi-graphiques (trellis, crossfilter, sélections liées).

## Données

Une série est une liste de points ; un point est `[x, valeur, ...autres]`. Les colonnes ont des noms, et un rendu demande celles dont il a besoin :

```ts
// deux colonnes, comme toujours
new D3PSeries({ name: 'cpu', data: [[0, 3], [1, 5]] })

// plusieurs colonnes : un chandelier a besoin de open, high, low et close
new D3PSeries({
  name: 'AAPL',
  columns: ['x', 'open', 'high', 'low', 'close'],
  primary: 'close',          // ce que veut dire « la valeur » (marqueur d'infobulle, légende, domaine par défaut)
  data: rows,
})
```

`primary` vaut par défaut la deuxième colonne. Un rendu qui a besoin de colonnes absentes de la série la refuse à l'attachement, en disant lesquelles.

Entrées acceptées, détectées sur la première ligne :

| Entrée | Exemple |
|---|---|
| nombres, tableaux typés | `[3, 5, 2]` : `x` est l'index (deux colonnes seulement) |
| lignes positionnelles | `[[0, 3], ['a', 5]]`, dans l'ordre de `columns` |
| lignes objet | `[{ x: 0, y: 3 }]`, ou d'autres clés et des fonctions avec `fields: { x: 't', y: (ligne) => ligne.v }` |
| par colonnes | `{ x: [0, 1], y: [3, 5] }` |
| tout itérable de ces formes | un `Set`, un générateur, `Map.entries()` |

### Ajuster les domaines

`D3PAutoDomain.linkSeries(serie, [dx, dy])` ajuste le second domaine à **toutes les colonnes de valeur** (les plus bas et les plus hauts d'un chandelier, pas seulement sa clôture). Les colonnes qui ne sont pas des positions (`size`, `value`, `kind`, `color`, `label`) sont laissées de côté ; `domainColumns` le modifie. Pour associer les colonnes une à une, utilisez les noms : `linkSeries(serie, { x: dx, value: couleurs.domain })`.

### Séries dérivées

Une transformation dérive des séries d'autres séries et les tient à jour. Les séries dérivées sont des séries ordinaires qui portent des colonnes supplémentaires pour les rendus :

| Transformation | Colonnes dérivées |
|---|---|
| `D3PStack` | `x`, `y` (haut de la couche), `y0` (sa base), `value` (la valeur d'origine, que montre l'infobulle) |
| `D3PWaterfall` | `x`, `y`, `y0`, `value`, `kind` (`up`, `down`, `total`) |
| `D3PHistogram` | `x`, `y` (effectif), `x0`, `x1` (les bornes de la classe) |

Les aires et les barres lisent d'elles-mêmes une colonne `y0`, ou celle que nomme `base`.

## Systèmes de coordonnées

Barres, aires, lignes, nuages, bulles et cartes de chaleur dessinent dans **n'importe quel** système de coordonnées : des rectangles en cartésien, des arcs en polaire, si bien que le même rendu donne un graphique en colonnes ou une aire polaire. Chandeliers, boîtes à moustaches et haltères dessinent des rectangles et des lignes et sont cartésiens seulement ; les camemberts sont polaires seulement ; les entonnoirs n'utilisent aucun système. Un rendu qui ne gère pas un système le dit.

Un [système polaire](/fr/guide/concepts#systèmes-de-coordonnées) peut couvrir une partie d'un cercle (`sweep`), être un anneau (`innerRadius`), commencer n'importe où (`startAngle`) et être déplacé (`shift`, en fractions du rayon, pour centrer un demi-disque).
