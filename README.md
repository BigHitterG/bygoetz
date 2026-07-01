# bygoetz

Personal website and creative portfolio of Thomas Goetz.

## Site tree

This repository currently uses plain HTML, CSS, and JavaScript with a static route structure:

```text
index.html
concepts/
  explorers/
    index.html
    products/
      field-notebook.html
      trail-patch.html
  nemean/
    index.html
    products/
      hide-scarf.html
      lion-pin.html
bag/
  index.html
checkout/
  index.html
styles.css
scripts.js
```

## Route model

- The master grid lives at `index.html` and contains the top-level concepts.
- Each concept has a landing page under `concepts/{concept}/index.html`.
- Concepts contain product pages under `concepts/{concept}/products/{product}.html`.
- Products can be added to a shared bag using `localStorage`.
- Checkout is a mostly shared one-off flow at `checkout/index.html`.

If the site moves to a framework later, mirror this route tree in `app/` or `pages/` so the information architecture remains the same.
