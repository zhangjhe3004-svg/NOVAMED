# -*- coding: utf-8 -*-
"""NOVAMED 移动端图标生成 —— 复刻 BrandSparkle 新星核设计"""
import math, os
from PIL import Image, ImageDraw, ImageFilter

OUT = r"C:/Users/zhang/Desktop/MediCode/apk/apps/mobile/assets"
os.makedirs(OUT, exist_ok=True)

# ── 品牌色（对齐 BrandSparkle on=dark 提亮渐变）──
STOPS = [(0.0, (255,255,255)), (0.36, (219,234,254)), (0.70, (96,165,250)), (1.0, (59,130,246))]
RAY = [(0.0, (125,211,252)), (1.0, (56,189,248))]
BLUE = (37, 99, 235)      # #2563eb
NAVY = (20, 45, 83)       # #142d53

def sample_sparkle(cx, cy, r, pinch=0.15, seg=28):
    """内凹四角星路径（Q 贝塞尔）采样为多边形点列"""
    k = r * pinch
    anchors = [(cx, cy-r), (cx+r, cy), (cx, cy+r), (cx-r, cy)]
    pts = []
    for i in range(4):
        p0 = anchors[i]
        p2 = anchors[(i+1) % 4]
        # Q 控制点 = 两锚点间的内收角点（顺时针: p0 -> ctrl -> p2）
        if i == 0: ctrl = (cx + k, cy - k)
        elif i == 1: ctrl = (cx + k, cy + k)
        elif i == 2: ctrl = (cx - k, cy + k)
        else: ctrl = (cx - k, cy - k)
        for s in range(seg):
            t = s / seg
            x = (1-t)**2*p0[0] + 2*(1-t)*t*ctrl[0] + t**2*p2[0]
            y = (1-t)**2*p0[1] + 2*(1-t)*t*ctrl[1] + t**2*p2[1]
            pts.append((x, y))
    return pts

def lerp_color(stops, t):
    for i in range(len(stops)-1):
        o0, c0 = stops[i]; o1, c1 = stops[i+1]
        if t <= o1:
            f = 0 if o1 == o0 else (t-o0)/(o1-o0)
            return tuple(int(c0[j] + (c1[j]-c0[j])*f) for j in range(3))
    return stops[-1][1]

def star_layer(size, bright=True):
    """40x40 viewBox 的星核层 → 缩放到 size。bright=True 用提亮渐变（深底用）"""
    S = 40
    img = Image.new("RGBA", (S*32, S*32), (0,0,0,0))
    px = img.load()
    W = S*32
    # 径向渐变（中心 42%,38%，半径 0.75*40 → 光斑覆盖全星）
    gcx, gcy, grad_r = 0.42*W, 0.38*W, 0.75*W
    stops = STOPS
    # 星核 polygon（r=10.5*32）
    core = sample_sparkle(20*32, 20*32, 10.5*32)
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).polygon(core, fill=255)
    # 伴星 A（四角星 r=3.6，phase -90°，静态位置 reduce 模式）
    tilt = math.radians(30)
    def place(radius, ang):
        x3 = radius*math.cos(ang); z3 = radius*math.sin(ang)
        y = 20*32 + z3*math.cos(tilt); x = 20*32 + x3
        norm = (z3*math.sin(tilt))/radius
        scale = 0.7 + 0.35*((norm+1)/2)
        return x, y, scale, 0.62+0.38*((norm+1)/2)
    ax, ay, asc, aop = place(12*32, -math.pi/2)
    bx, by, bsc, bop = place(14*32, 0)
    satA = sample_sparkle(ax, ay, 3.6*32*asc)
    # 渐变填星核
    grad = Image.new("RGBA", img.size)
    gpx = grad.load()
    for yy in range(0, W, 4):  # 步进4加速，后面放大模糊
        for xx in range(0, W, 4):
            d = math.hypot(xx-gcx, yy-gcy) / grad_r
            c = lerp_color(stops, min(d, 1.0))
            for dy in range(4):
                for dx in range(4):
                    if xx+dx < W and yy+dy < W:
                        gpx[xx+dx, yy+dy] = c + (255,)
    star = Image.composite(grad, img, mask)
    # 伴星 A 用同一渐变
    maskA = Image.new("L", img.size, 0)
    ImageDraw.Draw(maskA).polygon(satA, fill=255)
    star = Image.composite(grad, star, Image.eval(maskA, lambda v: int(v*aop)))
    draw = ImageDraw.Draw(star)
    # 伴星 B（圆点）
    rb = 2.4*32*bsc
    draw.ellipse([bx-rb, by-rb, bx+rb, by+rb], fill=(56,189,248,int(255*bop)))
    # 星尘粒子
    dust = [(6,12,0.8,(96,165,250)), (34,8,0.7,(56,189,248)), (36,30,0.9,(59,130,246)),
            (5,31,0.6,(147,197,253)), (15,4,0.6,(56,189,248)), (26,37,0.7,(96,165,250))]
    for dx_, dy_, dr_, dc in dust:
        rr = dr_*32
        cx_, cy_ = dx_*32, dy_*32
        draw.ellipse([cx_-rr, cy_-rr, cx_+rr, cy_+rr], fill=dc+(200,))
    return star.resize((size, size), Image.LANCZOS)

