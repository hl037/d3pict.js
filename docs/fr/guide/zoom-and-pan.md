# Étape 5 : zoom et déplacement

Les outils laissent l'utilisateur agir sur le graphique. Ils font une seule chose : écrire les domaines des axes.

<ExampleLive id="guide-5" :height="340" />

Ce qui a changé :

- **`D3PToolbox`** porte les outils et dit lesquels sont actifs. `setToolActive('pan')` active un outil.
- **`D3PPanTool`** déplace les domaines quand le pointeur fait glisser le tracé. **`D3PWheelZoomTool`** zoome autour du pointeur avec la molette. **`D3PResetTool`** ramène les domaines là où ils étaient.

Les axes suivent les domaines, et tout ce qui en dépend aussi : les courbes, la grille, le curseur.

## Les outils

| Outil | Nom | Fait |
|---|---|---|
| `D3PPanTool` | `pan` | glisser pour déplacer |
| `D3PZoomSelectionTool` | `zoom-selection` | tracer un rectangle pour zoomer dessus |
| `D3PClickZoomTool` | `zoom-click` | cliquer pour zoomer |
| `D3PWheelZoomTool` | `wheel-zoom` | molette pour zoomer autour du pointeur |
| `D3PWheelPanTool` | `wheel-pan` | molette pour se déplacer en x |
| `D3PResetTool` | `reset` | retour à la première vue |

## Choisir ce sur quoi un outil agit

Par défaut, un outil agit sur tous les axes du graphique. L'option `axes` nomme ceux qu'il déplace :

```ts
new D3PPanTool({ bus, axes: ['hour'] }) // déplace x, laisse la plage y tranquille
```

`new D3PToolbox({ bus, mutuallyExclusiveGroups: [['pan', 'zoom-selection']] })` rend des outils exclusifs : en activer un désactive les autres de son groupe.

## La molette et la page

Un graphique qui a un outil de molette prend la molette tant que le pointeur est dessus. Un graphique sans outil laisse la page défiler.
