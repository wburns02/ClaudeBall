#!/usr/bin/env python3
"""
Generate all game sprite sheets as pixel-perfect PNG files with transparent backgrounds.
No AI generation, no green-screen — just clean PIL-drawn pixel art.

Each frame is 48x48 pixels. Characters are drawn as simple but readable figures
with white uniform, blue trim, and proper proportions for a retro baseball game.
"""

from PIL import Image, ImageDraw
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites')

# ── Color palette ──────────────────────────────────────────────────────────
SKIN = (210, 170, 130)         # Light skin tone
SKIN_DARK = (180, 140, 100)   # Shadow skin
WHITE = (240, 240, 245)        # Uniform white
WHITE_SHADE = (200, 200, 210)  # Uniform shadow
BLUE = (40, 60, 140)           # Cap, socks, trim
BLUE_DARK = (30, 45, 110)     # Dark blue
BROWN = (140, 90, 40)         # Glove
BROWN_DARK = (110, 70, 30)    # Glove shadow
BAT = (200, 170, 110)         # Bat wood
BAT_DARK = (170, 140, 90)     # Bat shadow
BLACK = (30, 30, 40)          # Shoes, belt
GRAY = (80, 80, 90)           # Umpire uniform
GRAY_LIGHT = (100, 100, 110)  # Umpire shade
BALL = (255, 255, 255)        # Baseball
RED = (200, 50, 50)           # Ball stitching
NAVY = (25, 30, 60)           # Umpire dark
CATCHER_BLUE = (50, 70, 150)  # Chest protector

# ── Drawing helpers ────────────────────────────────────────────────────────

def draw_head(draw, cx, cy, facing='front'):
    """Draw a head with cap at center position."""
    # Cap
    draw.rectangle([cx-5, cy-3, cx+5, cy+1], fill=BLUE)
    draw.rectangle([cx-6, cy+1, cx+6, cy+3], fill=BLUE_DARK)  # brim
    # Face
    draw.rectangle([cx-4, cy+3, cx+4, cy+9], fill=SKIN)
    # Eyes (tiny dots)
    if facing != 'back':
        draw.point((cx-2, cy+5), fill=BLACK)
        draw.point((cx+2, cy+5), fill=BLACK)

def draw_helmet(draw, cx, cy):
    """Draw a batting helmet."""
    draw.ellipse([cx-6, cy-4, cx+6, cy+4], fill=BLUE)
    draw.rectangle([cx-5, cy+2, cx+5, cy+8], fill=SKIN)
    draw.point((cx-2, cy+4), fill=BLACK)
    draw.point((cx+2, cy+4), fill=BLACK)

def draw_torso(draw, cx, cy, w=10, h=12):
    """Draw uniform torso."""
    x0, y0 = cx - w//2, cy
    draw.rectangle([x0, y0, x0+w, y0+h], fill=WHITE)
    # Pinstripes
    for i in range(x0+2, x0+w, 3):
        draw.line([(i, y0+1), (i, y0+h-1)], fill=(200, 200, 220))
    # Belt
    draw.rectangle([x0, y0+h-2, x0+w, y0+h], fill=BLACK)

def draw_pants(draw, cx, cy, stance='normal', w=10):
    """Draw pants and shoes."""
    x0 = cx - w//2
    if stance == 'wide':
        # Left leg
        draw.rectangle([x0, cy, x0+4, cy+10], fill=WHITE_SHADE)
        draw.rectangle([x0, cy+10, x0+4, cy+13], fill=BLACK)  # shoe
        # Right leg
        draw.rectangle([x0+6, cy, x0+10, cy+10], fill=WHITE_SHADE)
        draw.rectangle([x0+6, cy+10, x0+10, cy+13], fill=BLACK)
    elif stance == 'running_l':
        draw.polygon([(cx-2, cy), (cx-6, cy+10), (cx-2, cy+10)], fill=WHITE_SHADE)
        draw.polygon([(cx+2, cy), (cx+6, cy+10), (cx+2, cy+10)], fill=WHITE)
        draw.rectangle([cx-7, cy+10, cx-3, cy+13], fill=BLACK)
        draw.rectangle([cx+3, cy+10, cx+7, cy+13], fill=BLACK)
    elif stance == 'running_r':
        draw.polygon([(cx+2, cy), (cx+6, cy+10), (cx+2, cy+10)], fill=WHITE_SHADE)
        draw.polygon([(cx-2, cy), (cx-6, cy+10), (cx-2, cy+10)], fill=WHITE)
        draw.rectangle([cx+3, cy+10, cx+7, cy+13], fill=BLACK)
        draw.rectangle([cx-7, cy+10, cx-3, cy+13], fill=BLACK)
    else:
        draw.rectangle([x0+1, cy, x0+4, cy+10], fill=WHITE_SHADE)
        draw.rectangle([x0+6, cy, x0+9, cy+10], fill=WHITE)
        draw.rectangle([x0+1, cy+8, x0+4, cy+10], fill=BLUE)  # socks
        draw.rectangle([x0+6, cy+8, x0+9, cy+10], fill=BLUE)
        draw.rectangle([x0, cy+10, x0+5, cy+13], fill=BLACK)
        draw.rectangle([x0+5, cy+10, x0+10, cy+13], fill=BLACK)

