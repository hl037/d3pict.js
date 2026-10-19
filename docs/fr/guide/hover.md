# Étape 4 : curseur, infobulle et légende

Trois types d'objets réagissent au pointeur : un curseur qui donne la valeur sous lui sur chaque axe, une infobulle qui liste les valeurs des séries, et une légende qui montre et cache des séries.

<ExampleLive id="guide-4" :height="340" />

Ce qui a changé :

- **`D3PCursorIndicator`** dessine un réticule qui suit le pointeur, avec la valeur de chaque axe sur l'axe.
- **`D3PTooltip`** liste la valeur de chaque série sous le pointeur.
- **`D3PLegendBundle`** liste les séries ; un clic sur une entrée cache sa courbe.
- **Core seulement : une zone d'interaction.** Les événements du pointeur viennent d'une zone d'interaction, un rectangle transparent sur le tracé. En TypeScript pur, `d3pAutoInteractionArea(chart)` la crée quand quelque chose la demande, et doit être appelé **avant** l'attache des objets. Les graphiques Vue et React le font pour vous.
- **Le HTML est à vous.** L'infobulle et la légende calculent ce qu'il faut montrer et donnent un élément où le mettre. `d3pDomTooltip` et `d3pDomLegend` le remplissent d'un contenu simple par défaut ; les adaptateurs Vue et React ont des composants pour cela, qui acceptent aussi votre contenu (voir [Vue et React](/fr/guide/frameworks)).

## Les étiquettes du curseur

Le curseur écrit la valeur sous le pointeur avec le `tickFormat` de l'axe. Cette valeur n'est pas une graduation : elle a beaucoup de décimales, donc un format comme `` (v) => `${Math.round(v)} %` `` garde l'étiquette courte. Une étiquette n'est jamais plus large que la place que son axe lui laisse : un texte plus long passe à la ligne, et se termine par une ellipse là où même cela ne tient pas. `props.axisLabelStyle.maxWidth` (160 px) abaisse la limite ; `valueFormatter` écrit les étiquettes vous-même.

À chaque mouvement, chaque série trouve le point le plus proche du pointeur, et son **marker** le marque : un point sur une courbe, un contour autour d'une barre. Les markers appartiennent aux rendus : donnez-en un autre avec `marker`, ou aucun avec `marker: false`.

```ts
new D3PLineRenderer({ bus, series, marker: false })
```

L'infobulle, le curseur et les markers lisent le même événement du pointeur, et le travail n'est fait qu'une fois.
