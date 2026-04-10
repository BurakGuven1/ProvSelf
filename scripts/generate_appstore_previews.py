import os
from dataclasses import dataclass
from typing import Callable, Dict, List, Tuple

from PIL import Image, ImageDraw, ImageFont


OUTPUT_DIR = os.path.join("assets", "appstore-previews")
IPHONE_SIZE = (1290, 2796)
IPAD_SIZE = (2048, 2732)

Color = Tuple[int, int, int]
Renderer = Callable[[ImageDraw.ImageDraw, Tuple[int, int, int, int], Dict[str, ImageFont.ImageFont]], None]


def hex_to_rgb(value: str) -> Color:
  value = value.lstrip("#")
  return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def blend(a: Color, b: Color, t: float) -> Color:
  return (
    int(a[0] + (b[0] - a[0]) * t),
    int(a[1] + (b[1] - a[1]) * t),
    int(a[2] + (b[2] - a[2]) * t),
  )


def vertical_gradient(image: Image.Image, top: Color, bottom: Color) -> None:
  draw = ImageDraw.Draw(image)
  w, h = image.size
  for y in range(h):
    t = y / max(1, h - 1)
    draw.line([(0, y), (w, y)], fill=blend(top, bottom, t))


def load_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
  bold_candidates = [
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\segoeuib.ttf",
  ]
  regular_candidates = [
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\segoeui.ttf",
  ]
  candidates = bold_candidates if bold else regular_candidates
  for path in candidates:
    if os.path.exists(path):
      try:
        return ImageFont.truetype(path, size=size)
      except OSError:
        continue
  return ImageFont.load_default()


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> Tuple[int, int]:
  bbox = draw.textbbox((0, 0), text, font=font)
  return bbox[2] - bbox[0], bbox[3] - bbox[1]


def draw_wrapped(
  draw: ImageDraw.ImageDraw,
  text: str,
  x: int,
  y: int,
  max_width: int,
  font: ImageFont.ImageFont,
  fill: Color,
  line_spacing: float = 1.08,
) -> int:
  words = text.split()
  lines: List[str] = []
  line: List[str] = []
  for word in words:
    test = " ".join(line + [word])
    tw, _ = text_size(draw, test, font)
    if tw <= max_width or not line:
      line.append(word)
    else:
      lines.append(" ".join(line))
      line = [word]
  if line:
    lines.append(" ".join(line))

  _, lh = text_size(draw, "Ag", font)
  step = int(lh * line_spacing)
  cy = y
  for l in lines:
    draw.text((x, cy), l, font=font, fill=fill)
    cy += step
  return cy


def make_fonts(scale: float) -> Dict[str, ImageFont.ImageFont]:
  return {
    "brand": load_font(int(30 * scale), bold=True),
    "title": load_font(int(80 * scale), bold=True),
    "subtitle": load_font(int(36 * scale)),
    "tiny": load_font(int(16 * scale)),
    "body": load_font(int(22 * scale)),
    "body_bold": load_font(int(24 * scale), bold=True),
    "screen_title": load_font(38, bold=True),
    "screen_body": load_font(24, bold=True),
    "screen_small": load_font(18),
    "screen_tiny": load_font(15),
  }


def draw_shadow(canvas: Image.Image, rect: Tuple[int, int, int, int], radius: int = 50) -> None:
  overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
  d = ImageDraw.Draw(overlay, "RGBA")
  x1, y1, x2, y2 = rect
  d.rounded_rectangle((x1 + 8, y1 + 18, x2 + 8, y2 + 18), radius=radius, fill=(0, 0, 0, 58))
  canvas.alpha_composite(overlay)


def draw_top_bar(draw: ImageDraw.ImageDraw, rect: Tuple[int, int, int, int], fonts: Dict[str, ImageFont.ImageFont], dark: bool = True) -> Tuple[int, int, int, int]:
  x1, y1, x2, y2 = rect
  text = (228, 236, 252) if dark else (40, 44, 52)
  draw.text((x1 + 18, y1 + 16), "9:41", font=fonts["screen_tiny"], fill=text)
  draw.text((x2 - 80, y1 + 16), "5G", font=fonts["screen_tiny"], fill=text)
  draw.text((x2 - 38, y1 + 16), "100%", font=fonts["screen_tiny"], fill=text)
  return (x1 + 14, y1 + 44, x2 - 14, y2 - 14)