def draw_glove(draw, x, y, size=5):
    """Draw a fielder's glove."""
    draw.ellipse([x-size, y-size+1, x+size, y+size+1], fill=BROWN)
    draw.ellipse([x-size+1, y-size+2, x+size-1, y+size], fill=BROWN_DARK)

def draw_bat(draw, x1, y1, x2, y2):
    """Draw a bat as a thick line."""
    draw.line([(x1, y1), (x2, y2)], fill=BAT, width=3)
    draw.line([(x1, y1), (x2, y2)], fill=BAT_DARK, width=1)

def draw_arm(draw, x1, y1, x2, y2, color=SKIN):
    """Draw an arm."""
    draw.line([(x1, y1), (x2, y2)], fill=color, width=3)

def draw_ball(draw, x, y):
    """Draw a small baseball."""
    draw.ellipse([x-2, y-2, x+2, y+2], fill=BALL)
    draw.point((x-1, y), fill=RED)
    draw.point((x+1, y), fill=RED)


# ── Pitcher sprites (4x3 = 12 frames, 48x48 each) ─────────────────────────

def generate_pitcher():
    cols, rows = 4, 3
    fw, fh = 48, 48
    sheet = Image.new('RGBA', (cols * fw, rows * fh), (0, 0, 0, 0))

    frames = []
    for i in range(cols * rows):
        frame = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
        d = ImageDraw.Draw(frame)
        cx, cy_head = 24, 8

        if i == 0:  # Standing
            draw_head(d, cx, cy_head)
            draw_torso(d, cx, cy_head + 10)
            draw_arm(d, cx-5, cy_head+12, cx-10, cy_head+18)  # glove arm
            draw_glove(d, cx-10, cy_head+18)
            draw_arm(d, cx+5, cy_head+12, cx+8, cy_head+20)  # ball hand
            draw_pants(d, cx, cy_head+22)
        elif i == 1:  # Set position
            draw_head(d, cx, cy_head)
            draw_torso(d, cx, cy_head + 10)
            draw_arm(d, cx-3, cy_head+12, cx, cy_head+16)
            draw_glove(d, cx, cy_head+16)
            draw_arm(d, cx+3, cy_head+12, cx, cy_head+16)
            draw_pants(d, cx, cy_head+22)
        elif i == 2:  # Windup start
            draw_head(d, cx, cy_head-2)
            draw_torso(d, cx, cy_head + 8)
            draw_arm(d, cx-5, cy_head+10, cx-8, cy_head+6)
            draw_glove(d, cx-8, cy_head+6)
            draw_arm(d, cx+5, cy_head+10, cx+2, cy_head+6)
            draw_pants(d, cx, cy_head+20)
        elif i == 3:  # Leg kick (peak)
            draw_head(d, cx, cy_head-3)
            draw_torso(d, cx, cy_head + 7)
            draw_arm(d, cx-5, cy_head+9, cx-8, cy_head+5)
            draw_glove(d, cx-8, cy_head+5)
            draw_arm(d, cx+5, cy_head+9, cx+3, cy_head+5)
            # One leg up
            draw_arm(d, cx, cy_head+19, cx-2, cy_head+12, WHITE_SHADE)  # raised leg
            d.rectangle([cx+1, cy_head+19, cx+5, cy_head+30], fill=WHITE_SHADE)  # planted leg
            d.rectangle([cx+1, cy_head+28, cx+5, cy_head+32], fill=BLUE)
            d.rectangle([cx, cy_head+32, cx+6, cy_head+35], fill=BLACK)
        elif i == 4:  # Stride
            draw_head(d, cx+2, cy_head)
            draw_torso(d, cx+2, cy_head + 10, w=10, h=10)
            draw_arm(d, cx-3, cy_head+12, cx-8, cy_head+10)
            draw_glove(d, cx-8, cy_head+10)
            draw_arm(d, cx+7, cy_head+12, cx+12, cy_head+8)
            draw_pants(d, cx+2, cy_head+20, 'wide')
        elif i == 5:  # Arm cocked
            draw_head(d, cx+3, cy_head)
            draw_torso(d, cx+3, cy_head + 10, w=10, h=10)
            draw_arm(d, cx-2, cy_head+12, cx-8, cy_head+14)
            draw_glove(d, cx-8, cy_head+14)
            draw_arm(d, cx+8, cy_head+12, cx+12, cy_head+4)  # arm back
            draw_ball(d, cx+12, cy_head+4)
            draw_pants(d, cx+3, cy_head+20, 'wide')
        elif i == 6:  # Arm forward
            draw_head(d, cx+4, cy_head+1)
            draw_torso(d, cx+4, cy_head + 11, w=10, h=10)
            draw_arm(d, cx-1, cy_head+13, cx-8, cy_head+16)
            draw_glove(d, cx-8, cy_head+16)
            draw_arm(d, cx+9, cy_head+13, cx+16, cy_head+12)
            draw_ball(d, cx+16, cy_head+12)
            draw_pants(d, cx+4, cy_head+21, 'wide')
        elif i == 7:  # Release
            draw_head(d, cx+5, cy_head+2)
            draw_torso(d, cx+5, cy_head + 12, w=10, h=10)
            draw_arm(d, cx, cy_head+14, cx-6, cy_head+18)
            draw_glove(d, cx-6, cy_head+18)
            draw_arm(d, cx+10, cy_head+14, cx+18, cy_head+16)
            draw_ball(d, cx+18, cy_head+16)
            draw_pants(d, cx+5, cy_head+22, 'wide')
        elif i == 8:  # Follow through
            draw_head(d, cx+4, cy_head+3)
            draw_torso(d, cx+4, cy_head + 13, w=10, h=10)
            draw_arm(d, cx-1, cy_head+15, cx-4, cy_head+22)
            draw_glove(d, cx-4, cy_head+22)
            draw_arm(d, cx+9, cy_head+15, cx+6, cy_head+24)
            draw_pants(d, cx+4, cy_head+23, 'normal')
        elif i == 9:  # Recovery
            draw_head(d, cx+2, cy_head+1)
            draw_torso(d, cx+2, cy_head + 11)
            draw_arm(d, cx-3, cy_head+13, cx-8, cy_head+18)
            draw_glove(d, cx-8, cy_head+18)
            draw_arm(d, cx+7, cy_head+13, cx+10, cy_head+20)
            draw_pants(d, cx+2, cy_head+23, 'normal')
        elif i == 10:  # Fielding ready
            draw_head(d, cx, cy_head+2)
            draw_torso(d, cx, cy_head + 12)
            draw_arm(d, cx-5, cy_head+14, cx-10, cy_head+20)
            draw_glove(d, cx-10, cy_head+20)
            draw_arm(d, cx+5, cy_head+14, cx+10, cy_head+20)
            draw_pants(d, cx, cy_head+24, 'wide')
        else:  # Frame 11 - same as standing
            draw_head(d, cx, cy_head)
            draw_torso(d, cx, cy_head + 10)
            draw_arm(d, cx-5, cy_head+12, cx-10, cy_head+18)
            draw_glove(d, cx-10, cy_head+18)
            draw_arm(d, cx+5, cy_head+12, cx+8, cy_head+20)
            draw_pants(d, cx, cy_head+22)

        frames.append(frame)

    # Arrange into grid
    for idx, frame in enumerate(frames):
        col = idx % cols
        row = idx // cols
        sheet.paste(frame, (col * fw, row * fh))

    return sheet


