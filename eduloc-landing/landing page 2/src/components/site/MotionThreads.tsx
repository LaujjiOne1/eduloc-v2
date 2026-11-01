import { useEffect, useRef } from "react";

/** Lightweight canvas interpretation of the supplied WebThreads reference. */
export const MotionThreads = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let tick = 0;
    let pointer = 0;
    const colors = ["--violet", "--emerald", "--primary"];
    const draw = () => {
      cancelAnimationFrame(frame);
      const { width, height } = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const styles = getComputedStyle(canvas);
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `hsl(${styles.getPropertyValue(colors[i % 3])} / 0.45)`;
        for (let x = 0; x <= width; x += 5) {
          const wave = Math.sin(x / Math.max(width, 1) * 7 + tick + i * 0.3);
          const y = height * 0.52 + wave * height * (0.1 + i * 0.012) + i * 9 + pointer * 12;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      tick += 0.008;
      if (!reduced.matches) frame = requestAnimationFrame(draw);
    };
    const move = (event: PointerEvent) => { pointer = event.clientX / window.innerWidth - 0.5; };
    draw();
    window.addEventListener("pointermove", move);
    window.addEventListener("resize", draw);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("pointermove", move); window.removeEventListener("resize", draw); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
};