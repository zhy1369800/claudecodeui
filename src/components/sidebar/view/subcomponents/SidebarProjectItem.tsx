import { Button } from '../../../ui/button';
import { ChevronDown, ChevronRight, Edit3, Folder, FolderOpen, Loader2, Play, Star, Trash2 } from 'lucide-react';
import type React from 'react';
import type { TFunction } from 'i18next';
import { cn } from '../../../../lib/utils';
import TaskIndicator from '../../../TaskIndicator';
import type { Project, ProjectSession, SessionProvider } from '../../../../types/app';
import type { MCPServerStatus, RunningProjectInfo, SessionWithProvider, TouchHandlerFactory } from '../../types/types';
import { getTaskIndicatorStatus } from '../../utils/utils';
import SidebarProjectSessions from './SidebarProjectSessions';

type SidebarProjectItemProps = {
  project: Project;
  selectedProject: Project | null;
  selectedSession: ProjectSession | null;
  isExpanded: boolean;
  isDeleting: boolean;
  isStarred: boolean;
  sessions: SessionWithProvider[];
  initialSessionsLoaded: boolean;
  isLoadingSessions: boolean;
  currentTime: Date;
  editingSession: string | null;
  editingSessionName: string;
  tasksEnabled: boolean;
  mcpServerStatus: MCPServerStatus;
  runningInfo: RunningProjectInfo | null;
  isStopping: boolean;
  isSwiped: boolean;
  onToggleProject: (projectName: string) => void;
  onProjectSelect: (project: Project) => void;
  onToggleStarProject: (projectName: string) => void;
  onStartEditingProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onSessionSelect: (session: SessionWithProvider, projectName: string) => void;
  onDeleteSession: (
    projectName: string,
    sessionId: string,
    sessionTitle: string,
    provider: SessionProvider,
  ) => void;
  onLoadMoreSessions: (project: Project) => void;
  onNewSession: (project: Project) => void;
  onEditingSessionNameChange: (value: string) => void;
  onStartEditingSession: (sessionId: string, initialName: string) => void;
  onCancelEditingSession: () => void;
  onSaveEditingSession: (projectName: string, sessionId: string, summary: string, provider: SessionProvider) => void;
  touchHandlerFactory: TouchHandlerFactory;
  onClearSwipedProject: () => void;
  onProjectTouchStart: (event: React.TouchEvent<HTMLElement>) => void;
  onProjectTouchMove: (event: React.TouchEvent<HTMLElement>, projectName: string) => void;
  onRunProject: (project: Project) => void;
  onStopProject: (projectName: string) => void;
  t: TFunction;
};

const getSessionCountDisplay = (sessions: SessionWithProvider[], hasMoreSessions: boolean): string => {
  const sessionCount = sessions.length;
  if (hasMoreSessions && sessionCount >= 5) {
    return `${sessionCount}+`;
  }

  return `${sessionCount}`;
};

