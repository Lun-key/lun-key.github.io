# 首页标题字形生成脚本（lumenkaelxystus 主题）。
#
# 【使用场景】需要重新生成首页固定的 "lunkey Lab" 标题时手动运行：
#   它读取 Segoe Print Bold 字体的字形轮廓，叠加脚本里手绘的钢笔笔路径（STROKES），
#   烘焙出一个带"逐笔书写动画"效果的 SVG 标题。
# 【读入】--font 指定的字体文件（默认是 Windows 系统字体目录下的 segoeprb.ttf）；
#   标题文字 TITLE 与每个字母的笔画路径 STROKES 都写在脚本里。
# 【产出】--output 指定的 SVG（默认 public/themes/lumen-kael-xystus/assets/hero-title.svg）。
#   若目标已存在且内容不同，只有当旧文件 SHA-256 等于 PREVIOUS_ASSET_SHA256 时才允许覆盖，
#   以防误改掉人工调整过的标题。
# 【运行命令】python themes/lumen-kael-xystus/tools/prepare-title-lettering.py
#   可用 --font / --output 覆盖默认的字体路径与输出路径；依赖 fontTools 库。
"""Bake the fixed Home title from Segoe Print Bold outlines and pen paths."""

import argparse
import hashlib
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont


# TITLE 是最终要显示的字符串；SCALE 把字体单位（2048 unitsPerEm）缩到 SVG 视图比例；
# PREVIOUS_ASSET_SHA256 是上一次产物内容的指纹，用于安全地判断是否允许覆盖。
TITLE = "lunkey Lab"
SCALE = 11 / 256
PREVIOUS_ASSET_SHA256 = "fe78e689b639c8508bd6b252a991694278ca3dad87773107151e9f80adfc62b6"
# 每个字母对应若干条 SVG 路径（贝塞尔曲线），模拟手写时的笔画顺序；
# 生成时会给每条笔画加上递增的 animation-delay，从而实现逐笔出现的书写动画。
STROKES = {
    "Y": (
        "M105 1380Q360 1180 730 750",
        "M1410 1430Q1170 1110 730 750",
        "M730 750Q650 450 660 20",
    ),
    "u": (
        "M350 960Q270 680 220 335Q190 90 345 90Q590 75 820 570",
        "M970 920Q885 650 905 330Q910 105 1035 50",
    ),
    "i": (
        "M500 1460L500 1450",
        "M345 950Q260 610 245 290Q225 105 255 40",
    ),
    "m": (
        "M310 970Q275 600 250 80",
        "M320 350Q655 1080 860 870Q970 750 970 410L990 110",
        "M1070 330Q1360 950 1540 880Q1680 850 1720 520Q1750 130 1910 115",
    ),
    "L": (
        "M430 1370Q355 790 280 160",
        "M285 160Q750 205 1170 175",
    ),
    "a": (
        "M835 920Q635 1130 375 715Q175 400 220 175Q320 -10 625 360Q860 660 850 875",
        "M930 920Q850 510 900 180Q925 60 1060 75",
    ),
    "b": (
        "M465 1650Q365 1180 255 335",
        "M355 750Q690 1175 940 950Q1160 720 835 315Q540 -70 275 175",
    ),
}


# 从字体构建完整 SVG：先校验字体是否符合预期，再导出字形轮廓与笔画蒙版。
def build_svg(font_path: Path) -> str:
    font = TTFont(font_path)
    if font["head"].unitsPerEm != 2048:
        raise ValueError("Expected the Segoe Print Bold 2048-unit outlines")
    families = {name.toUnicode() for name in font["name"].names if name.nameID == 1}
    if "Segoe Print" not in families:
        raise ValueError("Expected Segoe Print Bold, not another font family")
    weights = {name.toUnicode() for name in font["name"].names if name.nameID == 2}
    if "Bold" not in weights:
        raise ValueError("Expected the original bold title weight")
    glyph_set = font.getGlyphSet()
    names = font.getBestCmap()
    advances = font["hmtx"]
    definitions = []
    groups = []
    cursor = 4.0
    order = 0

    # 先为每个"去重后的字符"导出一次字形轮廓 path 定义（dict.fromkeys 保序去重）。
    for character in dict.fromkeys(TITLE.replace(" ", "")):
        pen = SVGPathPen(glyph_set)
        glyph_set[names[ord(character)]].draw(pen)
        definitions.append(f'<path id="glyph-{character}" d="{pen.getCommands()}"/>')

    # 再按 TITLE 原顺序逐字符排版：空格只推进光标，字符则叠加笔画蒙版与字形。
    for index, character in enumerate(TITLE):
        if character == " ":
            cursor += advances[names[ord(character)]][0] * SCALE
            continue
        paths = []
        for stroke in STROKES[character]:
            paths.append(
                f'<path class="pen" d="{stroke}" pathLength="1" fill="none" '
                f'stroke="#fff" stroke-width="500" stroke-linecap="round" '
                f'stroke-linejoin="round" style="animation-delay:{order * 68}ms"/>'
            )
            order += 1
        definitions.append(
            f'<mask id="pen-{index}" maskUnits="userSpaceOnUse" '
            f'x="-200" y="-300" width="2200" height="2100">{"".join(paths)}</mask>'
        )
        groups.append(
            f'<g transform="translate({cursor:.3f} 94) scale({SCALE} -{SCALE})">'
            f'<use href="#glyph-{character}" mask="url(#pen-{index})" '
            f'fill="#465575" stroke="#fff" stroke-width="100" '
            f'stroke-linejoin="round" paint-order="stroke fill"/></g>'
        )
        cursor += advances[names[ord(character)]][0] * SCALE

    width = round(cursor + 4, 3)
    style = (
        "<style>"
        ".pen{stroke-dasharray:1 1;animation:write 170ms linear both}"
        "@keyframes write{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}"
        "@media(prefers-reduced-motion:reduce){.pen{animation:none}}"
        "</style>"
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 12 {width} 94" '
        f'width="{width}" height="94">{style}<defs>{"".join(definitions)}</defs>'
        f'{"".join(groups)}</svg>\n'
    )


# 命令行入口：--font 指定字体、--output 指定输出 SVG；
# 覆盖已有文件时做 SHA-256 校验，既允许更新旧产物，又保护人工改过的版本。
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--font", type=Path, default=Path(r"C:\Windows\Fonts\segoeprb.ttf"))
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[4]
        / "public/themes/lumen-kael-xystus/assets/hero-title.svg",
    )
    args = parser.parse_args()
    svg = build_svg(args.font)
    if args.output.exists():
        if args.output.read_text(encoding="utf-8") != svg:
            digest = hashlib.sha256(args.output.read_bytes()).hexdigest()
            if digest != PREVIOUS_ASSET_SHA256:
                raise FileExistsError(f"Different lettering already exists: {args.output}")
            args.output.write_text(svg, encoding="utf-8", newline="\n")
    else:
        args.output.write_text(svg, encoding="utf-8", newline="\n")
    print(f"{args.output}: {len(svg.encode('utf-8'))} bytes")


if __name__ == "__main__":
    main()