def progress(draw: ImageDraw.ImageDraw, rect: Tuple[int, int, int, int], value: float, color: Color, track: Color = (63, 75, 98)) -> None:
  draw.rounded_rectangle(rect, radius=(rect[3] - rect[1]) // 2, fill=track)
  fill_w = int((rect[2] - rect[0]) * max(0.0, min(1.0, value)))
  if fill_w > 0:
    draw.rounded_rectangle((rect[0], rect[1], rect[0] + fill_w, rect[3]), radius=(rect[3] - rect[1]) // 2, fill=color)


def mini_grid(
  draw: ImageDraw.ImageDraw,
  x: int,
  y: int,
  cols: int,
  rows: int,
  cell: int,
  gap: int,
  color: Color,
  ratio: float,
) -> None:
  total = cols * rows
  done = int(total * ratio)
  index = 0
  for r in range(rows):
    for c in range(cols):
      left = x + c * (cell + gap)
      top = y + r * (cell + gap)
      rect = (left, top, left + cell, top + cell)
      if index < done:
        draw.rounded_rectangle(rect, radius=max(1, cell // 3), fill=color)
      else:
        draw.rounded_rectangle(rect, radius=max(1, cell // 3), fill=(59, 72, 97))
      index += 1


def avatar(draw: ImageDraw.ImageDraw, cx: int, cy: int, radius: int, color: Color, label: str, fonts: Dict[str, ImageFont.ImageFont]) -> None:
  draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=color)
  w, h = text_size(draw, label, fonts["screen_tiny"])
  draw.text((cx - w // 2, cy - h // 2), label, font=fonts["screen_tiny"], fill=(18, 20, 26))


def render_screen_habits(draw: ImageDraw.ImageDraw, rect: Tuple[int, int, int, int], fonts: Dict[str, ImageFont.ImageFont]) -> None:
  draw.rounded_rectangle(rect, radius=46, fill=(8, 19, 42))
  x1, y1, x2, y2 = draw_top_bar(draw, rect, fonts, dark=True)
  draw.text((x1, y1), "HabitKit", font=fonts["screen_title"], fill=(242, 246, 255))
  draw.text((x2 - 62, y1 + 6), "Today", font=fonts["screen_tiny"], fill=(155, 170, 198))

  habits = [
    ("Meditation", "15 min", hex_to_rgb("#D77AFF"), 0.74),
    ("Sleep", "No phone after 23:00", hex_to_rgb("#FFCA28"), 0.66),
    ("Running", "20 min", hex_to_rgb("#66D6FF"), 0.48),
    ("Hydration", "8 glasses", hex_to_rgb("#5DE2A0"), 0.58),
    ("Reading", "20 pages", hex_to_rgb("#EC68D8"), 0.83),
    ("Deep Work", "90 minutes", hex_to_rgb("#64B5F6"), 0.54),
  ]
  top = y1 + 52
  for title, sub, color, ratio in habits:
    card = (x1, top, x2, top + 118)
    draw.rounded_rectangle(card, radius=20, fill=(16, 34, 67), outline=(40, 58, 96), width=2)
    draw.text((card[0] + 14, card[1] + 12), title, font=fonts["screen_body"], fill=(229, 238, 255))
    draw.text((card[0] + 14, card[1] + 42), sub, font=fonts["screen_small"], fill=(150, 168, 201))
    mini_grid(draw, card[0] + 14, card[1] + 68, cols=18, rows=3, cell=8, gap=3, color=color, ratio=ratio)
    draw.text((card[2] - 18, card[1] + 14), "✓", font=fonts["screen_small"], fill=(150, 170, 206))
    top += 128

  nav = (x1, y2 - 42, x2, y2 - 6)
  draw.rounded_rectangle(nav, radius=12, fill=(12, 25, 50))
  draw.text((nav[0] + 14, nav[1] + 10), "Home", font=fonts["screen_tiny"], fill=(139, 156, 189))
  draw.text((nav[0] + 72, nav[1] + 10), "Habits", font=fonts["screen_tiny"], fill=hex_to_rgb("#8E7DFF"))
  draw.text((nav[0] + 142, nav[1] + 10), "Coach", font=fonts["screen_tiny"], fill=(139, 156, 189))


def render_screen_customize(draw: ImageDraw.ImageDraw, rect: Tuple[int, int, int, int], fonts: Dict[str, ImageFont.ImageFont]) -> None:
  draw.rounded_rectangle(rect, radius=46, fill=(10, 22, 46))
  x1, y1, x2, _ = draw_top_bar(draw, rect, fonts, dark=True)
  draw.text((x1, y1), "Edit Habit", font=fonts["screen_title"], fill=(242, 246, 255))

  panel = (x1, y1 + 44, x2, rect[3] - 18)
  draw.rounded_rectangle(panel, radius=20, fill=(15, 30, 60), outline=(40, 58, 95), width=2)

  draw.text((panel[0] + 14, panel[1] + 14), "Name", font=fonts["screen_tiny"], fill=(153, 170, 201))
  draw.rounded_rectangle((panel[0] + 14, panel[1] + 34, panel[2] - 14, panel[1] + 74), radius=10, fill=(23, 44, 79))
  draw.text((panel[0] + 22, panel[1] + 46), "Reading", font=fonts["screen_body"], fill=(232, 240, 255))

  draw.text((panel[0] + 14, panel[1] + 88), "Frequency", font=fonts["screen_tiny"], fill=(153, 170, 201))
  segments = [("3/w", False), ("5/w", True), ("7/w", False)]
  sx = panel[0] + 14
  for label, active in segments:
    box = (sx, panel[1] + 108, sx + 66, panel[1] + 142)
    draw.rounded_rectangle(box, radius=10, fill=hex_to_rgb("#8FB4FF") if active else (24, 46, 82))
    draw.text((box[0] + 18, box[1] + 10), label, font=fonts["screen_small"], fill=(16, 24, 39) if active else (170, 188, 220))
    sx += 74

  draw.text((panel[0] + 14, panel[1] + 154), "Icons", font=fonts["screen_tiny"], fill=(153, 170, 201))
  draw.rounded_rectangle((panel[0] + 14, panel[1] + 174, panel[2] - 14, panel[1] + 220), radius=10, fill=(23, 44, 79))
  for i in range(9):
    cx = panel[0] + 30 + i * 34
    draw.ellipse((cx - 8, panel[1] + 192, cx + 8, panel[1] + 208), fill=(76, 102, 147))
  draw.ellipse((panel[0] + 30 + 2 * 34 - 8, panel[1] + 192, panel[0] + 30 + 2 * 34 + 8, panel[1] + 208), fill=hex_to_rgb("#8FB4FF"))

  draw.text((panel[0] + 14, panel[1] + 232), "Color", font=fonts["screen_tiny"], fill=(153, 170, 201))
  palette = [hex_to_rgb("#FFCA28"), hex_to_rgb("#EC68D8"), hex_to_rgb("#66D6FF"), hex_to_rgb("#5DE2A0"), hex_to_rgb("#FF6F91"), hex_to_rgb("#CFD8DC")]
  for i, c in enumerate(palette):
    left = panel[0] + 14 + i * 30
    draw.rounded_rectangle((left, panel[1] + 252, left + 22, panel[1] + 274), radius=6, fill=c)

  draw.text((panel[0] + 14, panel[1] + 286), "Reminder", font=fonts["screen_tiny"], fill=(153, 170, 201))
  draw.rounded_rectangle((panel[0] + 14, panel[1] + 306, panel[2] - 14, panel[1] + 346), radius=10, fill=(23, 44, 79))
  draw.text((panel[0] + 22, panel[1] + 318), "Every day at 20:30", font=fonts["screen_body"], fill=(232, 240, 255))

  draw.text((panel[0] + 14, panel[1] + 360), "Preview", font=fonts["screen_tiny"], fill=(153, 170, 201))
  draw.rounded_rectangle((panel[0] + 14, panel[1] + 380, panel[2] - 14, panel[1] + 446), radius=10, fill=(23, 44, 79))
  mini_grid(draw, panel[0] + 24, panel[1] + 396, cols=16, rows=3, cell=7, gap=3, color=hex_to_rgb("#8FB4FF"), ratio=0.63)

  draw.rounded_rectangle((panel[0] + 14, panel[1] + 460, panel[2] - 14, panel[1] + 502), radius=12, fill=hex_to_rgb("#8FB4FF"))
  draw.text((panel[0] + 120, panel[1] + 472), "Save Habit", font=fonts["screen_body"], fill=(18, 25, 38))


def render_screen_friends(draw: ImageDraw.ImageDraw, rect: Tuple[int, int, int, int], fonts: Dict[str, ImageFont.ImageFont]) -> None:
  draw.rounded_rectangle(rect, radius=46, fill=(9, 18, 35))
  x1, y1, x2, _ = draw_top_bar(draw, rect, fonts, dark=True)
  draw.text((x1, y1), "Friends", font=fonts["screen_title"], fill=(245, 248, 255))

  top = y1 + 54
  avatar_colors = [hex_to_rgb("#F7A36B"), hex_to_rgb("#7EC8E3"), hex_to_rgb("#E8C56D"), hex_to_rgb("#C88AE9"), hex_to_rgb("#88D8A0")]
  names = ["Mary", "Patrick", "James", "Lena", "Nora"]
  for i, name in enumerate(names):
    cx = x1 + 30 + i * 74
    avatar(draw, cx, top + 20, 18, avatar_colors[i], name[0], fonts)
    draw.text((cx - 20, top + 44), name, font=fonts["screen_tiny"], fill=(184, 197, 222))
    draw.rounded_rectangle((cx + 10, top + 12, cx + 28, top + 30), radius=8, fill=hex_to_rgb("#FFCA28"))
    draw.text((cx + 16, top + 16), str(24 - i * 2), font=fonts["screen_tiny"], fill=(30, 24, 16))

  draw.text((x1, top + 82), "Activity", font=fonts["screen_body"], fill=(225, 236, 255))
  events = [
    ("Mary", "First workout done", "11:59 AM"),
    ("Patrick", "No alcohol challenge check-in", "9:32 AM"),
    ("James", "Completed reading streak", "7:10 AM"),
  ]
  y = top + 114
  for who, msg, when in events:
    card = (x1, y, x2, y + 112)
    draw.rounded_rectangle(card, radius=16, fill=(18, 29, 49), outline=(39, 52, 76), width=1)
    draw.text((card[0] + 14, card[1] + 12), f"{who}  •  {when}", font=fonts["screen_tiny"], fill=(143, 161, 196))
    draw.rounded_rectangle((card[0] + 14, card[1] + 34, card[2] - 14, card[1] + 78), radius=10, fill=(27, 38, 60))
    draw.text((card[0] + 24, card[1] + 50), msg, font=fonts["screen_small"], fill=(224, 235, 255))
    draw.text((card[2] - 68, card[1] + 84), "🔥  ⚡  🚀", font=fonts["screen_tiny"], fill=(247, 209, 102))
    y += 122


def render_screen_widgets(draw: ImageDraw.ImageDraw, rect: Tuple[int, int, int, int], fonts: Dict[str, ImageFont.ImageFont]) -> None:
  draw.rounded_rectangle(rect, radius=46, fill=(241, 244, 252))
  x1, y1, x2, _ = draw_top_bar(draw, rect, fonts, dark=False)
  draw.text((x1, y1), "Widgets", font=fonts["screen_title"], fill=(22, 28, 38))
  draw.text((x1, y1 + 36), "Stay close with your challenge", font=fonts["screen_small"], fill=(102, 112, 130))

  w1 = (x1, y1 + 84, x1 + 176, y1 + 244)
  w2 = (x1 + 186, y1 + 84, x1 + 352, y1 + 244)
  for card in (w1, w2):
    draw.rounded_rectangle(card, radius=16, fill=hex_to_rgb("#292A4A"))
    draw.text((card[0] + 10, card[1] + 10), "Day 1  0/7", font=fonts["screen_small"], fill=(240, 243, 252))
    for i, item in enumerate(["Workout", "Water", "Read"]):
      draw.text((card[0] + 12, card[1] + 44 + i * 24), f"○  {item}", font=fonts["screen_tiny"], fill=(176, 185, 208))

  icons = ["Photos", "Camera", "News", "TV", "Podcasts", "Store", "Maps", "Health", "Wallet", "Settings"]
  start_x = x1
  start_y = y1 + 264
  idx = 0
  for row in range(3):
    for col in range(4):
      if idx >= len(icons):
        break
      left = start_x + col * 90
      top = start_y + row * 94
      draw.rounded_rectangle((left, top, left + 70, top + 70), radius=16, fill=(255, 255, 255), outline=(212, 217, 229), width=1)
      draw.text((left + 10, top + 26), icons[idx][:6], font=fonts["screen_tiny"], fill=(66, 75, 92))
      idx += 1
  draw.text((x1 + 118, start_y + 290), "PROVSELF", font=fonts["screen_body"], fill=(36, 44, 58))


def render_screen_ai(draw: ImageDraw.ImageDraw, rect: Tuple[int, int, int, int], fonts: Dict[str, ImageFont.ImageFont]) -> None:
  draw.rounded_rectangle(rect, radius=46, fill=(10, 22, 45))
  x1, y1, x2, y2 = draw_top_bar(draw, rect, fonts, dark=True)
  draw.text((x1, y1), "AI Coach", font=fonts["screen_title"], fill=(242, 247, 255))

  bubble = (x1, y1 + 48, x2, y1 + 190)
  draw.rounded_rectangle(bubble, radius=18, fill=(22, 40, 72), outline=(48, 71, 111), width=2)
  draw.ellipse((bubble[0] + 14, bubble[1] + 18, bubble[0] + 42, bubble[1] + 46), fill=hex_to_rgb("#7ED0FF"))
  draw.text((bubble[0] + 50, bubble[1] + 18), "Great momentum this week.", font=fonts["screen_small"], fill=(236, 243, 255))
  draw.text((bubble[0] + 50, bubble[1] + 44), "Increase your reading target to 6 days.", font=fonts["screen_tiny"], fill=(155, 172, 203))
  draw.text((bubble[0] + 50, bubble[1] + 66), "Suggested plan ready.", font=fonts["screen_tiny"], fill=(155, 172, 203))

  bars = [
    ("Consistency", 0.82, hex_to_rgb("#66BB6A")),
    ("Sleep quality", 0.68, hex_to_rgb("#64B5F6")),
    ("Focus score", 0.74, hex_to_rgb("#AB47BC")),
  ]
  top = bubble[3] + 16
  for label, value, color in bars:
    row = (x1, top, x2, top + 64)
    draw.rounded_rectangle(row, radius=12, fill=(18, 34, 62), outline=(39, 58, 96), width=1)
    draw.text((row[0] + 14, row[1] + 10), label, font=fonts["screen_tiny"], fill=(155, 172, 203))
    progress(draw, (row[0] + 14, row[1] + 32, row[2] - 14, row[1] + 48), value, color)
    top += 76

  suggestions = [
    "2-minute journaling after dinner",
    "No social feed before sleep",
    "Morning hydration trigger",
    "Keep current running schedule",
  ]
  for text in suggestions:
    row = (x1, top, x2, top + 56)
    draw.rounded_rectangle(row, radius=10, fill=(18, 34, 62), outline=(39, 58, 96), width=1)
    draw.text((row[0] + 12, row[1] + 18), text, font=fonts["screen_tiny"], fill=(171, 186, 215))
    top += 64
    if top + 90 > y2:
      break

  draw.rounded_rectangle((x1, y2 - 54, x2, y2 - 8), radius=12, fill=hex_to_rgb("#7ED0FF"))
  draw.text((x1 + 96, y2 - 38), "Apply Suggested Plan", font=fonts["screen_body"], fill=(12, 23, 40))


def render_screen_challenge(draw: ImageDraw.ImageDraw, rect: Tuple[int, int, int, int], fonts: Dict[str, ImageFont.ImageFont]) -> None:
  draw.rounded_rectangle(rect, radius=46, fill=(10, 21, 42))
  x1, y1, x2, y2 = draw_top_bar(draw, rect, fonts, dark=True)
  draw.text((x1, y1), "Challenge + Habit Mode", font=fonts["screen_title"], fill=(241, 246, 255))

  hero = (x1, y1 + 50, x2, y1 + 216)
  draw.rounded_rectangle(hero, radius=18, fill=(20, 37, 69), outline=(45, 68, 108), width=2)
  draw.text((hero[0] + 14, hero[1] + 14), "No Sugar - 30 Day Challenge", font=fonts["screen_body"], fill=(240, 245, 255))
  draw.text((hero[0] + 14, hero[1] + 42), "Stake: 1,000 tokens", font=fonts["screen_small"], fill=hex_to_rgb("#FFCA28"))
  progress(draw, (hero[0] + 14, hero[1] + 72, hero[2] - 14, hero[1] + 90), 0.63, hex_to_rgb("#FFC757"))
  draw.text((hero[0] + 14, hero[1] + 96), "19 of 30 completed", font=fonts["screen_tiny"], fill=(160, 177, 209))
  mini_grid(draw, hero[0] + 14, hero[1] + 116, cols=20, rows=3, cell=7, gap=3, color=hex_to_rgb("#FFC757"), ratio=0.63)

  items = [
    ("Photo AI verification", "Enabled", hex_to_rgb("#66BB6A")),
    ("Apple Health sync", "Connected", hex_to_rgb("#64B5F6")),
    ("Buddy accountability", "2 active buddies", hex_to_rgb("#AB47BC")),
    ("No-proof penalty guard", "Active", hex_to_rgb("#FFCA28")),
    ("Challenge reminders", "20:30 daily", hex_to_rgb("#66D6FF")),
  ]
  top = hero[3] + 14
  for label, value, dot in items:
    row = (x1, top, x2, top + 70)
    draw.rounded_rectangle(row, radius=12, fill=(17, 32, 60), outline=(39, 58, 94), width=1)
    draw.ellipse((row[0] + 12, row[1] + 28, row[0] + 22, row[1] + 38), fill=dot)
    draw.text((row[0] + 28, row[1] + 14), label, font=fonts["screen_tiny"], fill=(156, 173, 205))
    draw.text((row[0] + 28, row[1] + 36), value, font=fonts["screen_body"], fill=(231, 240, 255))
    top += 80
    if top + 70 > y2:
      break


def render_screen_leaderboard(draw: ImageDraw.ImageDraw, rect: Tuple[int, int, int, int], fonts: Dict[str, ImageFont.ImageFont]) -> None:
  draw.rounded_rectangle(rect, radius=46, fill=(9, 19, 39))
  x1, y1, x2, _ = draw_top_bar(draw, rect, fonts, dark=True)
  draw.text((x1, y1), "Leaderboard", font=fonts["screen_title"], fill=(243, 248, 255))
  tabs = (x1, y1 + 50, x2, y1 + 92)
  draw.rounded_rectangle(tabs, radius=12, fill=(19, 34, 62))
  draw.rounded_rectangle((tabs[0] + 4, tabs[1] + 4, tabs[0] + 98, tabs[3] - 4), radius=10, fill=hex_to_rgb("#8FAFFF"))
  draw.text((tabs[0] + 22, tabs[1] + 12), "Global", font=fonts["screen_tiny"], fill=(16, 24, 38))
  draw.text((tabs[0] + 112, tabs[1] + 12), "Friends", font=fonts["screen_tiny"], fill=(159, 175, 207))

  rows = [
    ("1", "Maya R.", "24,200 XP"),
    ("2", "Alex T.", "22,910 XP"),
    ("3", "Nora S.", "19,980 XP"),
    ("4", "You", "18,660 XP"),
    ("5", "Liam K.", "17,880 XP"),
    ("6", "Sena V.", "16,930 XP"),
  ]
  top = tabs[3] + 16
  for rank, name, xp in rows:
    row = (x1, top, x2, top + 74)
    draw.rounded_rectangle(row, radius=12, fill=(16, 31, 58), outline=(36, 54, 88), width=1)
    medal = hex_to_rgb("#F5CE62") if rank == "1" else (76, 99, 140)
    draw.ellipse((row[0] + 12, row[1] + 24, row[0] + 30, row[1] + 42), fill=medal)
    draw.text((row[0] + 18, row[1] + 26), rank, font=fonts["screen_tiny"], fill=(22, 27, 36))
    draw.text((row[0] + 40, row[1] + 16), name, font=fonts["screen_body"], fill=(230, 240, 255))
    draw.text((row[2] - 96, row[1] + 28), xp, font=fonts["screen_tiny"], fill=(158, 174, 205))
    top += 84


def render_screen_pro(draw: ImageDraw.ImageDraw, rect: Tuple[int, int, int, int], fonts: Dict[str, ImageFont.ImageFont]) -> None:
  draw.rounded_rectangle(rect, radius=46, fill=(244, 246, 252))
  x1, y1, x2, y2 = draw_top_bar(draw, rect, fonts, dark=False)
  draw.text((x1, y1), "Provself Pro", font=fonts["screen_title"], fill=(28, 34, 45))

  hero = (x1, y1 + 48, x2, y1 + 172)
  draw.rounded_rectangle(hero, radius=16, fill=hex_to_rgb("#FFF3D6"), outline=hex_to_rgb("#E9D7A9"), width=2)
  draw.text((hero[0] + 14, hero[1] + 18), "Unlock premium accountability", font=fonts["screen_body"], fill=hex_to_rgb("#8A6114"))
  draw.text((hero[0] + 14, hero[1] + 46), "Unlimited habits and advanced coaching", font=fonts["screen_small"], fill=hex_to_rgb("#9B7230"))
  draw.rounded_rectangle((hero[2] - 96, hero[1] + 16, hero[2] - 14, hero[1] + 42), radius=8, fill=hex_to_rgb("#66BB6A"))
  draw.text((hero[2] - 80, hero[1] + 23), "SAVE 33%", font=fonts["screen_tiny"], fill=(18, 38, 22))

  features = [
    "Unlimited active habits",
    "Unlimited AI coach messages",
    "Advanced analytics and streak insights",
    "Premium share cards",
    "Unlimited buddy invites",
  ]
  top = hero[3] + 14
  for feature in features:
    row = (x1, top, x2, top + 58)
    draw.rounded_rectangle(row, radius=10, fill=(255, 255, 255), outline=(220, 225, 235), width=1)
    draw.ellipse((row[0] + 12, row[1] + 24, row[0] + 22, row[1] + 34), fill=hex_to_rgb("#66BB6A"))
    draw.text((row[0] + 28, row[1] + 20), feature, font=fonts["screen_tiny"], fill=(84, 93, 110))
    top += 68

  monthly = (x1, y2 - 122, x2, y2 - 74)
  yearly = (x1, y2 - 64, x2, y2 - 16)
  draw.rounded_rectangle(monthly, radius=10, fill=(255, 255, 255), outline=(220, 225, 235), width=1)
  draw.text((monthly[0] + 14, monthly[1] + 16), "Monthly - $4.99/mo", font=fonts["screen_body"], fill=(54, 63, 80))
  draw.rounded_rectangle(yearly, radius=10, fill=hex_to_rgb("#FFF3D6"), outline=hex_to_rgb("#E9D7A9"), width=2)
  draw.text((yearly[0] + 14, yearly[1] + 16), "Yearly - $39.99/yr ($3.33/mo)", font=fonts["screen_body"], fill=hex_to_rgb("#8A6114"))


@dataclass
class Scene:
  key: str
  title: str
  subtitle: str
  bg_top: Color
  bg_bottom: Color
  renderer: Renderer


SCENES: List[Scene] = [
  Scene("01_habit_grid", "Track habits with beautiful grids", "Visual daily consistency across all your routines.", hex_to_rgb("#FFFFFF"), hex_to_rgb("#F5F6FB"), render_screen_habits),
  Scene("02_customize", "Fully customizable", "Design each habit with your own icon, color, and target days.", hex_to_rgb("#FFFFFF"), hex_to_rgb("#F0F5FF"), render_screen_customize),
  Scene("03_friends", "Team up with friends", "Share progress and stay accountable together.", hex_to_rgb("#FFFFFF"), hex_to_rgb("#F6F7FB"), render_screen_friends),
  Scene("04_widgets", "Widgets", "Stay close with your challenge from your home screen.", hex_to_rgb("#FFFFFF"), hex_to_rgb("#F4F7FF"), render_screen_widgets),
  Scene("05_ai_coach", "Your personal habit assistant", "Turn simple habits into consistent long-term results.", hex_to_rgb("#FFFFFF"), hex_to_rgb("#F3F5FC"), render_screen_ai),
  Scene("06_challenge_mode", "Link habits to challenges", "Combine habit tracking with token stakes for stronger accountability.", hex_to_rgb("#FFFFFF"), hex_to_rgb("#FBF6EC"), render_screen_challenge),
  Scene("07_leaderboard", "Compete and stay consistent", "Climb rankings with daily streaks and challenge XP.", hex_to_rgb("#FFFFFF"), hex_to_rgb("#F2F5FF"), render_screen_leaderboard),
  Scene("08_upgrade_pro", "Upgrade for unlimited growth", "Unlock unlimited habits, advanced coaching, and premium analytics.", hex_to_rgb("#FFFFFF"), hex_to_rgb("#FFF7EA"), render_screen_pro),
]


def build_phone_frame(target_screen_w: int, target_screen_h: int) -> Image.Image:
  bezel = 24
  outer_w = target_screen_w + bezel * 2
  outer_h = target_screen_h + bezel * 2
  frame = Image.new("RGBA", (outer_w, outer_h), (0, 0, 0, 0))
  d = ImageDraw.Draw(frame, "RGBA")
  d.rounded_rectangle((0, 0, outer_w - 1, outer_h - 1), radius=66, fill=(10, 12, 16, 255))
  d.rounded_rectangle((bezel, bezel, bezel + target_screen_w, bezel + target_screen_h), radius=52, fill=(0, 0, 0, 255))

  notch_w = int(target_screen_w * 0.31)
  notch_h = int(target_screen_h * 0.03)
  nx1 = bezel + (target_screen_w - notch_w) // 2
  ny1 = bezel + 6
  d.rounded_rectangle((nx1, ny1, nx1 + notch_w, ny1 + notch_h), radius=notch_h // 2, fill=(12, 12, 12))
  d.ellipse((nx1 + notch_w - 22, ny1 + 5, nx1 + notch_w - 14, ny1 + 13), fill=(40, 40, 40))
  return frame


def draw_phone(
  canvas: Image.Image,
  scene: Scene,
  center: Tuple[int, int],
  target_height: int,
  angle: float,
  fonts: Dict[str, ImageFont.ImageFont],
) -> None:
  internal_w, internal_h = 420, 920
  target_screen_h = target_height
  target_screen_w = int(target_screen_h * (internal_w / internal_h))

  screen = Image.new("RGBA", (internal_w, internal_h), (255, 255, 255, 255))
  sdraw = ImageDraw.Draw(screen)
  scene.renderer(sdraw, (0, 0, internal_w, internal_h), fonts)
  screen = screen.resize((target_screen_w, target_screen_h), Image.Resampling.BICUBIC)

  frame = build_phone_frame(target_screen_w, target_screen_h)
  frame.alpha_composite(screen, (24, 24))
  rotated = frame.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)

  x = center[0] - rotated.size[0] // 2
  y = center[1] - rotated.size[1] // 2
  draw_shadow(canvas, (x, y, x + rotated.size[0], y + rotated.size[1]), radius=68)
  canvas.alpha_composite(rotated, (x, y))


def render_scene(scene: Scene, size: Tuple[int, int], device: str) -> str:
  w, h = size
  scale = min(w / 1290.0, h / 2796.0)
  fonts = make_fonts(scale)

  base = Image.new("RGBA", size, (255, 255, 255, 255))
  vertical_gradient(base, scene.bg_top, scene.bg_bottom)
  d = ImageDraw.Draw(base)

  margin_x = int(w * 0.08)
  d.text((margin_x, int(h * 0.06)), "PROVSELF", font=fonts["brand"], fill=(35, 44, 64))
  title_bottom = draw_wrapped(d, scene.title, margin_x, int(h * 0.10), int(w * 0.82), fonts["title"], (16, 18, 24))
  draw_wrapped(d, scene.subtitle, margin_x, title_bottom + int(14 * scale), int(w * 0.82), fonts["subtitle"], (122, 127, 137), line_spacing=1.14)

  if device == "iphone":
    draw_phone(base, scene, center=(w // 2, int(h * 0.70)), target_height=int(h * 0.70), angle=0.0, fonts=fonts)
  else:
    draw_phone(base, scene, center=(int(w * 0.44), int(h * 0.71)), target_height=int(h * 0.66), angle=-9.0, fonts=fonts)
    draw_phone(base, scene, center=(int(w * 0.72), int(h * 0.76)), target_height=int(h * 0.58), angle=8.0, fonts=fonts)

  os.makedirs(OUTPUT_DIR, exist_ok=True)
  filename = f"{device}_{scene.key}.png"
  output_path = os.path.join(OUTPUT_DIR, filename)
  base.convert("RGB").save(output_path, format="PNG", optimize=True)
  return output_path


def main() -> None:
  os.makedirs(OUTPUT_DIR, exist_ok=True)
  for f in os.listdir(OUTPUT_DIR):
    if f.lower().endswith(".png"):
      os.remove(os.path.join(OUTPUT_DIR, f))

  created: List[str] = []
  for scene in SCENES:
    created.append(render_scene(scene, IPHONE_SIZE, "iphone"))
    created.append(render_scene(scene, IPAD_SIZE, "ipad"))

  print("Generated previews:")
  for p in created:
    print(p)


if __name__ == "__main__":
  main()
