# Cartésien et polaire, synchronisés

Les mêmes données sur un graphique cartésien et un polaire qui partagent leurs domaines. Glissez sur l'un et l'autre suit ; survolez l'un et le pointeur montre sa valeur sur les deux.

<ExampleLive id="polarsync" />

## Comment fonctionne la synchronisation

- **Domaines partagés.** Les axes cartésiens et polaires reposent sur les deux mêmes `D3PAxisDomain` (l'angle et la magnitude) : ce que l'un écrit est vu par les deux graphiques, qui le dessinent chacun dans leur géométrie. Faire glisser l'angle sur le cartésien fait tourner le polaire, et inversement.
- **Les mêmes noms.** Les deux graphiques nomment leurs axes `angle` et `magnitude` : les rendus, le curseur, l'infobulle et les outils attachés aux deux retrouvent leurs axes sur chacun. Ce sont les mêmes objets, attachés deux fois.
- **Le pointeur suit d'un graphique à l'autre.** Survolez l'un et le curseur, l'infobulle et les points apparaissent sur l'autre, au même angle : chaque graphique lit l'événement du pointeur par la [sonde](/fr/guide/advanced#la-sonde-et-les-markers), par nom d'axe.
- **Un graphique polaire lit le pointeur au-delà de son anneau.** Dans la `reach` de son système (112 px par défaut), le pointeur donne encore l'angle et la magnitude extérieure : les points et l'infobulle ne disparaissent pas quand il quitte le disque. L'axe du rayon qui suit le pointeur s'arrête à la même distance.
