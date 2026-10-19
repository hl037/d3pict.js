# Étape 7 : plusieurs axes

Deux grandeurs d'unités différentes peuvent partager un graphique : donnez à chacune son axe. La température est à gauche, l'humidité à droite.

<ExampleLive id="guide-7" :height="380" />

Ce qui a changé :

- **Un deuxième axe y.** `yRight` est du côté `right`, et a un domaine à lui (`percent`, en %).
- **Un rendu nomme ses axes.** Un rendu prend le premier axe x et le premier axe y du graphique. `humidityLine` doit dire lesquels il utilise : `axes: ['hour', 'humidity']`, par nom. Les rendus de la température prennent les valeurs par défaut, puisque l'axe `temperature` a été attaché en premier.
- **Un titre pour le nouvel axe,** contre ses propres étiquettes (`D3PAxisTitle` avec `axis: yRight`).

## Plus d'un axe sur un côté

Un axe est en `bottom`, `top`, `left` ou `right`. Pour en mettre deux du même côté, éloignez le second du tracé avec `offset` (en pixels). Laissez entre eux la place du titre du premier : les étiquettes, un `gap` et le titre prennent environ 80 px.

```ts
const cpu = new D3PAxis({ bus, name: 'cpu', domain: dCpu, position: 'left', offset: 84 })
```

Donnez aux titres, et aux axes, la couleur de leur série (`props.style.color` du titre ; la prop `postProcess` de l'axe reçoit son groupe SVG) pour que chacun soit clairement l'axe de sa série.

## Outils, curseur et infobulle

- Le **curseur** montre une étiquette par axe, sur l'axe, à la valeur sous le pointeur.
- L'**infobulle** liste les séries, chacune dans les unités de son axe.
- Un **outil** agit sur tous les axes sauf consigne contraire (`axes: ['hour']`) : zoomez le temps sans toucher aux unités des axes y.

Voir l'[exemple à plusieurs axes](/fr/examples/axes) : quatre axes y, dont un logarithmique, et deux axes x sur un même domaine.
