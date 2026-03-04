import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Check, Clock, Edit2, Trash2, X } from 'lucide-react';
import type React from 'react';
import type { TFunction } from 'i18next';
import { cn } from '../../../../lib/utils';
import { formatTimeAgo } from '../../../../utils/dateUtils';
import type { Project, ProjectSession, SessionProvider } from '../../../../types/app';
import type { SessionWithProvider, TouchHandlerFactory } from '../../types/types';
import { createSessionViewModel } from '../../utils/utils';
import SessionProviderLogo from '../../../llm-logo-provider/SessionProviderLogo';

type SidebarSessionItemProps = {
  project: Project;
  session: SessionWithProvider;
  isSwiped: boolean;
  selectedSession: ProjectSession | null;
  currentTime: Date;
  editingSession: string | null;
  editingSessionName: string;
  onEditingSessionNameChange: (value: string) => void;
  onStartEditingSession: (sessionId: string, initialName: string) => void;
  onCancelEditingSession: () => void;
  onSaveEditingSession: (projectName: string, sessionId: string, summary: string, provider: SessionProvider) => void;
  onProjectSelect: (project: Project) => void;
  onSessionSelect: (session: SessionWithProvider, projectName: string) => void;
  onDeleteSession: (
    projectName: string,
    sessionId: string,
    sessionTitle: string,
    provider: SessionProvider,
  ) => void;
  touchHandlerFactory: TouchHandlerFactory;
  onClearSwipedSession: () => void;
  onSessionTouchStart: (event: React.TouchEvent<HTMLElement>) => void;
  onSessionTouchMove: (event: React.TouchEvent<HTMLElement>, sessionKey: string) => void;
  t: TFunction;
};

