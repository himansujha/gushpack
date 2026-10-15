import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { leadsQuery, todaysFollowUps, dueState } from "@/lib/lead-queries";
import { useToday } from "@/hooks/use-today";

/* ───────────────────────────── copy ───────────────────────────── */
const COPY = {
  placeholder: "Ask Gippi anything about your leads…",
  labels: ["Thinking", "Searching leads", "Analyzing pipeline", "Composing answer"],
  done: "Done",
  answerTitle: "Gippi Assist",
  answerBody: "I've reviewed your active pipeline. 3 hot leads require attention today.",
  reset: "New question",
  send: "Send",
};

export type Phase = "idle" | "launch" | "assemble" | "think" | "resolve" | "condense" | "unfold" | "answered" | "reset";

export interface GippiBotAssistProps {
  onSubmit?: (text: string) => Promise<string> | string;
  minThinkMs?: number;
  speed?: number;
  className?: string;
  fixed?: boolean;
  placeholder?: string;
  defaultExpanded?: boolean;
  onClose?: () => void;
}

export type MorphOrbProps = GippiBotAssistProps;

/* ─────────────────────────── geometry ─────────────────────────── */
const PILL_H = 60, BALL_SMALL = 60, ORB_D = 172, ORB_R = 86, CANVAS = 280;
const CARD_H = 172;
const FLY_D = 180;
const pillW = () => (typeof window !== "undefined" ? Math.min(560, window.innerWidth - 56) : 560);
const cardW = () => (typeof window !== "undefined" ? Math.min(480, window.innerWidth - 32) : 480);
const homeDx = () => (typeof window !== "undefined" ? window.innerWidth * 0.5 - 58 : 250);
const homeDy = () => (typeof window !== "undefined" ? window.innerHeight * 0.54 - 58 : 300);

/* ───────────────────────── math + easing ───────────────────────── */
type Ease = (t: number) => number;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const fmt = (v: number) => String(Math.round(v * 1e4) / 1e4);
const TAU = Math.PI * 2;

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return t;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const e = sx(t);
      if (Math.abs(e - x) < 1e-6) break;
      if (x > e) lo = t; else hi = t;
      t = (hi - lo) / 2 + lo;
    }
    return t;
  };
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)));
}

const E = {
  out: cubicBezier(0.22, 1, 0.36, 1),
  io: cubicBezier(0.65, 0, 0.35, 1),
  in: cubicBezier(0.4, 0, 1, 1),
  fly: cubicBezier(0.5, 0, 0.1, 1),
  grow: cubicBezier(0.3, 0, 0.2, 1),
  vortex: cubicBezier(0.6, 0, 0.2, 1),
  spring: cubicBezier(0.34, 1.4, 0.64, 1),
  card: cubicBezier(0.65, 0, 0.2, 1),
  lin: (t: number) => t,
};

const bez = (t: number, p0: number, c: number, p2: number) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * c + t * t * p2;

/* ───────────────────────── timeline data ───────────────────────── */
interface Track { ch: string; from: number; to: number; t0: number; t1: number; ease?: Ease }
const T = (ch: string, from: number, to: number, t0: number, t1: number, ease: Ease = E.io): Track => ({ ch, from, to, t0, t1, ease });

interface Geo { pw: number; cw: number; H: number; startX: number; dir: number }

const launchTracks = (g: Geo): Track[] => [
  T("w", g.pw, g.pw - 12, 0, 100, E.out),
  T("oInput", 1, 0, 0, 160, E.in),
  T("inScale", 1, 0.6, 0, 160, E.in),
  T("oGlow", 1, 0, 0, 300, E.out),
  T("oAur", 1, 0, 0, 300, E.out),
  T("w", g.pw - 12, BALL_SMALL, 100, 560, E.io),
  T("h", PILL_H, PILL_H + 6, 380, 500, E.out),
  T("h", PILL_H + 6, BALL_SMALL, 500, 620, E.out),
  T("oPill", 1, 0, 300, 560, E.out),
  T("oBall", 0, 1, 300, 560, E.out),
  T("u", 0, 1, 620, 1500, E.fly),
  T("w", BALL_SMALL, FLY_D, 620, 1300, E.grow),
  T("h", BALL_SMALL, FLY_D, 620, 1300, E.grow),
  T("w", FLY_D, ORB_D, 1300, 1500, E.out),
  T("h", FLY_D, ORB_D, 1300, 1500, E.out),
  T("cHalo", 0, 0.6, 620, 1500, E.out),
  T("trail", 0, 1, 700, 800, E.out),
  T("trail", 1, 0, 1300, 1500, E.in),
];

const ASSEMBLE: Track[] = [
  T("oRing", 1, 0, 0, 300, E.out),
  T("oBall", 1, 0, 0, 260, E.out),
  T("orb.k", 0, 1, 0, 800, E.out),
  T("orb.alpha", 0, 1, 0, 800, E.out),
  T("orb.spin", 0, 0.9, 0, 800, E.out),
  T("orb.pop", 1, 1.05, 0, 420, E.out),
  T("orb.pop", 1.05, 1, 420, 800, E.io),
  T("sOp", 0, 1, 300, 620, E.out),
  T("sTy", 6, 0, 300, 620, E.out),
];

const RESOLVE: Track[] = [
  T("orb.sweep", 0, 1, 0, 700, E.io),
  T("orb.spin", 0.9, 0.3, 0, 700, E.out),
  T("orb.gain", 1, 0, 0, 700, E.out),
  T("orb.floor", 0, 0.95, 400, 900, E.out),
  T("orb.rad", 0, 0.15, 400, 900, E.out),
  T("orb.pop", 1, 1.04, 600, 800, E.out),
  T("orb.pop", 1.04, 1, 800, 900, E.out),
];

const CONDENSE: Track[] = [
  T("orb.pop", 1, 1.06, 0, 120, E.out),
  T("sOp", 1, 0, 0, 160, E.in),
  T("sTy", 0, -6, 0, 160, E.in),
  T("orb.k", 1, 0, 120, 640, E.vortex),
  T("orb.vortex", 0, 1.6, 120, 640, E.vortex),
  T("oGreen", 0, 0, 260, 700, E.spring),
  T("gs", 0.55, 1, 260, 700, E.spring),
  T("pulse", -1, -1, 320, 760, E.out),
  T("oHalo", 0, 0.35, 380, 700, E.out),
  T("orb.alpha", 1, 0, 500, 800, E.out),
];

const unfoldTracks = (g: Geo, tw: number): Track[] => [
  T("w", ORB_D, 140, 0, 90, E.in),
  T("h", ORB_D, 140, 0, 90, E.in),
  T("w", 140, g.cw, 90, 700, E.card),
  T("h", 140, CARD_H, 90, 700, E.out),
  T("r", ORB_D / 2, 24, 90, 700, E.io),
  T("oGreen", 0, 0, 200, 560, E.out),
  T("oCard", 0, 1, 200, 560, E.out),
  T("oHalo", 0.35, 0, 300, 700, E.out),
  T("cHalo", 0.6, 0.22, 300, 700, E.out),
  T("hOp", 0, 1, 520, 840, E.out),
  T("dotS", 0, 1, 520, 840, E.spring),
  T("wp", 0, 1, 600, 600 + tw, E.lin),
  T("bloom", 1, 0.625, 700, 1200, E.io),
];

