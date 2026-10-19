# Cartésien et polaire

Mêmes séries, mêmes rendus ligne et aire, même infobulle, même curseur, même légende et mêmes outils, dessinés sur des axes cartésiens ou polaires. **Seuls les axes changent** : basculez avec les boutons. Dans le code ci-dessous, `axes` contient les deux jeux d'axes et le graphique en prend un, plus tout le reste.

En polaire, glisser fait tourner l'angle, la molette zoome le rayon, et l'axe du rayon suit le pointeur (`D3PCursorRadiusAxisRenderer`). Les données couvrent trois tours, et ce qui sort du domaine d'angle n'est pas dessiné : c'est pourquoi le motif continue de remplir le cercle pendant la rotation.

<ExampleLive id="polar" />

## Comment fonctionne la bascule

Un axe a une `position`. `bottom`, `top`, `left` et `right` le placent sur un côté d'un graphique cartésien ; `angle` et `radius` en font la première et la seconde dimension d'un système polaire (`D3PAngleAxis` et `D3PRadiusAxis` en sont des raccourcis). Les rendus lisent les axes du graphique et demandent à leur système de coordonnées de projeter les points : ils ne savent pas dans quelle géométrie ils dessinent.

```ts
// cartésien
new D3PAxis({ name: 'angle', domain: angle, position: 'bottom' })
new D3PAxis({ name: 'radius', domain: radius, position: 'left' })

// polaire : mêmes noms, mêmes domaines
new D3PAxis({ name: 'angle', domain: angle, position: 'angle' })
new D3PAxis({ name: 'radius', domain: radius, position: 'radius' })
```

Chaque axe est dessiné par un [moteur de rendu d'axe](/fr/guide/advanced#moteurs-de-rendu-d-axe), choisi d'après la position. Un axe refuse un moteur qui ne gère pas sa position, avec un message explicite.
