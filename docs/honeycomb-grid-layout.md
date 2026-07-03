# Honeycomb bubble grid layout

The bubble grid can reliably work as a set of clickable concept slots. Each bubble already has a stable coordinate and id, so a concept can be attached to a bubble by using its `q` and `r` coordinates.

## How the grid is organized

The grid uses **axial hex coordinates**:

- `q` moves across the grid down-right/up-left.
- `r` moves across the grid vertically in the staggered honeycomb.
- Each bubble id is written as `q:r`.
- The center slot is always `0:0`.
- The current home grid renders `rings = 8`, which means every slot whose hex distance from `0:0` is 8 or less is included.

The code converts each axial coordinate into a screen position with this formula:

```txt
x = spacing * (q + r / 2)
y = spacing * (sqrt(3) / 2) * r
```

Because every bubble is generated from `q`, `r`, and the same spacing value, the grid is deterministic: the same coordinate always means the same logical slot.

## Small diagram of the center slots

This is a small `rings = 2` map showing the same coordinate system used by the app. The real grid continues outward to ring 8.

```txt
                 r=-2
             0:-2      1:-2      2:-2

       r=-1
        -1:-1      0:-1      1:-1      2:-1

 r=0
  -2:0      -1:0       0:0       1:0       2:0

       r=1
        -2:1      -1:1       0:1       1:1

                 r=2
             -2:2      -1:2       0:2
```

## Neighbor directions

From any slot `q:r`, the six neighboring slots are:

| Direction | Coordinate change | Example from `0:0` |
| --- | --- | --- |
| East | `q + 1, r` | `1:0` |
| West | `q - 1, r` | `-1:0` |
| Southeast | `q, r + 1` | `0:1` |
| Northwest | `q, r - 1` | `0:-1` |
| Northeast | `q + 1, r - 1` | `1:-1` |
| Southwest | `q - 1, r + 1` | `-1:1` |

## Where concept photos should go

Put concept images in:

```txt
public/concepts/images/
```

Suggested naming convention:

```txt
public/concepts/images/<concept-slug>.jpg
public/concepts/images/<concept-slug>.png
public/concepts/images/<concept-slug>.webp
```

Example future concept mapping:

```ts
const concepts = [
  {
    id: "ritual",
    title: "Ritual",
    slot: { q: 0, r: 0 },
    image: "/concepts/images/ritual.webp",
  },
  {
    id: "craft",
    title: "Craft",
    slot: { q: 1, r: 0 },
    image: "/concepts/images/craft.webp",
  },
];
```

When we are ready to make the bubbles clickable, each concept can be matched to a generated bubble by comparing `concept.slot.q` and `concept.slot.r` to the bubble's `q` and `r` values.