const collapseTracks = (g: Geo): Track[] => [
  T("wp", 1, 0, 0, 100, E.out),
  T("hOp", 1, 0, 0, 100, E.out),
  T("cHalo", 0.6, 0, 0, 200, E.out),
  T("w", g.cw, BALL_SMALL, 30, 420, E.io),
  T("h", CARD_H, BALL_SMALL, 30, 420, E.io),
  T("r", 24, BALL_SMALL / 2, 30, 420, E.io),
  T("oCard", 1, 0, 30, 180, E.out),
  T("oBall", 0, 1, 50, 220, E.out),
  T("u", 1, 0, 40, 460, E.io),
  T("trail", 0, 0.7, 40, 200, E.out),
  T("trail", 0.7, 0, 340, 460, E.out),
  T("oBall", 1, 0, 420, 480, E.out),
  T("oPill", 0, 1, 420, 480, E.out),
  T("oInput", 0, 1, 420, 480, E.out),
];

const R_COLLAPSE = (g: Geo): Track[] => [
  T("wp", 1, 0, 0, 120, E.out),
  T("hOp", 1, 0, 0, 120, E.out),
  T("oCard", 1, 0, 0, 200, E.out),
  T("cHalo", 0.6, 0, 0, 200, E.out),
  T("w", g.cw, BALL_SMALL, 0, 250, E.out),
  T("h", CARD_H, BALL_SMALL, 0, 250, E.out),
  T("r", 24, BALL_SMALL / 2, 0, 250, E.out),
  T("u", 1, 0, 0, 250, E.out),
  T("oPill", 0, 1, 100, 250, E.out),
  T("oInput", 0, 1, 100, 250, E.out),
];

/* reduced-motion: pure cross-fades */
const R_OUT: Track[] = [
  T("oInput", 1, 0, 0, 140, E.out),
  T("oPill", 1, 0, 0, 200, E.out),
  T("oGlow", 1, 0, 0, 200, E.out),
  T("oAur", 1, 0, 0, 200, E.out),
  T("oRing", 1, 0, 0, 200, E.out),
];
const R_IN: Track[] = [
  T("orb.alpha", 0, 1, 0, 200, E.out),
  T("sOp", 0, 1, 0, 200, E.out),
  T("cHalo", 0, 0.6, 0, 200, E.out),
];
const R_RESOLVE: Track[] = [T("orb.sweep", 0, 1, 0, 250, E.io), T("orb.floor", 0, 0.95, 0, 250, E.out)];
const R_CONDENSE: Track[] = [
  T("oGreen", 0, 0, 0, 250, E.out),
  T("orb.alpha", 1, 0, 0, 250, E.out),
  T("sOp", 1, 0, 0, 250, E.out),
];
const R_GREEN_OUT: Track[] = [T("oGreen", 0, 0, 0, 120, E.out)];
const rCardIn = (tw: number): Track[] => [
  T("oCard", 0, 1, 0, 250, E.out),
  T("hOp", 0, 1, 0, 250, E.out),
  T("wp", 0, 1, 0, tw, E.lin),
  T("bloom", 1, 0.625, 0, 250, E.out),
];

const FADE = ["oGlow", "oAur", "oPill", "oBall", "oGreen", "oCard", "oRing", "oInput", "oHalo", "sOp", "orb.alpha", "trail"];

const INIT: Record<string, number> = {
  h: PILL_H, r: 999, oGlow: 1, oHalo: 0, oPill: 1, oBall: 0, oGreen: 0, oCard: 0, oRing: 1, oInput: 1, inScale: 1, oAur: 1,
  gs: 0.55, cs: 1, hOp: 0, dotS: 0, bloom: 1, u: 0, yOff: 0, trail: 0, pulse: -1, sOp: 0, sTy: 6, cHalo: 0, wp: 0,
  "orb.k": 0, "orb.alpha": 0, "orb.spin": 0, "orb.pop": 1, "orb.sweep": 0, "orb.vortex": 0, "orb.gain": 1, "orb.floor": 0, "orb.rad": 0,
};

/* ─────────────────────────── async utils ─────────────────────────── */
const ABORT = Symbol("abort");

function sleep(ms: number, sig: AbortSignal) {
  return new Promise<void>((res) => {
    if (sig.aborted) return res();
    let id = 0;
    const onAbort = () => { window.clearTimeout(id); res(); };
    id = window.setTimeout(() => { sig.removeEventListener("abort", onAbort); res(); }, Math.max(0, ms));
    sig.addEventListener("abort", onAbort, { once: true });
  });
}

function abortable<V>(p: Promise<V>, sig: AbortSignal) {
  return new Promise<V | undefined>((res) => {
    if (sig.aborted) return res(undefined);
    const onAbort = () => res(undefined);
    sig.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => { sig.removeEventListener("abort", onAbort); res(v); },
      () => { sig.removeEventListener("abort", onAbort); res(undefined); }
    );
  });
}

/* ───────────────────────────── dotted orb ───────────────────────────── */
const RINGS = 16;
const DOT_LIST = (() => {
  const rand = mulberry32(7);
  const out: { x: number; y: number; z: number; u: number; seed: number }[] = [];
  for (let k = 0; k < RINGS; k++) {
    const y = 1 - ((k + 0.5) / RINGS) * 2;
    const r = Math.sqrt(1 - y * y);
    const m = Math.max(4, Math.round(30 * r));
    for (let j = 0; j < m; j++) {
      const a = (j / m) * TAU + k * 0.35;
      out.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, u: (1 - y) / 2, seed: rand() * 6.283 });
    }
  }
  return out;
})();
const N = DOT_LIST.length;
const DX = Float32Array.from(DOT_LIST, (d) => d.x);
const DY = Float32Array.from(DOT_LIST, (d) => d.y);
const DZ = Float32Array.from(DOT_LIST, (d) => d.z);
const DU = Float32Array.from(DOT_LIST, (d) => d.u);
const DS = Float32Array.from(DOT_LIST, (d) => d.seed);

const T_STEPS = 60, G_STEPS = 8, A_STEPS = 32;

