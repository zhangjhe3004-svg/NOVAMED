# -*- coding: utf-8 -*-
"""
NOVAMED 品牌星核（App 内使用，供 BrandMark 组件加载）

两种底：
  dark  —— 深底用，炽白 → 浅蓝的提亮渐变（发光感）
  light —— 浅底用，亮蓝 → 深蓝的饱和渐变（保证在白底上有足够对比）
"""
import math
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))

# (offset, color)
DARK_STOPS = [(0.00, (255, 255, 255)), (0.34, (219, 234, 254)), (0.68, (96, 165, 250)), (1.00, (59, 130, 246))]
LIGHT_STOPS = [(0.00, (147, 197, 253)), (0.38, (59, 130, 246)), (0.78, (37, 99, 235)), (1.00, (29, 78, 216))]


def sparkle(cx, cy, r, pinch=0.148, seg=32):
    k = r * pinch
    anchors = [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)]
    ctrls = [(cx + k, cy - k), (cx + k, cy + k), (cx - k, cy + k), (cx - k, cy - k)]
    pts = []
    for i in range(4):
        p0 = anchors[i]
        p2 = anchors[(i + 1) % 4]
        c = ctrls[i]
        for s in range(seg):
            t = s / seg
            u = 1 - t
            pts.append((
                u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0],
                u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1],
            ))
    return pts


def lerp(stops, t):
    for i in range(len(stops) - 1):
        o0, c0 = stops[i]
        o1, c1 = stops[i + 1]
        if t <= o1:
            f = 0 if o1 == o0 else (t - o0) / (o1 - o0)
            return tuple(int(c0[j] + (c1[j] - c0[j]) * f) for j in range(3))
    return stops[-1][1]


def core(size, stops, star_ratio=0.40):
    SS = 4
    W = size * SS
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    cx, cy = W / 2, W / 2
    r = W * star_ratio

    # 渐变（中心略偏左上，模拟光源）
    gcx, gcy = cx - W * 0.06, cy - W * 0.08
    grad_r = W * 0.46
    grad = Image.new("RGB", (W, W))
    gpx = grad.load()
    step = max(1, W // 200)
    for yy in range(0, W, step):
        for xx in range(0, W, step):
            d = math.hypot(xx - gcx, yy - gcy) / grad_r
            col = lerp(stops, min(d, 1.0))
            for dy in range(step):
                for dx in range(step):
                    if xx + dx < W and yy + dy < W:
                        gpx[xx + dx, yy + dy] = col

    mask = Image.new("L", (W, W), 0)
    ImageDraw.Draw(mask).polygon(sparkle(cx, cy, r), fill=255)
    out = Image.composite(grad.convert("RGBA"), img, mask)
    return out.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    for app in ("staff", "patient"):
        adir = os.path.join(ROOT, "apps", app, "assets")
        core(512, DARK_STOPS).save(os.path.join(adir, "logo-core-dark.png"))
        core(512, LIGHT_STOPS).save(os.path.join(adir, "logo-core-light.png"))
        print("[ok]", app)
    print("DONE")