export default function SidebarSessionItem({
  project,
  session,
  isSwiped,
  selectedSession,
  currentTime,
  editingSession,
  editingSessionName,
  onEditingSessionNameChange,
  onStartEditingSession,
  onCancelEditingSession,
  onSaveEditingSession,
  onProjectSelect,
  onSessionSelect,
  onDeleteSession,
  touchHandlerFactory,
  onClearSwipedSession,
  onSessionTouchStart,
  onSessionTouchMove,
  t,
}: SidebarSessionItemProps) {
  const sessionView = createSessionViewModel(session, currentTime, t);
  const isSelected = selectedSession?.id === session.id;
  const sessionSwipeKey = `${project.name}:${session.__provider}:${session.id}`;

  const selectMobileSession = () => {
    onProjectSelect(project);
    onSessionSelect(session, project.name);
  };

  const saveEditedSession = () => {
    onSaveEditingSession(project.name, session.id, editingSessionName, session.__provider);
  };

  const requestDeleteSession = () => {
    onDeleteSession(project.name, session.id, sessionView.sessionName, session.__provider);
  };

  const handleDeleteSessionFromSwipe = () => {
    requestDeleteSession();
    onClearSwipedSession();
  };
  const handleDeleteSessionTouch = touchHandlerFactory(handleDeleteSessionFromSwipe);

  return (
    <div className="group relative">
      {sessionView.isActive && (
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>
      )}

      <div className="md:hidden">
        <div className="mx-3 my-0.5 rounded-md relative overflow-hidden">
          {!sessionView.isCursorSession && isSwiped && (
            <button
              type="button"
              className="absolute inset-y-0 right-0 w-20 bg-red-600 flex items-center justify-center"
              onTouchStart={(event) => {
                event.stopPropagation();
              }}
              onTouchEnd={handleDeleteSessionTouch}
              onClick={handleDeleteSessionFromSwipe}
            >
              <Trash2 className="w-4 h-4 text-white" />
            </button>
          )}

          <div
            className={cn(
              'p-2 rounded-md bg-card border active:scale-[0.98] transition-all duration-150 relative z-10',
              isSelected ? 'bg-primary/5 border-primary/20' : '',
              !isSelected && sessionView.isActive
                ? 'border-green-500/30 bg-green-50/5 dark:bg-green-900/5'
                : 'border-border/30',
              !sessionView.isCursorSession && isSwiped ? '-translate-x-20' : 'translate-x-0',
            )}
            onTouchStart={onSessionTouchStart}
            onTouchMove={(event) => onSessionTouchMove(event, sessionSwipeKey)}
            onClick={() => {
              if (isSwiped) {
                onClearSwipedSession();
                return;
              }

              selectMobileSession();
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0',
                  isSelected ? 'bg-primary/10' : 'bg-muted/50',
                )}
              >
                <SessionProviderLogo provider={session.__provider} className="w-3 h-3" />
              </div>

              <div className="min-w-0 flex-1">
                {editingSession === session.id ? (
                  <input
                    type="text"
                    value={editingSessionName}
                    onChange={(event) => onEditingSessionNameChange(event.target.value)}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === 'Enter') {
                        saveEditedSession();
                      } else if (event.key === 'Escape') {
                        onCancelEditingSession();
                      }
                    }}
                    onClick={(event) => event.stopPropagation()}
                    className="w-full px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                ) : (
                  <>
                    <div className="text-xs font-medium truncate text-foreground">{sessionView.sessionName}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(sessionView.sessionTime, currentTime, t)}
                      </span>
                      {sessionView.messageCount > 0 && (
                        <Badge variant="secondary" className="text-xs px-1 py-0 ml-auto">
                          {sessionView.messageCount}
                        </Badge>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1 ml-2">
                {editingSession === session.id ? (
                  <>
                    <button
                      className="w-5 h-5 rounded-md bg-green-50 dark:bg-green-900/20 flex items-center justify-center active:scale-95 transition-transform"
                      onClick={(event) => {
                        event.stopPropagation();
                        saveEditedSession();
                      }}
                      title={t('tooltips.save')}
                    >
                      <Check className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
                    </button>
                    <button
                      className="w-5 h-5 rounded-md bg-gray-50 dark:bg-gray-900/20 flex items-center justify-center active:scale-95 transition-transform"
                      onClick={(event) => {
                        event.stopPropagation();
                        onCancelEditingSession();
                      }}
                      title={t('tooltips.cancel')}
                    >
                      <X className="w-2.5 h-2.5 text-gray-600 dark:text-gray-400" />
                    </button>
                  </>
                ) : (
                  <button
                    className="w-5 h-5 rounded-md bg-gray-50 dark:bg-gray-900/20 flex items-center justify-center active:scale-95 transition-transform opacity-80"
                    onClick={(event) => {
                      event.stopPropagation();
                      onStartEditingSession(session.id, sessionView.sessionName);
                    }}
                    title={t('tooltips.editSessionName')}
                  >
                    <Edit2 className="w-2.5 h-2.5 text-gray-600 dark:text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start p-2 h-auto font-normal text-left hover:bg-accent/50 transition-colors duration-200',
            isSelected && 'bg-accent text-accent-foreground',
          )}
          onClick={() => onSessionSelect(session, project.name)}
        >
          <div className="flex items-start gap-2 min-w-0 w-full">
            <SessionProviderLogo provider={session.__provider} className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate text-foreground">{sessionView.sessionName}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <Clock className="w-2.5 h-2.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(sessionView.sessionTime, currentTime, t)}
                </span>
                {sessionView.messageCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-xs px-1 py-0 ml-auto group-hover:opacity-0 transition-opacity"
                  >
                    {sessionView.messageCount}
                  </Badge>
                )}
                <span className="ml-1 opacity-70 group-hover:opacity-0 transition-opacity">
                  <SessionProviderLogo provider={session.__provider} className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        </Button>

        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
            {editingSession === session.id ? (
              <>
                <input
                  type="text"
                  value={editingSessionName}
                  onChange={(event) => onEditingSessionNameChange(event.target.value)}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === 'Enter') {
                      saveEditedSession();
                    } else if (event.key === 'Escape') {
                      onCancelEditingSession();
                    }
                  }}
                  onClick={(event) => event.stopPropagation()}
                  className="w-32 px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
                <button
                  className="w-6 h-6 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded flex items-center justify-center"
                  onClick={(event) => {
                    event.stopPropagation();
                    saveEditedSession();
                  }}
                  title={t('tooltips.save')}
                >
                  <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                </button>
                <button
                  className="w-6 h-6 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/20 dark:hover:bg-gray-900/40 rounded flex items-center justify-center"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCancelEditingSession();
                  }}
                  title={t('tooltips.cancel')}
                >
                  <X className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                </button>
              </>
            ) : (
              <>
                <button
                  className="w-6 h-6 bg-gray-50 hover:bg-gray-100 dark:bg-gray-900/20 dark:hover:bg-gray-900/40 rounded flex items-center justify-center"
                  onClick={(event) => {
                    event.stopPropagation();
                    onStartEditingSession(session.id, sessionView.sessionName);
                  }}
                  title={t('tooltips.editSessionName')}
                >
                  <Edit2 className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                </button>
                {!sessionView.isCursorSession && (
                  <button
                    className="w-6 h-6 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded flex items-center justify-center"
                    onClick={(event) => {
                      event.stopPropagation();
                      requestDeleteSession();
                    }}
                    title={t('tooltips.deleteSession')}
                  >
                    <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                  </button>
                )}
              </>
            )}
          </div>
      </div>
    </div>
  );
}