function buildPalette(isDark: boolean): string[][][] {
  // Pure monochrome palette: no fancy gradients or colours, strictly monochrome
  const STOPS: [number, number, number][] = isDark
    ? [
        [225, 225, 225],
        [210, 210, 210],
        [235, 235, 235],
        [220, 220, 220],
        [225, 225, 225],
      ]
    : [
        [50, 50, 50],
        [65, 65, 65],
        [40, 40, 40],
        [55, 55, 55],
        [50, 50, 50],
      ];

  const table: string[][][] = [];
  for (let ti = 0; ti < T_STEPS; ti++) {
    const t = ti / (T_STEPS - 1);
    const seg = t * (STOPS.length - 1);
    const idx = Math.min(Math.floor(seg), STOPS.length - 2);
    const f = seg - idx;
    const HOLD = 0.70;
    let smoothF = 0;
    if (f > HOLD) {
      const rawF = (f - HOLD) / (1 - HOLD);
      smoothF = 0.5 - 0.5 * Math.cos(rawF * Math.PI);
    }
    const c0 = STOPS[idx] ?? STOPS[0]!;
    const c1 = STOPS[idx + 1] ?? STOPS[STOPS.length - 1]!;
    const monoVal = Math.round(c0[0] + (c1[0] - c0[0]) * smoothF);

    const gRow: string[][] = [];
    for (let gi = 0; gi < G_STEPS; gi++) {
      const g = gi / (G_STEPS - 1);
      // Subtle monochrome tone adjustment
      const v = Math.round(Math.min(255, Math.max(0, monoVal + (isDark ? 15 : -10) * g)));

      const aRow: string[] = [];
      for (let ai = 0; ai < A_STEPS; ai++) {
        const a = ((ai / (A_STEPS - 1)) * 0.75).toFixed(3);
        aRow.push(`rgba(${v},${v},${v},${a})`);
      }
      gRow.push(aRow);
    }
    table.push(gRow);
  }
  return table;
}

const PALETTE_LIGHT = buildPalette(false);
const PALETTE_DARK = buildPalette(true);

interface OrbParams {
  k: number; alpha: number; spin: number; rot: number; sweep: number; pop: number;
  vortex: number; gain: number; floor: number; rad: number; prog: number;
}
const ORB_KEYS = ["k", "alpha", "spin", "sweep", "pop", "vortex", "gain", "floor", "rad"] as const;

