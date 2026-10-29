# Étape 12 : Vue et React

Les onglets du guide montraient le même graphique pour les trois environnements. Cette page dit ce que font les adaptateurs.

Les objets (séries, axes, rendus, outils...) sont les mêmes classes partout. Ce qui diffère, c'est la façon de monter un graphique et celle dont du HTML (une infobulle, une légende, votre contenu) y entre. Les adaptateurs sont dans `d3pict/vue` et `d3pict/react` ; leurs classes sont préfixées `D3PV` et `D3PR`.

## Vue

```ts
import { createApp } from 'vue'
import { D3PVPlugin } from 'd3pict/vue'

createApp(App).use(D3PVPlugin) // l'application a son propre bus
```

```vue
<script setup lang="ts">
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PContext } from 'd3pict/vue'

const ctx = useD3PContext()
// les objets faits avec le contexte sont détruits quand le composant disparaît
const series = ctx.newSeries({ name: 'température', data: [[0, 12], [4, 9], [8, 14]] })
const line = ctx.newLineRenderer({ series })
const tooltip = ctx.newTooltip()
const legend = ctx.newLegendBundle()
// ... les axes, les domaines, le reste
const objects = [line, tooltip, legend]
</script>

<template>
  <div style="height: 400px">
    <D3PVChart :objects="objects" />
  </div>
  <D3PVLegend :legend="legend" />
  <D3PVTooltip :tooltip="tooltip" />
</template>
```

- **`D3PVChart`** crée le graphique dans un `div` qui suit son conteneur et attache `objects` (ajoutez-en ou retirez-en et le graphique suit). Il crée aussi la zone d'interaction. Ses props : `objects`, `margin`, `width`, `height`, `name`.
- **`D3PVTooltip`**, **`D3PVLegend`** et **`D3PVSlot`** mettent du contenu Vue dans les éléments HTML d'une infobulle, d'une légende ou d'un slot. Ils ont un contenu par défaut ; un slot par défaut le remplace, avec `data` et `chart` :

```vue
<D3PVTooltip :tooltip="tooltip">
  <template #default="{ data }">
    <div v-for="s in data.series" :key="s.renderer.id">{{ s.renderer.name }} : {{ s.y }}</div>
  </template>
</D3PVTooltip>
```

- **`useD3PContext()`** renvoie le contexte, [décrit plus bas](#le-contexte). Appelez-le dans `setup()`.
- Gardez les objets D3Pict hors de la réactivité profonde de Vue (`shallowRef`, ou de simples `const` dans `setup`) : ce sont des classes, pas un état.

## React

```tsx
import { D3PRChart, D3PRLegend, D3PRProvider, D3PRTooltip, useD3PContext } from 'd3pict/react'

function build(ctx: D3PContext) {
  const series = ctx.newSeries({ name: 'température', data: [[0, 12], [4, 9], [8, 14]] })
  const line = ctx.newLineRenderer({ series })
  const tooltip = ctx.newTooltip()
  const legend = ctx.newLegendBundle()
  // ... les axes, les domaines, le reste
  return { objects: [line, tooltip, legend], tooltip, legend }
}

function Chart() {
  // les objets faits avec le contexte sont détruits quand le composant disparaît
  const ctx = useD3PContext()
  const [scene, setScene] = useState<ReturnType<typeof build>>()
  // faites les objets dans un effet, pas pendant le rendu : sûr en StrictMode
  useEffect(() => setScene(build(ctx)), [ctx])
  if (!scene) return null
  return (
    <>
      <div style={{ height: 400 }}>
        <D3PRChart objects={scene.objects} />
      </div>
      <D3PRLegend legend={scene.legend} />
      <D3PRTooltip tooltip={scene.tooltip} />
    </>
  )
}

<D3PRProvider><Chart /></D3PRProvider>
```

- **`D3PRProvider`** donne à son sous-arbre un bus à lui ; sans lui, le bus global est utilisé.
- **`D3PRChart`**, **`D3PRTooltip`**, **`D3PRLegend`** et **`D3PRSlot`** fonctionnent comme leurs jumeaux Vue. Leur contenu vient d'une fonction des données et du graphique : `<D3PRTooltip tooltip={tooltip}>{(data) => ...}</D3PRTooltip>`.

## Le contexte

`useD3PContext()` est la façon de faire les objets d'un graphique dans un composant. Le contexte les fait avec le bus de l'application et les détruit quand le composant disparaît : pas de liste d'objets à garder, pas de nettoyage à écrire. Il a une méthode pour chaque objet de la bibliothèque, nommée d'après sa classe sans le `D3P` :

| Avec le bus | Avec le contexte |
|---|---|
| `new D3PSeries({ bus, name: 'a' })` | `ctx.newSeries({ name: 'a' })` |
| `new D3PAxis({ bus, name: 'x', domain })` | `ctx.newAxis({ name: 'x', domain })` |
| `new D3PLineRenderer({ bus, series })` | `ctx.newLineRenderer({ series })` |
| `new D3PCursorIndicator({ bus })` | `ctx.newCursorIndicator()` |

Les options sont celles de la classe, sans `bus`, et sont facultatives quand la classe n'en demande pas. `ctx.bus` est le bus, pour ce que vous faites vous-même, et `ctx.destroyLater(objet)` détruit un objet avec les autres et le renvoie :

```ts
const mine = ctx.destroyLater(new MyOwnObject({ bus: ctx.bus }))
```

Les objets sont détruits dans l'ordre inverse de leur création : un rendu avant sa série. En React, faites-les dans un effet : le composant peut être rendu deux fois, et `StrictMode` le monte, le démonte et le remonte, ce qui détruit ce que le premier montage a fait. Le contexte reste utilisable ensuite, donc le second montage refait ses objets. Le contexte existe aussi sans framework : `d3pContext(bus)` dans `d3pict`, et `ctx.destroy()` quand vous avez fini.

## Le bus

Le bus est ce par quoi les objets se parlent. Chaque application Vue et chaque `D3PRProvider` a le sien, donc deux applications sur une page ne s'entendent pas. Les objets et le graphique auquel ils sont attachés doivent partager un bus : une erreur le dit quand ce n'est pas le cas. Voir [Avancé](/fr/guide/advanced) pour ce qui y passe.
