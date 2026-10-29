# Étape 11 : export

Enregistrez le graphique en fichier SVG ou en image PNG. Le graphique le fait lui-même.

<ExampleLive id="guide-11" :height="520" />

Ce qui a changé :

- **`chart.downloadSVG(nom)` et `chart.downloadPNG(nom)`.** Le navigateur télécharge le fichier sous ce nom. Deux boutons les appellent.
- **D'où vient l'objet graphique.** En core, c'est le `D3PChart` que vous avez fait. En Vue, `D3PVChart` émet `ready` avec le graphique (`@ready="chart = $event"`). En React, `D3PRChart` appelle sa prop `onReady` avec lui.
- **Rien d'autre à régler.** Les titres, les titres d'axes et la légende sont dans le fichier, ainsi que les axes, la grille et les données.

## Ce qu'il y a dans le fichier

Le fichier est ce que montre un graphique immobile. Ce qui n'a de sens que pendant que le pointeur est là est laissé de côté : la zone qui reçoit le pointeur, le curseur, les markers et l'infobulle. Le fichier ne dépend pas non plus de la page : il a son propre fond, sa propre couleur de texte et les polices du graphique, donc il se lit pareil dans une visionneuse, un document ou une diapositive.

## Options

Les deux méthodes prennent les mêmes options après le nom du fichier :

```ts
chart.downloadSVG('temperature.svg', { background: '#111827', color: '#e5e7eb' })
chart.downloadPNG('temperature.png', { scale: 3, background: null })
```

| Option | Est | Par défaut |
|---|---|---|
| `background` | La couleur derrière le graphique. `null` le laisse transparent. | `'#fff'` |
| `color` | Ce qu'est `currentColor` dans le fichier : le texte et les traits qui suivent la couleur de la page. Donnez-en une claire avec un `background` sombre. | `'#000'` |
| `scale` | PNG seulement : les pixels de l'image pour chaque pixel du graphique. | `2` |
| `fonts` | Écrit dans le fichier les polices web que le graphique utilise. `false` fait un fichier plus petit, écrit avec les polices de la machine. | `true` |

Un graphique sur une page sombre a besoin de `background` et de `color` : le fichier n'est pas la page, donc il ne suit pas son thème.

## SVG ou PNG

- Le **SVG** garde tout tel quel : le texte reste du texte, et le fichier s'adapte à toutes les tailles. Servez-vous-en pour les documents et tout ce qui s'imprime. Les polices sont dedans, ce qui ajoute leur poids au fichier : une police fait souvent de 20 à 100 Ko. `fonts: false` les laisse de côté.
- Le **PNG** est une photo du graphique, `scale` fois plus grande. Servez-vous-en là où il faut une image (un message, une diapositive, une page qui n'accepte pas le SVG). Les polices web de votre page sont écrites dans l'image, donc le texte a l'aspect qu'il a à l'écran.

## Sans téléchargement

`chart.exportSVG(options)` renvoie une promesse du texte du fichier SVG, et `chart.exportPNG(options)` renvoie une promesse d'URL de données PNG. Servez-vous-en pour envoyer le graphique à un serveur, le copier dans le presse-papiers ou en montrer un aperçu. L'[exemple d'export](/fr/examples/export) en montre un.

## Polices

Un fichier se lit sans la page : un SVG ouvert dans une visionneuse, ou chargé comme image pour faire un PNG, ne voit pas les polices de la page, et son texte se rabattrait sur une autre police. L'export écrit donc dans le fichier les `@font-face` des polices web que le graphique utilise, avec les fichiers de police intégrés. Seul ce dont le texte a besoin est écrit : les polices et les graisses utilisées, et les sous-ensembles d'une police (`unicode-range`) qui couvrent les caractères du graphique. La police de la page est aussi écrite sur le fichier, pour le texte qui n'en nomme pas.

Les règles sont lues dans les feuilles de style de la page, et les fichiers sont téléchargés (une seule fois). Donc :

- Une feuille de style d'une autre origine qui ne l'autorise pas (pas d'en-têtes CORS) ne peut pas être lue, ni un fichier de police d'un serveur qui ne l'autorise pas. Google Fonts autorise les deux. Cette police se rabat sur une police proche.
- Une police chargée par script (`new FontFace(...)`) ne peut pas être relue, et n'est pas écrite.
- Une police qui n'est installée que sur votre machine n'est pas écrite : ce n'est pas une police web.

## Limites

- Un navigateur qui ne laisse pas entrer de HTML dans une image (Safari, à l'heure où j'écris) dessine le PNG sans les titres ni la légende, et le dit dans la console. Le SVG les garde.
- Le HTML que vous ajoutez vous-même (une ancre, un slot) est dans le fichier tant qu'il n'utilise que ce qu'un `foreignObject` sait dessiner. Les parties pilotées par le pointeur sont toujours laissées de côté.
