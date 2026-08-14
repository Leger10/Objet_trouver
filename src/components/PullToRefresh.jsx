import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

const THRESHOLD = 70;
const MAX = 110;

/**
 * Native-style pull-to-refresh wrapper.
 * Wraps scrollable page content; calls onRefresh (async) when pulled past threshold.
 */
const PullToRefresh = ({ onRefresh, children, className = '' }) => {
    const [pull, setPull] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const startY = useRef(null);
    const top = useRef(0);

    const onTouchStart = (e) => {
        if (refreshing) return;
        top.current = window.scrollY || 0;
        startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
        if (startY.current == null || refreshing) return;
        const dy = e.touches[0].clientY - startY.current;
        if (dy > 0 && top.current <= 0) {
            const resisted = Math.min(MAX, dy * 0.5);
            setPull(resisted);
        }
    };

    const onTouchEnd = useCallback(async () => {
        if (startY.current == null) return;
        startY.current = null;
        if (pull >= THRESHOLD && !refreshing) {
            setRefreshing(true);
            setPull(THRESHOLD);
            try {
                await onRefresh?.();
            } finally {
                setRefreshing(false);
                setPull(0);
            }
        } else {
            setPull(0);
        }
    }, [pull, refreshing, onRefresh]);

    useEffect(() => {
        if (!pull && !refreshing) return;
        document.body.style.overscrollBehaviorY = 'contain';
        return () => {
            document.body.style.overscrollBehaviorY = '';
        };
    }, [pull, refreshing]);

    const pct = Math.min(1, pull / THRESHOLD);

    return (
        <div className={className} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <div
                className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
                style={{ height: pull }}
                aria-hidden="true"
            >
                {refreshing ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : (
                    <RefreshCw
                        className="h-6 w-6 text-primary transition-transform"
                        style={{ transform: `rotate(${pct * 360}deg)`, opacity: pct }}
                    />
                )}
            </div>
            {children}
        </div>
    );
};

export default PullToRefresh;