export default function SidebarProjectItem({
  project,
  selectedProject,
  selectedSession,
  isExpanded,
  isDeleting,
  isStarred,
  sessions,
  initialSessionsLoaded,
  isLoadingSessions,
  currentTime,
  editingSession,
  editingSessionName,
  tasksEnabled,
  mcpServerStatus,
  runningInfo,
  isStopping,
  isSwiped,
  onToggleProject,
  onProjectSelect,
  onToggleStarProject,
  onStartEditingProject,
  onDeleteProject,
  onSessionSelect,
  onDeleteSession,
  onLoadMoreSessions,
  onNewSession,
  onEditingSessionNameChange,
  onStartEditingSession,
  onCancelEditingSession,
  onSaveEditingSession,
  touchHandlerFactory,
  onClearSwipedProject,
  onProjectTouchStart,
  onProjectTouchMove,
  onRunProject,
  onStopProject,
  t,
}: SidebarProjectItemProps) {
  const isSelected = selectedProject?.name === project.name;
  const hasMoreSessions = project.sessionMeta?.hasMore === true;
  const sessionCountDisplay = getSessionCountDisplay(sessions, hasMoreSessions);
  const sessionCountLabel = `${sessionCountDisplay} session${sessions.length === 1 ? '' : 's'}`;
  const taskStatus = getTaskIndicatorStatus(project, mcpServerStatus);
  const startupScript = typeof project.startupScript === 'string' ? project.startupScript : '';
  const canRunProject = startupScript.length > 0;
  const isRunning = Boolean(runningInfo);

  const toggleProject = () => onToggleProject(project.name);
  const toggleStarProject = () => onToggleStarProject(project.name);

  const handleDeleteProjectFromSwipe = () => {
    onDeleteProject(project);
    onClearSwipedProject();
  };

  const selectAndToggleProject = () => {
    if (selectedProject?.name !== project.name) {
      onProjectSelect(project);
    }

    toggleProject();
  };

  return (
    <div className={cn('md:space-y-1', isDeleting && 'opacity-50 pointer-events-none')}>
      <div className="group md:group">
        <div className="md:hidden">
          <div className="mx-3 my-1 rounded-lg relative overflow-hidden">
            {isSwiped && (
              <button
                type="button"
                className="absolute inset-y-0 right-0 w-28 bg-red-600 flex items-center justify-center"
                onTouchStart={(event) => {
                  event.stopPropagation();
                }}
                onTouchEnd={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleDeleteProjectFromSwipe();
                }}
                onClick={handleDeleteProjectFromSwipe}
              >
                <Trash2 className="w-5 h-5 text-white" />
              </button>
            )}

            <div
              className={cn(
                'p-3 rounded-lg bg-card border border-border/50 active:scale-[0.98] transition-all duration-200 relative z-10',
                isSelected && 'bg-primary/5 border-primary/20',
                isStarred &&
                  !isSelected &&
                  'bg-yellow-50/50 dark:bg-yellow-900/5 border-yellow-200/30 dark:border-yellow-800/30',
                isSwiped ? '-translate-x-28' : 'translate-x-0',
              )}
              onTouchStart={onProjectTouchStart}
              onTouchMove={(event) => onProjectTouchMove(event, project.name)}
              onClick={() => {
                if (isSwiped) {
                  onClearSwipedProject();
                  return;
                }

                toggleProject();
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                      isExpanded ? 'bg-primary/10' : 'bg-muted',
                    )}
                  >
                    {isExpanded ? (
                      <FolderOpen className="w-4 h-4 text-primary" />
                    ) : (
                      <Folder className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-foreground truncate">{project.displayName}</h3>
                      {tasksEnabled && (
                        <TaskIndicator
                          status={taskStatus}
                          size="xs"
                          className="hidden md:inline-flex flex-shrink-0 ml-2"
                        />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{sessionCountLabel}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all duration-150 border',
                      isStarred
                        ? 'bg-yellow-500/10 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800'
                        : 'bg-gray-500/10 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800',
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleStarProject();
                    }}
                    title={isStarred ? t('tooltips.removeFromFavorites') : t('tooltips.addToFavorites')}
                  >
                    <Star
                      className={cn(
                        'w-4 h-4 transition-colors',
                        isStarred
                          ? 'text-yellow-600 dark:text-yellow-400 fill-current'
                          : 'text-gray-600 dark:text-gray-400',
                      )}
                    />
                  </button>

                  {canRunProject && (
                    <button
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all duration-150 border',
                        isRunning
                          ? 'bg-red-500/10 dark:bg-red-900/30 border-red-200 dark:border-red-800'
                          : 'bg-green-500/10 dark:bg-green-900/30 border-green-200 dark:border-green-800',
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isRunning) {
                          if (isStopping) {
                            return;
                          }
                          onStopProject(project.name);
                          return;
                        }
                        onProjectSelect(project);
                        onRunProject(project);
                      }}
                    >
                      {isStopping ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-600 dark:text-red-400" />
                      ) : isRunning ? (
                        <div className="w-3 h-3 bg-red-600 dark:bg-red-400 rounded-sm" />
                      ) : (
                        <Play className="w-4 h-4 text-green-600 dark:text-green-400 fill-current" />
                      )}
                    </button>
                  )}

                  <button
                    className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center active:scale-90 border border-primary/20 dark:border-primary/30"
                    onClick={(event) => {
                      event.stopPropagation();
                      onStartEditingProject(project);
                    }}
                  >
                    <Edit3 className="w-4 h-4 text-primary" />
                  </button>

                  <div className="w-6 h-6 rounded-md bg-muted/30 flex items-center justify-center">
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          className={cn(
            'hidden md:flex w-full justify-between p-2 h-auto font-normal hover:bg-accent/50',
            isSelected && 'bg-accent text-accent-foreground',
            isStarred &&
              !isSelected &&
              'bg-yellow-50/50 dark:bg-yellow-900/10 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20',
          )}
          onClick={selectAndToggleProject}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1 text-left">
              <div>
                <div className="text-sm font-semibold truncate text-foreground" title={project.displayName}>
                  {project.displayName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {sessionCountDisplay}
                  {project.fullPath !== project.displayName && (
                    <span className="ml-1 opacity-60" title={project.fullPath}>
                      {' - '}
                      {project.fullPath.length > 25 ? `...${project.fullPath.slice(-22)}` : project.fullPath}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <div
              className={cn(
                'w-6 h-6 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center rounded cursor-pointer touch:opacity-100',
                isStarred ? 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20 opacity-100' : 'hover:bg-accent',
              )}
              onClick={(event) => {
                event.stopPropagation();
                toggleStarProject();
              }}
              title={isStarred ? t('tooltips.removeFromFavorites') : t('tooltips.addToFavorites')}
            >
              <Star
                className={cn(
                  'w-3 h-3 transition-colors',
                  isStarred
                    ? 'text-yellow-600 dark:text-yellow-400 fill-current'
                    : 'text-muted-foreground',
                )}
              />
            </div>
            {canRunProject && (
              <div
                className={cn(
                  'w-6 h-6 transition-all duration-200 flex items-center justify-center rounded cursor-pointer touch:opacity-100',
                  isRunning
                    ? 'opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'opacity-0 group-hover:opacity-100 hover:bg-green-50 dark:hover:bg-green-900/20',
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  if (isRunning) {
                    if (isStopping) {
                      return;
                    }
                    onStopProject(project.name);
                    return;
                  }
                  onProjectSelect(project);
                  onRunProject(project);
                }}
              >
                {isStopping ? (
                  <Loader2 className="w-3 h-3 animate-spin text-red-500" />
                ) : isRunning ? (
                  <div className="w-3 h-3 bg-red-500 rounded-sm" />
                ) : (
                  <Play className="w-3 h-3 text-green-600 dark:text-green-400 fill-current" />
                )}
              </div>
            )}
            <div
              className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-accent flex items-center justify-center rounded cursor-pointer touch:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                onStartEditingProject(project);
              }}
              title={t('tooltips.renameProject')}
            >
              <Edit3 className="w-3 h-3" />
            </div>
            <div
              className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center rounded cursor-pointer touch:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteProject(project);
              }}
              title={t('tooltips.deleteProject')}
            >
              <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
            </div>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            )}
          </div>
        </Button>
      </div>

      <SidebarProjectSessions
        project={project}
        isExpanded={isExpanded}
        sessions={sessions}
        selectedSession={selectedSession}
        initialSessionsLoaded={initialSessionsLoaded}
        isLoadingSessions={isLoadingSessions}
        currentTime={currentTime}
        editingSession={editingSession}
        editingSessionName={editingSessionName}
        onEditingSessionNameChange={onEditingSessionNameChange}
        onStartEditingSession={onStartEditingSession}
        onCancelEditingSession={onCancelEditingSession}
        onSaveEditingSession={onSaveEditingSession}
        onProjectSelect={onProjectSelect}
        onSessionSelect={onSessionSelect}
        onDeleteSession={onDeleteSession}
        onLoadMoreSessions={onLoadMoreSessions}
        onNewSession={onNewSession}
        touchHandlerFactory={touchHandlerFactory}
        t={t}
      />
    </div>
  );
}