function createOrb(canvas: HTMLCanvasElement, getSpeed: () => number, isReduced: () => boolean) {
  const P: OrbParams = { k: 0, alpha: 0, spin: 0, rot: 0, sweep: 0, pop: 1, vortex: 0, gain: 1, floor: 0, rad: 0, prog: 0 };
  const ctx = canvas.getContext("2d");
  const lit = new Float32Array(N);
  const SX = new Float32Array(N), SY = new Float32Array(N), SR = new Float32Array(N), SD = new Float32Array(N);
  const SA = new Int8Array(N);
  const SG = new Uint8Array(N);
  const pw = [1, 0, 0, 0];
  let time = 0, raf = 0, last = 0, dead = false;

  const reset = () => {
    P.k = 0; P.alpha = 0; P.spin = 0; P.rot = 0; P.sweep = 0; P.pop = 1; P.vortex = 0; P.gain = 1; P.floor = 0; P.rad = 0; P.prog = 0;
    lit.fill(0);
    SA.fill(-1);
    SG.fill(0);
    pw[0] = 1; pw[1] = 0; pw[2] = 0; pw[3] = 0;
    time = isReduced() ? 1.2 : 0;
  };
  reset();

  if (!ctx) return { P, ensure() {}, reset, destroy() {} };

  const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  canvas.width = Math.round(CANVAS * dpr);
  canvas.height = Math.round(CANVAS * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const S = 0.6, CP = Math.cos(0.35), SP = Math.sin(0.35), C0 = CANVAS / 2;

  const draw = (dt: number) => {
    ctx.clearRect(0, 0, CANVAS, CANVAS);
    time += dt;
    P.rot += P.spin * dt;
    const yaw = P.rot + P.vortex, cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const stepW = dt / 0.35;
    for (let q = 0; q < 4; q++) {
      const curVal = pw[q] ?? 0;
      const target = q === P.prog ? 1 : 0;
      const d = target - curVal;
      pw[q] = curVal + (Math.abs(d) <= stepW ? d : d > 0 ? stepW : -stepW);
    }
    const decay = Math.exp(-dt / 0.5);
    const h0 = (time * 300) % N, h3 = (time * 480) % N;
    const a1 = time * 0.8, b1 = Math.sin(time * 0.5) * 0.9;
    const f1x = Math.cos(b1) * Math.cos(a1), f1y = Math.sin(b1), f1z = Math.cos(b1) * Math.sin(a1);
    const a2 = time * 0.55 + 2.1, b2 = Math.cos(time * 0.42) * 0.9;
    const f2x = Math.cos(b2) * Math.cos(a2), f2y = Math.sin(b2), f2z = Math.cos(b2) * Math.sin(a2);
    const lat = Math.sin(time * 2.2);
    const swirlK = P.vortex * 1.5;

    const pw0 = pw[0] ?? 0, pw1 = pw[1] ?? 0, pw2 = pw[2] ?? 0, pw3 = pw[3] ?? 0;

    for (let n = 0; n < N; n++) {
      const dx = DX[n] ?? 0, dy = DY[n] ?? 0, dz = DZ[n] ?? 0, u = DU[n] ?? 0;

      /* light programs: dots are lit in turn */
      let pulse = 0;
      if (pw0 > 0.001) {
        let dd = Math.abs(n - h0); if (dd > N - dd) dd = N - dd;
        const v = Math.max(0, 1 - dd / 16);
        pulse = Math.max(pulse, v * v * pw0);
      }
      if (pw1 > 0.001) {
        const v1 = Math.max(0, (dx * f1x + dy * f1y + dz * f1z - 0.72) / 0.28);
        const v2 = Math.max(0, (dx * f2x + dy * f2y + dz * f2z - 0.72) / 0.28);
        const v = Math.max(v1, v2);
        pulse = Math.max(pulse, v * v * pw1);
      }
      if (pw2 > 0.001) {
        const e = dy - lat;
        const v = Math.max(0, 1 - (e * e) / 0.02);
        pulse = Math.max(pulse, v * v * pw2);
      }
      if (pw3 > 0.001) {
        let dd = Math.abs(n - h3); if (dd > N - dd) dd = N - dd;
        const v = Math.max(0, 1 - dd / 22);
        pulse = Math.max(pulse, v * v * pw3);
      }
      const prevLit = lit[n] ?? 0;
      const l = Math.max(prevLit * decay, pulse * P.gain);
      lit[n] = l;

      /* per-dot appearance: top dots first, bottom collapse first */
      const ki = clamp01(P.k * (1 + S) - S * u);
      if (ki <= 0.001) { SA[n] = -1; continue; }
      const eo = E.out(ki), kk = eo * P.pop;

      const x1 = dx * cyw + dz * syw, z1 = -dx * syw + dz * cyw;
      const y2 = dy * CP - z1 * SP, z2 = dy * SP + z1 * CP;
      const f = 2.8 / (2.8 - z2), depth = (z2 + 1) / 2;
      let ox = x1 * ORB_R * kk * f, oy = -y2 * ORB_R * kk * f;
      if (swirlK > 0.001) {
        const sw = (1 - ki) * swirlK, cc = Math.cos(sw), ss = Math.sin(sw);
        const tx = ox * cc - oy * ss;
        oy = ox * ss + oy * cc;
        ox = tx;
      }

      const g = clamp01((P.sweep * 1.4 - u) / 0.4);
      const dsSeed = DS[n] ?? 0;
      let a = 0.1 + 0.035 * Math.sin(dsSeed + time * 1.6) * (1 - g) + 0.32 * depth * depth + 0.75 * l * (1 - g) + g * (0.55 + 0.4 * depth) + 2 * g * (1 - g);
      a = Math.max(a, P.floor * (0.7 + 0.3 * depth));
      if (a > 1) a = 1;
      a *= eo * P.alpha;

      SX[n] = C0 + ox;
      SY[n] = C0 + oy;
      SD[n] = depth;
      SR[n] = (1.15 * (0.45 + 0.75 * depth) * f + 0.9 * l + g * 0.25) * (1 + P.rad) * (0.4 + 0.6 * eo);
      const ai = Math.round(a * (A_STEPS - 1)), gi = Math.round(g * (G_STEPS - 1));
      SA[n] = ai <= 0 ? -1 : Math.min(A_STEPS - 1, ai);
      SG[n] = Math.min(G_STEPS - 1, Math.max(0, gi));
    }

    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    const palette = isDark ? PALETTE_DARK : PALETTE_LIGHT;

    // Smooth individual color shifting through the 5 card colors, one at a time (10s cycle)
    const shiftPeriod = 10;
    const timeProgress = (time % shiftPeriod) / shiftPeriod;
    const globalTi = Math.min(T_STEPS - 1, Math.max(0, Math.floor(timeProgress * T_STEPS)));

    /* two passes: back half first, then front half */
    for (let pass = 0; pass < 2; pass++) {
      for (let n = 0; n < N; n++) {
        const ai = SA[n];
        if (ai === undefined || ai < 0) continue;
        const sdVal = SD[n] ?? 0;
        if ((sdVal >= 0.5) !== (pass === 1)) continue;
        const gi = SG[n] ?? 0;
        const color = palette[globalTi]?.[gi]?.[ai];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(SX[n] ?? 0, SY[n] ?? 0, SR[n] ?? 0, 0, TAU);
        ctx.fill();
      }
    }
  };

  const frame = (now: number) => {
    raf = 0;
    if (dead) return;
    const dt = isReduced() ? 0 : Math.max(0, Math.min(0.05, (now - last) / 1000)) * getSpeed();
    last = now;
    draw(dt);
    if (P.alpha > 0.002) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, CANVAS, CANVAS);
  };

  const ensure = () => {
    if (raf || dead || P.alpha <= 0.002) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const destroy = () => {
    dead = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  return { P, ensure, reset, destroy };
}

/* ───────────────────────────── runtime ───────────────────────────── */
interface UI {
  setPhase(p: Phase): void;
  swapLabel(name: string): void;
  resetLabel(): void;
  setAnswer(s: string): void;
  clearInput(): void;
  live(s: string): void;
  lock(on: boolean): void;
  idleReady(): void;
  focusAnswer(): void;
}
interface Env {
  root: HTMLElement; mover: HTMLElement; actor: HTMLElement; form: HTMLElement; ghosts: HTMLElement[];
  canvas: HTMLCanvasElement; pulse: HTMLElement; status: HTMLElement;
  getBody: () => HTMLElement | null;
  ui: UI; getSpeed: () => number; isReduced: () => boolean;
}
interface RunCfg { onSubmit: (text: string) => Promise<string> | string; minThink: number }
interface Runtime {
  start(text: string, cfg: RunCfg): boolean;
  escape(): void;
  reset(): void;
  hard(): void;
  home(): void;
  busy(): boolean;
  destroy(): void;
}
interface Sample { t: number; x: number; y: number; d: number }

function sampleAt(h: Sample[], t: number, out: Sample) {
  const n = h.length;
  const copy = (s: Sample) => { out.x = s.x; out.y = s.y; out.d = s.d; };
  if (n === 0) { out.x = 0; out.y = 0; out.d = 0; return; }
  const h0 = h[0];
  if (!h0) { out.x = 0; out.y = 0; out.d = 0; return; }
  if (t <= h0.t) return copy(h0);
  for (let i = n - 1; i > 0; i--) {
    const a = h[i - 1];
    const b = h[i];
    if (a && b && t >= a.t) {
      if (t >= b.t) return copy(b);
      const k = (t - a.t) / (b.t - a.t || 1);
      out.x = lerp(a.x, b.x, k); out.y = lerp(a.y, b.y, k); out.d = lerp(a.d, b.d, k);
      return;
    }
  }
  const lastSample = h[n - 1];
  if (lastSample) copy(lastSample);
}

function createRuntime(env: Env): Runtime {
  const { actor, mover, root, status, pulse, ghosts, form } = env;
  const life = new AbortController();
  const geo: Geo = { pw: pillW(), cw: cardW(), H: homeDy(), startX: homeDx(), dir: -1 };
  const orb = createOrb(env.canvas, env.getSpeed, env.isReduced);
  const vals: Record<string, number> = {};
  const dirty = new Set<string>();
  const CH: Record<string, (v: number) => void> = {};

  let current: AbortController | null = null;
  let idleCtl: AbortController | null = null;
  let busy = false, idling = false, epoch = 0;
  let curX = 0, curY = 0, curD = BALL_SMALL, trailVis = 0, ghostsShown = false;
  let wStagger = 45, wDur = 320;
  const hist: Sample[] = [];
  const tmp: Sample = { t: 0, x: 0, y: 0, d: 0 };

  const child = () => {
    const ac = new AbortController();
    if (life.signal.aborted) ac.abort();
    else life.signal.addEventListener("abort", () => ac.abort(), { once: true });
    return ac;
  };

  /* ── flight path + comet trail ── */
  const renderTrail = () => {
    if (trailVis <= 0.001) {
      if (ghostsShown) { ghosts.forEach((g) => { if (g) g.style.opacity = "0"; }); ghostsShown = false; }
      return;
    }
    ghostsShown = true;
    const now = performance.now();
    for (let i = 0; i < ghosts.length; i++) {
      sampleAt(hist, now - (i + 1) * 45, tmp);
      const k = (tmp.d * (1 - 0.08 * (i + 1))) / 100;
      const g = ghosts[i];
      if (g) {
        g.style.transform = `translate3d(${(tmp.x - curX).toFixed(2)}px,${(tmp.y - curY).toFixed(2)}px,0) translate(-50%,-50%) scale(${k.toFixed(3)})`;
        g.style.opacity = (0.28 * Math.pow(1 - i / 6, 1.5) * trailVis).toFixed(3);
      }
    }
  };

  const applyPath = () => {
    const u = vals["u"] ?? 0, H = geo.H, sx = geo.startX;
    curX = bez(u, sx, sx * 0.4, 0);
    curY = bez(u, H, 0.5 * H, 0) + (vals["yOff"] ?? 0);
    mover.style.transform = `translate3d(${curX.toFixed(2)}px,${curY.toFixed(2)}px,0)`;
    const now = performance.now();
    hist.push({ t: now, x: curX, y: curY, d: curD });
    const h0 = hist[0];
    while (hist.length > 2 && h0 && h0.t < now - 500) hist.shift();
    renderTrail();
  };

  /* ── answer words ── */
  const applyWords = (v: number) => {
    const body = env.getBody();
    if (!body) return;
    const nodes = body.querySelectorAll<HTMLElement>(".mo-w");
    const total = (nodes.length - 1) * wStagger + wDur;
    const time = v * total;
    const reduced = env.isReduced();
    nodes.forEach((el, i) => {
      const p = E.out(clamp01((time - i * wStagger) / wDur));
      el.style.opacity = fmt(p);
      el.style.transform = p >= 0.999 || reduced ? "none" : `translateY(${fmt((1 - p) * 4)}px)`;
      el.style.filter = p >= 0.999 || reduced ? "none" : `blur(${fmt((1 - p) * 4)}px)`;
    });
  };

  /* ── channels ── */
  ["oGlow", "oHalo", "oPill", "oBall", "oGreen", "oCard", "oRing", "oInput", "oAur", "gs", "cs", "hOp", "dotS", "bloom"].forEach((n) => {
    CH[n] = (v) => actor.style.setProperty("--" + n, fmt(v));
  });
  ["w", "h", "r"].forEach((n) => {
    CH[n] = (v) => {
      actor.style.setProperty("--" + n, fmt(v) + "px");
      if (n === "w") curD = v;
    };
  });
  CH["inScale"] = (v) => {
    actor.style.setProperty("--inScale", fmt(v));
    form.style.filter = v >= 0.999 ? "none" : `blur(${fmt((1 - v) * 15)}px)`;
  };
  CH["sOp"] = (v) => status.style.setProperty("--sOp", fmt(v));
  CH["sTy"] = (v) => status.style.setProperty("--sTy", fmt(v));
  CH["cHalo"] = (v) => root.style.setProperty("--oCenter", fmt(v));
  CH["u"] = () => applyPath();
  CH["yOff"] = () => applyPath();
  CH["trail"] = (v) => { trailVis = v; renderTrail(); };
  CH["pulse"] = (v) => {
    if (v < 0) { pulse.style.opacity = "0"; return; }
    pulse.style.opacity = fmt(0.5 * (1 - v));
    pulse.style.transform = `scale(${fmt(1 + v)})`;
  };
  CH["wp"] = applyWords;
  ORB_KEYS.forEach((name) => {
    CH["orb." + name] = (v) => {
      orb.P[name] = v;
      if (name === "alpha") orb.ensure();
    };
  });

  const set = (ch: string, v: number) => { vals[ch] = v; dirty.add(ch); };
  const flush = () => { dirty.forEach((ch) => CH[ch]?.(vals[ch] ?? 0)); dirty.clear(); };
  const setNow = (ch: string, v: number) => { vals[ch] = v; CH[ch]?.(v); };
  const resetChannels = () => {
    setNow("w", geo.pw);
    for (const ch of Object.keys(INIT)) {
      const val = INIT[ch];
      if (val !== undefined) setNow(ch, val);
    }
  };

  /* ── timeline engine ── */
  const play = (tracks: Track[], sig: AbortSignal) =>
    new Promise<void>((res) => {
      if (sig.aborted) return res();
      const end = tracks.reduce((m, k) => Math.max(m, k.t1), 0);
      const done = new Set<Track>();
      let raf = 0, t = 0, last = performance.now();
      const onAbort = () => { cancelAnimationFrame(raf); res(); };
      const finish = () => { sig.removeEventListener("abort", onAbort); res(); };
      const step = (now: number) => {
        const dt = Math.max(0, Math.min(100, now - last));
        last = now;
        t += dt * env.getSpeed();
        for (const k of tracks) {
          if (done.has(k) || t < k.t0) continue;
          const p = Math.min(1, (t - k.t0) / Math.max(1, k.t1 - k.t0));
          set(k.ch, k.from + (k.to - k.from) * (k.ease ?? E.io)(p));
          if (p === 1) done.add(k);
        }
        flush();
        if (t >= end) finish(); else raf = requestAnimationFrame(step);
      };
      sig.addEventListener("abort", onAbort, { once: true });
      raf = requestAnimationFrame(step);
    });

  /* ── thinking labels ── */
  const labelLoop = async (sig: AbortSignal, ctl: { stop: boolean }) => {
    let i = 0;
    for (;;) {
      await sleep(1150 / env.getSpeed(), sig);
      if (sig.aborted || ctl.stop) return;
      i = (i + 1) % COPY.labels.length;
      orb.P.prog = i % 4;
      env.ui.swapLabel(COPY.labels[i] ?? COPY.labels[0] ?? "Thinking");
    }
  };

  /* ── orchestrator ── */
  const run = async (text: string, sig: AbortSignal, cfg: RunCfg) => {
    const reduced = env.isReduced();
    const go = async (tracks: Track[]) => {
      await play(tracks, sig);
      if (sig.aborted) throw ABORT;
    };
    try {
      env.ui.setPhase("launch");
      hist.length = 0;
      if (!reduced) {
        await go(launchTracks(geo));
        setNow("r", ORB_D / 2);
        env.ui.setPhase("assemble");
        await go(ASSEMBLE);
      } else {
        await go(R_OUT);
        setNow("u", 1); setNow("w", ORB_D); setNow("h", ORB_D); setNow("r", ORB_D / 2);
        setNow("sTy", 0); setNow("orb.k", 1); setNow("orb.spin", 0);
        env.ui.setPhase("assemble");
        await go(R_IN);
      }

      /* think — until the answer settled AND the minimum time elapsed */
      env.ui.setPhase("think");
      env.ui.live(COPY.labels[0] ?? "Thinking");
      const ctl = { stop: false };
      void labelLoop(sig, ctl);
      const t0 = performance.now();
      const pending = Promise.resolve()
        .then(() => cfg.onSubmit(text))
        .then((b) => (typeof b === "string" && b.trim() ? b : COPY.answerBody), () => COPY.answerBody);
      const got = await abortable(pending, sig);
      if (sig.aborted) throw ABORT;
      const body = got ?? COPY.answerBody;
      await sleep(cfg.minThink / env.getSpeed() - (performance.now() - t0), sig);
      ctl.stop = true;
      if (sig.aborted) throw ABORT;

      const words = body.split(/\s+/).filter(Boolean);
      const n = Math.max(1, words.length);

      if (!reduced) {
        env.ui.setPhase("resolve");
        await go(RESOLVE);

        env.ui.setPhase("condense");
        await go(CONDENSE);

        env.ui.setPhase("unfold");
        wDur = 320;
        wStagger = n > 1 ? Math.min(45, 280 / (n - 1)) : 0;
        env.ui.setAnswer(body);
        await go(unfoldTracks(geo, (n - 1) * wStagger + wDur));
      } else {
        env.ui.setPhase("resolve");
        await go(R_RESOLVE);
        await sleep(350 / env.getSpeed(), sig);
        if (sig.aborted) throw ABORT;

        env.ui.setPhase("condense");
        setNow("gs", 1);
        await go(R_CONDENSE);

        env.ui.setPhase("unfold");
        wDur = 250;
        wStagger = 0;
        env.ui.setAnswer(body);
        await go(R_GREEN_OUT);
        setNow("w", geo.cw); setNow("h", CARD_H); setNow("r", 24); setNow("dotS", 1);
        await go(rCardIn(wDur));
      }

      env.ui.setPhase("answered");
      env.ui.live("Answer ready: " + body);
      env.ui.focusAnswer();
    } catch (e) {
      if (e === ABORT) return;
      hard();
    }
  };

  /* ── return to the idle pill ── */
  const toIdle = async (kind: "reset" | "esc") => {
    if (idling) return;
    idling = true;
    const my = ++epoch;
    const ac = child();
    idleCtl = ac;
    const sig = ac.signal;

    env.ui.setPhase("reset");

    geo.pw = pillW(); geo.cw = cardW(); geo.H = homeDy(); geo.startX = homeDx();

    if (!env.isReduced()) {
      await play(collapseTracks(geo), sig);
    } else {
      await play(R_COLLAPSE(geo), sig);
    }
    if (sig.aborted || my !== epoch) return;

    setNow("pulse", -1);
    env.ui.setAnswer("");
    env.ui.resetLabel();
    env.ui.clearInput();
    orb.reset();
    hist.length = 0;

    // Reset channels directly to collapsed 60px circle state
    setNow("w", BALL_SMALL);
    setNow("h", BALL_SMALL);
    setNow("r", BALL_SMALL / 2);
    setNow("u", 0);
    setNow("yOff", 0);
    setNow("oPill", 1);
    setNow("oInput", 1);
    setNow("oBall", 0);
    setNow("oCard", 0);
    setNow("oGreen", 0);
    setNow("oHalo", 0);
    setNow("cHalo", 0);
    setNow("trail", 0);
    setNow("inScale", 1);

    current = null; idleCtl = null; busy = false; idling = false;
    env.ui.lock(false);
    env.ui.idleReady();
    env.ui.setPhase("idle");
  };

  function hard() {
    epoch++;
    current?.abort(); current = null;
    idleCtl?.abort(); idleCtl = null;
    orb.reset();
    hist.length = 0;
    env.ui.setAnswer("");
    env.ui.resetLabel();
    geo.pw = pillW(); geo.cw = cardW(); geo.H = homeDy(); geo.startX = homeDx();
    resetChannels();
    setNow("pulse", -1);
    busy = false; idling = false;
    env.ui.lock(false);
    env.ui.setPhase("idle");
    env.ui.idleReady();
  }

  resetChannels();

  return {
    start(text, cfg) {
      if (busy) return false;
      busy = true;
      geo.pw = pillW(); geo.cw = cardW(); geo.H = homeDy(); geo.startX = homeDx();
      geo.dir = -geo.dir;
      orb.reset();
      setNow("u", 0);
      const ac = child();
      current = ac;
      env.ui.lock(true);
      void run(text, ac.signal, cfg);
      return true;
    },
    escape() {
      if (!busy || idling) return;
      current?.abort();
      void toIdle("esc");
    },
    reset() {
      if (!busy || idling) return;
      void toIdle("reset");
    },
    hard,
    home() {
      if (busy) return;
      geo.pw = pillW(); geo.cw = cardW(); geo.H = homeDy(); geo.startX = homeDx();
      setNow("w", geo.pw);
      setNow("u", 0);
    },
    busy: () => busy,
    destroy() {
      life.abort();
      orb.destroy();
    },
  };
}

/* ────────── sleeping "?????" floating animation ────────── */
export interface GippiSleepingQuestionsProps {
  expanded: boolean;
  phase: Phase;
}

export function GippiSleepingQuestions({ expanded, phase }: GippiSleepingQuestionsProps) {
  const isVisible = !expanded && phase === "idle";

  return (
    <div
      className="mo-sleep-questions pointer-events-none select-none"
      aria-hidden="true"
      data-visible={isVisible ? "true" : "false"}
    >
      <span className="mo-sleep-q mo-sleep-q1" aria-hidden="true">?</span>
      <span className="mo-sleep-q mo-sleep-q2" aria-hidden="true">?</span>
      <span className="mo-sleep-q mo-sleep-q3" aria-hidden="true">?</span>
    </div>
  );
}

/* ────────── bot capabilities tooltip card on hover ────────── */
export interface GippiBotTooltipProps {
  expanded: boolean;
  phase: Phase;
}

export function GippiBotTooltip({ expanded, phase }: GippiBotTooltipProps) {
  const isVisible = !expanded && phase === "idle";
  if (!isVisible) return null;

  return (
    <div
      className="mo-bot-tooltip pointer-events-none select-none"
      role="tooltip"
      aria-hidden="true"
    >
      <div className="mo-bot-tooltip-card">
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles className="size-3 text-foreground stroke-[2.2]" />
          <span className="font-semibold text-xs tracking-tight text-foreground">Gippi AI</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Ask questions about your leads or draft follow-up messages.
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────────── component ───────────────────────────── */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function GippiBotAssist(props: GippiBotAssistProps) {
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [value, setValue] = useState("");
  const [lbl, setLbl] = useState<{ cur: string; prev: string | null; n: number }>({ cur: COPY.labels[0] ?? "Thinking", prev: null, n: 0 });
  const [answer, setAnswer] = useState("");
  const [dbgSpeed, setDbgSpeed] = useState(1);
  const [debug] = useState(() => typeof window !== "undefined" && /[?&]debug(?:[=&]|$)/.test(window.location.search));
  const [isFocused, setIsFocused] = useState(false);
  const [expanded, setExpanded] = useState(props.defaultExpanded ?? false);

  const rootRef = useRef<HTMLDivElement>(null);
  const moverRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const ghostRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const today = useToday();
  const { data: leads = [] } = useQuery(leadsQuery);

  const propsRef = useRef(props);
  propsRef.current = props;
  const speedRef = useRef(1);
  speedRef.current = Math.max(0.05, (props.speed ?? 1) * dbgSpeed);
  const phaseRef = useRef<Phase>("idle");
  const reducedRef = useRef(false);
  const rtRef = useRef<Runtime | null>(null);
  const lastTextRef = useRef("");
  const timers = useRef<{ typing?: number; shake?: number; flash?: number }>({});

  useIsoLayoutEffect(() => {
    const root = rootRef.current, mover = moverRef.current, actor = actorRef.current, canvas = canvasRef.current;
    const pulse = pulseRef.current, status = statusRef.current, form = formRef.current;
    const ghosts = ghostRefs.current.filter((g): g is HTMLSpanElement => !!g);
    if (!root || !mover || !actor || !canvas || !pulse || !status || !form) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onMq = (e: MediaQueryListEvent) => { reducedRef.current = e.matches; };
    mq.addEventListener("change", onMq);

    const rt = createRuntime({
      root, mover, actor, form, ghosts, canvas, pulse, status,
      getBody: () => bodyRef.current,
      getSpeed: () => speedRef.current,
      isReduced: () => reducedRef.current,
      ui: {
        setPhase: (p) => { phaseRef.current = p; setPhaseState(p); },
        swapLabel: (name) => setLbl((l) => (l.cur === name ? l : { cur: name, prev: l.cur, n: l.n + 1 })),
        resetLabel: () => setLbl((l) => ({ cur: COPY.labels[0] ?? "Thinking", prev: null, n: l.n + 1 })),
        setAnswer: (s) => setAnswer(s),
        clearInput: () => setValue(""),
        live: (s) => { if (liveRef.current) liveRef.current.textContent = s; },
        lock: (on) => { form.toggleAttribute("inert", on); },
        idleReady: () => {
          setExpanded(false);
          setIsFocused(false);
        },
        focusAnswer: () => { answerRef.current?.focus({ preventScroll: true }); },
      },
    });
    rtRef.current = rt;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phaseRef.current !== "idle" && phaseRef.current !== "reset") {
        e.preventDefault();
        rt.escape();
      }
    };
    const onResize = () => {
      if (phaseRef.current === "idle" && !rt.busy()) rt.home();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      mq.removeEventListener("change", onMq);
      window.clearTimeout(timers.current["typing"]);
      window.clearTimeout(timers.current["shake"]);
      window.clearTimeout(timers.current["flash"]);
      rt.destroy();
      rtRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!expanded || phase !== "idle") return;
    const handlePointerDown = (e: MouseEvent) => {
      if (actorRef.current && !actorRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [expanded, phase]);

  const defaultSubmit = async (queryText: string): Promise<string> => {
    try {
      const { askGippi } = await import("@/lib/leads.functions");
      const answer = await askGippi({ data: { queryText, today } });
      if (answer && typeof answer === "string" && answer.trim()) {
        return answer.trim();
      }
    } catch {
      // Gracefully fall back to local instant heuristic if offline or credentials issue
    }

    const lower = queryText.toLowerCase().trim();
    const isGreeting = /^(hi|hello|hey|hey hi|good morning|good afternoon|good evening|who are you|help|sup)\b/i.test(lower);
    if (isGreeting) {
      return `Hey! I am Gippi, your AI sales assistant. I have full context on all ${leads.length} leads across your pipeline. How can I help you today? You can ask me about hot deals, overdue follow-ups, specific reps, or message suggestions!`;
    }

    const hotLeads = leads.filter((l) => l.analysis?.classification === "Hot");
    const dueList = todaysFollowUps(leads, today);
    const overdueList = leads.filter(
      (l) => l.analysis && !l.analysis.do_not_contact && dueState(l.analysis.next_follow_up_date, today) === "overdue"
    );

    // Check if query is asking for a specific person
    const matchedLead = leads.find((l) => l.name.toLowerCase().split(" ").some((n) => lower.includes(n)));
    if (matchedLead) {
      const cls = matchedLead.analysis?.classification ?? "Active";
      const company = matchedLead.company ? ` at ${matchedLead.company}` : "";
      const reason = matchedLead.analysis?.reason ?? "Engagement in progress";
      return `${matchedLead.name}${company} is classified as ${cls}. Assessment: ${reason}`;
    }

    if (lower.includes("hot") || lower.includes("urgent")) {
      if (hotLeads.length === 0) {
        return "You currently have 0 hot leads. Review warm leads to identify high-potential prospects.";
      }
      const names = hotLeads.slice(0, 3).map((l) => l.name).join(", ");
      return `You have ${hotLeads.length} hot leads (${names}). Check their drafted messages to reach out quickly.`;
    } else if (lower.includes("today") || lower.includes("due")) {
      if (dueList.length === 0) {
        return "No follow-ups due today! You're completely caught up with your schedule.";
      }
      const names = dueList.slice(0, 3).map((l) => l.name).join(", ");
      return `You have ${dueList.length} follow-ups scheduled (${names}). Gippi pre-drafted personalized messages.`;
    } else if (lower.includes("overdue")) {
      if (overdueList.length === 0) {
        return "Clean board! You have 0 overdue follow-ups right now.";
      }
      return `You have ${overdueList.length} overdue follow-ups that need your attention to maintain deal momentum.`;
    } else if (lower.includes("summary") || lower.includes("pipeline") || lower.includes("status")) {
      return `Active pipeline: ${leads.length} total leads, ${hotLeads.length} hot deals, and ${dueList.length} follow-ups due today.`;
    }

    return `I have real-time visibility on all ${leads.length} leads in your pipeline, including ${hotLeads.length} hot deals and ${dueList.length} follow-ups scheduled today. How can I assist you with your prospects?`;
  };

  const makeCfg = (): RunCfg => ({
    onSubmit: propsRef.current.onSubmit ?? defaultSubmit,
    minThink: propsRef.current.minThinkMs ?? 2800,
  });

  const shake = () => {
    const a = actorRef.current;
    if (!a) return;
    a.removeAttribute("data-shake");
    void a.offsetWidth;
    a.setAttribute("data-shake", "");
    a.setAttribute("data-flash", "");
    window.clearTimeout(timers.current["shake"]);
    window.clearTimeout(timers.current["flash"]);
    timers.current["shake"] = window.setTimeout(() => a.removeAttribute("data-shake"), 260);
    timers.current["flash"] = window.setTimeout(() => a.removeAttribute("data-flash"), 200);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    const a = actorRef.current;
    if (!a) return;
    a.setAttribute("data-typing", "");
    window.clearTimeout(timers.current["typing"]);
    timers.current["typing"] = window.setTimeout(() => a.removeAttribute("data-typing"), 300);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onFormSubmit(e);
    }
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rt = rtRef.current;
    if (!rt || rt.busy() || phaseRef.current !== "idle") return;
    const text = (inputRef.current?.value || value).trim();
    if (!text) { shake(); return; }
    lastTextRef.current = text;
    rt.start(text, makeCfg());
  };

  const onReset = () => {
    if (phaseRef.current === "answered") rtRef.current?.reset();
  };

  const onBackdropClick = () => {
    if (phaseRef.current !== "idle" && phaseRef.current !== "reset") {
      rtRef.current?.escape();
    }
  };

  // Auto-collapse smoothly back to circular Gippi bot profile after reading answer
  useEffect(() => {
    if (phase === "answered") {
      const timer = window.setTimeout(() => {
        if (phaseRef.current === "answered") {
          rtRef.current?.reset();
        }
      }, 7500);
      return () => window.clearTimeout(timer);
    }
  }, [phase]);

  const replay = () => {
    const rt = rtRef.current;
    if (!rt) return;
    const text = lastTextRef.current || "Check hot leads";
    lastTextRef.current = text;
    rt.hard();
    setValue(text);
    window.requestAnimationFrame(() => { rt.start(text, makeCfg()); });
  };

  const ready = value.trim().length > 0;
  const words = answer.split(/\s+/).filter(Boolean);

  const labelInner = (name: string) =>
    name === COPY.done ? (
      <span className="mo-lab-done">{name}</span>
    ) : (
      <>
        <span className="mo-lab-t">{name}</span>
        <span className="mo-dots" aria-hidden="true"><i /><i /><i /></span>
      </>
    );

  const isFixed = props.fixed ?? false;

  return (
    <div
      className={`mo-root ${isFixed ? "mo-fixed-desktop" : ""} ${props.className || ""}`}
      data-phase={phase}
      ref={rootRef}
    >
      <div className="mo-bg" aria-hidden="true" onClick={onBackdropClick} />
      <div className="mo-halo" aria-hidden="true" />

      <div className="mo-mover" ref={moverRef}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="mo-trail" aria-hidden="true" ref={(el) => { ghostRefs.current[i] = el; }} />
        ))}

        <div
          className="mo-actor"
          data-focused={isFocused ? "" : undefined}
          data-expanded={expanded ? "true" : "false"}
          title={expanded ? undefined : "Ask Gippi assistant"}
          ref={actorRef}
          onClick={(e) => {
            if (phaseRef.current === "idle") {
              if (!expanded) {
                setExpanded(true);
                setTimeout(() => inputRef.current?.focus(), 60);
                return;
              }
              const target = e.target as HTMLElement | null;
              if (target && (target.closest(".mo-send") || target.closest(".mo-collapse-btn"))) return;
              inputRef.current?.focus();
            }
          }}
        >
          <div className="mo-underglow" aria-hidden="true" />
          <div className="mo-halo-green" aria-hidden="true" />
          <div className="mo-surface" aria-hidden="true">
            <div className="mo-aurora"><i /><i /><i /><i /><i /></div>
          </div>
          <div className="mo-ball" aria-hidden="true" />
          <div className="mo-green" aria-hidden="true" />
          <div className="mo-card" aria-hidden="true" />
          <div className="mo-ring" aria-hidden="true" />

          {/* Sleeping "?????" animation replacing previous arc text */}
          <GippiSleepingQuestions expanded={expanded} phase={phase} />

          {/* Hover tooltip card showing what Gippi bot can do */}
          <GippiBotTooltip expanded={expanded} phase={phase} />

          <form
            className="mo-input cursor-text"
            ref={formRef}
            onSubmit={onFormSubmit}
            autoComplete="off"
            onClick={(e) => {
              if (phaseRef.current === "idle" && !expanded) {
                setExpanded(true);
                setTimeout(() => inputRef.current?.focus(), 60);
                return;
              }
              const target = e.target as HTMLElement | null;
              if (target && (target.closest(".mo-send") || target.closest(".mo-collapse-btn"))) return;
              inputRef.current?.focus();
            }}
          >
            <span
              className="mo-spark flex items-center justify-center shrink-0 cursor-pointer"
              aria-hidden="true"
              onClick={() => {
                if (!expanded) {
                  setExpanded(true);
                  setTimeout(() => inputRef.current?.focus(), 60);
                }
              }}
            >
              <img
                src="/bot-icon-dark.svg"
                alt=""
                className="w-[42px] h-[42px] size-[42px] shrink-0 inline-block dark:hidden select-none pointer-events-none"
              />
              <img
                src="/bot-icon-light.svg"
                alt=""
                className="w-[42px] h-[42px] size-[42px] shrink-0 hidden dark:inline-block select-none pointer-events-none"
              />
            </span>
            <input
              ref={inputRef}
              className="mo-field"
              type="text"
              value={value}
              maxLength={200}
              placeholder={props.placeholder ?? COPY.placeholder}
              aria-label="Ask Gippi anything"
              spellCheck={false}
              onChange={onChange}
              onKeyDown={onKeyDown}
              onFocus={() => {
                setExpanded(true);
                setIsFocused(true);
              }}
              onBlur={() => setIsFocused(false)}
            />
            <div className="mo-actions flex items-center gap-2 shrink-0">
              <button
                type="submit"
                className="mo-send"
                aria-label={COPY.send}
                data-ready={ready ? "" : undefined}
              >
                <ArrowUp aria-hidden="true" />
              </button>
              <button
                type="button"
                className="mo-collapse-btn"
                aria-label="Close assistant"
                title="Close"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(false);
                }}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </form>

          <canvas className="mo-orb" ref={canvasRef} aria-hidden="true" />
          <div className="mo-pulse" ref={pulseRef} aria-hidden="true" />

          <div className="mo-answer" ref={answerRef} tabIndex={-1} role="group" aria-label="gippi answer">
            <p className="mo-a-body" ref={bodyRef}>
              <span className="mo-a-prefix inline-flex items-center gap-1.5 font-bold mr-1.5 select-none align-middle -translate-y-px">
                <img
                  src="/bot-icon-dark.svg"
                  alt=""
                  aria-hidden="true"
                  className="size-4 shrink-0 inline-block dark:hidden select-none pointer-events-none"
                />
                <img
                  src="/bot-icon-light.svg"
                  alt=""
                  aria-hidden="true"
                  className="size-4 shrink-0 hidden dark:inline-block select-none pointer-events-none"
                />
                <span>gippi:</span>
              </span>
              {words.map((w, i) => (
                <React.Fragment key={i}>
                  <span className="mo-w">{w}</span>{" "}
                </React.Fragment>
              ))}
            </p>
          </div>
        </div>
      </div>

      <div className="mo-status" ref={statusRef} aria-hidden="true">
        {lbl.prev !== null && (
          <span key={"p" + lbl.n} className="mo-lab mo-out">{labelInner(lbl.prev)}</span>
        )}
        <span key={"c" + lbl.n} className="mo-lab mo-in">{labelInner(lbl.cur)}</span>
      </div>

      <button type="button" className="mo-reset" onClick={onReset}>{COPY.reset}</button>

      <div className="mo-live" ref={liveRef} role="status" aria-live="polite" />

      {debug && (
        <div className="mo-debug">
          <span className="mo-chip">{phase}</span>
          <label>
            <span>{dbgSpeed.toFixed(2)}×</span>
            <input
              type="range"
              min={0.25}
              max={2}
              step={0.05}
              value={dbgSpeed}
              aria-label="Speed"
              onChange={(e) => setDbgSpeed(parseFloat(e.target.value))}
            />
          </label>
          <button type="button" onClick={replay}>Replay</button>
        </div>
      )}
    </div>
  );
}

export const MorphOrb = GippiBotAssist;
export default GippiBotAssist;
