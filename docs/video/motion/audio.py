import json, wave, sys
import numpy as np

SR = 44100
D = 15.0
N = int(SR * D)
rng = np.random.default_rng(7)
cues = json.load(open(sys.argv[1]))
out = sys.argv[2]

dry = np.zeros((N, 2))
wet = np.zeros((N, 2))


def add(buf, sig, t0, pan=0.0, gain=1.0):
    i0 = int(t0 * SR)
    if i0 >= N or i0 + len(sig) <= 0:
        return
    s0 = max(0, -i0)
    n = min(len(sig) - s0, N - max(i0, 0))
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    seg = sig[s0:s0 + n] * gain
    buf[max(i0, 0):max(i0, 0) + n, 0] += seg * l
    buf[max(i0, 0):max(i0, 0) + n, 1] += seg * r


def tt(d):
    return np.arange(int(d * SR)) / SR


def lowpass(x, fc):
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc)
        y[i] = acc
    return y


def lp_sweep(x, f0, f1):
    n = len(x)
    fcs = np.geomspace(f0, f1, n)
    a = 1 - np.exp(-2 * np.pi * fcs / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(n):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def highpass(x, fc):
    return x - lowpass(x, fc)


def bell(f, d=1.4, gain=1.0):
    t = tt(d)
    s = np.zeros_like(t)
    for r, a, dec in [(1, 1, 3.2), (2.76, .5, 4.5), (5.4, .25, 7), (8.93, .12, 10)]:
        s += a * np.sin(2 * np.pi * f * r * t) * np.exp(-dec * t)
    s *= (1 - np.exp(-t * 900))
    return s * gain


def pluck(f, d=.5, gain=1.0):
    t = tt(d)
    s = (np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-8 * t) + .15 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-12 * t))
    return s * np.exp(-6 * t) * (1 - np.exp(-t * 1500)) * gain


def kick(d=.35):
    t = tt(d)
    f = 48 + 90 * np.exp(-28 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-9 * t) * (1 - np.exp(-t * 3000))


def noise(d):
    return rng.standard_normal(int(d * SR))


def whoosh(d=.55):
    n = noise(d)
    y = lp_sweep(n, 250, 7000)
    t = tt(d)
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2.2
    return highpass(y, 180) * env * .9


def hat(d=.05):
    n = highpass(noise(d), 6000)
    t = tt(d)
    return n * np.exp(-60 * t)


def tick(f=2600, d=.03):
    t = tt(d)
    return (np.sin(2 * np.pi * f * t) * .6 + highpass(noise(d), 3000) * .6) * np.exp(-140 * t)


N0 = {"C5": 523.25, "D5": 587.33, "E5": 659.25, "G5": 783.99, "A5": 880.0, "C6": 1046.5, "E6": 1318.5, "G6": 1568.0}
PENT = [N0["C5"], N0["D5"], N0["E5"], N0["G5"], N0["A5"], N0["C6"]]

# ---------- pad ----------
CH = {
    "C": [130.81, 196.0, 246.94, 293.66, 329.63],
    "Am": [110.0, 164.81, 196.0, 246.94, 261.63],
    "F": [87.31, 130.81, 164.81, 196.0, 220.0],
    "G": [98.0, 146.83, 164.81, 220.0, 246.94],
}
SEQ = [(0, 2.5, "C", .35), (2.5, 4.5, "Am", .6), (4.5, 7.5, "F", .8), (7.5, 10.0, "G", .8), (10.0, 12.3, "C", .9), (12.3, 14.0, "F", .85), (14.0, 15.0, "C", 1.0)]
t_all = np.arange(N) / SR
pad = np.zeros(N)
for a, b, name, lvl in SEQ:
    env = np.clip((t_all - a) / .5, 0, 1) * np.clip((b + .5 - t_all) / .5, 0, 1)
    ch = np.zeros(N)
    for k, f in enumerate(CH[name]):
        for det in (-.0035, 0, .0035):
            ch += np.sin(2 * np.pi * f * (1 + det) * t_all + k) * (.5 if det == 0 else .3) / (1 + k * .35)
        ch += .18 * np.sin(2 * np.pi * f * 2 * t_all + k) / (1 + k * .5)
    pad += ch * env * lvl
