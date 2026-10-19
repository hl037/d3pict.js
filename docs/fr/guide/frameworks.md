# Étape 11 : Vue et React

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
import { onBeforeUnmount } from 'vue'
import { D3PVChart, D3PVLegend, D3PVTooltip, useD3PBus } from 'd3pict/vue'

const bus = useD3PBus()
// ... créez séries, axes, rendus, infobulle et légende avec `bus`
onBeforeUnmount(() => /* détruisez-les */ {})
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

- Gardez les objets D3Pict hors de la réactivité profonde de Vue (`shallowRef`, ou de simples `const` dans `setup`) : ce sont des classes, pas un état.

## React

```tsx
import { D3PRChart, D3PRLegend, D3PRProvider, D3PRTooltip, useD3PBus } from 'd3pict/react'

function Chart() {
  const bus = useD3PBus()
  const [scene, setScene] = useState<Scene>()
  // créez les objets dans un effet, et détruisez-les dans son nettoyage : sûr en StrictMode
  useEffect(() => {
    const created = build(bus)
    setScene(created)
    return () => created.destroy()
  }, [bus])
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

## Le bus

Le bus est ce par quoi les objets se parlent. Chaque application Vue et chaque `D3PRProvider` a le sien, donc deux applications sur une page ne s'entendent pas. Les objets et le graphique auquel ils sont attachés doivent partager un bus : une erreur le dit quand ce n'est pas le cas. Voir [Avancé](/fr/guide/advanced) pour ce qui y passe.
