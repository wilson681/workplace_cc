#!/usr/bin/env python3
"""Render honest stills of the four LATENT works using the same algorithms
as the live JS pieces. numpy for the maths, Pillow for output."""
import numpy as np, time, os
from PIL import Image, ImageFilter

OUT = "/home/user/workplace_cc/assets/img"
os.makedirs(OUT, exist_ok=True)
W, H = 1200, 750
BG = np.array([6, 7, 12], np.float32)

# ---- palette ramp (vectorised) ------------------------------------------
def ramp(t, stops):
    """t: float array in [0,1]; stops: list[(pos,(r,g,b))] 0..255 -> (...,3)"""
    pos = np.array([s[0] for s in stops], np.float32)
    cols = np.array([s[1] for s in stops], np.float32)
    t = np.clip(t, 0, 1)
    out = np.empty(t.shape + (3,), np.float32)
    for c in range(3):
        out[..., c] = np.interp(t, pos, cols[:, c])
    return out

IRIS = [(0.0,(5,6,14)),(0.18,(60,40,150)),(0.40,(124,92,255)),
        (0.60,(34,211,238)),(0.80,(247,162,59)),(1.0,(255,240,210))]
EMBER= [(0.0,(6,5,10)),(0.30,(120,30,20)),(0.6,(247,120,40)),
        (0.85,(255,200,90)),(1.0,(255,245,220))]

def cyclic(angle, base, span, sat=0.9, lit=0.62):
    """map angle field (radians) -> rgb through an hsl-ish band."""
    t = (np.mod(angle, 2*np.pi))/(2*np.pi)
    hue = (base + t*span) % 360
    return hsl_to_rgb(hue, sat, lit)

def hsl_to_rgb(h, s, l):
    h = h/360.0
    if np.isscalar(h): h=np.array(h)
    def f(n):
        k = (n + h*12) % 12
        return l - s*min(l,1-l)*np.clip(np.minimum(k-3, np.minimum(9-k,1)),-1,1)
    # vectorised
    s_=s; l_=l
    a = s_*np.minimum(l_,1-l_)
    def fv(n):
        k=(n+h*12.0)%12.0
        return l_ - a*np.clip(np.minimum(k-3.0,np.minimum(9.0-k,1.0)),-1.0,1.0)
    return np.stack([fv(0),fv(8),fv(4)],-1)*255.0

def save(arr, name):
    arr = np.clip(arr,0,255).astype(np.uint8)
    Image.fromarray(arr,'RGB').save(f"{OUT}/{name}.png")
    print("  ->", name, "saved")

def glow(arr, radius, amount):
    img = Image.fromarray(np.clip(arr,0,255).astype(np.uint8),'RGB')
    b = img.filter(ImageFilter.GaussianBlur(radius))
    return np.clip(np.asarray(img,np.float32) + np.asarray(b,np.float32)*amount, 0,255)

# =========================================================================
def gen_attractor():
    t0=time.time(); print("attractor…")
    # de Jong, a pretty parameter set
    a,b,c,d = -2.24, -2.30, 1.65, -2.43
    M, K = 300_000, 46
    x = np.random.uniform(-2,2,M); y = np.random.uniform(-2,2,M)
    hist = np.zeros((H,W), np.float64)
    rng = 2.05
    for k in range(K):
        nx = np.sin(a*y) - np.cos(b*x)
        ny = np.sin(c*x) - np.cos(d*y)
        x, y = nx, ny
        if k < 6:  # let it settle onto the attractor
            continue
        ix = ((x/(rng*2)+0.5)*W).astype(np.int64)
        iy = ((y/(rng*2)+0.5)*H).astype(np.int64)
        m = (ix>=0)&(ix<W)&(iy>=0)&(iy<H)
        np.add.at(hist.reshape(-1), iy[m]*W+ix[m], 1.0)
    dens = np.log1p(hist)
    dens /= dens.max()+1e-9
    t = dens**0.62
    col = ramp(t, IRIS)
    col *= t[...,None]*1.15            # dark where empty
    out = BG[None,None,:]*(1-np.clip(t[...,None]*2,0,1)) + col
    out = glow(out, 2.2, 0.5)
    save(out, "attractor"); print("   ", round(time.time()-t0,1),"s")

