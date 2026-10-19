# Étape 9 : graphiques polaires

Un graphique polaire dessine les mêmes séries avec un angle et une distance au centre. Seuls les axes changent.

<ExampleLive id="guide-9" :height="460" />

Ce qui a changé :

- **Les axes ont d'autres positions.** `position: 'angle'` fait de l'heure un angle, `position: 'radius'` fait de la température une distance au centre. Les domaines, les séries, les rendus, le curseur, l'infobulle, les outils et la légende sont ceux du graphique cartésien.
- **L'humidité a disparu,** pour garder un graphique qui se lit bien : un système polaire a un angle et un rayon.
- Les titres sont contre le disque : celui de l'angle dessous, celui du rayon à sa gauche.

Les rendus ne savent pas dans quelle géométrie ils dessinent. Ils demandent à leur **système de coordonnées** de placer les points : le système cartésien leur donne un rectangle, le polaire un disque.

## Le système polaire

Le système est créé avec le premier axe polaire, avec ses réglages par défaut. Pour les changer, créez-le vous-même et attachez-le avant les axes :

```ts
const polar = new D3PPolarSystem({ bus, props: { startAngle: 90, clockwise: false, innerRadius: 0.4 } })
```

| Prop | Est |
|---|---|
| `startAngle` | où commence le domaine de l'angle, en degrés (0 est en haut) |
| `clockwise` | le sens dans lequel l'angle croît |
| `sweep` | la partie du cercle couverte, en degrés : 180 est un demi-cercle (une jauge) |
| `innerRadius` | le trou, en fraction du rayon : un anneau, un donut |
| `shift` | déplace le centre, en fractions du rayon |
| `padding` | pixels gardés autour du disque pour les étiquettes de l'angle |
| `reach` | jusqu'où au-delà du disque le pointeur compte encore comme sur le graphique (112 px) |

Les valeurs hors du domaine n'ont pas de place : une courbe polaire est coupée à la plage d'angle et écrêtée à l'anneau, jamais enroulée autour du cercle.

## Mêmes données, deux géométries

Échangez les positions et le graphique change. L'[exemple cartésien et polaire](/fr/examples/polar) le fait avec un bouton. L'axe du rayon peut suivre le pointeur (`D3PCursorRadiusAxisRenderer`).

## Camemberts et radars

Un camembert est un rendu dans un système polaire (`D3PPieRenderer` ; un `D3PPolarSystem` avec un `innerRadius` fait un anneau). Un radar utilise des axes polaires avec `D3PRadarAngleAxisRenderer` ; une rose ou des barres radiales utilisent `D3PBarRenderer`. Voir les [types de graphiques](/fr/examples/gallery).

## Des graphiques qui se suivent

Deux graphiques dont les axes partagent un `D3PAxisDomain` restent synchrones, un cartésien et un polaire compris : [cartésien et polaire, synchronisés](/fr/examples/polarsync).