def compose_icon(size, bg, star_scale, star_img=None):
    """bg 底 + 居中星核"""
    img = Image.new("RGBA", (size, size), bg + (255,) if len(bg) == 3 else bg)
    s = star_img or star_layer(size, bright=True)
    target = int(size * star_scale)
    st = (star_img or star_layer(target)).resize((target, target), Image.LANCZOS) if s.size[0] != target else s
    img.alpha_composite(st, ((size-target)//2, (size-target)//2))
    return img

bright = star_layer(640, bright=True)   # 提亮版（深底）
normal = star_layer(640, bright=False)  # 标准版

# 1) icon.png 1024 —— 蓝底 + 星核
compose_icon(1024, BLUE, 0.62, bright.resize((int(1024*0.62),)*2, Image.LANCZOS)).convert("RGB").save(f"{OUT}/icon.png")

# 2) android-icon-foreground.png 1024 —— 透明底，星核缩到安全区（约 60%）
compose_icon(1024, (0,0,0,0), 0.60, bright.resize((int(1024*0.60),)*2, Image.LANCZOS)).save(f"{OUT}/android-icon-foreground.png")

# 3) android-icon-background.png 1024 —— 纯品牌蓝
Image.new("RGB", (1024, 1024), BLUE).save(f"{OUT}/android-icon-background.png")

# 4) android-icon-monochrome.png 1024 —— 白色剪影
mono = Image.new("RGBA", (1024, 1024), (0,0,0,0))
core = sample_sparkle(512, 512, 1024*0.30)
ImageDraw.Draw(mono).polygon(core, fill=(255,255,255,255))
mono.save(f"{OUT}/android-icon-monochrome.png")

# 5) splash-icon.png 512 —— 透明底提亮星核（深海军蓝启动屏用）
bright.resize((512, 512), Image.LANCZOS).save(f"{OUT}/splash-icon.png")

# 6) logo-dark.png 256（深底用）/ logo-light.png 256（白底用）—— App 内品牌标识
bright.resize((256, 256), Image.LANCZOS).save(f"{OUT}/logo-dark.png")
normal.resize((256, 256), Image.LANCZOS).save(f"{OUT}/logo-light.png")

# 7) favicon.png 128 —— 白底蓝星
compose_icon(128, (255,255,255), 0.78, normal.resize((100, 100), Image.LANCZOS)).convert("RGB").save(f"{OUT}/favicon.png")

print("DONE:", sorted(os.listdir(OUT)))
