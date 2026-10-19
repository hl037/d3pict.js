---
pageClass: wide-example
aside: false
---

# Vitrine

Sept graphiques qui combinent la plupart des fonctionnalités de la bibliothèque, chacun avec un titre, des titres sur ses axes et une légende. Les quatre boutons au-dessus changent les données de tous les graphiques à la fois : **add a point**, **remove the last**, **remove the first**, **replace**. Chaque graphique prend le changement à sa façon : des heures et des jours sont ajoutés, trimestres, mois, régions et heures de la heatmap s'ajoutent comme catégories (la rose gagne des pétales), et les axes s'ajustent aux nouvelles données.

<ExampleLive id="showcase" :height="2700" />

## Les graphiques

1. **Série temporelle, quatre axes Y.** Deux axes de chaque côté (`offset` les empile), dont un **logarithmique**, et deux axes X (heure et jour) sur un seul domaine. Des barres, une **spline** avec un **trou** (`gaps: 'break'`), une **aire de plage** (`base`), des points, quatre **annotations** (bande, ligne, point ; la ligne est sur l'axe log), une légende, déplacement et zoom à la molette sur l'axe X seulement.
2. **Catégories.** Des **colonnes groupées** (`count` et `index`) sur un axe en bandes, une ligne sur un second axe Y, une annotation.
3. **Deux systèmes polaires dans un graphique.** Une **rose empilée** (`D3PStack`, barres sur axes polaires) et un **anneau** dessiné dans un second `D3PPolarSystem`, plus petit. L'axe du rayon suit le pointeur.
4. **Un graphique en chandeliers et son volume**, deux graphiques qui partagent **un axe X** : déplacez ou zoomez l'un et l'autre suit, et le pointeur montre sa valeur sur les deux. Une moyenne mobile, et l'axe Y ajusté aux plus bas et plus hauts (`D3PAutoDomain`).
5. **Les barres de volume**, second graphique de cette paire.
6. **Une carte de chaleur** avec son échelle de couleurs et sa légende (`D3PColorScale`, `D3PColorLegend`).
7. **Beaucoup de points.** Une courbe de 1 000, 10 000 ou 100 000 points, choisis dans la liste au-dessus des graphiques, pour voir ce que coûte un graphique quand les données grossissent. Son sous-titre donne le temps entre l'affectation des données et le premier dessin, génération des points comprise. Déplacement, zoom et survol se comportent pareil quelle que soit la taille ; seule l'animation entre deux jeux de données ralentit avec 100 000 points.

Chaque type de graphique a aussi [sa propre page](/fr/examples/gallery), avec le code de ce type seul.