# ── Batter sprites (4x3 = 12 frames) ──────────────────────────────────────

def generate_batter():
    cols, rows = 4, 3
    fw, fh = 48, 48
    sheet = Image.new('RGBA', (cols * fw, rows * fh), (0, 0, 0, 0))

    frames = []
    for i in range(cols * rows):
        frame = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
        d = ImageDraw.Draw(frame)
        cx, cy_head = 24, 6

        if i == 0:  # Stance
            draw_helmet(d, cx-2, cy_head)
            draw_torso(d, cx-2, cy_head + 10)
            draw_arm(d, cx-7, cy_head+12, cx-4, cy_head+6)  # hands up
            draw_arm(d, cx+3, cy_head+12, cx, cy_head+6)
            draw_bat(d, cx-2, cy_head+4, cx+8, cy_head-4)  # bat on shoulder
            draw_pants(d, cx-2, cy_head+22, 'wide')
        elif i == 1:  # Load
            draw_helmet(d, cx-2, cy_head)
            draw_torso(d, cx-2, cy_head + 10)
            draw_arm(d, cx-7, cy_head+12, cx-5, cy_head+5)
            draw_arm(d, cx+3, cy_head+12, cx+1, cy_head+5)
            draw_bat(d, cx-1, cy_head+3, cx+10, cy_head-6)  # bat back more
            draw_pants(d, cx-2, cy_head+22, 'wide')
        elif i == 2:  # Stride
            draw_helmet(d, cx-1, cy_head)
            draw_torso(d, cx-1, cy_head + 10)
            draw_arm(d, cx-6, cy_head+12, cx-4, cy_head+6)
            draw_arm(d, cx+4, cy_head+12, cx+2, cy_head+6)
            draw_bat(d, cx, cy_head+4, cx+12, cy_head-4)
            draw_pants(d, cx-1, cy_head+22, 'wide')
        elif i == 3:  # Hips rotate
            draw_helmet(d, cx, cy_head)
            draw_torso(d, cx, cy_head + 10)
            draw_arm(d, cx-5, cy_head+12, cx-8, cy_head+8)
            draw_arm(d, cx+5, cy_head+12, cx+2, cy_head+8)
            draw_bat(d, cx+2, cy_head+6, cx+14, cy_head)
            draw_pants(d, cx, cy_head+22, 'wide')
        elif i == 4:  # Bat entering zone
            draw_helmet(d, cx+1, cy_head)
            draw_torso(d, cx+1, cy_head + 10)
            draw_arm(d, cx-4, cy_head+12, cx-10, cy_head+12)
            draw_arm(d, cx+6, cy_head+12, cx, cy_head+12)
            draw_bat(d, cx-2, cy_head+10, cx-16, cy_head+10)  # bat horizontal
            draw_pants(d, cx+1, cy_head+22, 'wide')
        elif i == 5:  # Contact
            draw_helmet(d, cx+2, cy_head)
            draw_torso(d, cx+2, cy_head + 10)
            draw_arm(d, cx-3, cy_head+12, cx-12, cy_head+14)
            draw_arm(d, cx+7, cy_head+12, cx-2, cy_head+14)
            draw_bat(d, cx-4, cy_head+12, cx-18, cy_head+10)  # bat through zone
            draw_pants(d, cx+2, cy_head+22, 'wide')
        elif i == 6:  # Follow start
            draw_helmet(d, cx+3, cy_head+1)
            draw_torso(d, cx+3, cy_head + 11)
            draw_arm(d, cx-2, cy_head+13, cx-10, cy_head+16)
            draw_arm(d, cx+8, cy_head+13, cx, cy_head+16)
            draw_bat(d, cx-6, cy_head+14, cx-16, cy_head+6)  # bat wrapping
            draw_pants(d, cx+3, cy_head+23, 'wide')
        elif i == 7:  # Full follow through
            draw_helmet(d, cx+3, cy_head+2)
            draw_torso(d, cx+3, cy_head + 12)
            draw_arm(d, cx-2, cy_head+14, cx-8, cy_head+8)
            draw_arm(d, cx+8, cy_head+14, cx+2, cy_head+8)
            draw_bat(d, cx-4, cy_head+6, cx-12, cy_head-2)  # bat behind
            draw_pants(d, cx+3, cy_head+24, 'normal')
        elif i == 8:  # Watching ball
            draw_helmet(d, cx+2, cy_head+1)
            draw_torso(d, cx+2, cy_head + 11)
            draw_arm(d, cx-3, cy_head+13, cx-6, cy_head+8)
            draw_arm(d, cx+7, cy_head+13, cx+4, cy_head+8)
            draw_bat(d, cx-2, cy_head+6, cx-10, cy_head-2)
            draw_pants(d, cx+2, cy_head+23, 'normal')
        elif i == 9:  # Drop bat
            draw_helmet(d, cx, cy_head)
            draw_torso(d, cx, cy_head + 10)
            draw_arm(d, cx-5, cy_head+12, cx-8, cy_head+18)
            draw_arm(d, cx+5, cy_head+12, cx+8, cy_head+18)
            # Bat on ground
            draw_bat(d, cx-8, cy_head+30, cx+4, cy_head+32)
            draw_pants(d, cx, cy_head+22, 'normal')
        elif i == 10:  # Running 1
            draw_helmet(d, cx, cy_head)
            draw_torso(d, cx, cy_head + 10)
            draw_arm(d, cx-5, cy_head+12, cx-10, cy_head+16)
            draw_arm(d, cx+5, cy_head+12, cx+10, cy_head+16)
            draw_pants(d, cx, cy_head+22, 'running_l')
        elif i == 11:  # Running 2
            draw_helmet(d, cx, cy_head)
            draw_torso(d, cx, cy_head + 10)
            draw_arm(d, cx-5, cy_head+12, cx-10, cy_head+8)
            draw_arm(d, cx+5, cy_head+12, cx+10, cy_head+20)
            draw_pants(d, cx, cy_head+22, 'running_r')

        frames.append(frame)

    for idx, frame in enumerate(frames):
        col = idx % cols
        row = idx // cols
        sheet.paste(frame, (col * fw, row * fh))

    return sheet


