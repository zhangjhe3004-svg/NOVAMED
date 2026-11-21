# -*- coding: utf-8 -*-
"""
NOVAMED 移动端 App 图标 —— 静态星标（大星居中 + 右上方两颗不同角度小星）

设计说明
--------
* 一颗大四角星（内凹贝塞尔）居中偏左下，形成视觉焦点；
* 右上方沿 45° 对角线排布两颗小星，角度不同（+35° / -12°），
  形成「星群升起」的方向感，避免三颗星共轴呆板；
* 白色 → 极浅蓝的径向渐变，呼应客户端 BrandSparkle 的炽白星核；
* 静态（不含动画），符合「图标不做动效」的要求。

用法
----
    "C:/Program Files/PyManager/python.exe" gen_star_icons.py
"""
import math
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))
RENDER = os.path.join(ROOT, "render")
os.makedirs(RENDER, exist_ok=True)

# 两端客户端的品牌色（取自各自 Web 客户端）
BRAND = {
    "staff": (37, 99, 235),     # #2563eb  blue-600
    "patient": (39, 133, 125),  # #27857d  teal
}

# 星核渐变：中心纯白 → 边缘极浅蓝（近白，保证在彩色底上仍然「发光」）
GRAD_CORE = (255, 255, 255)
GRAD_EDGE = (222, 235, 255)


# ─────────────────────────── 几何 ───────────────────────────
def sparkle_points(cx, cy, r, rot_deg=0.0, pinch=0.145, seg=26):
    """内凹四角星：4 段二次贝塞尔采样成多边形。rot_deg 为旋转角。"""
    rot = math.radians(rot_deg)
    k = r * pinch
    # 未旋转的四个尖角与四个内收控制点
    anchors = [(0, -r), (r, 0), (0, r), (-r, 0)]
    ctrls = [(k, -k), (k, k), (-k, k), (-k, -k)]

    def tf(px, py):
        x = px * math.cos(rot) - py * math.sin(rot) + cx
        y = px * math.sin(rot) + py * math.cos(rot) + cy
        return (x, y)

    pts = []
    for i in range(4):
        p0 = anchors[i]
        p2 = anchors[(i + 1) % 4]
        c = ctrls[i]
        for s in range(seg):
            t = s / seg
            u = 1 - t
            x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0]
            y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1]
            pts.append(tf(x, y))
    return pts


def radial_layer(size, stars, solid=False):
    """在透明画布上绘制星群；solid=True 时输出纯白剪影。"""
    SS = 4  # 超采样倍率，抗锯齿
    W = size * SS
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))

    if solid:
        d = ImageDraw.Draw(img)
        for (cx, cy, r, rot) in stars:
            d.polygon(sparkle_points(cx * W, cy * W, r * W, rot), fill=(255, 255, 255, 255))
        return img.resize((size, size), Image.LANCZOS)

    # 渐变底色层：以整体视觉重心为中心做径向渐变
    gcx, gcy = 0.50 * W, 0.52 * W
    grad_r = 0.62 * W
    grad = Image.new("RGB", (W, W), GRAD_CORE)
    gpx = grad.load()
    step = max(1, W // 256)
    for yy in range(0, W, step):
        for xx in range(0, W, step):
            dist = math.hypot(xx - gcx, yy - gcy) / grad_r
            t = min(dist, 1.0) ** 0.85
            col = (
                int(GRAD_CORE[0] + (GRAD_EDGE[0] - GRAD_CORE[0]) * t),
                int(GRAD_CORE[1] + (GRAD_EDGE[1] - GRAD_CORE[1]) * t),
                int(GRAD_CORE[2] + (GRAD_EDGE[2] - GRAD_CORE[2]) * t),
            )
            for dy in range(step):
                for dx in range(step):
                    if xx + dx < W and yy + dy < W:
                        gpx[xx + dx, yy + dy] = col

    mask = Image.new("L", (W, W), 0)
    md = ImageDraw.Draw(mask)
    for (cx, cy, r, rot) in stars:
        md.polygon(sparkle_points(cx * W, cy * W, r * W, rot), fill=255)

    img = Image.composite(grad.convert("RGBA"), img, mask)
    return img.resize((size, size), Image.LANCZOS)


# ──────────────────────── 星群布局（相对画布 0~1） ────────────────────────
def layout(scale=1.0, cx=0.465, cy=0.555):
    """
    大星居中偏左下，两颗小星沿右上方对角线错落排布：
      小星 A —— 更近更大，旋转 +35°
      小星 B —— 更远更小，旋转 -12°（与 A 形成 47° 夹角）
    返回 [(cx, cy, r, rot), ...]
    """
    return [
        (cx, cy, 0.300 * scale, 0.0),                              # 大星
        (cx + 0.255 * scale, cy - 0.255 * scale, 0.100 * scale, 35),   # 小星 A
        (cx + 0.372 * scale, cy - 0.402 * scale, 0.064 * scale, -12),  # 小星 B
    ]


def build(size, bg, scale, star_scale=1.0, transparent=False, solid=False):
    stars = layout(scale)
    layer = radial_layer(size, stars, solid=solid)
    if transparent:
        return layer
    base = Image.new("RGBA", (size, size), bg + (255,))
    base.alpha_composite(layer)
    return base


def scale_to(size, artwork_ratio):
    """把星群整体缩进画布中央（用于自适应图标安全区 / 启动图）"""
    return artwork_ratio


# ───────────────────────────── 输出 ─────────────────────────────
def generate(key, bg):
    sub = os.path.join(RENDER, key)
    os.makedirs(sub, exist_ok=True)
    tag = key

    # 1) 普通图标 1024：星群占比 0.86（留出舒适边距）
    build(1024, bg, 1.0).convert("RGB").save(os.path.join(sub, "icon.png"))

    # 2) 自适应图标前景 1024（透明）：内容需落在中央安全区 ~66%
    build(1024, bg, 0.62, transparent=True).save(os.path.join(sub, "fg.png"))

    # 3) 自适应图标背景 1024：纯品牌色
    Image.new("RGB", (1024, 1024), bg).save(os.path.join(sub, "bg.png"))

    # 4) 单色剪影 1024（Android 13 主题图标用）
    build(1024, bg, 0.62, transparent=True, solid=True).save(os.path.join(sub, "mono.png"))

    # 5) 启动图 512（透明，白色星群，放在品牌色启动屏上）
    build(512, bg, 0.76, transparent=True).save(os.path.join(sub, "splash.png"))

    # 6) App 内品牌标（深底 / 浅底同图，白色星群）
    build(256, bg, 0.92, transparent=True).save(os.path.join(sub, "logo.png"))

    # 7) favicon 128
    build(128, bg, 1.0).convert("RGB").save(os.path.join(sub, "favicon.png"))

    print("[ok]", tag, "->", sorted(os.listdir(sub)))
    return sub


if __name__ == "__main__":
    for k, c in BRAND.items():
        generate(k, c)
    print("DONE")
