This build has no external image files — every icon in the app is an inline SVG
defined in js/icons.js, and unit "photos" are CSS gradient placeholders (see the
.scrim-photo class in css/styles.css). That's a deliberate choice in the prototype,
not something missing from this package.

When you're ready to add real unit photos, this is a natural place to put them,
e.g. assets/units/<unit-id>/1.jpg — a developer can then swap the .scrim-photo
placeholder in js/pages/inventory.js for an <img> tag pointing here.
