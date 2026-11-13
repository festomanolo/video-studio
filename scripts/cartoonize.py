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