# ── Fielder sprites (4x4 = 16 frames, use 12) ─────────────────────────────

def generate_fielder():
    cols, rows = 4, 3
    fw, fh = 48, 48
    sheet = Image.new('RGBA', (cols * fw, rows * fh), (0, 0, 0, 0))

    frames = []
    for i in range(cols * rows):
        frame = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
        d = ImageDraw.Draw(frame)
        cx, cy_head = 24, 8

        if i == 0:  # Ready position
            draw_head(d, cx, cy_head+2)
            draw_torso(d, cx, cy_head + 12, h=10)
            draw_arm(d, cx-5, cy_head+14, cx-10, cy_head+20)
            draw_glove(d, cx-10, cy_head+20)
            draw_arm(d, cx+5, cy_head+14, cx+10, cy_head+20)
            draw_pants(d, cx, cy_head+22, 'wide')
        elif i == 1:  # Shuffle left
            draw_head(d, cx-2, cy_head+1)
            draw_torso(d, cx-2, cy_head + 11, h=10)
            draw_arm(d, cx-7, cy_head+13, cx-12, cy_head+18)
            draw_glove(d, cx-12, cy_head+18)
            draw_arm(d, cx+3, cy_head+13, cx+6, cy_head+18)
            draw_pants(d, cx-2, cy_head+21, 'running_l')
        elif i == 2:  # Shuffle right
            draw_head(d, cx+2, cy_head+1)
            draw_torso(d, cx+2, cy_head + 11, h=10)
            draw_arm(d, cx-3, cy_head+13, cx-6, cy_head+18)
            draw_glove(d, cx-6, cy_head+18)
            draw_arm(d, cx+7, cy_head+13, cx+12, cy_head+18)
            draw_pants(d, cx+2, cy_head+21, 'running_r')
        elif i == 3:  # Running forward
            draw_head(d, cx, cy_head)
            draw_torso(d, cx, cy_head + 10, h=10)
            draw_arm(d, cx-5, cy_head+12, cx-10, cy_head+16)
            draw_glove(d, cx-10, cy_head+16)
            draw_arm(d, cx+5, cy_head+12, cx+10, cy_head+8)
            draw_pants(d, cx, cy_head+20, 'running_l')
        elif i == 4:  # Running forward alt
            draw_head(d, cx, cy_head)
            draw_torso(d, cx, cy_head + 10, h=10)
            draw_arm(d, cx-5, cy_head+12, cx-10, cy_head+8)
            draw_glove(d, cx-10, cy_head+8)
            draw_arm(d, cx+5, cy_head+12, cx+10, cy_head+16)
            draw_pants(d, cx, cy_head+20, 'running_r')
        elif i == 5:  # Bend for grounder
            draw_head(d, cx, cy_head+6)
            draw_torso(d, cx, cy_head + 16, h=8)
            draw_arm(d, cx-5, cy_head+18, cx-10, cy_head+28)
            draw_glove(d, cx-10, cy_head+28, 4)
            draw_arm(d, cx+5, cy_head+18, cx+8, cy_head+26)
            draw_pants(d, cx, cy_head+24, 'wide')
        elif i == 6:  # Scooping ball
            draw_head(d, cx, cy_head+7)
            draw_torso(d, cx, cy_head + 17, h=7)
            draw_arm(d, cx-5, cy_head+19, cx-8, cy_head+30)
            draw_glove(d, cx-8, cy_head+30, 4)
            draw_ball(d, cx-7, cy_head+29)
            draw_arm(d, cx+5, cy_head+19, cx+6, cy_head+28)
            draw_pants(d, cx, cy_head+24, 'wide')
        elif i == 7:  # Standing up with ball
            draw_head(d, cx, cy_head+3)
            draw_torso(d, cx, cy_head + 13, h=10)
            draw_arm(d, cx-5, cy_head+15, cx-8, cy_head+20)
            draw_glove(d, cx-8, cy_head+20)
            draw_arm(d, cx+5, cy_head+15, cx+10, cy_head+12)
            draw_ball(d, cx+10, cy_head+12)
            draw_pants(d, cx, cy_head+23, 'normal')
        elif i == 8:  # Crow hop
            draw_head(d, cx+2, cy_head+1)
            draw_torso(d, cx+2, cy_head + 11, h=10)
            draw_arm(d, cx-3, cy_head+13, cx-6, cy_head+16)
            draw_glove(d, cx-6, cy_head+16)
            draw_arm(d, cx+7, cy_head+13, cx+14, cy_head+6)
            draw_ball(d, cx+14, cy_head+6)
            draw_pants(d, cx+2, cy_head+21, 'running_r')
        elif i == 9:  # Throwing
            draw_head(d, cx+3, cy_head+2)
            draw_torso(d, cx+3, cy_head + 12, h=10)
            draw_arm(d, cx-2, cy_head+14, cx-6, cy_head+18)
            draw_glove(d, cx-6, cy_head+18)
            draw_arm(d, cx+8, cy_head+14, cx+18, cy_head+14)
            draw_ball(d, cx+18, cy_head+14)
            draw_pants(d, cx+3, cy_head+22, 'wide')
        elif i == 10:  # Throw follow through
            draw_head(d, cx+4, cy_head+3)
            draw_torso(d, cx+4, cy_head + 13, h=10)
            draw_arm(d, cx-1, cy_head+15, cx-4, cy_head+20)
            draw_glove(d, cx-4, cy_head+20)
            draw_arm(d, cx+9, cy_head+15, cx+14, cy_head+22)
            draw_pants(d, cx+4, cy_head+23, 'normal')
        elif i == 11:  # Catch fly ball
            draw_head(d, cx, cy_head-2)
            draw_torso(d, cx, cy_head + 8, h=10)
            draw_arm(d, cx-5, cy_head+10, cx-8, cy_head+2)
            draw_glove(d, cx-8, cy_head+2, 5)
            draw_arm(d, cx+5, cy_head+10, cx+8, cy_head+4)
            draw_pants(d, cx, cy_head+18, 'normal')

        frames.append(frame)

    for idx, frame in enumerate(frames):
        col = idx % cols
        row = idx // cols
        sheet.paste(frame, (col * fw, row * fh))

    return sheet


