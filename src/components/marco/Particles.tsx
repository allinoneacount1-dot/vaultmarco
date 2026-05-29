import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
}

export function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>();
  const timeRef = useRef(0);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    return () => window.removeEventListener("resize", updateDimensions);
  }, [isClient]);

  useEffect(() => {
    if (!isClient || !canvasRef.current || dimensions.width === 0 || prefersReducedMotion) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const colors = [
      "rgba(145, 231, 255, 0.6)",
      "rgba(180, 255, 200, 0.5)",
      "rgba(190, 150, 255, 0.5)",
      "rgba(255, 180, 200, 0.4)",
      "rgba(255, 230, 150, 0.4)",
    ];

    const initParticles = () => {
      const particles: Particle[] = [];
      const numParticles = Math.floor((dimensions.width * dimensions.height) / 8000);

      for (let i = 0; i < numParticles; i++) {
        particles.push({
          x: Math.random() * dimensions.width,
          y: Math.random() * dimensions.height,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          size: Math.random() * 4 + 1,
          opacity: Math.random() * 0.6 + 0.2,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.02,
        });
      }
      particlesRef.current = particles;
    };

    const animate = () => {
      timeRef.current += 0.01;
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      particlesRef.current.forEach((particle, i) => {
        particle.x += particle.vx + Math.sin(timeRef.current + i) * 0.2;
        particle.y += particle.vy + Math.cos(timeRef.current + i) * 0.2;
        particle.rotation += particle.rotationSpeed;

        if (particle.x < 0 || particle.x > dimensions.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > dimensions.height) particle.vy *= -1;

        const dx = mouseRef.current.x - particle.x;
        const dy = mouseRef.current.y - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 200) {
          const force = (200 - distance) / 200;
          particle.x -= dx * force * 0.03;
          particle.y -= dy * force * 0.03;
        }

        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        
        const pulse = Math.sin(timeRef.current * 2 + i) * 0.3 + 1;
        ctx.beginPath();
        ctx.arc(0, 0, particle.size * pulse, 0, Math.PI * 2);
        const alpha = particle.opacity * (0.5 + Math.sin(timeRef.current + i) * 0.3);
        ctx.fillStyle = particle.color.replace(/[\d.]+\)$/, `${alpha.toFixed(2)})`);
        ctx.fill();
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = particle.color;
        ctx.fill();
        ctx.restore();

        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const other = particlesRef.current[j];
          const dx2 = particle.x - other.x;
          const dy2 = particle.y - other.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (dist2 < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(145, 231, 255, ${0.2 * (1 - dist2 / 150) * (0.5 + Math.sin(timeRef.current) * 0.3)})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    initParticles();
    animate();
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [dimensions, isClient, prefersReducedMotion]);

  if (!isClient || prefersReducedMotion) return null;

  return (
    <motion.canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
    />
  );
}
