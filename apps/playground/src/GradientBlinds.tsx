/*
  Adapted from Gradient Blinds by David Haz, React Bits (https://reactbits.dev/backgrounds/gradient-blinds).
  Copyright (c) 2026 David Haz. Used under the MIT + Commons Clause License Condition v1.0, which
  permits use as part of a website and requires this notice. Not part of the published package.

  Changes: TypeScript; pauses offscreen, in background tabs, and under reduced motion (one still
  frame); renders at half density and 30 fps; follows the pointer across a host element; falls
  back to CSS without WebGL.
*/
import { useEffect, useRef, type RefObject } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';

const MAX_COLORS = 8;

const hexToRGB = (hex: string): [number, number, number] => {
  const c = hex.replace('#', '').padEnd(6, '0');
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ];
};

function prepStops(stops: string[]) {
  const base = (stops.length ? stops : ['#FF9FFC', '#5227FF']).slice(0, MAX_COLORS);
  if (base.length === 1) base.push(base[0]);
  while (base.length < MAX_COLORS) base.push(base[base.length - 1]);
  return {
    arr: base.map(hexToRGB),
    count: Math.max(2, Math.min(MAX_COLORS, stops.length || 2)),
  };
}

const vertex = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = /* glsl */ `
#ifdef GL_ES
precision mediump float;
#endif
uniform vec3 iResolution;
uniform vec2 iMouse;
uniform float iTime;
uniform float uAngle;
uniform float uNoise;
uniform float uBlindCount;
uniform float uSpotlightRadius;
uniform float uSpotlightSoftness;
uniform float uSpotlightOpacity;
uniform float uMirror;
uniform float uDistort;
uniform float uShineFlip;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform vec3 uColor5;
uniform vec3 uColor6;
uniform vec3 uColor7;
uniform int uColorCount;
varying vec2 vUv;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 rotate2D(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c) * p;
}

vec3 getGradientColor(float t) {
  float tt = clamp(t, 0.0, 1.0);
  int count = uColorCount;
  if (count < 2) count = 2;
  float scaled = tt * float(count - 1);
  float seg = floor(scaled);
  float f = fract(scaled);
  if (seg < 1.0) return mix(uColor0, uColor1, f);
  if (seg < 2.0 && count > 2) return mix(uColor1, uColor2, f);
  if (seg < 3.0 && count > 3) return mix(uColor2, uColor3, f);
  if (seg < 4.0 && count > 4) return mix(uColor3, uColor4, f);
  if (seg < 5.0 && count > 5) return mix(uColor4, uColor5, f);
  if (seg < 6.0 && count > 6) return mix(uColor5, uColor6, f);
  if (seg < 7.0 && count > 7) return mix(uColor6, uColor7, f);
  if (count > 7) return uColor7;
  if (count > 6) return uColor6;
  if (count > 5) return uColor5;
  if (count > 4) return uColor4;
  if (count > 3) return uColor3;
  if (count > 2) return uColor2;
  return uColor1;
}

void main() {
  vec2 fragCoord = vUv * iResolution.xy;
  vec2 uv0 = fragCoord.xy / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 p = uv0 * 2.0 - 1.0;
  p.x *= aspect;
  vec2 pr = rotate2D(p, uAngle);
  pr.x /= aspect;
  vec2 uv = pr * 0.5 + 0.5;
  vec2 uvMod = uv;
  if (uDistort > 0.0) {
    float a = uvMod.y * 6.0;
    float b = uvMod.x * 6.0;
    float w = 0.01 * uDistort;
    uvMod.x += sin(a) * w;
    uvMod.y += cos(b) * w;
  }
  float t = uvMod.x;
  if (uMirror > 0.5) {
    t = 1.0 - abs(1.0 - 2.0 * fract(t));
  }
  vec3 base = getGradientColor(t);
  vec2 offset = vec2(iMouse.x / iResolution.x, iMouse.y / iResolution.y);
  float d = length(uv0 - offset);
  float r = max(uSpotlightRadius, 1e-4);
  float dn = d / r;
  float spot = (1.0 - 2.0 * pow(dn, uSpotlightSoftness)) * uSpotlightOpacity;
  vec3 cir = vec3(spot);
  float blindCount = max(uBlindCount, 1.0);
  float stripe = fract(uvMod.x * blindCount);
  float stripeAA = clamp(blindCount * 1.25 / min(iResolution.x, iResolution.y), 0.001, 0.12);
  float edgeDistance = min(stripe, 1.0 - stripe);
  float edgeBlend = 1.0 - smoothstep(0.0, stripeAA, edgeDistance);
  stripe = mix(stripe, 0.5, edgeBlend);
  if (uShineFlip > 0.5) stripe = 1.0 - stripe;
  vec3 col = cir + base - vec3(stripe);
  col += (rand(gl_FragCoord.xy + iTime) - 0.5) * uNoise;
  gl_FragColor = vec4(col, 1.0);
}
`;