pad = lowpass(pad, 1600) * .05
swell = .6 + .4 * np.clip(t_all / 4.5, 0, 1)
pad *= swell
add(dry, pad, 0, 0, 1.0)
add(wet, pad, 0, 0, .4)

# ---------- rhythm ----------
BEAT = .5
k = 0
tb = 4.5
kick_s = kick()
while tb < 11.6:
    add(dry, kick_s, tb, 0, .55 if tb < 7.5 else .7)
    tb += BEAT
tb = 4.75
hat_s = hat()
while tb < 11.6:
    g = .14 if tb < 7.5 else .2
    add(dry, hat_s, tb, .25, g)
    tb += BEAT
# soft clap on 2 and 4 from 7.5
tb = 7.5 + BEAT
while tb < 11.6:
    n = highpass(lowpass(noise(.18), 5000), 900) * np.exp(-22 * tt(.18))
    add(dry, n, tb, 0, .35)
    add(wet, n, tb, 0, .3)
    tb += 2 * BEAT
# arpeggio plucks (8th notes) 7.5 -> 11.6
ARP = {"G": [196.0, 293.66, 392.0, 493.88, 587.33, 493.88, 392.0, 293.66], "C": [261.63, 392.0, 523.25, 659.25, 783.99, 659.25, 523.25, 392.0]}
tb = 7.5
i = 0
while tb < 11.6:
    key = "G" if tb < 10 else "C"
    f = ARP[key][i % 8]
    add(dry, pluck(f, .45), tb, ((i % 4) - 1.5) * .25, .16)
    add(wet, pluck(f, .45), tb, ((i % 4) - 1.5) * .25, .22)
    tb += BEAT / 2
    i += 1
# sparse plucks in 4.5-7.5 on beats
for j, tb in enumerate(np.arange(5.0, 7.5, 1.0)):
    f = [220.0, 329.63, 440.0][j % 3]
    add(wet, pluck(f, .5), tb, .2, .2)
    add(dry, pluck(f, .5), tb, .2, .12)
# bass
tb = 4.5
bass_notes = {4.5: 87.31, 7.5: 98.0, 10.0: 65.41}
cur = None
tt_ = 4.5
while tt_ < 11.6:
    f = 87.31 if tt_ < 7.5 else (98.0 if tt_ < 10 else 65.41)
    d = .45
    t = tt(d)
    s = np.sin(2 * np.pi * f * t) * np.exp(-3.5 * t) * (1 - np.exp(-t * 400))
    add(dry, s, tt_ + (BEAT / 2 if int((tt_ - 4.5) / BEAT) % 2 else 0), 0, .32)
    tt_ += BEAT

