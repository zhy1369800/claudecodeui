import { useCallback, useRef } from 'react';
import MobileMenuButton from './MobileMenuButton';
import MainContentTabSwitcher from './MainContentTabSwitcher';
import MainContentTitle from './MainContentTitle';
import type { MainContentHeaderProps } from '../../types/types';
import { emitMobileNavRevealEvent } from '../../../../hooks/useDraggableMobileNav';

export default function MainContentHeader({
  activeTab,
  setActiveTab,
  selectedProject,
  selectedSession,
  shouldShowTasksTab,
  isMobile,
  onMenuClick,
}: MainContentHeaderProps) {
  const lastTouchEndTimeRef = useRef(0);

  const revealMobileNav = useCallback(() => {
    if (!isMobile) {
      return;
    }

    emitMobileNavRevealEvent();
  }, [isMobile]);

  const handleHeaderTouchEnd = useCallback(() => {
    if (!isMobile) {
      return;
    }

    const now = Date.now();
    if (now - lastTouchEndTimeRef.current <= 280) {
      revealMobileNav();
    }
    lastTouchEndTimeRef.current = now;
  }, [isMobile, revealMobileNav]);

  return (
    <div className="bg-background border-b border-border/60 px-3 py-1.5 sm:px-4 sm:py-2 pwa-header-safe flex-shrink-0">
      <div className="flex items-center justify-between gap-3">
        <div
          className="flex items-center gap-2 min-w-0 flex-1"
          onDoubleClick={revealMobileNav}
          onTouchEnd={handleHeaderTouchEnd}
        >
          {isMobile && <MobileMenuButton onMenuClick={onMenuClick} />}
          <MainContentTitle
            activeTab={activeTab}
            selectedProject={selectedProject}
            selectedSession={selectedSession}
            shouldShowTasksTab={shouldShowTasksTab}
          />
        </div>

        <div className="flex-shrink-0 hidden sm:block">
          <MainContentTabSwitcher
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            shouldShowTasksTab={shouldShowTasksTab}
          />
        </div>
      </div>
    </div>
  );
}
