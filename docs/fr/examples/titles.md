# Titres et légende

Un titre avec un sous-titre, des titres sur les axes et une légende sous le tracé. Chacun est un composant ajouté au graphique, et prend sa place sur le tracé.

<ExampleLive id="titles" />

## Ce qu'il montre

- **`D3PTitle`** met un titre et un sous-titre au-dessus du tracé.
- **`D3PAxisTitle`** met un titre sur un axe, de son côté. Sans `props.text`, il écrit le nom affiché de l'axe.
- **`D3PLegendPanel`** liste les rendus sous le tracé (`placement` choisit le côté, ou un coin du tracé) ; un clic sur une entrée montre ou cache son rendu.
- Aucun n'est là si vous ne l'ajoutez pas. Le [guide de la mise en page](/fr/guide/layout) dit comment ils réservent leur place, et comment écrire un titre ou une légende à vous avec les mêmes pièces.
