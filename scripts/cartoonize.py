"""Cartoon portrait samples from the cut-out selfies (assets/avatar-src/cut/*.png).
Styles keep the photo's geometry, so the lip-sync rig coordinates still fit."""
import sys, cv2, numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets/avatar-src/cut'
OUT = ROOT / 'assets/avatar-cartoon'

def load(name):
    im = cv2.imread(str(SRC / f'{name}.png'), cv2.IMREAD_UNCHANGED)
    im = cv2.resize(im, None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4)
    return im[..., :3].copy(), im[..., 3].copy()

def quantize(img, k, smooth=9):
    z = img.reshape(-1, 3).astype(np.float32)
    _, lab, cen = cv2.kmeans(z, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0), 4, cv2.KMEANS_PP_CENTERS)
    lab = lab.reshape(img.shape[:2]).astype(np.uint8)
    lab = cv2.medianBlur(lab, smooth)  # rounder, vector-like regions
    return cen.astype(np.uint8)[lab]

def ink(img, block=11, c=6, thick=1):
    g = cv2.medianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), 7)
    e = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, block, c)
    if thick > 1: e = cv2.erode(e, np.ones((thick, thick), np.uint8))
    return e

def smooth(img, n=6):
    for _ in range(n): img = cv2.bilateralFilter(img, 9, 40, 9)
    return img

def boost(img, sat=1.25, val=1.05):
    h = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    h[..., 1] *= sat; h[..., 2] *= val
    return cv2.cvtColor(np.clip(h, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR)

def comic(img):      # cel-shaded comic with ink lines
    q = quantize(boost(smooth(img)), 9, 7)
    e = ink(img, 13, 7)
    return cv2.bitwise_and(q, q, mask=e)

def flat(img):       # flat vector poster, few colours, thin ink
    # Even out the lighting first so the face doesn't split into light/dark islands.
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    lab[..., 0] = cv2.createCLAHE(2.0, (4, 4)).apply(lab[..., 0])
    img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    q = quantize(boost(smooth(img, 10), 1.3), 10, 9)
    e = cv2.Canny(cv2.medianBlur(q, 5), 30, 90)
    e = cv2.dilate(e, np.ones((3, 3), np.uint8))
    q[e > 0] = (35, 25, 30)
    return q

def paint(img):      # soft painterly / storybook
    return boost(cv2.stylization(img, sigma_s=80, sigma_r=0.35), 1.2)

def sketch(img):     # coloured pencil
    g, _ = cv2.pencilSketch(img, sigma_s=60, sigma_r=0.07, shade_factor=0.02)
    base = boost(smooth(img, 4), 1.3)
    return (base.astype(np.float32) * (g[..., None] / 255.0) ** 1.6).astype(np.uint8)

def bighead(img, a=None):  # caricature: comic shading, head enlarged over the body
    return comic(img)

def toon(img):       # bold 3-tone toon shading with heavy outline
    q = quantize(boost(smooth(img, 8), 1.4, 1.08), 4, 15)
    e = ink(img, 21, 9, 3)
    return cv2.bitwise_and(q, q, mask=e)

def popart(img):     # 2-colour pop art
    g = cv2.cvtColor(smooth(img), cv2.COLOR_BGR2GRAY)
    g = cv2.equalizeHist(g)
    lv = np.digitize(g, [70, 140])
    pal = np.array([(60, 20, 40), (60, 120, 230), (170, 230, 255)], np.uint8)  # BGR
