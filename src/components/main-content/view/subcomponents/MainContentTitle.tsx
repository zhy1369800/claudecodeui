import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SessionProviderLogo from '../../../SessionProviderLogo';
import type { AppTab, Project, ProjectSession } from '../../../../types/app';

type MainContentTitleProps = {
  activeTab: AppTab;
  selectedProject: Project;
  selectedSession: ProjectSession | null;
  shouldShowTasksTab: boolean;
  ws: WebSocket | null;
};

function getTabTitle(activeTab: AppTab, shouldShowTasksTab: boolean, t: (key: string) => string) {
  if (activeTab === 'files') {
    return t('mainContent.projectFiles');
  }

  if (activeTab === 'git') {
    return t('tabs.git');
  }

  if (activeTab === 'tasks' && shouldShowTasksTab) {
    return 'TaskMaster';
  }

  return 'Project';
}

function getSessionTitle(session: ProjectSession): string {
  if (session.__provider === 'cursor') {
    return (session.name as string) || 'Untitled Session';
  }

  return (session.summary as string) || 'New Session';
}

export default function MainContentTitle({
  activeTab,
  selectedProject,
  selectedSession,
  shouldShowTasksTab,
  ws,
}: MainContentTitleProps) {
  const { t } = useTranslation();
  const [wsReadyState, setWsReadyState] = useState<number>(
    ws ? ws.readyState : WebSocket.CLOSED,
  );

  useEffect(() => {
    if (!ws) {
      setWsReadyState(WebSocket.CLOSED);
      return;
    }

    const syncState = () => setWsReadyState(ws.readyState);
    syncState();

    ws.addEventListener('open', syncState);
    ws.addEventListener('close', syncState);
    ws.addEventListener('error', syncState);

    return () => {
      ws.removeEventListener('open', syncState);
      ws.removeEventListener('close', syncState);
      ws.removeEventListener('error', syncState);
    };
  }, [ws]);

  const connectionUi = useMemo(() => {
    if (wsReadyState === WebSocket.OPEN) {
      return {
        dotClass: 'bg-green-500',
        title: t('mainContent.connection.connected', { defaultValue: 'Connected' }),
      };
    }
    if (wsReadyState === WebSocket.CONNECTING) {
      return {
        dotClass: 'bg-amber-500 animate-pulse',
        title: t('mainContent.connection.connecting', { defaultValue: 'Connecting' }),
      };
    }
    return {
      dotClass: 'bg-red-500',
      title: t('mainContent.connection.disconnected', { defaultValue: 'Disconnected' }),
    };
  }, [wsReadyState, t]);

  const showSessionIcon = activeTab === 'chat' && Boolean(selectedSession);
  const showChatNewSession = activeTab === 'chat' && !selectedSession;
  const showConnectionIndicator = activeTab === 'chat';

  return (
    <div className="min-w-0 flex items-center gap-2 flex-1 overflow-x-auto scrollbar-hide">
      {showSessionIcon && (
        <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
          <SessionProviderLogo provider={selectedSession?.__provider} className="w-4 h-4" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        {activeTab === 'chat' && selectedSession ? (
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground whitespace-nowrap overflow-x-auto scrollbar-hide leading-tight">
              {getSessionTitle(selectedSession)}
            </h2>
            <div className="text-[11px] text-muted-foreground truncate leading-tight flex items-center gap-1.5">
              {showConnectionIndicator && (
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connectionUi.dotClass}`} title={connectionUi.title} />
              )}
              <span className="truncate">{selectedProject.displayName}</span>
            </div>
          </div>
        ) : showChatNewSession ? (
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground leading-tight">{t('mainContent.newSession')}</h2>
            <div className="text-xs text-muted-foreground truncate leading-tight flex items-center gap-1.5">
              {showConnectionIndicator && (
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connectionUi.dotClass}`} title={connectionUi.title} />
              )}
              <span className="truncate">{selectedProject.displayName}</span>
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground leading-tight">
              {getTabTitle(activeTab, shouldShowTasksTab, t)}
            </h2>
            <div className="text-[11px] text-muted-foreground truncate leading-tight flex items-center gap-1.5">
              <span className="truncate">{selectedProject.displayName}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
