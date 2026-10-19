# Beaucoup de séries

Trente-deux séries sur un graphique, avec un titre, des titres d'axes et une légende.

<ExampleLive id="many" :height="520" />

## Ce qu'il montre

- **La légende s'adapte.** Sous (ou sur) le tracé, `D3PLegendPanel` passe ses entrées à la ligne autant qu'il faut et sa bande grandit d'autant, en prenant la place au tracé. Elle s'arrête à un tiers du graphique : au-delà, la liste défile dans sa bande. Donnez un nombre à `size` pour fixer la hauteur. Sur un côté du tracé, la bande a une largeur à elle (140 px par défaut), les noms longs sont coupés par une ellipse (le nom entier est le titre de l'entrée) et la liste défile.
- **Les bandes gardent leur ordre** quel que soit le nombre d'entrées : le titre du graphique le plus à l'extérieur, puis la légende, puis le titre de l'axe x.
- **L'infobulle passe en colonnes**, une douzaine de lignes chacune, pour que sa boîte ne dépasse pas la hauteur du graphique. Le contenu par défaut de `d3pDomTooltip`, `D3PVTooltip` et `D3PRTooltip` le fait ; avec votre propre balisage, les données de l'infobulle (`series`) sont à vous de disposer.
- **Chaque série a son point** là où est le pointeur, et les entrées de la légende montrent ou cachent leur ligne.