export interface GradientBlindsProps {
  className?: string;
  gradientColors: string[];
  angle?: number;
  noise?: number;
  blindCount?: number;
  blindMinWidth?: number;
  mouseDampening?: number;
  mirrorGradient?: boolean;
  spotlightRadius?: number;
  spotlightSoftness?: number;
  spotlightOpacity?: number;
  distortAmount?: number;
  shineDirection?: 'left' | 'right';
  /** Where pointer movement steers the spotlight: an element, the whole window, or the container. */
  pointerTarget?: RefObject<HTMLElement | null> | 'window';
}

export function GradientBlinds({
  className = '',
  gradientColors,
  angle = 0,
  noise = 0.3,
  blindCount = 16,
  blindMinWidth = 60,
  mouseDampening = 0.15,
  mirrorGradient = false,
  spotlightRadius = 0.5,
  spotlightSoftness = 1,
  spotlightOpacity = 1,
  distortAmount = 0,
  shineDirection = 'left',
  pointerTarget,
}: GradientBlindsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const colors = gradientColors.join(',');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let renderer: Renderer;
    try {
      // Soft stripes and grain do not need full resolution: half density keeps the GPU idle.
      renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio || 1, 2) * 0.5,
        alpha: true,
      });
    } catch {
      container.dataset.fallback = 'true';
      return;
    }
    const gl = renderer.gl;
    if (!gl) {
      container.dataset.fallback = 'true';
      return;
    }
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const { arr, count } = prepStops(colors.split(','));
    const uniforms: Record<string, { value: unknown }> = {
      iResolution: { value: [gl.drawingBufferWidth, gl.drawingBufferHeight, 1] },
      iMouse: { value: [0, 0] },
      iTime: { value: 0 },
      uAngle: { value: (angle * Math.PI) / 180 },
      uNoise: { value: noise },
      uBlindCount: { value: Math.max(1, blindCount) },
      uSpotlightRadius: { value: spotlightRadius },
      uSpotlightSoftness: { value: spotlightSoftness },
      uSpotlightOpacity: { value: spotlightOpacity },
      uMirror: { value: mirrorGradient ? 1 : 0 },
      uDistort: { value: distortAmount },
      uShineFlip: { value: shineDirection === 'right' ? 1 : 0 },
      uColorCount: { value: count },
    };
    arr.forEach((color, index) => (uniforms[`uColor${index}`] = { value: color }));
    const program = new Program(gl, { vertex, fragment, uniforms });
    const geometry = new Triangle(gl);
    const mesh = new Mesh(gl, { geometry, program });
    const mouse = uniforms.iMouse.value as number[];
    const target = [0, 0];
    let centered = false;

    const draw = () => renderer.render({ scene: mesh });
    const resize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1];
      const byWidth = Math.max(1, Math.floor(rect.width / blindMinWidth));
      uniforms.uBlindCount.value = Math.max(1, Math.min(blindCount, byWidth));
      if (!centered) {
        centered = true;
        mouse[0] = target[0] = gl.drawingBufferWidth / 2;
        mouse[1] = target[1] = gl.drawingBufferHeight * 0.62;
      }
      draw();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const host: HTMLElement | Window =
      pointerTarget === 'window' ? window : (pointerTarget?.current ?? container);
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scale = renderer.dpr || 1;
      target[0] = (event.clientX - rect.left) * scale;
      target[1] = (rect.height - (event.clientY - rect.top)) * scale;
    };
    host.addEventListener('pointermove', onPointerMove as EventListener);

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let visible = true;
    let frame = 0;
    let last = 0;
    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      // Thirty frames a second is plenty for a slow spotlight.
      if (!visible || document.hidden || time - last < 32) return;
      uniforms.iTime.value = time * 0.001;
      const dt = last ? (time - last) / 1000 : 0;
      last = time;
      const factor = Math.min(1, 1 - Math.exp(-dt / Math.max(1e-4, mouseDampening)));
      mouse[0] += (target[0] - mouse[0]) * factor;
      mouse[1] += (target[1] - mouse[1]) * factor;
      draw();
    };
    const intersection = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    intersection.observe(container);
    if (!reduced) frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      intersection.disconnect();
      resizeObserver.disconnect();
      host.removeEventListener('pointermove', onPointerMove as EventListener);
      canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [
    colors,
    angle,
    noise,
    blindCount,
    blindMinWidth,
    mouseDampening,
    mirrorGradient,
    spotlightRadius,
    spotlightSoftness,
    spotlightOpacity,
    distortAmount,
    shineDirection,
    pointerTarget,
  ]);

  return <div ref={containerRef} className={`gradient-blinds ${className}`} aria-hidden="true" />;
}
