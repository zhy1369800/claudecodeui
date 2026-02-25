import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'mobileNavHandlePosition';
const MOBILE_NAV_REVEAL_EVENT = 'mobile-nav:reveal';
const DEFAULT_POSITION_PERCENT = 5;
const DRAG_THRESHOLD_PX = 5;
const MIN_POSITION_PERCENT = 0;
const MAX_POSITION_PERCENT = 90;

export { MOBILE_NAV_REVEAL_EVENT };

export function emitMobileNavRevealEvent() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(MOBILE_NAV_REVEAL_EVENT));
}

function readSavedPosition() {
  if (typeof window === 'undefined') {
    return DEFAULT_POSITION_PERCENT;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return DEFAULT_POSITION_PERCENT;
  }

  try {
    const parsed = JSON.parse(rawValue);
    const nextPosition = Number(parsed?.y);
    if (Number.isFinite(nextPosition)) {
      return Math.max(MIN_POSITION_PERCENT, Math.min(MAX_POSITION_PERCENT, nextPosition));
    }
  } catch {
    return DEFAULT_POSITION_PERCENT;
  }

  return DEFAULT_POSITION_PERCENT;
}

export function useDraggableMobileNav({ enabled, autoHideDelayMs = 5000 }) {
  const [positionPercent, setPositionPercent] = useState(readSavedPosition);
  const [isVisible, setIsVisible] = useState(Boolean(enabled));
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);

  const hideTimerRef = useRef(null);
  const dragStartPositionRef = useRef(positionPercent);
  const isDraggingRef = useRef(false);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const showTemporarily = useCallback(() => {
    if (!enabled || typeof window === 'undefined') {
      setIsVisible(false);
      return;
    }

    clearHideTimer();
    setIsVisible(true);

    hideTimerRef.current = window.setTimeout(() => {
      setIsVisible(false);
    }, autoHideDelayMs);
  }, [enabled, autoHideDelayMs, clearHideTimer]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!enabled) {
      clearHideTimer();
      setIsVisible(false);
      setIsDragging(false);
      setDragStartY(0);
      isDraggingRef.current = false;
      return;
    }

    showTemporarily();

    return () => {
      clearHideTimer();
    };
  }, [enabled, clearHideTimer, showTemporarily]);

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ y: positionPercent }));
  }, [enabled, positionPercent]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleReveal = () => {
      showTemporarily();
    };

    window.addEventListener(MOBILE_NAV_REVEAL_EVENT, handleReveal);

    return () => {
      window.removeEventListener(MOBILE_NAV_REVEAL_EVENT, handleReveal);
    };
  }, [showTemporarily]);

  const handleDragStart = useCallback(
    (event) => {
      if (!enabled || !event.touches?.length) {
        return;
      }

      showTemporarily();
      setDragStartY(event.touches[0].clientY);
      dragStartPositionRef.current = positionPercent;
      isDraggingRef.current = false;
      setIsDragging(false);
    },
    [enabled, positionPercent, showTemporarily],
  );

  const handleDragMove = useCallback(
    (event) => {
      if (!enabled || dragStartY === 0 || !event.touches?.length) {
        return;
      }

      const clientY = event.touches[0].clientY;
      const deltaY = Math.abs(clientY - dragStartY);

      if (!isDraggingRef.current && deltaY > DRAG_THRESHOLD_PX) {
        isDraggingRef.current = true;
        setIsDragging(true);
      }

      if (!isDraggingRef.current) {
        return;
      }

      event.preventDefault();

      const actualDeltaY = clientY - dragStartY;
      const percentageDelta = (actualDeltaY / window.innerHeight) * 100;
      const nextPosition = dragStartPositionRef.current + percentageDelta;

      setPositionPercent(Math.max(MIN_POSITION_PERCENT, Math.min(MAX_POSITION_PERCENT, nextPosition)));
    },
    [enabled, dragStartY],
  );

  const handleDragEnd = useCallback(() => {
    setDragStartY(0);
    setIsDragging(false);
    isDraggingRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled || dragStartY === 0) {
      return;
    }

    const onTouchMove = (event) => handleDragMove(event);
    const onTouchEnd = () => handleDragEnd();

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled, dragStartY, handleDragEnd, handleDragMove]);

  return {
    positionPercent,
    isVisible,
    isDragging,
    showTemporarily,
    handleDragStart,
  };
}
