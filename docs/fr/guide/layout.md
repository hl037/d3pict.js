# Étape 6 : titres et mise en page

Un graphique est un tracé entouré de place : les marges pour les étiquettes de graduation, et ce que vous ajoutez autour. Les titres, les titres d'axes et une légende sont des objets qui prennent leur place sur le tracé.

<ExampleLive id="guide-6" :height="380" />

Ce qui a changé :

- **`D3PTitle`** met un titre, et un sous-titre, au-dessus du tracé.
- **`D3PAxisTitle`** met un titre sur un axe, contre ses étiquettes de graduation. Sans `props.text`, il écrit le `displayName` de l'axe.
- **`D3PLegendPanel`** remplace la légende : il dessine lui-même les entrées, sous le tracé (`placement`), et lui prend de la place. `D3PLegendBundle` vous laisse le balisage ; utilisez le panneau quand vous voulez une légende qui est simplement là.

Rien de tout cela n'est présent si vous ne l'ajoutez pas. Chacun peut être retiré, changé, ou remplacé par un composant à vous (voir plus bas).

## Les composants standard

| Composant | Ce qu'il fait | Options |
|---|---|---|
| `D3PTitle` | Un titre au-dessus du tracé, avec un sous-titre facultatif. | `side` (`top`, `bottom`), `size`, `props` : `text`, `subtitle`, `align`, `style` |
| `D3PAxisTitle` | Le titre d'un axe, contre ses étiquettes de graduation et centré sur le tracé ; tourné pour se lire le long d'un axe de gauche ou de droite. | `axis` (objet ou nom), `size`, `props` : `text`, `align`, `gap`, `style` |
| `D3PLegendPanel` | Une légende : une ligne par entrée des rendus ; un clic la montre ou la cache. | `placement`, `size`, `series`, `props` : `align`, `style` |

- Les props se lisent et se changent comme celles de n'importe quel objet : `title.props.align = 'start'`, `title.props({ subtitle: '' })`.
- Un **panneau de légende** va sur un côté du tracé (`top`, `right`, `bottom`, `left` : il prend de la place au tracé) ou dans un coin (`top-left`, `top-right`, `bottom-left`, `bottom-right` : il flotte sur le tracé). `series` le limite à certains rendus. Avec beaucoup d'entrées, il s'adapte : en haut ou en bas, sa bande grandit avec les lignes sur lesquelles les entrées passent, jusqu'à un tiers du graphique, puis la liste défile (`size` la fixe) ; sur un côté, les noms sont coupés et la liste défile.
- Un **titre d'axe** se place à `gap` pixels (6 par défaut ; de 4 à 10 est l'usage) des étiquettes de son axe, du côté extérieur. Les étiquettes sont mesurées une fois l'axe dessiné, donc le titre suit leur largeur, et le tracé garde la place dont l'axe et son titre ont besoin ensemble. Avec plusieurs axes d'un même côté, chaque titre est contre son axe : laissez la place entre les axes avec leur `offset` (voir [plusieurs axes](/fr/guide/several-axes)).
- Sur un graphique **polaire**, les titres d'axes sont contre le disque : sous lui pour l'angle, à sa gauche pour le rayon.
- Les bandes d'un côté s'empilent par `order`, quel que soit l'ordre d'attache : le titre du graphique est le plus extérieur, puis la légende, et les titres des axes sont les plus proches du tracé.

## La place : la mise en page et ses bandes

Chaque graphique a une mise en page, `chart.layout`, qui répartit la place en **bandes** : une bande le long d'un côté qu'un objet réserve, et que le tracé cède.

```ts
const band = chart.layout.reserve('top', 30)   // 30 px le long du haut, pris au tracé
band.rect()                                    // { x, y, width, height }, dans les coordonnées du svg
band.size = 50                                 // le tracé cède 20 pixels de plus
band.release()                                 // et les reprend
chart.margin                                   // les marges avec les bandes : où commence le tracé
chart.baseMargin                               // la `margin` donnée au graphique
```

Une bande a un `side`, un `span` (le long de tout le graphique, ou du tracé seul, pour qu'un titre soit centré sur le tracé) et un `order` : le plus bas est le plus extérieur (un titre vaut 0, une légende 1, le titre d'un axe 2). Quand une bande change, le graphique recalcule le tracé et tout se redessine, comme quand le conteneur est redimensionné.

## Un slot : une bande et un élément

`D3PSlot` réserve une bande sur chaque graphique où il est attaché, et donne à chacun un élément HTML placé dessus. C'est la pièce dont sont faits les composants standard.

```ts
import { D3PSlot } from 'd3pict'

const note = new D3PSlot({ bus, side: 'bottom', size: 20 })   // `inside` flotte sur le tracé à la place, sans rien réserver
note.addToChart(chart)
note.getContainer(chart)!.textContent = 'Source : le service de supervision'
```

Avec un framework, rendez dedans avec le composant de l'adaptateur :

```vue
<D3PVChart :objects="[x, y, line, note]" />
<D3PVSlot :slot="note">Source : le service de supervision</D3PVSlot>
```

```tsx
<D3PRChart objects={[x, y, line, note]} />
<D3PRSlot slot={note}>{() => <>Source : le service de supervision</>}</D3PRSlot>
```

## Vos propres composants

Les composants standard n'utilisent rien qu'un composant de vous ne puisse utiliser : un slot pour la place, des props publiques, le gestionnaire de légende, les axes du graphique. Voici `D3PTitle`, réduit à son principe :

```ts
import { D3PAttachable, D3PSlot, type D3PChart } from 'd3pict'

class Caption extends D3PAttachable<{}> {
  private readonly slot = new D3PSlot({ side: 'top', size: 24 })
  constructor(readonly text: string) {
    super('caption', [])
  }
  protected createData() {
    return {}
  }
  protected attached(chart: D3PChart) {
    this.slot.addToChart(chart)
    this.slot.getContainer(chart)!.textContent = this.text
  }
  protected override detached(chart: D3PChart) {
    this.slot.removeFromChart(chart)
  }
}
```

Pour remplacer un composant standard, ne l'attachez pas et attachez le vôtre. Une légende à vous peut partir de `D3PLegendBundle` : il donne les entrées (`legend.manager.e.changed`) et chaque entrée bascule son rendu (`entry.toggle()`).
