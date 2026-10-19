# Plusieurs axes

Quatre axes Y (deux de chaque côté, un logarithmique) et deux axes X sur un graphique, chaque série selon ses propres axes. La molette zoome le temps, glisser déplace.

<ExampleLive id="axes" />

## Ce qu'il montre

- **Quatre axes Y.** Deux à gauche, deux à droite : l'option `offset` éloigne un axe du tracé, vers l'extérieur, donc plusieurs axes s'empilent sur un côté. Prévoyez la place avec les marges du graphique.
- **Un axe logarithmique.** `scaleType: 'log'` sur l'axe de latence ; les trois autres sont linéaires.
- **Deux axes X.** Celui du bas montre l'heure, celui du haut le jour ; les deux lisent **un seul** `D3PAxisDomain`, donc zoomer le temps les déplace ensemble.
- **Un titre par axe.** Chaque `D3PAxisTitle` se place contre les étiquettes de son propre axe, de la couleur de sa série. Le second axe de chaque côté a un `offset` de 84 px, qui laisse la place du titre du premier entre les deux. Le titre du graphique et la légende (`D3PTitle`, `D3PLegendPanel`) sont à l'extérieur, quel que soit l'ordre d'ajout.
- **Chaque série selon ses axes.** Un rendu nomme les axes avec lesquels il dessine (`axes: ['hour', 'latency']`) ; tout le reste (curseur, infobulle, légende) lit les rendus. Les axes prennent la couleur de leur série avec le crochet `postProcess`.
- **Outils sur les axes X seulement.** `axes: ['hour']` laisse les plages Y fixes : la molette zoome le temps, glisser le déplace.
