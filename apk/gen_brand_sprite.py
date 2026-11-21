# -*- coding: utf-8 -*-
"""
NOVAMED 星核精灵图 —— 与 Web 客户端 BrandSparkle 的 SVG 几何严格 1:1

Web 侧（viewBox 0 0 40 40）：
    core      = sparklePath(20, 20, 10.5)   pinch .15
    satellite = sparklePath(0, 0, 3.6)      （同一径向渐变，objectBoundingBox 相对）
    <radialGradient cx="0.42" cy="0.38" r="0.75">
      dark : 0% #ffffff / 36% #dbeafe / 70% #60a5fa / 100% #3b82f6
      light: 0% #ffffff / 34% #dbeafe / 68% #60a5fa / 100% #3b82f6

本脚本输出「星角刚好触到画布四边」的精灵图（star r = W/2），
于是 RN 里直接按 2r 作为 Image 宽度即可完全复现 viewBox 的比例，
伴星也能复用同一张图（渐变按 bbox 相对，缩放后外观一致）。

用法："C:/Program Files/PyManager/python.exe" gen_brand_sprite.py
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__))

STOPS_DARK = [(0.00, (255, 255, 255)), (0.36, (219, 234, 254)), (0.70, (96, 165, 250)), (1.00, (59, 130, 246))]
STOPS_LIGHT = [(0.00, (255, 255, 255)), (0.34, (219, 234, 254)), (0.68, (96, 165, 250)), (1.00, (59, 130, 246))]

# 径向渐变在 bbox 内的相对参数（来自 SVG）
GCX, GCY, GR = 0.42, 0.38, 0.75


def sparkle(cx, cy, r, pinch=0.15, seg=40):
    """与 sparklePath 完全一致的四段二次贝塞尔采样。"""
    k = r * pinch
    anchors = [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)]
    ctrls = [(cx + k, cy - k), (cx + k, cy + k), (cx - k, cy + k), (cx - k, cy - k)]
    pts = []
    for i in range(4):
        p0, p2, c = anchors[i], anchors[(i + 1) % 4], ctrls[i]
        for s in range(seg):
            t = s / seg
            u_ = 1 - t
            pts.append((
                u_ * u_ * p0[0] + 2 * u_ * t * c[0] + t * t * p2[0],
                u_ * u_ * p0[1] + 2 * u_ * t * c[1] + t * t * p2[1],
            ))
    return pts


def lerp(stops, t):
    if t <= stops[0][0]:
        return stops[0][1]
    for i in range(len(stops) - 1):
        o0, c0 = stops[i]
        o1, c1 = stops[i + 1]
        if t <= o1:
            f = 0 if o1 == o0 else (t - o0) / (o1 - o0)
            return tuple(int(c0[j] + (c1[j] - c0[j]) * f) for j in range(3))
    return stops[-1][1]


def render(size, stops):
    SS = 4
    W = size * SS
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))

    # 渐变底（bbox 相对：cx .42 / cy .38 / r .75）
    gcx, gcy, grad_r = GCX * W, GCY * W, GR * W
    grad = Image.new("RGB", (W, W), stops[-1][1])
    gpx = grad.load()
    step = max(1, W // 240)
    for yy in range(0, W, step):
        for xx in range(0, W, step):
            d = math.hypot(xx - gcx, yy - gcy) / grad_r
            col = lerp(stops, min(d, 1.0))
            for dy in range(step):
                for dx in range(step):
                    if xx + dx < W and yy + dy < W:
                        gpx[xx + dx, yy + dy] = col

    mask = Image.new("L", (W, W), 0)
    ImageDraw.Draw(mask).polygon(sparkle(W / 2, W / 2, W / 2), fill=255)
    out = Image.composite(grad.convert("RGBA"), img, mask)
    return out.resize((size, size), Image.LANCZOS)


def render_glow(size, color=(59, 130, 246)):
    """
    轮廓辉光：模拟 Web 的 drop-shadow(0 0 8px rgba(59,130,246,.45))。
    RN 没有 drop-shadow 滤镜，改用「同形状 + 预高斯模糊」的独立精灵图，
    叠在星核下方即可得到只有形状外沿发光、星核本身依旧锐利的效果。
    """
    SS = 2
    W = size * SS
    canvas = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    # 留出模糊所需的边距：星角半径取 0.34W
    mask = Image.new("L", (W, W), 0)
    ImageDraw.Draw(mask).polygon(sparkle(W / 2, W / 2, W * 0.34), fill=255)
    layer = Image.new("RGBA", (W, W), color + (255,))
    layer.putalpha(mask)
    # 两段模糊叠加，得到 tighter core + wider halo 的自然衰减
    near = layer.filter(ImageFilter.GaussianBlur(radius=W * 0.035))
    far = layer.filter(ImageFilter.GaussianBlur(radius=W * 0.085))
    out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    out = Image.alpha_composite(out, far)
    out = Image.alpha_composite(out, near)
    return out.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    for app in ("staff", "patient"):
        adir = os.path.join(ROOT, "apps", app, "assets")
        core = render(512, STOPS_LIGHT)
        core.save(os.path.join(adir, "brand-core.png"))
        # 兼容旧引用：两者几何一致，仅渐变停靠点差 2%，视觉无差别
        render(512, STOPS_DARK).save(os.path.join(adir, "logo-core-dark.png"))
        core.save(os.path.join(adir, "logo-core-light.png"))
        render_glow(512).save(os.path.join(adir, "brand-glow.png"))
        print("[ok]", app)
    print("DONE")
