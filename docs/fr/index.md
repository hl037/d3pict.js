---
layout: home
hero:
  name: D3Pict
  text: "Dépeignez vos données."
  image:
    src: /logo.svg
    alt: D3Pict
  tagline: "Des graphiques SVG que l'on assemble à partir d'objets, au-dessus de d3. Interactifs, animés, et faits pour être étendus, en TypeScript pur, avec Vue ou React."
  actions:
    - theme: brand
      text: Démarrer
      link: /fr/guide/getting-started
    - theme: alt
      text: Voir la vitrine
      link: /fr/examples/showcase
    - theme: alt
      text: GitHub
      link: https://github.com/hl037/d3pict.js
features:
  - title: "Cinq objets font un graphique"
    details: "Une série, deux axes, un rendu, un graphique. Changez le rendu et une courbe devient des barres, une carte de chaleur ou un camembert. Tout le reste est un objet de plus, que vous ajoutez ou pas."
  - title: "Le polaire, c'est changer des mots"
    details: "Remplacez `left` par `radius` et `bottom` par `angle` : la même série, le même rendu et la même infobulle dessinent un graphique polaire. Les graphiques dont les axes partagent un domaine zooment ensemble, polaires ou pas."
  - title: "Les nouvelles données bougent"
    details: "Affectez `series.data` et les points glissent vers leur nouvelle place. Chaque point est apparié à celui qui a le même x, donc rien ne change de place avec son voisin."
  - title: "Pas de pièce cachée"
    details: "La légende, les titres et les titres d'axes sont faits avec les pièces que vous avez. Remplacez-en une, ou écrivez la vôtre de la même façon."
  - title: "TypeScript pur, Vue ou React"
    details: "Les mêmes objets partout. `useD3PContext()` les fait dans un composant et les détruit avec lui."
  - title: "Un fichier quand il en faut un"
    details: "Enregistrez un graphique en SVG ou en PNG, avec ses polices, son titre et sa légende. Le curseur et l'infobulle n'y sont pas."
---
