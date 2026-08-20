import React, { useEffect, useRef, useState } from 'react';

const AutoScrollRow = ({ children, autoPlay = false, speed = 0.4, className = '' }) => {
  const ref = useRef(null);
  const rafRef = useRef(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    if (!autoPlay || !ref.current) return;
    const el = ref.current;

    const tick = () => {
      if (!pausedRef.current && el) {
        const max = el.scrollWidth - el.clientWidth;
        if (max > 0) {
          el.scrollLeft += speed;
          if (el.scrollLeft >= max - 1) el.scrollLeft = 0;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [autoPlay, speed]);

  const onPointerDown = (e) => {
    if (autoPlay) { pausedRef.current = true; setPaused(true); }
    dragRef.current = { active: true, startX: e.clientX, scrollLeft: ref.current?.scrollLeft || 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d.active || !ref.current) return;
    ref.current.scrollLeft = d.scrollLeft - (e.clientX - d.startX);
  };

  const onPointerUp = () => {
    dragRef.current.active = false;
    if (autoPlay) {
      setTimeout(() => { pausedRef.current = false; setPaused(false); }, 2500);
    }
  };

  return (
    <div className={className}>
      <div
        ref={ref}
        className="flex gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
      </div>
      {autoPlay && (
        <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          {paused ? 'Glissez manuellement' : 'Défilement automatique'}
        </div>
      )}
    </div>
  );
};

export default AutoScrollRow;
