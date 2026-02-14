import React, { useState, useCallback } from 'react';
import Shell from './Shell.jsx';

/**
 * Generic Shell wrapper that can be used in tabs, modals, and other contexts.
 * Provides a flexible API for both standalone and session-based usage.
 */
function StandaloneShell({
  project,
  session = null,
  command = null,
  isPlainShell = null,
  autoConnect = true,
  onComplete = null,
  onClose = null,
  title = null,
  className = "",
  showHeader = true,
  compact = false,
  minimal = false,
  isMobile = false,
  isSettingsOpen = false,
  onToggleSettings = null,
  onStatusChange = null
}) {
  const [isCompleted, setIsCompleted] = useState(false);

  // Default to plain shell if no project is provided or a command is specified
  const shouldUsePlainShell = isPlainShell !== null ? isPlainShell : (command !== null || !project);

  const handleProcessComplete = useCallback((exitCode) => {
    setIsCompleted(true);
    if (onComplete) {
      onComplete(exitCode);
    }
  }, [onComplete]);

  return (
    <div className={`h-full w-full flex flex-col ${className}`}>
      {/* Optional custom header */}
      {!minimal && showHeader && title && (
        <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-medium text-gray-200">{title}</h3>
              {isCompleted && (
                <span className="text-xs text-green-400">(Completed)</span>
              )}
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Shell component wrapper */}
      <div className="flex-1 w-full min-h-0">
        <Shell
          selectedProject={project}
          selectedSession={session}
          initialCommand={command}
          isPlainShell={shouldUsePlainShell}
          onProcessComplete={handleProcessComplete}
          minimal={minimal}
          isMobile={isMobile}
          isSettingsOpen={isSettingsOpen}
          onToggleSettings={onToggleSettings}
          onStatusChange={onStatusChange}
          autoConnect={minimal ? true : autoConnect}
        />
      </div>
    </div>
  );
}

export default StandaloneShell;