# ---------- cues ----------
for name, t0 in cues:
    h = int(t0 * 1000) % 97
    if name == "pop":
        f = PENT[h % len(PENT)] * (1 if t0 > 3 else .5)
        b = bell(f, .9, .16)
        pan = ((h % 7) - 3) / 6 * .6
        add(dry, b, t0, pan, 1.0)
        add(wet, b, t0, pan, 1.0)
    elif name == "glitch":
        s = noise(.14)
        s = np.round(s * 4) / 4
        s = highpass(s, 1200) * np.exp(-14 * tt(.14))
        add(dry, s, t0, 0, .22)
    elif name == "whoosh":
        w = whoosh(.5)
        add(dry, w, t0 - .1, 0, .22)
        add(wet, w, t0 - .1, 0, .16)
    elif name == "thump":
        t = tt(1.0)
        f = 38 + 80 * np.exp(-14 * t)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-4 * t)
        add(dry, s, t0, 0, .95)
        add(wet, s * .0 + lowpass(noise(1.0), 800) * np.exp(-6 * t), t0, 0, .3)
    elif name == "draw":
        d = .55
        t = tt(d)
        f = 900 + 1700 * (t / d) ** 1.5
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * (.6 + .4 * np.sin(2 * np.pi * 22 * t)) * np.sin(np.pi * t / d) ** 2
        add(dry, s, t0, 0, .09)
        add(wet, s, t0, 0, .14)
    elif name == "chime":
        for q, f in enumerate([N0["C6"], N0["E6"], N0["G6"]]):
            b = bell(f, 1.6, .14)
            add(dry, b, t0 + q * .09, 0, 1)
            add(wet, b, t0 + q * .09, 0, 1.4)
    elif name == "rise":
        d = .6
        t = tt(d)
        n = highpass(lp_sweep(noise(d), 400, 9000), 300) * (t / d) ** 2
        add(dry, n, t0 - .1, 0, .25)
    elif name == "pin":
        t = tt(.3)
        f = 420 + 500 * np.exp(-20 * t)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-14 * t)
        add(dry, s, t0 + .45, 0, .32)
        add(wet, s, t0 + .45, 0, .25)
    elif name == "blip":
        for q, f in enumerate([N0["E5"], N0["G5"]]):
            b = pluck(f, .4)
            add(dry, b, t0 + q * .1, 0, .22)
            add(wet, b, t0 + q * .1, 0, .3)
    elif name == "key":
        f = 2200 + (h % 9) * 140
        add(dry, tick(f, .03), t0, ((h % 5) - 2) * .1, .28)
        add(dry, np.sin(2 * np.pi * 180 * tt(.025)) * np.exp(-120 * tt(.025)), t0, 0, .15)
    elif name == "click":
        s = tick(1700, .04)
        add(dry, s, t0, 0, .4)
        add(dry, np.sin(2 * np.pi * 140 * tt(.06)) * np.exp(-60 * tt(.06)), t0, 0, .25)
    elif name == "success":
        for q, f in enumerate([N0["C5"], N0["E5"], N0["G5"], N0["C6"], N0["E6"]]):
            b = bell(f, 1.5, .24)
            pl = pluck(f, .5)
            add(dry, pl, t0 + q * .075, (q - 2) * .15, .5)
            add(dry, b, t0 + q * .075, (q - 2) * .15, 1)
            add(wet, b, t0 + q * .075, (q - 2) * .15, 1.3)
        t = tt(.9)
        s = np.sin(2 * np.pi * 65.41 * t) * np.exp(-3.5 * t)
        add(dry, s, t0, 0, .5)
    elif name == "sting":
        for q, f in enumerate([261.63, 392.0, 493.88, 659.25, 783.99]):
            t = tt(2.0)
            s = (np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-3 * t)) * np.exp(-1.6 * t) * (1 - np.exp(-t * 200))
            add(dry, s, t0 + q * .02, (q - 2) * .2, .2)
            add(wet, s, t0 + q * .02, (q - 2) * .2, .35)
        b = bell(N0["C6"], 2.0, .3)
        add(dry, b, t0 + .1, 0, 1)
        add(wet, b, t0 + .1, 0, 1.6)
        t = tt(1.4)
        s = np.sin(2 * np.pi * 43.65 * t) * np.exp(-2.5 * t)
        add(dry, s, t0, 0, .55)
    elif name == "shine":
        d = .5
        t = tt(d)
        f = 2500 + 3500 * (t / d)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2
        add(dry, s, t0, 0, .08)
        add(wet, s, t0, 0, .16)
        b = bell(N0["G6"] * 2, .8, .12)
        add(dry, b, t0 + .15, .3, 1)
        add(wet, b, t0 + .15, .3, 1.2)

# ---------- reverb ----------
rl = int(1.8 * SR)
tir = np.arange(rl) / SR
ir = np.stack([rng.standard_normal(rl), rng.standard_normal(rl)], axis=1) * np.exp(-3.2 * tir)[:, None]
ir[:int(.012 * SR)] *= np.linspace(0, 1, int(.012 * SR))[:, None]
for c in range(2):
    ir[:, c] = highpass(lowpass(ir[:, c], 7000), 200)
ir /= np.sqrt((ir ** 2).sum(axis=0)).max() / 3.2
n_fft = 1 << int(np.ceil(np.log2(N + rl)))
rev = np.zeros((N, 2))
for c in range(2):
    spec = np.fft.rfft(wet[:, c], n_fft) * np.fft.rfft(ir[:, c], n_fft)
    rev[:, c] = np.fft.irfft(spec, n_fft)[:N]

mix = dry + rev * .55
# master: gentle glue + fades
fade_in = np.clip(t_all / .04, 0, 1)
fade_out = np.clip((D - t_all) / .45, 0, 1) ** 1.5
mix *= (fade_in * fade_out)[:, None]
mix = np.tanh(mix * 1.15)
mix /= np.abs(mix).max()
mix *= .89
pcm = (mix * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('audio ok', out)
