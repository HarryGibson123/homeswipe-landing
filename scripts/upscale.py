"""
Real-ESRGAN x4 upscaler using PyTorch + M2 MPS GPU.
Upscales frames/ JPEGs 4× then downsamples to 2× for Retina sharpness.
"""
import os, glob, math, time
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
import numpy as np

# ── RRDB network (Real-ESRGAN backbone) ────────────────────────────────────

class ResidualDenseBlock(nn.Module):
    def __init__(self, num_feat=64, num_grow_ch=32):
        super().__init__()
        self.conv1 = nn.Conv2d(num_feat, num_grow_ch, 3, 1, 1)
        self.conv2 = nn.Conv2d(num_feat + num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv3 = nn.Conv2d(num_feat + 2 * num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv4 = nn.Conv2d(num_feat + 3 * num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv5 = nn.Conv2d(num_feat + 4 * num_grow_ch, num_feat, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        return x5 * 0.2 + x

class RRDB(nn.Module):
    def __init__(self, num_feat, num_grow_ch=32):
        super().__init__()
        self.rdb1 = ResidualDenseBlock(num_feat, num_grow_ch)
        self.rdb2 = ResidualDenseBlock(num_feat, num_grow_ch)
        self.rdb3 = ResidualDenseBlock(num_feat, num_grow_ch)

    def forward(self, x):
        out = self.rdb1(x)
        out = self.rdb2(out)
        out = self.rdb3(out)
        return out * 0.2 + x

class RRDBNet(nn.Module):
    def __init__(self, num_in_ch=3, num_out_ch=3, num_feat=64,
                 num_block=23, num_grow_ch=32, scale=4):
        super().__init__()
        self.scale = scale
        num_in = (scale ** 2) * num_in_ch if scale == 1 else num_in_ch
        self.conv_first = nn.Conv2d(num_in, num_feat, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB(num_feat, num_grow_ch) for _ in range(num_block)])
        self.conv_body = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_up1  = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_up2  = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_hr   = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_last = nn.Conv2d(num_feat, num_out_ch, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x):
        feat = self.conv_first(x)
        body = self.conv_body(self.body(feat))
        feat = feat + body
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode='nearest')))
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode='nearest')))
        return self.conv_last(self.lrelu(self.conv_hr(feat)))

# ── Setup ───────────────────────────────────────────────────────────────────

device = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
print(f'Using device: {device}')

model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)

weights_path = '/tmp/realesrgan-x4.pth'
state = torch.load(weights_path, map_location='cpu')
# Handle various checkpoint formats
if 'params_ema' in state:
    state = state['params_ema']
elif 'params' in state:
    state = state['params']
model.load_state_dict(state, strict=True)
model.eval().to(device)
print('Model loaded.')

# ── Upscale with tiling (avoids OOM on large images) ───────────────────────

TILE      = 512   # tile size
TILE_PAD  = 16    # overlap padding

def upscale_tile(img_t):
    with torch.no_grad():
        return model(img_t)

def upscale_image(img_np):
    h, w = img_np.shape[:2]
    img_t = torch.from_numpy(img_np.transpose(2, 0, 1)).float() / 255.0
    img_t = img_t.unsqueeze(0).to(device)

    # Simple tile-based inference
    scale = 4
    out_h, out_w = h * scale, w * scale
    out = torch.zeros(1, 3, out_h, out_w, device=device)

    tiles_x = math.ceil(w / TILE)
    tiles_y = math.ceil(h / TILE)

    for ty in range(tiles_y):
        for tx in range(tiles_x):
            x0 = max(tx * TILE - TILE_PAD, 0)
            y0 = max(ty * TILE - TILE_PAD, 0)
            x1 = min((tx + 1) * TILE + TILE_PAD, w)
            y1 = min((ty + 1) * TILE + TILE_PAD, h)

            tile = img_t[:, :, y0:y1, x0:x1]
            tile_out = upscale_tile(tile)

            # Determine output region (excluding padding)
            ox0 = (tx * TILE - x0) * scale
            oy0 = (ty * TILE - y0) * scale
            ox1 = ox0 + min(TILE, w - tx * TILE) * scale
            oy1 = oy0 + min(TILE, h - ty * TILE) * scale

            out_x0 = tx * TILE * scale
            out_y0 = ty * TILE * scale
            out_x1 = min((tx + 1) * TILE * scale, out_w)
            out_y1 = min((ty + 1) * TILE * scale, out_h)

            out[:, :, out_y0:out_y1, out_x0:out_x1] = tile_out[:, :, oy0:oy1, ox0:ox1]

    out_np = out.squeeze(0).cpu().numpy().transpose(1, 2, 0)
    out_np = (out_np.clip(0, 1) * 255).astype(np.uint8)
    return out_np

# ── Process all frames ──────────────────────────────────────────────────────

frames_dir = 'video-showcase/frames'
files = sorted(glob.glob(os.path.join(frames_dir, 'frame_*.jpg')))
total = len(files)
print(f'Processing {total} frames...')

t0 = time.time()
for i, f in enumerate(files):
    img = Image.open(f).convert('RGB')
    img_np = np.array(img)

    # AI 4× upscale
    up4 = upscale_image(img_np)

    # Downscale to 2× (3832×2160) with Lanczos for sharpening
    h4, w4 = up4.shape[:2]
    final = Image.fromarray(up4).resize((w4 // 2, h4 // 2), Image.LANCZOS)

    # Save as WebP for best compression at high quality
    out_path = f.replace('.jpg', '.webp')
    final.save(out_path, 'WEBP', quality=92, method=4)

    elapsed = time.time() - t0
    per_frame = elapsed / (i + 1)
    remaining = per_frame * (total - i - 1)
    print(f'  [{i+1}/{total}] {os.path.basename(f)} → {final.size[0]}×{final.size[1]} '
          f'({os.path.getsize(out_path)//1024}KB)  ETA {remaining:.0f}s')

print(f'\nDone in {time.time()-t0:.0f}s. Removing old JPEGs...')
for f in files:
    os.remove(f)
print('All frames upscaled to WebP at 2× Retina resolution.')
