# Démarrer

D3Pict dessine des graphiques en SVG, au-dessus de [d3](https://d3js.org). Utilisez-le en TypeScript pur, avec Vue ou avec React : le graphique est le même, seules les dernières lignes changent.

Ce guide construit **un seul graphique**, d'une courbe à un graphique polaire dont vous changez les données et que vous enregistrez en fichier, en onze étapes. Chaque étape ajoute quelque chose et montre ce qui a changé. [Concepts](/fr/guide/concepts) donne la vue d'ensemble.

## Installer

```sh
pnpm add d3pict d3
```

`d3` est une dépendance homologue. Vue et React sont facultatifs : seuls `d3pict/vue` et `d3pict/react` les utilisent.

## Étape 1 : une courbe

Les onglets donnent le code pour TypeScript pur, Vue et React. Le graphique est le même.

<ExampleLive id="guide-1" :height="340" />

- **Série.** `D3PSeries` porte vos données : un nom et une liste de points `[x, valeur]`.
- **Axes.** `D3PAxis` dessine un axe. Son `D3PAxisDomain` est la plage de valeurs que l'axe montre : `[0, 24]` pour l'axe x, `[0, 30]` pour l'axe y. `position: 'left'` met l'axe y à gauche ; un axe est en `bottom` par défaut. Le `name` d'un axe est ce qui permet aux autres objets de le désigner.
- **Rendu.** `D3PLineRenderer` dessine une série en courbe. Il trouve ses axes tout seul : le premier axe x et le premier axe y du graphique.
- **Bus.** Chaque objet prend un `bus` : le canal par lequel les objets se parlent. Passez le même à tous. Vue et React vous en donnent un (voir [Vue et React](/fr/guide/frameworks)).
- **Graphique.** `D3PChart` est un SVG vide dans un conteneur. Rien n'est dessiné tant que des objets ne lui sont pas attachés : `addToChart(chart)` en TypeScript pur, la liste `objects` avec Vue et React.

Tout ce que vous attachez est un **objet** : des axes et des rendus maintenant, puis le curseur, l'infobulle, les outils et les titres. Un objet peut être attaché à plusieurs graphiques, ce qui permet de les [synchroniser](/fr/guide/concepts#plusieurs-graphiques).

::: tip Le conteneur a besoin d'une taille
Un graphique remplit son conteneur et le suit quand il est redimensionné. Donnez une hauteur au conteneur en CSS (`height: 400px`) ; sans elle, le graphique n'a rien à remplir.
:::
