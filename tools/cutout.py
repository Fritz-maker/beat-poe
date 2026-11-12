"""Cut a face picture out of its flat background and shrink it for the game.

    python3 tools/cutout.py ~/Downloads/some-picture.jpeg art/twain-normal.webp

The background colour is read from the picture's corners. Everything of that
colour that is connected to the edge of the picture becomes transparent, so
dark outlines and details inside the figure are kept.

Needs: pip install pillow numpy
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

SIZE = 512        # output is at most SIZE x SIZE
TOLERANCE = 20    # how far (in colour distance) a pixel may be from the background


def cutout(src, dst):
    im = Image.open(src).convert("RGB")
    a = np.asarray(im).astype(np.int32)
    h, w, _ = a.shape
    k = max(4, min(h, w) // 64)
    corners = np.concatenate([a[:k, :k], a[:k, -k:], a[-k:, :k], a[-k:, -k:]]).reshape(-1, 3)
    bg = np.median(corners, axis=0)
    spread = np.abs(corners - bg).max()
    if spread > 24:
        print(f"warning: the corners are not one flat colour (spread {spread:.0f}); the cut-out may be rough")
    close = np.sqrt(((a - bg) ** 2).sum(axis=2)) < TOLERANCE

    # grow inwards from the picture's edge through background-coloured pixels
    mask = np.zeros((h, w), bool)
    mask[0, :], mask[-1, :], mask[:, 0], mask[:, -1] = close[0, :], close[-1, :], close[:, 0], close[:, -1]
    while True:
        grown = mask.copy()
        grown[1:, :] |= mask[:-1, :]
        grown[:-1, :] |= mask[1:, :]
        grown[:, 1:] |= mask[:, :-1]
        grown[:, :-1] |= mask[:, 1:]
        grown &= close
        if (grown == mask).all():
            break
        mask = grown

    alpha = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8), "L")
    alpha = alpha.filter(ImageFilter.GaussianBlur(max(1.0, min(h, w) / 700)))   # soften the edge
    out = im.convert("RGBA")
    out.putalpha(alpha)
    out.thumbnail((SIZE, SIZE), Image.LANCZOS)
    out.save(dst, quality=88, method=6)
    removed = 100 * mask.mean()
    print(f"{dst}: {out.size[0]}x{out.size[1]}, background removed from {removed:.0f}% of the picture")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    cutout(sys.argv[1], sys.argv[2])
