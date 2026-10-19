# Ajouter et retirer des données

Affectez les données d'une série et tout ce qui la dessine suit : les barres, la courbe, l'infobulle, et les axes quand un domaine automatique les ajuste.

<ExampleLive id="data" :height="420" />

## Ce qu'il montre

- **Changer les données, c'est les affecter.** `series.data = [...series.data, [x, valeur]]` ajoute un point ; `series.data.slice(1)` retire le premier. Il n'y a pas d'autre appel : une série annonce que ses données ont changé, et les rendus et le domaine automatique qui lui sont liés réagissent.
- **Le graphique passe de ce qui était là à ce qui est là maintenant.** Un point nouveau naît sur son plus proche voisin et un point retiré meurt sur lui, donc une courbe grandit ou rétrécit sans sauter ; une nouvelle barre grandit depuis la base et une barre retirée y retourne. La transition dure 200 ms, et repart de ce qui est à l'écran si les données changent pendant qu'elle a lieu. [Avancé](/fr/guide/advanced#animations) donne l'algorithme.
- **Les axes s'ajustent aux nouvelles données.** Le `D3PAutoDomain` lié à la série règle de nouveau les domaines x et y à chaque fois. Sans lui, les domaines gardent les plages que vous avez écrites et les nouveaux points peuvent tomber dehors.
- **Le zoom et le déplacement ne sont pas animés.** Un changement de domaine est dessiné aussitôt, pour que le glissement ne traîne jamais derrière le pointeur.
