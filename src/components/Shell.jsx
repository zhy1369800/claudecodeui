import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useTranslation } from 'react-i18next';
import { IS_PLATFORM } from '../constants/config';
import { Settings2, X, ChevronRight, Terminal as TerminalIcon, ChevronLeft, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';

const xtermStyles = `
  .xterm .xterm-screen {
    outline: none !important;
  }
  .xterm:focus .xterm-screen {
    outline: none !important;
  }
  .xterm-screen:focus {
    outline: none !important;
  }
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = xtermStyles;
  document.head.appendChild(styleSheet);
}

function Shell({
  selectedProject,
  selectedSession,
  initialCommand,
  isPlainShell = false,
  onProcessComplete,
  minimal = false,
  autoConnect = false,
  isMobile = false,
  isSettingsOpen = false,
  onToggleSettings = null,
  onStatusChange = null
}) {
  const { t } = useTranslation('chat');
  const terminalRef = useRef(null);
  const terminal = useRef(null);
  const fitAddon = useRef(null);
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [lastSessionId, setLastSessionId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [virtualKeysOpen, setVirtualKeysOpen] = useState(false);

  // Notify parent of connection status
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(isConnected);
    }
  }, [isConnected, onStatusChange]);

  const selectedProjectRef = useRef(selectedProject);
  const selectedSessionRef = useRef(selectedSession);
  const initialCommandRef = useRef(initialCommand);
  const isPlainShellRef = useRef(isPlainShell);
  const onProcessCompleteRef = useRef(onProcessComplete);

  useEffect(() => {
    selectedProjectRef.current = selectedProject;
    selectedSessionRef.current = selectedSession;
    initialCommandRef.current = initialCommand;
    isPlainShellRef.current = isPlainShell;
    onProcessCompleteRef.current = onProcessComplete;
  });

  const connectWebSocket = useCallback(async () => {
    if (isConnecting || isConnected) return;

    try {
      let wsUrl;

      if (IS_PLATFORM) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/shell`;
      } else {
        const token = localStorage.getItem('auth-token');
        if (!token) {
          console.error('No authentication token found for Shell WebSocket connection');
          return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/shell?token=${encodeURIComponent(token)}`;
      }

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);

        setTimeout(() => {
          if (fitAddon.current && terminal.current) {
            fitAddon.current.fit();

            ws.current.send(JSON.stringify({
              type: 'init',
              projectPath: selectedProjectRef.current.fullPath || selectedProjectRef.current.path,
              sessionId: isPlainShellRef.current ? null : selectedSessionRef.current?.id,
              hasSession: isPlainShellRef.current ? false : !!selectedSessionRef.current,
              provider: isPlainShellRef.current ? 'plain-shell' : (selectedSessionRef.current?.__provider || 'claude'),
              cols: terminal.current.cols,
              rows: terminal.current.rows,
              initialCommand: initialCommandRef.current,
              isPlainShell: isPlainShellRef.current
            }));
          }
        }, 100);
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'output') {
            let output = data.data;

            if (isPlainShellRef.current && onProcessCompleteRef.current) {
              const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
              if (cleanOutput.includes('Process exited with code 0')) {
                onProcessCompleteRef.current(0);
              } else if (cleanOutput.match(/Process exited with code (\d+)/)) {
                const exitCode = parseInt(cleanOutput.match(/Process exited with code (\d+)/)[1]);
                if (exitCode !== 0) {
                  onProcessCompleteRef.current(exitCode);
                }
              }
            }

            if (terminal.current) {
              terminal.current.write(output);
            }
          } else if (data.type === 'url_open') {
            window.open(data.url, '_blank');
          }
        } catch (error) {
          console.error('[Shell] Error handling WebSocket message:', error, event.data);
        }
      };

      ws.current.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);

        if (terminal.current) {
          terminal.current.clear();
          terminal.current.write('\x1b[2J\x1b[H');
        }
      };

      ws.current.onerror = (error) => {
        setIsConnected(false);
        setIsConnecting(false);
      };
    } catch (error) {
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, [isConnecting, isConnected]);

  const connectToShell = useCallback(() => {
    if (!isInitialized || isConnected || isConnecting) return;
    setIsConnecting(true);
    connectWebSocket();
  }, [isInitialized, isConnected, isConnecting, connectWebSocket]);

  const syncTerminalSize = useCallback(() => {
    if (!fitAddon.current || !terminal.current) return;
    fitAddon.current.fit();
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'resize',
        cols: terminal.current.cols,
        rows: terminal.current.rows
      }));
    }
  }, []);

  const disconnectFromShell = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    if (terminal.current) {
      terminal.current.clear();
      terminal.current.write('\x1b[2J\x1b[H');
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const sessionDisplayName = useMemo(() => {
    if (!selectedSession) return null;
    return selectedSession.__provider === 'cursor'
      ? (selectedSession.name || 'Untitled Session')
      : selectedSession.__provider === 'codex'
        ? (selectedSession.summary || selectedSession.name || 'Codex Session')
        : (selectedSession.summary || 'New Session');
  }, [selectedSession]);

  const sessionDisplayNameShort = useMemo(() => {
    if (!sessionDisplayName) return null;
    return sessionDisplayName.slice(0, 30);
  }, [sessionDisplayName]);

  const sessionDisplayNameLong = useMemo(() => {
    if (!sessionDisplayName) return null;
    return sessionDisplayName.slice(0, 50);
  }, [sessionDisplayName]);

  const sendTerminalKey = useCallback((keyData) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'input',
        data: keyData
      }));
    }
  }, []);

  const restartShell = () => {
    setIsRestarting(true);

    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    if (terminal.current) {
      terminal.current.dispose();
      terminal.current = null;
      fitAddon.current = null;
    }

    setIsConnected(false);
    setIsInitialized(false);

    setTimeout(() => {
      setIsRestarting(false);
    }, 200);
  };

  useEffect(() => {
    const currentSessionId = selectedSession?.id || null;

    if (lastSessionId !== null && lastSessionId !== currentSessionId && isInitialized) {
      disconnectFromShell();
    }

    setLastSessionId(currentSessionId);
  }, [selectedSession?.id, isInitialized, disconnectFromShell]);

  useEffect(() => {
    if (!terminalRef.current || !selectedProject || isRestarting || terminal.current) {
      return;
    }


    terminal.current = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      allowProposedApi: true,
      allowTransparency: false,
      convertEol: true,
      scrollback: 10000,
      tabStopWidth: 4,
      windowsMode: false,
      macOptionIsMeta: true,
      macOptionClickForcesSelection: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        cursorAccent: '#1e1e1e',
        selection: '#264f78',
        selectionForeground: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
        extendedAnsi: [
          '#000000', '#800000', '#008000', '#808000',
          '#000080', '#800080', '#008080', '#c0c0c0',
          '#808080', '#ff0000', '#00ff00', '#ffff00',
          '#0000ff', '#ff00ff', '#00ffff', '#ffffff'
        ]
      }
    });

    fitAddon.current = new FitAddon();
    const webglAddon = new WebglAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(webLinksAddon);
    // Note: ClipboardAddon removed - we handle clipboard operations manually in attachCustomKeyEventHandler

    try {
      terminal.current.loadAddon(webglAddon);
    } catch (error) {
      console.warn('[Shell] WebGL renderer unavailable, using Canvas fallback');
    }

    terminal.current.open(terminalRef.current);

    terminal.current.attachCustomKeyEventHandler((event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'c' && terminal.current.hasSelection()) {
        document.execCommand('copy');
        return false;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        navigator.clipboard.readText().then(text => {
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'input',
              data: text
            }));
          }
        }).catch(() => { });
        return false;
      }

      return true;
    });

    setTimeout(() => {
      syncTerminalSize();
    }, 100);

    setIsInitialized(true);
    terminal.current.onData((data) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'input',
          data: data
        }));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      setTimeout(() => {
        syncTerminalSize();
      }, 50);
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    const handleWindowResize = () => {
      setTimeout(() => {
        syncTerminalSize();
      }, 50);
    };

    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('orientationchange', handleWindowResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleWindowResize);
      window.visualViewport.addEventListener('scroll', handleWindowResize);
    }

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('orientationchange', handleWindowResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleWindowResize);
        window.visualViewport.removeEventListener('scroll', handleWindowResize);
      }

      if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
        ws.current.close();
      }
      ws.current = null;

      if (terminal.current) {
        terminal.current.dispose();
        terminal.current = null;
      }
    };
  }, [selectedProject?.path || selectedProject?.fullPath, isRestarting, syncTerminalSize]);

  useEffect(() => {
    if (!autoConnect || !isInitialized || isConnecting || isConnected) return;
    connectToShell();
  }, [autoConnect, isInitialized, isConnecting, isConnected, connectToShell]);

  if (!selectedProject) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">{t('shell.selectProject.title')}</h3>
          <p>{t('shell.selectProject.description')}</p>
        </div>
      </div>
    );
  }

  if (minimal) {
    return (
      <div className="h-full w-full bg-gray-900">
        <div ref={terminalRef} className="h-full w-full focus:outline-none" style={{ outline: 'none' }} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 w-full relative">
      {isMobile ? (
        <>
          {/* Mobile Terminal Toolbar - Slides down below header when toggled */}
          <div
            className={`absolute top-0 left-0 right-0 z-[60] transition-all duration-300 transform origin-top border-b border-gray-700 bg-gray-800/95 backdrop-blur-sm ${isSettingsOpen
              ? 'scale-y-100 opacity-100 translate-y-0'
              : 'scale-y-95 opacity-0 -translate-y-2 pointer-events-none'
              }`}
          >
            <div className="flex items-center justify-between p-2 px-3">
              <div className="flex items-center space-x-2 pl-1">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                {selectedSession && (
                  <span className="text-xs text-blue-300 whitespace-nowrap">
                    ({sessionDisplayNameShort}...)
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {isConnected && (
                  <button
                    onClick={disconnectFromShell}
                    className="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
                    title={t('shell.actions.disconnectTitle')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={restartShell}
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
        </>
      ) : (
        isSettingsOpen && (
          <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 pl-1">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                {selectedSession && (
                  <span className="text-xs text-blue-300 whitespace-nowrap">
                    ({sessionDisplayNameShort}...)
                  </span>
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
                  onClick={restartShell}
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
        <div ref={terminalRef} className="h-full w-full focus:outline-none" style={{ outline: 'none' }} />

        {!isInitialized && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90">
            <div className="text-white">{t('shell.loading')}</div>
          </div>
        )}

        {isInitialized && !isConnected && !isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 p-4">
            <div className="text-center max-w-sm w-full">
              <button
                onClick={connectToShell}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 text-base font-medium w-full sm:w-auto"
                title={t('shell.actions.connectTitle')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>{t('shell.actions.connect')}</span>
              </button>
              <p className="text-gray-400 text-sm mt-3 px-2">
                {isPlainShell ?
                  t('shell.runCommand', { command: initialCommand || t('shell.defaultCommand'), projectName: selectedProject.displayName }) :
                  selectedSession ?
                    t('shell.resumeSession', { displayName: sessionDisplayNameLong }) :
                    t('shell.startSession')
                }
              </p>
            </div>
          </div>
        )}

        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 p-4">
            <div className="text-center max-w-sm w-full">
              <div className="flex items-center justify-center space-x-3 text-yellow-400">
                <div className="w-6 h-6 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent"></div>
                <span className="text-base font-medium">{t('shell.connecting')}</span>
              </div>
              <p className="text-gray-400 text-sm mt-3 px-2">
                {isPlainShell ?
                  t('shell.runCommand', { command: initialCommand || t('shell.defaultCommand'), projectName: selectedProject.displayName }) :
                  t('shell.startCli', { projectName: selectedProject.displayName })
                }
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Virtual Keys Drawer - Right Side Pull Tab */}
      {isMobile && isConnected && (
        <div
          className="fixed right-0 top-1/2 -translate-y-1/2 z-[70] flex items-center transition-transform duration-300 pointer-events-auto"
          style={{ transform: virtualKeysOpen ? 'translateX(0)' : 'translateX(calc(100% - 1.5rem))' }}
        >
          {/* Pull Tab Handle */}
          <button
            onClick={() => setVirtualKeysOpen(!virtualKeysOpen)}
            className="w-6 h-16 flex items-center justify-center bg-gray-800 border border-gray-700 border-r-0 rounded-l-lg shadow-lg active:bg-gray-700 transition-colors"
            style={{ touchAction: 'none' }}
          >
            {virtualKeysOpen ? (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {/* Vertical Button Column */}
          <div
            className="flex flex-col gap-3 p-2 bg-gray-800/95 backdrop-blur-md border border-gray-700 border-r-0 shadow-2xl h-auto"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => e.preventDefault()}
            onTouchMove={(e) => e.preventDefault()}
          >
            <button
              onPointerDown={(e) => { e.preventDefault(); sendTerminalKey('\x1b'); }}
              className="w-10 h-10 flex items-center justify-center bg-gray-700 text-gray-200 rounded-lg active:bg-blue-600 transition-colors text-[10px] font-bold border border-gray-600 shadow-sm"
            >
              ESC
            </button>
            <button
              onPointerDown={(e) => { e.preventDefault(); sendTerminalKey('\t'); }}
              className="w-10 h-10 flex items-center justify-center bg-gray-700 text-gray-200 rounded-lg active:bg-blue-600 transition-colors text-[10px] font-bold border border-gray-600 shadow-sm"
            >
              TAB
            </button>
            <div className="h-px w-6 bg-gray-600 mx-auto" />
            <button
              onPointerDown={(e) => { e.preventDefault(); sendTerminalKey('\x1b[A'); }}
              className="w-10 h-10 flex items-center justify-center bg-gray-700 text-gray-200 rounded-lg active:bg-blue-600 transition-colors border border-gray-600 shadow-sm"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              onPointerDown={(e) => { e.preventDefault(); sendTerminalKey('\x1b[B'); }}
              className="w-10 h-10 flex items-center justify-center bg-gray-700 text-gray-200 rounded-lg active:bg-blue-600 transition-colors border border-gray-600 shadow-sm"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Shell;
