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