# ── Runner sprites (2x4 = 8 frames) ───────────────────────────────────────

def generate_runner():
    cols, rows = 2, 4
    fw, fh = 48, 48
    sheet = Image.new('RGBA', (cols * fw, rows * fh), (0, 0, 0, 0))

    frames = []
    for i in range(8):
        frame = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
        d = ImageDraw.Draw(frame)
        cx, cy_head = 24, 8

        if i == 0:  # Run 1
            draw_helmet(d, cx, cy_head)
            draw_torso(d, cx, cy_head + 10, h=10)
            draw_arm(d, cx-5, cy_head+12, cx-10, cy_head+8)
            draw_arm(d, cx+5, cy_head+12, cx+10, cy_head+18)
            draw_pants(d, cx, cy_head+20, 'running_l')
        elif i == 1:  # Run 2
            draw_helmet(d, cx, cy_head)
            draw_torso(d, cx, cy_head + 10, h=10)
            draw_arm(d, cx-5, cy_head+12, cx-10, cy_head+18)
            draw_arm(d, cx+5, cy_head+12, cx+10, cy_head+8)
            draw_pants(d, cx, cy_head+20, 'running_r')
        elif i == 2:  # Run 3
            draw_helmet(d, cx+1, cy_head-1)
            draw_torso(d, cx+1, cy_head + 9, h=10)
            draw_arm(d, cx-4, cy_head+11, cx-8, cy_head+6)
            draw_arm(d, cx+6, cy_head+11, cx+10, cy_head+16)
            draw_pants(d, cx+1, cy_head+19, 'running_l')
        elif i == 3:  # Run 4
            draw_helmet(d, cx-1, cy_head-1)
            draw_torso(d, cx-1, cy_head + 9, h=10)
            draw_arm(d, cx-6, cy_head+11, cx-10, cy_head+16)
            draw_arm(d, cx+4, cy_head+11, cx+8, cy_head+6)
            draw_pants(d, cx-1, cy_head+19, 'running_r')
        elif i == 4:  # Slide start
            draw_helmet(d, cx-4, cy_head+8)
            draw_torso(d, cx-2, cy_head + 18, h=6)
            draw_arm(d, cx-7, cy_head+20, cx-12, cy_head+22)
            draw_arm(d, cx+3, cy_head+20, cx+8, cy_head+18)
            d.rectangle([cx-8, cy_head+24, cx+8, cy_head+28], fill=WHITE_SHADE)
            d.rectangle([cx+6, cy_head+26, cx+14, cy_head+30], fill=BLACK)
        elif i == 5:  # Feet-first slide
            draw_helmet(d, cx-6, cy_head+10)
            d.rectangle([cx-8, cy_head+16, cx+2, cy_head+22], fill=WHITE)  # body flat
            draw_arm(d, cx-8, cy_head+16, cx-14, cy_head+14)
            d.rectangle([cx+2, cy_head+18, cx+16, cy_head+22], fill=WHITE_SHADE)  # legs forward
            d.rectangle([cx+14, cy_head+18, cx+20, cy_head+22], fill=BLACK)  # shoes
        elif i == 6:  # Headfirst dive
            draw_helmet(d, cx+8, cy_head+14)
            d.rectangle([cx-4, cy_head+16, cx+8, cy_head+22], fill=WHITE)  # body flat
            draw_arm(d, cx+8, cy_head+18, cx+18, cy_head+16)  # arms reaching
            draw_arm(d, cx+8, cy_head+20, cx+18, cy_head+18)
            d.rectangle([cx-10, cy_head+18, cx-4, cy_head+22], fill=WHITE_SHADE)  # legs behind
            d.rectangle([cx-14, cy_head+18, cx-10, cy_head+22], fill=BLACK)
        elif i == 7:  # Standing on base
            draw_helmet(d, cx, cy_head)
            draw_torso(d, cx, cy_head + 10)
            draw_arm(d, cx-5, cy_head+12, cx-8, cy_head+18)
            draw_arm(d, cx+5, cy_head+12, cx+8, cy_head+18)
            draw_pants(d, cx, cy_head+22, 'normal')

        frames.append(frame)

    for idx, frame in enumerate(frames):
        col = idx % cols
        row = idx // cols
        sheet.paste(frame, (col * fw, row * fh))

    return sheet


