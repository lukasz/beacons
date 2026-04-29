import { useState, useCallback, useEffect } from 'react';
import { handlerRegistry } from '../state/handlerRegistry';

interface Particle {
  id: number;
  emoji: string;
  // Launch angle and velocity for confetti-gun physics
  angle: number;    // radians, from bottom-left
  speed: number;    // px
  spin: number;     // degrees
  size: number;     // rem
  delay: number;    // seconds
  duration: number; // seconds
}

let nextId = 0;

export default function ReactionRain() {
  const [particles, setParticles] = useState<Particle[]>([]);

  const triggerRain = useCallback((emoji: string) => {
    const count = 35 + Math.floor(Math.random() * 15);
    const newParticles: Particle[] = [];
    // Scale speed to viewport so confetti covers ~75% of the screen diagonal
    const diagonal = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
    const baseSpeed = diagonal * 0.25;
    const speedRange = diagonal * 0.35;
    for (let i = 0; i < count; i++) {
      // Spread from bottom-left corner, fanning upward and to the right
      const angle = (0.35 + Math.random() * 1.0); // ~20° to ~77° from horizontal
      const speed = baseSpeed + Math.random() * speedRange;
      newParticles.push({
        id: nextId++,
        emoji,
        angle,
        speed,
        spin: 0, // no self-rotation
        size: 1.0 + Math.random() * 1.4,
        delay: Math.random() * 0.4,
        duration: 2.5 + Math.random() * 2.0,
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);

    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.includes(p)));
    }, 5000);
  }, []);

  useEffect(() => {
    handlerRegistry.setReactionHandler(triggerRain);
    return () => { handlerRegistry.setReactionHandler(null); };
  }, [triggerRain]);

  if (particles.length === 0) return null;

  return (
    <div className="reaction-rain">
      {particles.map((p) => {
        // Compute end position relative to bottom-left origin
        const endX = Math.cos(p.angle) * p.speed;
        const endY = -Math.sin(p.angle) * p.speed; // negative = upward
        return (
          <span
            key={p.id}
            className="reaction-particle"
            style={{
              left: 30,
              bottom: 30,
              fontSize: `${p.size}rem`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--end-x': `${endX}px`,
              '--end-y': `${endY}px`,
              '--spin': `${p.spin}deg`,
            } as React.CSSProperties}
          >
            {p.emoji}
          </span>
        );
      })}
    </div>
  );
}
