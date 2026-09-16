"""Lepas latar hitam dari foto pin BNI.

Bukan colorkey: colorkey membolongi bagian gelap di dalam pin (ring hijau tua,
tulisan maroon di pin emas). Yang dipakai flood fill dari tepi gambar, jadi yang
hilang hanya hitam yang benar-benar tersambung ke luar.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from collections import deque

LUM_BG = 26        # di bawah ini dianggap latar
FEATHER = 1.1      # radius blur alpha, piksel
GROW = 3           # berapa piksel warna dijalarkan ke luar, membunuh pinggiran hitam


def kill_black(src, dst, size=256):
    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    lum = a.max(axis=2)                       # max RGB, bukan luma, supaya glow warna ikut terjaga
    h, w = lum.shape

    # flood fill dari empat sudut
    bg = np.zeros((h, w), bool)
    dark = lum <= LUM_BG
    q = deque()
    for y, x in ((0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)):
        if dark[y, x]:
            bg[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and dark[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))

    alpha = np.where(bg, 0, 255).astype(np.uint8)

    # jalarkan warna piksel buram ke daerah transparan, supaya pinggirannya tidak abu gelap
    rgb = a.astype(np.uint8).copy()
    solid = alpha > 0
    for _ in range(GROW):
        holes = ~solid
        if not holes.any():
            break
        filled = np.zeros_like(solid)
        acc = np.zeros(rgb.shape, np.int32)
        cnt = np.zeros(solid.shape, np.int32)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            sh = np.roll(np.roll(solid, dy, 0), dx, 1)
            sc = np.roll(np.roll(rgb.astype(np.int32), dy, 0), dx, 1)
            take = sh & holes
            acc[take] += sc[take]
            cnt[take] += 1
            filled |= take
        ok = cnt > 0
        rgb[ok] = (acc[ok] // cnt[ok][:, None]).astype(np.uint8)
        solid = solid | filled

    out = Image.fromarray(np.dstack([rgb, alpha]), 'RGBA')
    # pinggiran dihaluskan sedikit supaya tidak bergerigi
    af = out.getchannel('A').filter(ImageFilter.GaussianBlur(FEATHER))
    out.putalpha(af)

    box = out.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    out = out.crop(box)
    m = max(out.size)
    sq = Image.new('RGBA', (m, m), (0, 0, 0, 0))
    sq.paste(out, ((m - out.size[0]) // 2, (m - out.size[1]) // 2))
    sq = sq.resize((size, size), Image.LANCZOS)
    sq.save(dst, optimize=True)
    return box, sq.size


for src, dst in [a.split('::') for a in sys.argv[1:]]:
    print(dst, kill_black(src, dst))