# =========================================================================
def gen_reaction():
    t0=time.time(); print("reaction…")
    h,w = 600, 960
    U = np.ones((h,w),np.float32); V = np.zeros((h,w),np.float32)
    rng = np.random.default_rng(7)
    # central kick + scattered specks
    cy,cx = h//2,w//2; V[cy-8:cy+8, cx-8:cx+8] = 1.0
    for _ in range(40):
        yy,xx = rng.integers(10,h-10), rng.integers(10,w-10)
        V[yy-4:yy+4, xx-4:xx+4] = 1.0
    Du,Dv,f,k = 1.0,0.5,0.0367,0.0612   # between coral & worms
    def lap(a):
        return (np.roll(a,1,0)+np.roll(a,-1,0)+np.roll(a,1,1)+np.roll(a,-1,1))*0.2 \
             + (np.roll(np.roll(a,1,0),1,1)+np.roll(np.roll(a,1,0),-1,1)
               +np.roll(np.roll(a,-1,0),1,1)+np.roll(np.roll(a,-1,0),-1,1))*0.05 - a
    for step in range(5200):
        uvv = U*V*V
        U += (Du*lap(U) - uvv + f*(1-U))
        V += (Dv*lap(V) + uvv - (f+k)*V)
        np.clip(U,0,1,U); np.clip(V,0,1,V)
    # shade by gradient (fake lighting)
    gy,gx = np.gradient(V)
    nz = np.ones_like(V)
    nl = np.sqrt(gx*gx*36+gy*gy*36+1)
    diff = np.clip((gx*-6*0.5 + gy*-6*0.7 + 0.8)/nl, 0,1)
    t = np.clip(V*1.15,0,1)**1.15          # wider tonal range -> more violet/amber
    col = ramp(t, IRIS)
    col *= (0.45+0.75*diff)[...,None]
    col += (np.clip(diff,0,1)**26)[...,None]*np.array([255,243,230])*0.45
    col = glow(col, 1.2, 0.28)
    # upscale to gallery size
    img = Image.fromarray(np.clip(col,0,255).astype(np.uint8)).resize((W,H), Image.LANCZOS)
    img.save(f"{OUT}/reaction.png"); print("   ->", "reaction saved", round(time.time()-t0,1),"s")

# =========================================================================
def gen_murmuration():
    t0=time.time(); print("murmuration…")
    n=820; steps=340
    rng=np.random.default_rng(3)
    p = rng.uniform([0,0],[W,H],(n,2)).astype(np.float32)
    ang = rng.uniform(0,2*np.pi,n)
    v = np.stack([np.cos(ang),np.sin(ang)],1).astype(np.float32)*2.4
    acc = np.zeros((H,W,3),np.float32)
    R=46.0; R2=R*R; sep2=(R*0.45)**2; maxs=3.4
    for s in range(steps):
        d = p[None,:,:]-p[:,None,:]              # (n,n,2)
        dist2 = (d*d).sum(-1)
        np.fill_diagonal(dist2, 1e9)
        near = dist2 < R2
        cnt = near.sum(1,keepdims=True).clip(1)
        # alignment
        al = (near[...,None]*v[None]).sum(1)/cnt
        # cohesion
        center = (near[...,None]*p[None]).sum(1)/cnt
        coh = center - p
        # separation
        sepm = (dist2<sep2)
        rep = (sepm[...,None]*(-d)/ (dist2[...,None]+1e-3)).sum(1)
        steer = al*0.9 + coh*0.0009 + rep*22.0
        # soft bounds
        steer[:,0] += np.where(p[:,0]<90, (90-p[:,0])*0.01, 0) - np.where(p[:,0]>W-90,(p[:,0]-(W-90))*0.01,0)
        steer[:,1] += np.where(p[:,1]<90, (90-p[:,1])*0.01, 0) - np.where(p[:,1]>H-90,(p[:,1]-(H-90))*0.01,0)
        v += steer*0.05
        sp = np.linalg.norm(v,axis=1,keepdims=True)+1e-6
        v = np.where(sp>maxs, v/sp*maxs, v)
        p += v
        p[:,0]%=W; p[:,1]%=H
        if s>40:
            head = np.arctan2(v[:,1],v[:,0])
            cols = cyclic(head, 248, 120, sat=0.92, lit=0.66)/255.0
            u = v/sp                              # unit heading
            L = 7.0                               # streak length (px)
            for tt in np.linspace(0,1,6):         # rasterise a short streak
                sx = (p[:,0]-u[:,0]*L*tt); sy=(p[:,1]-u[:,1]*L*tt)
                ix=sx.astype(int)%W; iy=sy.astype(int)%H
                np.add.at(acc,(iy,ix),cols*0.42)
    out = BG[None,None,:] + acc*30
    out = glow(out, 1.3, 0.7)
    save(out, "murmuration"); print("   ", round(time.time()-t0,1),"s")

