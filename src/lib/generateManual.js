import { jsPDF } from 'jspdf';

export function generateManual() {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentW = pageW - margin * 2;
  let y = margin;

  const colors = {
    primary: [8, 145, 178],
    dark: [24, 24, 27],
    muted: [100, 100, 100],
    accent: [234, 88, 12],
  };

  const ensureSpace = (needed) => {
    if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
  };

  const heading = (text, size = 16) => {
    ensureSpace(size + 14);
    y += 10;
    doc.setFont(`helvetica`, `bold`);
    doc.setFontSize(size);
    doc.setTextColor(...colors.primary);
    doc.text(text, margin, y);
    y += 4;
    doc.setDrawColor(...colors.primary);
    doc.setLineWidth(1);
    doc.line(margin, y, margin + contentW, y);
    y += 14;
  };

  const subheading = (text) => {
    ensureSpace(22);
    y += 6;
    doc.setFont(`helvetica`, `bold`);
    doc.setFontSize(12);
    doc.setTextColor(...colors.dark);
    doc.text(text, margin, y);
    y += 12;
  };

  const body = (text) => {
    doc.setFont(`helvetica`, `normal`);
    doc.setFontSize(10);
    doc.setTextColor(...colors.dark);
    const lines = doc.splitTextToSize(text, contentW);
    const lineH = 13;
    lines.forEach((line) => {
      ensureSpace(lineH);
      doc.text(line, margin, y);
      y += lineH;
    });
    y += 4;
  };

  const bullet = (label, desc) => {
    ensureSpace(13);
    doc.setFont(`helvetica`, `bold`);
    doc.setFontSize(10);
    doc.setTextColor(...colors.accent);
    doc.text(`•`, margin, y);
    doc.setFont(`helvetica`, `bold`);
    doc.setTextColor(...colors.dark);
    doc.text(label, margin + 12, y);
    if (desc) {
      const labelW = doc.getTextWidth(label);
      doc.setFont(`helvetica`, `normal`);
      doc.setTextColor(...colors.muted);
      const descLines = doc.splitTextToSize(desc, contentW - 12 - labelW - 6);
      if (descLines.length === 1) {
        doc.text(descLines[0], margin + 12 + labelW + 6, y);
        y += 13;
      } else {
        y += 13;
        descLines.forEach((line) => {
          ensureSpace(13);
          doc.text(line, margin + 24, y);
          y += 13;
        });
      }
    } else {
      y += 13;
    }
    y += 2;
  };

  const spacer = (h = 8) => { y += h; };

  // ════════ COVER ════════
  doc.setFillColor(8, 145, 178);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(`helvetica`, `bold`);
  doc.setFontSize(42);
  doc.text(`NPFCut Pro`, pageW / 2, pageH / 2 - 40, { align: 'center' });
  doc.setFontSize(16);
  doc.setFont(`helvetica`, `normal`);
  doc.text(`Logiciel CAD/CAM pour découpe CNC`, pageW / 2, pageH / 2, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`Manuel d'utilisation complet`, pageW / 2, pageH / 2 + 30, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`Génération de G-code optimisé • Import/Export DXF • Compensation de kerf`, pageW / 2, pageH / 2 + 55, { align: 'center' });
  doc.setFontSize(8);
  doc.text(`Version 2026 — ${new Date().toLocaleDateString('fr-FR')}`, pageW / 2, pageH - 40, { align: 'center' });

  // ════════ TABLE OF CONTENTS ════════
  doc.addPage();
  y = margin;
  heading(`Table des matières`, 18);
  const toc = [
    `1. Présentation générale`,
    `2. Interface de travail`,
    `3. Outils de dessin`,
    `4. Sélection et édition`,
    `5. Opérations de modification`,
    `6. Opérations CAM (découpe)`,
    `7. Compensation de kerf`,
    `8. Ponts et entrées/sorties (Lead-In/Out)`,
    `9. Import et Export de fichiers`,
    `10. Simulation du parcours`,
    `11. Raccourcis clavier`,
    `12. Conseils et bonnes pratiques`,
  ];
  toc.forEach((item) => {
    ensureSpace(16);
    doc.setFont(`helvetica`, `normal`);
    doc.setFontSize(11);
    doc.setTextColor(...colors.dark);
    doc.text(item, margin + 10, y);
    y += 16;
  });

  // ════════ 1. PRÉSENTATION ════════
  doc.addPage();
  y = margin;
  heading(`1. Présentation générale`);
  body(`NPFCut Pro est un logiciel CAD/CAM fonctionnant dans le navigateur, conçu pour générer du G-code optimisé pour les machines de découpe CNC (plasma, laser, jet d'eau, routeur). Il permet de dessiner, importer, modifier et préparer des contours de découpe, puis d'exporter un G-code prêt à l'emploi.`);
  subheading(`Fonctionnalités principales`);
  bullet(`Dessin 2D`, `lignes, rectangles, cercles, arcs, texte, formes libres.`);
  bullet(`Import DXF`, `récupération de dessins depuis Inkscape, AutoCAD, etc.`);
  bullet(`Import TXT`, `lecture de fichiers G-code machine existants.`);
  bullet(`Édition avancée`, `miroirs, répétitions, arrondis, éclatement, fusion de contours.`);
  bullet(`Outils Inkscape`, `joindre, briser, ciseaux pour couper un segment.`);
  bullet(`Compensation de kerf`, `décalage automatique des contours selon la largeur de coupe.`);
  bullet(`Ponts et lead-in/out`, `maintien des pièces et entrées/sorties de coupe.`);
  bullet(`Simulation`, `visualisation animée du parcours d'outil.`);
  bullet(`Export G-code`, `format machine prêt à découper.`);

  // ════════ 2. INTERFACE ════════
  heading(`2. Interface de travail`);
  body(`L'interface se compose de trois zones principales :`);
  bullet(`Barre d'outils (haut)`, `tous les boutons de dessin, modification, CAM, import/export.`);
  bullet(`Zone de dessin (centre)`, `canvas interactif avec grille, axes et origine (point DÉPART).`);
  bullet(`Panneau d'information (haut-gauche)`, `outil actif, taille de grille, zoom, mesures, raccourcis.`);
  subheading(`Navigation dans la vue`);
  bullet(`Molette de la souris`, `zoom centré sur le curseur.`);
  bullet(`Espace + glisser`, `déplacer la vue (pan).`);
  bullet(`Bouton zoom +/-`, `zoom avant/arrière par pas de 20%.`);
  bullet(`Bouton %`, `réinitialise la vue à 100%.`);
  body(`L'origine (0,0) est marquée par une croix rouge « DÉPART » : c'est le point de départ de la machine. Positionnez toujours votre dessin près de cette origine avant l'export (voir Normaliser la position).`);

  // ════════ 3. OUTILS DE DESSIN ════════
  heading(`3. Outils de dessin`);
  body(`Sélectionnez un outil dans la barre d'outils, puis cliquez sur le canvas. Le magnétisme de grille (MAG) aligne les points sur la grille par défaut.`);
  subheading(`Sélection (S)`);
  body(`Outil par défaut. Cliquez une entité pour la sélectionner. Maj+clic pour en sélectionner plusieurs. Glissez pour sélectionner par rectangle. Double-clic sur la sélection bascule en mode rotation.`);
  subheading(`Ligne (L)`);
  body(`Cliquez deux points pour tracer une ligne. La longueur s'affiche en temps réel.`);
  subheading(`Rectangle (R)`);
  body(`Cliquez un point, une boîte demande largeur et hauteur.`);
  subheading(`Cercle (C)`);
  body(`Cliquez le centre, une boîte demande le diamètre.`);
  subheading(`Arc (⌒)`);
  body(`Cliquez trois points : départ, point intermédiaire, fin. L'arc est calculé automatiquement.`);
  subheading(`Texte (A)`);
  body(`Cliquez la position, saisissez le texte, la taille, la police et un rayon d'arc optionnel (0 = texte droit). Convertissez ensuite en contours avec le bouton « A→ » pour le découper.`);
  subheading(`Forme libre (F)`);
  body(`Glissez pour définir un carré ; la forme libre est générée avec des points de contrôle éditables.`);

  // ════════ 4. SÉLECTION ET ÉDITION ════════
  heading(`4. Sélection et édition`);
  subheading(`Déplacer`);
  body(`Avec l'outil Sélection, glissez une entité sélectionnée pour la déplacer.`);
  subheading(`Redimensionner`);
  body(`Des poignées carrées bleues apparaissent aux coins de la sélection. Glissez un coin pour mettre à l'échelle.`);
  subheading(`Pivoter`);
  body(`Double-cliquez la sélection pour passer en mode rotation. Des poignées rondes apparaissent ; glissez-en une pour pivoter autour du centre.`);
  subheading(`Poignées d'entité`);
  body(`Chaque entité possède des poignées bleues (extrémités, centre, points) que vous pouvez glisser pour modifier sa géométrie directement.`);
  subheading(`Dupliquer (D)`);
  body(`Duplique la sélection avec un décalage de 10 mm.`);
  subheading(`Supprimer`);
  body(`Touche Suppr efface toutes les entités sélectionnées.`);

  // ════════ 5. OPÉRATIONS DE MODIFICATION ════════
  heading(`5. Opérations de modification`);
  subheading(`Bissectrice (∠ ÷2)`);
  body(`Sélectionnez 2 lignes : crée les 2 lignes bissectrices à leur intersection.`);
  subheading(`Prolonger lignes (⟿)`);
  body(`Sélectionnez des lignes, saisissez une distance : chaque ligne est prolongée des deux côtés.`);
  subheading(`Briser aux intersections (✂ / Ctrl+B)`);
  body(`Découpe toutes les entités à leurs points d'intersection. Les cercles traversés deviennent des arcs.`);
  subheading(`Regrouper lignes en contours (🔗)`);
  body(`Fusionne les entités sélectionnées en un seul contour (path).`);
  subheading(`Miroir ↕ / ↔`);
  body(`Crée une copie miroir de la sélection par rapport à l'axe horizontal ou vertical de son cadre.`);
  subheading(`Répétition rectangulaire (⊞)`);
  body(`Grille de copies : nombre de lignes, colonnes et espacements.`);
  subheading(`Répétition circulaire (⭯)`);
  body(`Copies réparties sur un cercle : nombre, rayon, angle de départ.`);
  subheading(`Fusion Lignes (🔗 L)`);
  body(`Assemble les lignes sélectionnées en contours en chaînant les extrémités proches.`);
  subheading(`Fusion Manuelle (🔗 M)`);
  body(`Cliquez les segments dans l'ordre souhaité, puis Entrée pour les assembler en un contour. Échap annule.`);
  subheading(`Contour Externe (🔲 Ext)`);
  body(`Calcule l'enveloppe convexe (convex hull) des entités sélectionnées.`);
  subheading(`Fusionner en 1 contour (⛓️)`);
  body(`Connecte les segments ouverts sélectionnés en un seul contour, en raboutant les extrémités les plus proches.`);
  subheading(`Joindre (🔗 J)`);
  body(`Sélectionnez 2 contours ouverts (lignes ou chemins ouverts) : ils sont joints par leurs extrémités les plus proches.`);
  subheading(`Briser au point (✂ Briser)`);
  body(`Cliquez sur un contour pour le couper en deux à cet endroit. Sur un contour fermé, il devient ouvert.`);
  subheading(`Ciseaux (✂️ Ciseaux)`);
  body(`Cliquez deux points sur un même contour : la portion entre les deux est supprimée. Idéal pour retirer un segment.`);
  subheading(`Arrondir les angles (⌒)`);
  body(`Sélectionnez des rectangles ou contours, saisissez un rayon : les angles sont remplacés par des arcs.`);
  subheading(`Fixer les joints (🧲)`);
  body(`Soude les extrémités proches (< 2 mm) des entités sélectionnées en un point commun.`);
  subheading(`Éclater (💥 / X)`);
  body(`Décompose un contour ou rectangle en lignes individuelles.`);
  subheading(`Convertir texte en contours (A→)`);
  body(`Transforme un texte en contours découpables (charge la police, gère le texte courbe).`);
  subheading(`Parallèle (//)`);
  body(`Crée une copie parallèle d'une ligne ou contour à une distance donnée (gauche/droite/haut/bas).`);
  subheading(`Cercles aux intersections (+)`);
  body(`Place un cercle à chaque intersection d'entités (diamètre paramétrable).`);
  subheading(`Nettoyer points isolés (🧹)`);
  body(`Supprime les entités trop petites (< 0,1 mm).`);
  subheading(`Normaliser la position (📍)`);
  body(`Déplace tout le dessin pour que son coin inférieur-gauche soit à l'origine (0,0). Indispensable avant l'export.`);

  // ════════ 6. OPÉRATIONS CAM ════════
  heading(`6. Opérations CAM (découpe)`);
  subheading(`Trier intérieur → extérieur (🎯 Tri)`);
  body(`Réordonne les entités pour découper les trous avant les contours externes (évite de détacher la pièce trop tôt).`);
  subheading(`Prévisualiser le parcours (🛤️)`);
  body(`Affiche l'ordre de coupe avec des numéros et des flèches de déplacement entre contours.`);
  subheading(`Simulation (SIM)`);
  body(`Ouvre une fenêtre qui anime le parcours d'outil en temps réel, avec lecture/pause, vitesse réglable et navigation pas-à-pas.`);

  // ════════ 7. KERF ════════
  heading(`7. Compensation de kerf`);
  body(`Le « kerf » est la largeur de matière retirée par l'outil (largeur de coupe). Pour obtenir une pièce aux dimensions exactes, le parcours doit être décalé de la moitié du kerf.`);
  subheading(`Réglage`);
  body(`Saisissez la largeur de kerf (mm) dans le champ « Kerf » de la barre d'outils. La compensation s'applique à l'export G-code.`);
  subheading(`Comportement`);
  bullet(`Contours externes`, `décalés vers l'extérieur (la pièce garde ses dimensions).`);
  bullet(`Trous / contours internes`, `décalés vers l'intérieur (le trou garde ses dimensions).`);
  body(`La détection automatique distingue les trous (contenus dans un autre contour) des contours externes. Les lead-in/out sont décalés en conséquence.`);
  subheading(`Valeurs typiques`);
  body(`Plasma : 1 à 3 mm • Laser : 0,1 à 0,5 mm • Jet d'eau : 0,8 à 1,2 mm. Référez-vous à la documentation de votre machine.`);

  // ════════ 8. PONTS & LEAD-IN/OUT ════════
  heading(`8. Ponts et entrées/sorties (Lead-In/Out)`);
  subheading(`Ponts (🔲 / ➕ PONT)`);
  body(`Les ponts laissent de la matière non coupée pour maintenir la pièce dans la tôle. « 🔲 » crée plusieurs ponts réguliers sur un contour fermé. « ➕ PONT » permet de cliquer un point précis sur un contour pour y placer un pont.`);
  subheading(`Lead-In (↘️ IN)`);
  body(`Ajoute une entrée de coupe : l'outil commence hors du contour et entre en coupant. Évite le défaut de départ sur le contour. La distance est paramétrable.`);
  subheading(`Lead-Out (↗️ OUT)`);
  body(`Ajoute une sortie de coupe après le lead-in. L'outil ressort proprement.`);
  subheading(`Supprimer (✕ IN / ✕ OUT)`);
  body(`Retire les entrées/sorties des entités sélectionnées.`);
  body(`Les lead-in/out sont représentés par des points rouges (IN) et bleus (OUT), déplaçables par glisser-déposer.`);

  // ════════ 9. IMPORT / EXPORT ════════
  heading(`9. Import et Export de fichiers`);
  subheading(`Importer DXF (⬆)`);
  body(`Cliquez l'icône d'import et choisissez un fichier .dxf. Les lignes, cercles, arcs, polylignes et splines sont importés comme entités.`);
  subheading(`Importer TXT (📄)`);
  body(`Lit un fichier G-code machine (.txt) et reconstruit les contours pour les rééditer.`);
  subheading(`Enregistrer sous DXF (💾)`);
  body(`Exporte le dessin courant au format DXF (compatible Inkscape, AutoCAD).`);
  subheading(`Exporter G-code (G)`);
  body(`Génère le G-code avec compensation de kerf, lead-in/out et ordre de coupe. Une fenêtre affiche le code avec options de téléchargement (.txt) et copie.`);
  subheading(`Format G-code`);
  body(`Coordonnées relatives (G91), métrique (G71). M07 = allumage torche, M08 = extinction, M02 = fin de programme. Les arcs utilisent G02/G03 avec I/J.`);

  // ════════ 10. SIMULATION ════════
  heading(`10. Simulation du parcours`);
  body(`Le bouton SIM ouvre une fenêtre de simulation qui :`);
  bullet(`Affiche`, `tous les contours et l'ordre de coupe numéroté.`);
  bullet(`Anime`, `le parcours de l'outil en temps réel.`);
  bullet(`Contrôles`, `lecture/pause, réinitialisation, pas-à-pas, réglage de vitesse.`);
  bullet(`Curseur`, `barre de progression pour naviguer dans le parcours.`);
  body(`Vérifiez la simulation avant d'exporter pour confirmer l'ordre, la direction et l'absence de collisions.`);

  // ════════ 11. RACCOURCIS ════════
  heading(`11. Raccourcis clavier`);
  const shortcuts = [
    [`S`, `Outil Sélection`],
    [`L`, `Outil Ligne`],
    [`R`, `Outil Rectangle`],
    [`C`, `Outil Cercle`],
    [`T`, `Outil Texte`],
    [`F`, `Outil Forme libre`],
    [`X`, `Éclater le contour sélectionné`],
    [`D`, `Dupliquer la sélection`],
    [`O`, `Parallèle (offset)`],
    [`Suppr`, `Effacer la sélection`],
    [`Ctrl+Z`, `Annuler`],
    [`Ctrl+Y`, `Refaire`],
    [`Ctrl+B`, `Briser aux intersections`],
    [`Échap`, `Annuler l'action / désélectionner / quitter un mode`],
    [`Entrée`, `Terminer la fusion manuelle`],
    [`Espace + glisser`, `Déplacer la vue`],
    [`Molette`, `Zoom`],
  ];
  shortcuts.forEach(([key, desc]) => {
    ensureSpace(14);
    doc.setFont(`helvetica`, `bold`);
    doc.setFontSize(10);
    doc.setTextColor(...colors.accent);
    doc.text(key, margin, y);
    doc.setFont(`helvetica`, `normal`);
    doc.setTextColor(...colors.dark);
    doc.text(desc, margin + 80, y);
    y += 14;
  });

  // ════════ 12. CONSEILS ════════
  spacer(6);
  heading(`12. Conseils et bonnes pratiques`);
  bullet(`Normalisez la position`, `avant chaque export pour partir de l'origine machine.`);
  bullet(`Vérifiez le kerf`, `mesurez la largeur réelle de coupe de votre outil et réglez-la.`);
  bullet(`Triez intérieur → extérieur`, `pour découper les trous avant le contour externe.`);
  bullet(`Ajoutez des ponts`, `sur les pièces qui risquent de tomber ou de se déformer.`);
  bullet(`Utilisez les lead-in/out`, `pour une finition propre des contours.`);
  bullet(`Simulez toujours`, `avant d'envoyer le G-code à la machine.`);
  bullet(`Fermez les contours`, `un contour ouvert ne sera pas découpé en boucle ; utilisez Joindre ou Fusionner.`);
  bullet(`Sauvegardez en DXF`, `pour conserver une version éditable de votre travail.`);

  spacer(20);
  ensureSpace(30);
  doc.setFont(`helvetica`, `italic`);
  doc.setFontSize(9);
  doc.setTextColor(...colors.muted);
  doc.text(`NPFCut Pro — Manuel d'utilisation généré automatiquement.`, margin, y);
  y += 12;
  doc.text(`Pour toute question ou suggestion, utilisez le bouton Don (☕) dans la barre d'outils.`, margin, y);

  doc.save(`NPFCut_Pro_Manuel.pdf`);
}