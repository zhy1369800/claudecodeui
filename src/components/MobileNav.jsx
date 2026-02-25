import React, { useEffect } from 'react';
import { MessageSquare, Folder, Terminal, GitBranch, ClipboardCheck } from 'lucide-react';
import { useTasksSettings } from '../contexts/TasksSettingsContext';
import { useDraggableMobileNav } from '../hooks/useDraggableMobileNav';

function MobileNav({ activeTab, setActiveTab, isInputFocused, sessionId }) {
  const { tasksEnabled, isTaskMasterInstalled } = useTasksSettings();
  const shouldShowTasksTab = Boolean(tasksEnabled && isTaskMasterInstalled);
  const navEnabled = !isInputFocused;

  const {
    positionPercent,
    isVisible,
    isDragging,
    showTemporarily,
    handleDragStart,
  } = useDraggableMobileNav({ enabled: navEnabled });

  useEffect(() => {
    showTemporarily();
  }, [activeTab, sessionId, showTemporarily]);

  const navItems = [
    {
      id: 'chat',
      icon: MessageSquare,
      label: 'Chat',
      onClick: () => setActiveTab('chat')
    },
    {
      id: 'shell',
      icon: Terminal,
      label: 'Shell',
      onClick: () => setActiveTab('shell')
    },
    {
      id: 'files',
      icon: Folder,
      label: 'Files',
      onClick: () => setActiveTab('files')
    },
    {
      id: 'git',
      icon: GitBranch,
      label: 'Git',
      onClick: () => setActiveTab('git')
    },
    ...(shouldShowTasksTab ? [{
      id: 'tasks',
      icon: ClipboardCheck,
      label: 'Tasks',
      onClick: () => setActiveTab('tasks')
    }] : [])
  ];

  const handleTabClick = (event, onClick) => {
    if (isDragging) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    showTemporarily();
    onClick();
  };

  const railStyle = {
    position: 'fixed',
    top: `${positionPercent}%`,
    right: '8px',
    zIndex: 20,
    pointerEvents: isVisible ? 'auto' : 'none',
    opacity: isVisible ? 1 : 0,
    visibility: isVisible ? 'visible' : 'hidden',
    transition: 'opacity 0.3s, visibility 0.3s',
  };

  return (
    <div
      className={`flex-shrink-0 ${isDragging ? 'cursor-grabbing' : ''}`}
      style={railStyle}
      onClick={showTemporarily}
      onTouchStart={showTemporarily}
    >
      <div
        className="nav-glass mobile-nav-float rounded-lg border border-border/30 touch-none shadow-lg"
        onTouchStart={handleDragStart}
      >
        <div className="flex items-center justify-center p-0.5 gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={(event) => handleTabClick(event, item.onClick)}
                className={`relative flex items-center justify-center px-2 py-1 text-xs font-medium rounded-md touch-manipulation transition-all duration-200 active:scale-95 ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                title={item.label}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-primary/8 dark:bg-primary/12 rounded-md" />
                )}
                <Icon
                  className="relative z-10 w-3.5 h-3.5 transition-all duration-200"
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MobileNav;
