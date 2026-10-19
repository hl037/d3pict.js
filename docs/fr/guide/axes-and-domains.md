# Étape 2 : axes et domaines

Un axe transforme les valeurs de vos données en positions. Deux choses y participent : son **domaine** (*domain*), la plage de valeurs qu'il montre, et son **échelle** (*scale*), la fonction qui projette cette plage sur des pixels. Vous écrivez le domaine ; l'axe construit l'échelle à partir de lui et de la taille du graphique.

<ExampleLive id="guide-2" :height="340" />

Ce qui a changé :

- **Les domaines sont des variables.** `hours` et `degrees` sont des objets `D3PAxisDomain`, donnés aux axes. Un domaine est un objet simple qui porte une plage, rien d'autre : ni échelle, ni pixels.
- **Un domaine automatique les ajuste aux données.** `D3PAutoDomain.linkSeries(series, [domaineX, domaineY])` règle les domaines sur l'étendue de la série, et les tient à jour quand les données changent. Retirez-le pour garder les plages que vous avez écrites.
- **Les axes se règlent avec `props`.** `tickCount` est le nombre de graduations voulu, `tickFormat` écrit une valeur, `grid` dessine la grille, `displayName` est le nom affiché dans les étiquettes du curseur et les titres.

## Les domaines sont partagés et modifiables

Le domaine d'un axe se lit et s'écrit : `hours.domain = [6, 18]` ne montre que la journée, et l'axe suit. C'est tout ce que font le zoom et le déplacement (ils écrivent des domaines), et c'est ainsi que des graphiques restent synchrones : deux axes construits sur le même `D3PAxisDomain` montrent toujours la même plage, même sur deux graphiques différents.

## Types d'échelle

`scaleType` sur l'axe choisit l'échelle.

| `scaleType` | Pour | Domaine |
|---|---|---|
| `linear` (défaut) | des nombres | `[min, max]` |
| `time`, `utc` | des dates | `[début, fin]` en `Date` |
| `log` | des nombres sur plusieurs ordres de grandeur | `[min, max]`, tous deux au-dessus de 0 |
| `symlog` | pareil, avec des valeurs négatives et zéro | `[min, max]` |
| `pow`, `sqrt` | des aires et autres lois de puissance | `[min, max]` |
| `band` | des catégories dessinées en bandes (barres) | la liste des catégories |
| `point` | des catégories dessinées en points (une courbe sur des catégories) | la liste des catégories |

`scaleOptions` passe des options à l'échelle : la `base` d'une échelle `log`, l'`exponent` d'une échelle `pow`.
