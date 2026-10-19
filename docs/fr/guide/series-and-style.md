# Étape 3 : plusieurs séries et leur style

Un graphique peut porter autant de séries qu'on veut. Chacune est dessinée par un rendu, et un rendu reçoit son apparence par ses `props`.

<ExampleLive id="guide-3" :height="340" />

Ce qui a changé :

- **Une deuxième série, un deuxième rendu.** `feelsLike` est liée aux mêmes domaines, donc les deux courbes partagent les axes. Un rendu n'a pas d'autre idée des données que sa série.
- **Le style est une prop.** `props: { style: { color, curve, strokeWidth } }`. `curve` relie les points : `linear` (défaut), `monotone`, `step`, `stepBefore`, `stepAfter`, `basis`, `cardinal`, `catmullRom`, `natural`. Sans couleur, un rendu en prend une d'après son nom.

## Les props

Tout objet qui a des options a des `props`. Lisez-en une (`line.props.style.color`), changez une partie (`line.props({ style: { color: 'tomato' } })`) ou affectez un champ (`line.props.style.strokeWidth = 4`) : le graphique se redessine tout seul.

## Ce qu'une série peut contenir

Une série est une liste de lignes. La première colonne est x, la deuxième la valeur principale ; elle peut avoir d'autres colonnes, nommées, que des rendus lisent (une aire de plage a un `min` et un `max`, un chandelier a un `open`, un `high`, un `low` et un `close`).

```ts
// des lignes : [x, valeur]
new D3PSeries({ bus, name: 'a', data: [[0, 12], [4, 9]] })
// une plage : les colonnes sont nommées, un rendu prend celles dont il a besoin
new D3PSeries({ bus, name: 'band', columns: ['x', 'max', 'min'], data: [[0, 20, 10], [4, 18, 8]] })
// des nombres seuls : l'indice est x
new D3PSeries({ bus, name: 'b', data: [12, 9, 14] })
// des objets : dites d'où vient chaque colonne (une clé, ou une fonction de la ligne)
new D3PSeries({ bus, name: 'c', data: rows, fields: { x: 'date', y: 'close' } })
// des colonnes : un tableau par colonne
new D3PSeries({ bus, name: 'd', data: { x: [0, 4], y: [12, 9] } })
```

Pour changer les données d'une série, affectez-les : `series.data = [...series.data, [x, valeur]]`. Tout ce qui la dessine suit, avec une animation (voir l'[étape 10](/fr/guide/changing-data) et l'[exemple d'ajout et de retrait de données](/fr/examples/data)).

Une valeur manquante (`NaN`) laisse un trou dans la courbe quand le style a `gaps: 'break'` ; par défaut, la courbe passe par-dessus.
