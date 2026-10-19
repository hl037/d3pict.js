# Étape 8 : autres types de graphique

Le type de graphique, c'est le rendu. Les axes, les séries, le curseur, l'infobulle restent tels quels.

<ExampleLive id="guide-8" :height="380" />

Ce qui a changé :

- **Des barres au lieu d'une courbe.** La série d'humidité est la même ; `D3PBarRenderer` remplace `D3PLineRenderer`. `barWidth` est en pixels sur un axe continu, et une fraction de la bande sur un axe en bandes.
- **Les barres sont en premier dans la liste des objets,** donc dessinées derrière les courbes : les rendus se dessinent dans l'ordre où ils sont attachés.

Pour mettre une aire sous une courbe, ajoutez un second rendu sur la même série : `new D3PAreaRenderer({ bus, series, marker: false })`. Son `marker: false` laisse le point de l'infobulle à la courbe qui la surplombe.

## Les rendus

| Rendu | Dessine |
|---|---|
| `D3PLineRenderer`, `D3PAreaRenderer`, `D3PScatterRenderer` | des courbes, des aires (jusqu'à zéro, jusqu'à une base, ou entre deux séries), des points |
| `D3PBarRenderer` | des colonnes, des barres horizontales, des barres groupées ou empilées, des sucettes, des plages ; des barres sur axes polaires |
| `D3PBubbleRenderer` | des points d'une taille donnée par une troisième colonne |
| `D3PCandlestickRenderer`, `D3PBoxPlotRenderer`, `D3PDumbbellRenderer` | des séries à plusieurs valeurs par point |
| `D3PHeatmapRenderer` | une grille colorée par une valeur (`D3PColorScale`, `D3PColorLegend`) |
| `D3PPieRenderer`, `D3PFunnelRenderer` | des parts d'un tout : pas d'axes |

Certains types demandent une transformation pour préparer la série : `D3PStack` (aires et barres empilées, streamgraphs), `D3PWaterfall`, `D3PHistogram`. Les annotations (`D3PAnnotationLine`, `D3PAnnotationBand`, `D3PAnnotationPoint`, `D3PAnnotationText`) marquent des valeurs des axes et suivent les zooms. Elles s'arrêtent au bord du tracé : une marque dont la valeur est hors de l'axe n'est pas dessinée, ni son étiquette.

Chaque type de graphique a [une page](/fr/examples/gallery) avec le graphique et le code qui le fait, et la [référence des types](/fr/guide/chart-types) dit comment chacun est construit.
