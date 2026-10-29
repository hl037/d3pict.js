# Export

Enregistrez un graphique en fichier SVG ou en image PNG. Choisissez un fond et la taille du PNG, puis enregistrez, ou montrez un aperçu du PNG sous le graphique.

<ExampleLive id="export" :height="560" />

## Ce qu'il montre

- **Le graphique s'enregistre lui-même.** `chart.downloadSVG(nom, options)` et `chart.downloadPNG(nom, options)` font télécharger un fichier par le navigateur. L'objet graphique vient de `new D3PChart` en core, de l'événement `ready` de `D3PVChart` en Vue et de la prop `onReady` de `D3PRChart` en React.
- **Le fichier n'est pas la page.** Il a un fond (blanc sauf indication), une couleur de texte et les polices web du graphique, donc il se lit pareil partout. Sur une page sombre, donnez les deux : `{ background: '#111827', color: '#e5e7eb' }`. `background: null` le laisse transparent, ce que l'aperçu montre en damier.
- **Ce qui n'est à l'écran que pour le pointeur est laissé de côté.** Le titre, les titres d'axes, la légende et la ligne d'objectif sont dans le fichier. Le curseur, les markers et l'infobulle n'y sont pas, même si vous survolez le graphique au moment d'enregistrer.
- **`exportPNG` et `exportSVG` ne téléchargent pas.** Ils renvoient une promesse d'URL de données et du texte du fichier : l'aperçu est `exportPNG` mis dans un `<img>`. Servez-vous-en pour envoyer le graphique à un serveur ou le copier.
- **L'échelle est la taille du PNG.** `scale: 2` donne deux fois les pixels du graphique, pour un écran à haute densité ou une impression.

Le [guide](/fr/guide/export) passe en revue les options, et chaque graphique de la [vitrine](/fr/examples/showcase) a ses propres boutons SVG et PNG.
