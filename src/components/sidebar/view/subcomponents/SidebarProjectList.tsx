import { useEffect } from 'react';
import type React from 'react';
import type { TFunction } from 'i18next';
import type { LoadingProgress, Project, ProjectSession, SessionProvider } from '../../../../types/app';
import type {
  LoadingSessionsByProject,
  MCPServerStatus,
  RunningProjectInfo,
  SessionWithProvider,
  TouchHandlerFactory,
} from '../../types/types';
import SidebarProjectItem from './SidebarProjectItem';
import SidebarProjectsState from './SidebarProjectsState';

export type SidebarProjectListProps = {
  projects: Project[];
  filteredProjects: Project[];
  selectedProject: Project | null;
  selectedSession: ProjectSession | null;
  isLoading: boolean;
  loadingProgress: LoadingProgress | null;
  expandedProjects: Set<string>;
  loadingSessions: LoadingSessionsByProject;
  initialSessionsLoaded: Set<string>;
  currentTime: Date;
  editingSession: string | null;
  editingSessionName: string;
  deletingProjects: Set<string>;
  swipedProject: string | null;
  tasksEnabled: boolean;
  mcpServerStatus: MCPServerStatus;
  runningProjects: Record<string, RunningProjectInfo>;
  stoppingProjects: Set<string>;
  getProjectSessions: (project: Project) => SessionWithProvider[];
  isProjectStarred: (projectName: string) => boolean;
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
  onSaveEditingSession: (projectName: string, sessionId: string, summary: string) => void;
  touchHandlerFactory: TouchHandlerFactory;
  onClearSwipedProject: () => void;
  onProjectTouchStart: (event: React.TouchEvent<HTMLElement>) => void;
  onProjectTouchMove: (event: React.TouchEvent<HTMLElement>, projectName: string) => void;
  onRunProject: (project: Project) => void;
  onStopProject: (projectName: string) => void;
  t: TFunction;
};

export default function SidebarProjectList({
  projects,
  filteredProjects,
  selectedProject,
  selectedSession,
  isLoading,
  loadingProgress,
  expandedProjects,
  loadingSessions,
  initialSessionsLoaded,
  currentTime,
  editingSession,
  editingSessionName,
  deletingProjects,
  swipedProject,
  tasksEnabled,
  mcpServerStatus,
  runningProjects,
  stoppingProjects,
  getProjectSessions,
  isProjectStarred,
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
}: SidebarProjectListProps) {
  const state = (
    <SidebarProjectsState
      isLoading={isLoading}
      loadingProgress={loadingProgress}
      projectsCount={projects.length}
      filteredProjectsCount={filteredProjects.length}
      t={t}
    />
  );

  useEffect(() => {
    let baseTitle = 'CloudCLI UI';
    const displayName = selectedProject?.displayName?.trim();
    if (displayName) {
      baseTitle = `${displayName} - ${baseTitle}`;
    }
    document.title = baseTitle;
  }, [selectedProject]);

  const showProjects = !isLoading && projects.length > 0 && filteredProjects.length > 0;

  return (
    <div className="md:space-y-1 pb-safe-area-inset-bottom">
      {!showProjects
        ? state
        : filteredProjects.map((project) => (
            <SidebarProjectItem
              key={project.name}
              project={project}
              selectedProject={selectedProject}
              selectedSession={selectedSession}
              isExpanded={expandedProjects.has(project.name)}
              isDeleting={deletingProjects.has(project.name)}
              isStarred={isProjectStarred(project.name)}
              sessions={getProjectSessions(project)}
              initialSessionsLoaded={initialSessionsLoaded.has(project.name)}
              isLoadingSessions={Boolean(loadingSessions[project.name])}
              currentTime={currentTime}
              editingSession={editingSession}
              editingSessionName={editingSessionName}
              tasksEnabled={tasksEnabled}
              mcpServerStatus={mcpServerStatus}
              runningInfo={runningProjects[project.name] || null}
              isStopping={stoppingProjects.has(project.name)}
              isSwiped={swipedProject === project.name}
              onToggleProject={onToggleProject}
              onProjectSelect={onProjectSelect}
              onToggleStarProject={onToggleStarProject}
              onStartEditingProject={onStartEditingProject}
              onDeleteProject={onDeleteProject}
              onSessionSelect={onSessionSelect}
              onDeleteSession={onDeleteSession}
              onLoadMoreSessions={onLoadMoreSessions}
              onNewSession={onNewSession}
              onEditingSessionNameChange={onEditingSessionNameChange}
              onStartEditingSession={onStartEditingSession}
              onCancelEditingSession={onCancelEditingSession}
              onSaveEditingSession={onSaveEditingSession}
              touchHandlerFactory={touchHandlerFactory}
              onClearSwipedProject={onClearSwipedProject}
              onProjectTouchStart={onProjectTouchStart}
              onProjectTouchMove={onProjectTouchMove}
              onRunProject={onRunProject}
              onStopProject={onStopProject}
              t={t}
            />
          ))}
    </div>
  );
}