# =========================================================================
def value_noise_field(w,h,seed=1):
    rng=np.random.default_rng(seed)
    field=np.zeros((h,w),np.float32)
    for (gs,amp) in [(6,1.0),(13,0.5),(26,0.25)]:
        g=rng.uniform(0,2*np.pi,(gs+2,gs+2)).astype(np.float32)
        ys=np.linspace(0,gs,h); xs=np.linspace(0,gs,w)
        y0=ys.astype(int); x0=xs.astype(int)
        fy=(ys-y0)[:,None]; fx=(xs-x0)[None,:]
        def sm(t): return t*t*(3-2*t)
        fy=sm(fy); fx=sm(fx)
        g00=g[y0][:,x0]; g10=g[y0+1][:,x0]; g01=g[y0][:,x0+1]; g11=g[y0+1][:,x0+1]
        top=g00*(1-fx)+g01*fx; bot=g10*(1-fx)+g11*fx
        field+=(top*(1-fy)+bot*fy)*amp
    return field

def gen_flow():
    t0=time.time(); print("flow…")
    angle = value_noise_field(W,H,seed=11)*2.0
    n=7000; steps=460
    rng=np.random.default_rng(5)
    p = rng.uniform([0,0],[W,H],(n,2)).astype(np.float32)
    acc=np.zeros((H,W,3),np.float32)
    sp=1.7
    for s in range(steps):
        ix=p[:,0].astype(int).clip(0,W-1); iy=p[:,1].astype(int).clip(0,H-1)
        a=angle[iy,ix]
        d=np.stack([np.cos(a),np.sin(a)],1)
        p=p+d*sp
        cols=cyclic(a, 250, 120, sat=0.88, lit=0.62)/255.0
        ix2=p[:,0].astype(int); iy2=p[:,1].astype(int)
        m=(ix2>=0)&(ix2<W)&(iy2>=0)&(iy2<H)
        np.add.at(acc,(iy2[m],ix2[m]),cols[m]*0.4)
        # respawn strays
        off=~m | (rng.random(n)<0.004)
        cnt=off.sum()
        if cnt:
            p[off]=rng.uniform([0,0],[W,H],(cnt,2)).astype(np.float32)
    out=BG[None,None,:]+acc*30
    out=glow(out,1.6,0.5)
    save(out,"flow"); print("   ",round(time.time()-t0,1),"s")

if __name__=="__main__":
    import sys
    np.random.seed(42)
    todo = sys.argv[1:] or ["attractor","murmuration","flow","reaction"]
    fns = {"attractor":gen_attractor,"murmuration":gen_murmuration,"flow":gen_flow,"reaction":gen_reaction}
    for t in todo: fns[t]()
    print("done.")
