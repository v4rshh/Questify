'use client';

import { memo, useEffect, useId, useRef } from 'react';
import type { HTMLAttributes } from 'react';

const TWO_PI = Math.PI * 2;

interface Dot {
  ax: number;
  ay: number;
  sx: number;
  sy: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

interface DotFieldProps extends HTMLAttributes<HTMLDivElement> {
  dotRadius?: number;
  dotSpacing?: number;
  cursorRadius?: number;
  cursorForce?: number;
  bulgeOnly?: boolean;
  bulgeStrength?: number;
  glowRadius?: number;
  sparkle?: boolean;
  waveAmplitude?: number;
  gradientFrom?: string;
  gradientTo?: string;
  glowColor?: string;
}

const DotField = memo(function DotField({
  dotRadius = 1.5,
  dotSpacing = 14,
  cursorRadius = 500,
  cursorForce = 0.1,
  bulgeOnly = true,
  bulgeStrength = 67,
  glowRadius = 160,
  sparkle = false,
  waveAmplitude = 0,
  gradientFrom = 'rgba(47, 91, 73, 0.2)',
  gradientTo = 'rgba(194, 118, 66, 0.12)',
  glowColor = 'rgba(228, 239, 233, 0.72)',
  className,
  ...rest
}: DotFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999, prevX: -9999, prevY: -9999, speed: 0 });
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, offsetX: 0, offsetY: 0 });
  const glowOpacity = useRef(0);
  const engagement = useRef(0);
  const propsRef = useRef({
    dotRadius,
    dotSpacing,
    cursorRadius,
    cursorForce,
    bulgeOnly,
    bulgeStrength,
    sparkle,
    waveAmplitude,
    gradientFrom,
    gradientTo,
  });
  const rebuildRef = useRef<(() => void) | null>(null);
  const glowId = `dot-field-glow-${useId().replace(/:/g, '')}`;

  propsRef.current = {
    dotRadius,
    dotSpacing,
    cursorRadius,
    cursorForce,
    bulgeOnly,
    bulgeStrength,
    sparkle,
    waveAmplitude,
    gradientFrom,
    gradientTo,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const glowElement = glowRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;
    const canvasElement: HTMLCanvasElement = canvas;
    const drawingContext: CanvasRenderingContext2D = context;

    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let resizeTimer: ReturnType<typeof setTimeout>;
    let frameCount = 0;
    let visible = !document.hidden;

    function buildDots(width: number, height: number) {
      const settings = propsRef.current;
      const step = settings.dotRadius + settings.dotSpacing;
      const columns = Math.floor(width / step);
      const rows = Math.floor(height / step);
      const paddingX = (width % step) / 2;
      const paddingY = (height % step) / 2;
      const dots: Dot[] = new Array(rows * columns);
      let index = 0;

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const ax = paddingX + column * step + step / 2;
          const ay = paddingY + row * step + step / 2;
          dots[index] = { ax, ay, sx: ax, sy: ay, vx: 0, vy: 0, x: ax, y: ay };
          index += 1;
        }
      }
      dotsRef.current = dots;
    }

    function draw() {
      const dots = dotsRef.current;
      const mouse = mouseRef.current;
      const { w: width, h: height } = sizeRef.current;
      const settings = propsRef.current;
      const time = frameCount * 0.02;
      const targetEngagement = reduceMotion ? 0 : Math.min(mouse.speed / 5, 1);

      engagement.current += (targetEngagement - engagement.current) * 0.06;
      if (engagement.current < 0.001) engagement.current = 0;
      glowOpacity.current += (engagement.current - glowOpacity.current) * 0.08;

      if (glowElement) {
        glowElement.setAttribute('cx', String(mouse.x));
        glowElement.setAttribute('cy', String(mouse.y));
        glowElement.style.opacity = String(glowOpacity.current);
      }

      drawingContext.clearRect(0, 0, width, height);
      const gradient = drawingContext.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, settings.gradientFrom);
      gradient.addColorStop(1, settings.gradientTo);
      drawingContext.fillStyle = gradient;
      drawingContext.beginPath();

      const cursorRadiusSquared = settings.cursorRadius * settings.cursorRadius;
      const radius = settings.dotRadius / 2;

      dots.forEach((dot, index) => {
        const deltaX = mouse.x - dot.ax;
        const deltaY = mouse.y - dot.ay;
        const distanceSquared = deltaX * deltaX + deltaY * deltaY;

        if (distanceSquared < cursorRadiusSquared && engagement.current > 0.01) {
          const distance = Math.max(1, Math.sqrt(distanceSquared));
          const angle = Math.atan2(deltaY, deltaX);
          if (settings.bulgeOnly) {
            const strength = 1 - distance / settings.cursorRadius;
            const push = strength * strength * settings.bulgeStrength * engagement.current;
            dot.sx += (dot.ax - Math.cos(angle) * push - dot.sx) * 0.15;
            dot.sy += (dot.ay - Math.sin(angle) * push - dot.sy) * 0.15;
          } else {
            const move = (500 / distance) * (mouse.speed * settings.cursorForce);
            dot.vx -= Math.cos(angle) * move;
            dot.vy -= Math.sin(angle) * move;
          }
        } else if (settings.bulgeOnly) {
          dot.sx += (dot.ax - dot.sx) * 0.1;
          dot.sy += (dot.ay - dot.sy) * 0.1;
        }

        if (!settings.bulgeOnly) {
          dot.vx *= 0.9;
          dot.vy *= 0.9;
          dot.x = dot.ax + dot.vx;
          dot.y = dot.ay + dot.vy;
          dot.sx += (dot.x - dot.sx) * 0.1;
          dot.sy += (dot.y - dot.sy) * 0.1;
        }

        let drawX = dot.sx;
        let drawY = dot.sy;
        if (settings.waveAmplitude > 0) {
          drawY += Math.sin(dot.ax * 0.03 + time) * settings.waveAmplitude;
          drawX += Math.cos(dot.ay * 0.03 + time * 0.7) * settings.waveAmplitude * 0.5;
        }

        const sparkleRadius =
          settings.sparkle && (((index * 2654435761) ^ (frameCount >> 3)) >>> 0) % 100 < 3
            ? radius * 1.8
            : radius;
        drawingContext.moveTo(drawX + sparkleRadius, drawY);
        drawingContext.arc(drawX, drawY, sparkleRadius, 0, TWO_PI);
      });

      drawingContext.fill();
    }

    function tick() {
      frameCount += 1;
      draw();
      if (!reduceMotion && visible) rafRef.current = requestAnimationFrame(tick);
    }

    function resizeNow() {
      const rect = canvasElement.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const width = rect.width;
      const height = rect.height;
      canvasElement.width = width * devicePixelRatio;
      canvasElement.height = height * devicePixelRatio;
      canvasElement.style.width = `${width}px`;
      canvasElement.style.height = `${height}px`;
      drawingContext.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      sizeRef.current = {
        w: width,
        h: height,
        offsetX: rect.left + window.scrollX,
        offsetY: rect.top + window.scrollY,
      };
      buildDots(width, height);
      if (reduceMotion) draw();
    }

    function resize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resizeNow, 100);
    }

    function updatePointer(event: MouseEvent) {
      const size = sizeRef.current;
      mouseRef.current.x = event.pageX - size.offsetX;
      mouseRef.current.y = event.pageY - size.offsetY;
    }

    function updatePointerSpeed() {
      const mouse = mouseRef.current;
      const deltaX = mouse.prevX - mouse.x;
      const deltaY = mouse.prevY - mouse.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      mouse.speed += (distance - mouse.speed) * 0.5;
      if (mouse.speed < 0.001) mouse.speed = 0;
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;
    }

    function handleVisibility() {
      visible = !document.hidden;
      if (visible && !reduceMotion && rafRef.current === null) {
        rafRef.current = requestAnimationFrame(tick);
      }
      if (!visible && rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }

    resizeNow();
    const speedInterval = reduceMotion ? undefined : window.setInterval(updatePointerSpeed, 20);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibility);
    if (!reduceMotion) {
      window.addEventListener('mousemove', updatePointer, { passive: true });
      rafRef.current = requestAnimationFrame(tick);
    }

    rebuildRef.current = () => {
      const { w: width, h: height } = sizeRef.current;
      if (width > 0 && height > 0) {
        buildDots(width, height);
        if (reduceMotion) draw();
      }
    };

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (speedInterval !== undefined) clearInterval(speedInterval);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', updatePointer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    rebuildRef.current?.();
  }, [dotRadius, dotSpacing, gradientFrom, gradientTo]);

  return (
    <div className={className} {...rest}>
      <canvas ref={canvasRef} className="dot-field-canvas" />
      <svg className="dot-field-glow" aria-hidden="true">
        <defs>
          <radialGradient id={glowId}>
            <stop offset="0%" stopColor={glowColor} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <circle
          ref={glowRef}
          cx="-9999"
          cy="-9999"
          r={glowRadius}
          fill={`url(#${glowId})`}
          style={{ opacity: 0, willChange: 'opacity' }}
        />
      </svg>
    </div>
  );
});

DotField.displayName = 'DotField';

export default DotField;
