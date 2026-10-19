# Étape 10 : changer les données

Affectez les données d'une série et tout ce qui la dessine suit. Aucun autre appel n'est nécessaire.

<ExampleLive id="guide-10" :height="520" />

Ce qui a changé :

- **`series.data = ...` est toute l'API.** `[...series.data, ligne]` ajoute une ligne, `series.data.slice(1)` retire la première, un nouveau tableau remplace tout. La série annonce le changement ; les rendus et le `D3PAutoDomain` qui lui sont liés réagissent.
- **Les domaines s'ajustent aux nouvelles données.** Le domaine automatique règle de nouveau `hours` et `degrees`, donc les nouveaux points ne sont jamais dehors. Sans lui, les domaines gardent les plages que vous avez écrites.
- **Les boutons sont les vôtres.** Ce sont de simples fonctions qui affectent une série ; le graphique ne les connaît pas.

## L'animation

Un rendu passe de ce qui est à l'écran à ce que disent les données maintenant. Un point est apparié au point de **même valeur x**, quelle que soit sa place à l'écran, donc :

- un point qui reste n'est pas apparié à son voisin, même quand les axes se redimensionnent ;
- un point nouveau naît sur son plus proche voisin, et un point retiré meurt sur lui : la courbe grandit ou rétrécit sans sauter ;
- une nouvelle barre grandit depuis la base, et une barre retirée y retourne.

Un redessin dure 200 ms. Si les données changent de nouveau pendant ce temps, le suivant part de ce qui est visible. Le zoom et le déplacement ne sont pas animés, pour que le glissement ne traîne jamais derrière le pointeur. [Avancé](/fr/guide/advanced#animations) donne l'algorithme.

## Plusieurs séries

Affectez chaque série qui change. Elles se redessinent ensemble, dans la même image. Pour changer plusieurs graphiques à la fois, donnez-leur les mêmes séries : la [vitrine](/fr/examples/showcase) a un seul jeu de boutons pour sept graphiques.

## Beaucoup de points

Une courbe de 100 000 points se dessine en environ 70 ms, et se déplace, se zoome et se survole à 60 images par seconde ; seule l'animation entre deux jeux de données ralentit. La [vitrine](/fr/examples/showcase) a un graphique pour la mesurer sur votre machine.
