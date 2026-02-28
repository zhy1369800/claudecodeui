import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@xterm/xterm/css/xterm.css';
import type { Project, ProjectSession } from '../../../types/app';
import { SHELL_RESTART_DELAY_MS } from '../constants/constants';
import { useShellRuntime } from '../hooks/useShellRuntime';
import { getSessionDisplayName } from '../utils/auth';
import ShellConnectionOverlay from './subcomponents/ShellConnectionOverlay';
import ShellEmptyState from './subcomponents/ShellEmptyState';
import ShellMinimalView from './subcomponents/ShellMinimalView';

type ShellProps = {
  selectedProject?: Project | null;
  selectedSession?: ProjectSession | null;
  initialCommand?: string | null;
  isPlainShell?: boolean;
  onProcessComplete?: ((exitCode: number) => void) | null;
  minimal?: boolean;
  autoConnect?: boolean;
  isActive?: boolean;
  isMobile?: boolean;
  isSettingsOpen?: boolean;
  onStatusChange?: ((isConnected: boolean) => void) | null;
};

export default function Shell({
  selectedProject = null,
  selectedSession = null,
  initialCommand = null,
  isPlainShell = false,
  onProcessComplete = null,
  minimal = false,
  autoConnect = false,
  isActive,
  isMobile = false,
  isSettingsOpen = false,
  onStatusChange = null,
}: ShellProps) {
  const { t } = useTranslation('chat');
  const [isRestarting, setIsRestarting] = useState(false);

  // Keep the public API stable for existing callers that still pass `isActive`.
  void isActive;
  // Keep `isMobile` and `isSettingsOpen` in the public API for compatibility with existing callers.
  void isMobile;
  void isSettingsOpen;

  const {
    terminalContainerRef,
    isConnected,
    isInitialized,
    isConnecting,
    authUrl,
    authUrlVersion,
    connectToShell,
    disconnectFromShell,
    openAuthUrlInBrowser,
    copyAuthUrlToClipboard,
  } = useShellRuntime({
    selectedProject,
    selectedSession,
    initialCommand,
    isPlainShell,
    minimal,
    autoConnect,
    isRestarting,
    onProcessComplete,
  });

  const sessionDisplayName = useMemo(() => getSessionDisplayName(selectedSession), [selectedSession]);
  const sessionDisplayNameShort = useMemo(
    () => (sessionDisplayName ? sessionDisplayName.slice(0, 30) : null),
    [sessionDisplayName],
  );
  const sessionDisplayNameLong = useMemo(
    () => (sessionDisplayName ? sessionDisplayName.slice(0, 50) : null),
    [sessionDisplayName],
  );

  useEffect(() => {
    onStatusChange?.(isConnected);
  }, [isConnected, onStatusChange]);

  useEffect(() => {
    return () => {
      onStatusChange?.(false);
    };
  }, [onStatusChange]);

  const handleRestartShell = useCallback(() => {
    setIsRestarting(true);
    window.setTimeout(() => {
      setIsRestarting(false);
    }, SHELL_RESTART_DELAY_MS);
  }, []);

  if (!selectedProject && !isPlainShell) {
    return (
      <ShellEmptyState
        title={t('shell.selectProject.title')}
        description={t('shell.selectProject.description')}
      />
    );
  }

  if (minimal) {
    return (
      <ShellMinimalView
        terminalContainerRef={terminalContainerRef}
        authUrl={authUrl}
        authUrlVersion={authUrlVersion}
        initialCommand={initialCommand}
        isConnected={isConnected}
        openAuthUrlInBrowser={openAuthUrlInBrowser}
        copyAuthUrlToClipboard={copyAuthUrlToClipboard}
      />
    );
  }

  const readyDescription = isPlainShell
    ? t('shell.runCommand', {
        command: initialCommand || t('shell.defaultCommand'),
        projectName: selectedProject?.displayName || t('shell.selectProject.title'),
      })
    : selectedSession
      ? t('shell.resumeSession', { displayName: sessionDisplayNameLong })
      : t('shell.startSession');

  const connectingDescription = isPlainShell
    ? t('shell.runCommand', {
        command: initialCommand || t('shell.defaultCommand'),
        projectName: selectedProject?.displayName || t('shell.selectProject.title'),
      })
    : t('shell.startCli', { projectName: selectedProject?.displayName || t('shell.selectProject.title') });

  const overlayMode = !isInitialized ? 'loading' : isConnecting ? 'connecting' : !isConnected ? 'connect' : null;
  const overlayDescription = overlayMode === 'connecting' ? connectingDescription : readyDescription;

  return (
    <div className="h-full flex flex-col bg-gray-900 w-full relative">
      {isMobile ? (
        <div
          className={`absolute top-0 left-0 right-0 z-20 transition-all duration-300 transform origin-top border-b border-gray-700 bg-gray-800/95 backdrop-blur-sm ${
            isSettingsOpen
              ? 'scale-y-100 opacity-100 translate-y-0'
              : 'scale-y-95 opacity-0 -translate-y-2 pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between p-2 px-3">
            <div className="flex items-center space-x-2 pl-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              {selectedSession && (
                <span className="text-xs text-blue-300 whitespace-nowrap">({sessionDisplayNameShort}...)</span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {isConnected && (
                <button
                  onClick={disconnectFromShell}
                  className="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
                  title={t('shell.actions.disconnectTitle')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              <button
                onClick={handleRestartShell}
                disabled={isRestarting || isConnected}
                className="p-1.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors"
                title={t('shell.actions.restartTitle')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        isSettingsOpen && (
          <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 pl-1">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                {selectedSession && (
                  <span className="text-xs text-blue-300 whitespace-nowrap">({sessionDisplayNameShort}...)</span>
                )}
                {!selectedSession && (
                  <span className="text-xs text-gray-400">{t('shell.status.newSession')}</span>
                )}
                {!isInitialized && (
                  <span className="text-xs text-yellow-400">{t('shell.status.initializing')}</span>
                )}
                {isRestarting && (
                  <span className="text-xs text-blue-400">{t('shell.status.restarting')}</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {isConnected && (
                  <button
                    onClick={disconnectFromShell}
                    className="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
                    title={t('shell.actions.disconnectTitle')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}

                <button
                  onClick={handleRestartShell}
                  disabled={isRestarting || isConnected}
                  className="p-1.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title={t('shell.actions.restartTitle')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )
      )}

      <div className="flex-1 p-2 overflow-hidden relative">
        <div
          ref={terminalContainerRef}
          className="h-full w-full focus:outline-none"
          style={{ outline: 'none' }}
        />

        {overlayMode && (
          <ShellConnectionOverlay
            mode={overlayMode}
            description={overlayDescription}
            loadingLabel={t('shell.loading')}
            connectLabel={t('shell.actions.connect')}
            connectTitle={t('shell.actions.connectTitle')}
            connectingLabel={t('shell.connecting')}
            onConnect={connectToShell}
          />
        )}
      </div>
    </div>
  );
}