# ── Catcher + Umpire sprites (4x2 = 8 frames) ────────────────────────────

def generate_catcher_umpire():
    cols, rows = 4, 2
    fw, fh = 48, 48
    sheet = Image.new('RGBA', (cols * fw, rows * fh), (0, 0, 0, 0))

    frames = []
    for i in range(8):
        frame = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
        d = ImageDraw.Draw(frame)
        cx, cy_head = 24, 6

        if i < 4:
            # ── CATCHER frames ──
            # Catcher mask
            def draw_catcher_head(d, cx, cy):
                d.rectangle([cx-5, cy-2, cx+5, cy+2], fill=BLUE)  # helmet
                d.rectangle([cx-4, cy+2, cx+4, cy+9], fill=GRAY)  # mask
                d.rectangle([cx-3, cy+3, cx+3, cy+8], fill=(60, 60, 70))  # mask grill
                draw_arm(d, 0, 0, 0, 0, (0,0,0,0))  # noop

            if i == 0:  # Squat
                draw_catcher_head(d, cx, cy_head+4)
                # Chest protector
                d.rectangle([cx-6, cy_head+13, cx+6, cy_head+24], fill=CATCHER_BLUE)
                d.rectangle([cx-5, cy_head+14, cx+5, cy_head+23], fill=(60, 80, 160))
                # Arms
                draw_arm(d, cx-6, cy_head+16, cx-12, cy_head+18)
                draw_glove(d, cx-12, cy_head+18, 5)
                draw_arm(d, cx+6, cy_head+16, cx+10, cy_head+20)
                # Squatting legs
                d.rectangle([cx-6, cy_head+24, cx-1, cy_head+30], fill=WHITE_SHADE)
                d.rectangle([cx+1, cy_head+24, cx+6, cy_head+30], fill=WHITE)
                d.rectangle([cx-8, cy_head+30, cx-2, cy_head+34], fill=BLACK)
                d.rectangle([cx+2, cy_head+30, cx+8, cy_head+34], fill=BLACK)
            elif i == 1:  # Reach left
                draw_catcher_head(d, cx-2, cy_head+4)
                d.rectangle([cx-8, cy_head+13, cx+4, cy_head+24], fill=CATCHER_BLUE)
                draw_arm(d, cx-8, cy_head+16, cx-18, cy_head+18)
                draw_glove(d, cx-18, cy_head+18, 5)
                draw_arm(d, cx+4, cy_head+16, cx+8, cy_head+20)
                d.rectangle([cx-7, cy_head+24, cx-2, cy_head+30], fill=WHITE_SHADE)
                d.rectangle([cx, cy_head+24, cx+5, cy_head+30], fill=WHITE)
                d.rectangle([cx-9, cy_head+30, cx-3, cy_head+34], fill=BLACK)
                d.rectangle([cx+1, cy_head+30, cx+7, cy_head+34], fill=BLACK)
            elif i == 2:  # Reach right
                draw_catcher_head(d, cx+2, cy_head+4)
                d.rectangle([cx-4, cy_head+13, cx+8, cy_head+24], fill=CATCHER_BLUE)
                draw_arm(d, cx-4, cy_head+16, cx-8, cy_head+20)
                draw_arm(d, cx+8, cy_head+16, cx+18, cy_head+18)
                draw_glove(d, cx+18, cy_head+18, 5)
                d.rectangle([cx-5, cy_head+24, cx, cy_head+30], fill=WHITE_SHADE)
                d.rectangle([cx+2, cy_head+24, cx+7, cy_head+30], fill=WHITE)
                d.rectangle([cx-7, cy_head+30, cx-1, cy_head+34], fill=BLACK)
                d.rectangle([cx+3, cy_head+30, cx+9, cy_head+34], fill=BLACK)
            elif i == 3:  # Throw
                draw_catcher_head(d, cx, cy_head+2)
                d.rectangle([cx-6, cy_head+11, cx+6, cy_head+22], fill=CATCHER_BLUE)
                draw_arm(d, cx-6, cy_head+14, cx-10, cy_head+16)
                draw_glove(d, cx-10, cy_head+16, 4)
                draw_arm(d, cx+6, cy_head+14, cx+12, cy_head+6)
                draw_ball(d, cx+12, cy_head+6)
                draw_pants(d, cx, cy_head+22, 'wide')
        else:
            # ── UMPIRE frames ──
            def draw_ump_head(d, cx, cy):
                d.rectangle([cx-5, cy-2, cx+5, cy+2], fill=NAVY)  # hat
                d.rectangle([cx-6, cy+2, cx+6, cy+4], fill=(20, 25, 50))  # brim
                d.rectangle([cx-4, cy+4, cx+4, cy+10], fill=SKIN)
                draw_arm(d, 0, 0, 0, 0, (0,0,0,0))  # noop

            if i == 4:  # Standing
                draw_ump_head(d, cx, cy_head)
                d.rectangle([cx-6, cy_head+11, cx+6, cy_head+23], fill=NAVY)  # dark shirt
                draw_arm(d, cx-6, cy_head+13, cx-10, cy_head+20, NAVY)
                draw_arm(d, cx+6, cy_head+13, cx+10, cy_head+20, NAVY)
                d.rectangle([cx-5, cy_head+23, cx-1, cy_head+34], fill=BLACK)
                d.rectangle([cx+1, cy_head+23, cx+5, cy_head+34], fill=BLACK)
                d.rectangle([cx-6, cy_head+34, cx, cy_head+37], fill=BLACK)
                d.rectangle([cx, cy_head+34, cx+6, cy_head+37], fill=BLACK)
            elif i == 5:  # Strike call
                draw_ump_head(d, cx+2, cy_head+1)
                d.rectangle([cx-4, cy_head+12, cx+8, cy_head+23], fill=NAVY)
                draw_arm(d, cx-4, cy_head+14, cx-8, cy_head+18, NAVY)
                draw_arm(d, cx+8, cy_head+14, cx+18, cy_head+10, NAVY)  # arm punching out
                d.ellipse([cx+16, cy_head+8, cx+22, cy_head+14], fill=SKIN)  # fist
                d.rectangle([cx-3, cy_head+23, cx+1, cy_head+34], fill=BLACK)
                d.rectangle([cx+3, cy_head+23, cx+7, cy_head+34], fill=BLACK)
                d.rectangle([cx-4, cy_head+34, cx+2, cy_head+37], fill=BLACK)
                d.rectangle([cx+2, cy_head+34, cx+8, cy_head+37], fill=BLACK)
            elif i == 6:  # Ball call
                draw_ump_head(d, cx, cy_head)
                d.rectangle([cx-6, cy_head+11, cx+6, cy_head+23], fill=NAVY)
                draw_arm(d, cx-6, cy_head+13, cx-12, cy_head+16, NAVY)  # pointing
                draw_arm(d, cx+6, cy_head+13, cx+10, cy_head+20, NAVY)
                d.rectangle([cx-5, cy_head+23, cx-1, cy_head+34], fill=BLACK)
                d.rectangle([cx+1, cy_head+23, cx+5, cy_head+34], fill=BLACK)
                d.rectangle([cx-6, cy_head+34, cx, cy_head+37], fill=BLACK)
                d.rectangle([cx, cy_head+34, cx+6, cy_head+37], fill=BLACK)
            elif i == 7:  # Out call (fist up)
                draw_ump_head(d, cx, cy_head+1)
                d.rectangle([cx-6, cy_head+12, cx+6, cy_head+23], fill=NAVY)
                draw_arm(d, cx-6, cy_head+14, cx-10, cy_head+18, NAVY)
                draw_arm(d, cx+6, cy_head+14, cx+10, cy_head+2, NAVY)  # fist up
                d.ellipse([cx+8, cy_head, cx+14, cy_head+6], fill=SKIN)  # fist
                d.rectangle([cx-5, cy_head+23, cx-1, cy_head+34], fill=BLACK)
                d.rectangle([cx+1, cy_head+23, cx+5, cy_head+34], fill=BLACK)
                d.rectangle([cx-6, cy_head+34, cx, cy_head+37], fill=BLACK)
                d.rectangle([cx, cy_head+34, cx+6, cy_head+37], fill=BLACK)

        frames.append(frame)

    for idx, frame in enumerate(frames):
        col = idx % cols
        row = idx // cols
        sheet.paste(frame, (col * fw, row * fh))

    return sheet


# ── Main ───────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)

    print("Generating pitcher-v3.png...")
    generate_pitcher().save(os.path.join(OUT_DIR, 'pitcher-v3.png'))

    print("Generating batter-v3.png...")
    generate_batter().save(os.path.join(OUT_DIR, 'batter-v3.png'))

    print("Generating fielder-v3.png...")
    generate_fielder().save(os.path.join(OUT_DIR, 'fielder-v3.png'))

    print("Generating runner-v3.png...")
    generate_runner().save(os.path.join(OUT_DIR, 'runner-v3.png'))

    print("Generating catcher-umpire-v3.png...")
    generate_catcher_umpire().save(os.path.join(OUT_DIR, 'catcher-umpire-v3.png'))

    print("All sprite sheets generated!")

    # Verify
    for name in ['pitcher-v3', 'batter-v3', 'fielder-v3', 'runner-v3', 'catcher-umpire-v3']:
        path = os.path.join(OUT_DIR, f'{name}.png')
        img = Image.open(path)
        print(f"  {name}: {img.size[0]}x{img.size[1]}, mode={img.mode}")
