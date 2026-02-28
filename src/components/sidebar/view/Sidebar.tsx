import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeviceSettings } from '../../../hooks/useDeviceSettings';
import { useVersionCheck } from '../../../hooks/useVersionCheck';
import { useUiPreferences } from '../../../hooks/useUiPreferences';
import { useSidebarController } from '../hooks/useSidebarController';
import { useTaskMaster } from '../../../contexts/TaskMasterContext';
import { useTasksSettings } from '../../../contexts/TasksSettingsContext';
import SidebarCollapsed from './subcomponents/SidebarCollapsed';
import SidebarContent from './subcomponents/SidebarContent';
import SidebarModals from './subcomponents/SidebarModals';
import type { Project } from '../../../types/app';
import type { SidebarProjectListProps } from './subcomponents/SidebarProjectList';
import type { MCPServerStatus, SidebarProps } from '../types/types';

type TaskMasterSidebarContext = {
  setCurrentProject: (project: Project) => void;
  mcpServerStatus: MCPServerStatus;
};

function Sidebar({
  projects,
  selectedProject,
  selectedSession,
  onProjectSelect,
  onSessionSelect,
  onNewSession,
  onSessionDelete,
  onProjectDelete,
  isLoading,
  loadingProgress,
  onRefresh,
  onShowSettings,
  onOpenShellTab,
  showSettings,
  settingsInitialTab,
  onCloseSettings,
  isMobile,
  isMobileSidebarOpen = true,
}: SidebarProps) {
  const { t } = useTranslation(['sidebar', 'common']);
  const { isPWA } = useDeviceSettings({ trackMobile: false });
  const { updateAvailable, latestVersion, currentVersion, releaseInfo, installMode } = useVersionCheck(
    'siteboon',
    'claudecodeui',
  );
  const { preferences, setPreference } = useUiPreferences();
  const { sidebarVisible } = preferences;
  const { setCurrentProject, mcpServerStatus } = useTaskMaster() as TaskMasterSidebarContext;
  const { tasksEnabled } = useTasksSettings();

  const {
    isSidebarCollapsed,
    expandedProjects,
    editingProject,
    showNewProject,
    editingName,
    editingStartupScript,
    availableScripts,
    isLoadingScripts,
    loadingSessions,
    initialSessionsLoaded,
    currentTime,
    isRefreshing,
    editingSession,
    editingSessionName,
    searchFilter,
    deletingProjects,
    deleteConfirmation,
    sessionDeleteConfirmation,
    showVersionModal,
    filteredProjects,
    swipedProject,
    runningProjects,
    stoppingProjects,
    handleTouchClick,
    clearSwipedProject,
    handleProjectTouchStart,
    handleProjectTouchMove,
    toggleProject,
    handleSessionClick,
    toggleStarProject,
    isProjectStarred,
    getProjectSessions,
    startEditing,
    cancelEditing,
    saveProjectName,
    showDeleteSessionConfirmation,
    confirmDeleteSession,
    requestProjectDelete,
    confirmDeleteProject,
    loadMoreSessions,
    handleProjectSelect,
    refreshProjects,
    updateSessionSummary,
    stopProject,
    collapseSidebar: handleCollapseSidebar,
    expandSidebar: handleExpandSidebar,
    setShowNewProject,
    setEditingName,
    setEditingStartupScript,
    setEditingSession,
    setEditingSessionName,
    setSearchFilter,
    setDeleteConfirmation,
    setSessionDeleteConfirmation,
    setShowVersionModal,
  } = useSidebarController({
    projects,
    selectedProject,
    selectedSession,
    isLoading,
    isMobile,
    t,
    onRefresh,
    onProjectSelect,
    onSessionSelect,
    onSessionDelete,
    onProjectDelete,
    setCurrentProject,
    setSidebarVisible: (visible) => setPreference('sidebarVisible', visible),
    sidebarVisible,
    isMobileSidebarOpen,
  });

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.classList.toggle('pwa-mode', isPWA);
    document.body.classList.toggle('pwa-mode', isPWA);
  }, [isPWA]);

  const handleProjectCreated = () => {
    if (window.refreshProjects) {
      void window.refreshProjects();
      return;
    }

    window.location.reload();
  };

  const projectListProps: SidebarProjectListProps = {
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
    onToggleProject: toggleProject,
    onProjectSelect: handleProjectSelect,
    onToggleStarProject: toggleStarProject,
    onStartEditingProject: startEditing,
    onDeleteProject: requestProjectDelete,
    onSessionSelect: handleSessionClick,
    onDeleteSession: showDeleteSessionConfirmation,
    onLoadMoreSessions: (project) => {
      void loadMoreSessions(project);
    },
    onNewSession,
    onEditingSessionNameChange: setEditingSessionName,
    onStartEditingSession: (sessionId, initialName) => {
      setEditingSession(sessionId);
      setEditingSessionName(initialName);
    },
    onCancelEditingSession: () => {
      setEditingSession(null);
      setEditingSessionName('');
    },
    onSaveEditingSession: (projectName, sessionId, summary) => {
      void updateSessionSummary(projectName, sessionId, summary);
    },
    touchHandlerFactory: handleTouchClick,
    onClearSwipedProject: clearSwipedProject,
    onProjectTouchStart: handleProjectTouchStart,
    onProjectTouchMove: handleProjectTouchMove,
    onRunProject: (project) => {
      const startupScript = typeof project.startupScript === 'string' ? project.startupScript : '';
      if (!startupScript) {
        return;
      }
      onOpenShellTab({
        project,
        forcePlain: true,
        clearSession: true,
        initialCommand: startupScript,
        closeSidebar: true,
      });
    },
    onStopProject: (projectName) => {
      void stopProject(projectName);
    },
    t,
  };

  const handleOpenMobileTerminal = () => {
    const expandedProjectName = expandedProjects.size > 0 ? Array.from(expandedProjects)[0] : null;
    const expandedProject =
      expandedProjectName !== null
        ? projects.find((project) => project.name === expandedProjectName) || null
        : null;
    // Mobile bottom Terminal should follow explicit project expansion only.
    // If no project is expanded, always open plain shell in user home directory.
    const terminalProject = expandedProject || null;
    const runningInfo = terminalProject?.name ? runningProjects[terminalProject.name] : null;
    const runningInitialCommand =
      runningInfo?.initialCommand ||
      (typeof terminalProject?.startupScript === 'string' ? terminalProject.startupScript : null) ||
      null;

    onOpenShellTab({
      project: terminalProject,
      forcePlain: true,
      clearSession: true,
      initialCommand: runningInfo ? runningInitialCommand : null,
      closeSidebar: true,
    });
  };

  return (
    <>
      <SidebarModals
        projects={projects}
        showSettings={showSettings}
        settingsInitialTab={settingsInitialTab}
        onCloseSettings={onCloseSettings}
        showNewProject={showNewProject}
        onCloseNewProject={() => setShowNewProject(false)}
        onProjectCreated={handleProjectCreated}
        editingProject={editingProject}
        editingName={editingName}
        editingStartupScript={editingStartupScript}
        availableScripts={availableScripts}
        isLoadingScripts={isLoadingScripts}
        onEditingNameChange={setEditingName}
        onEditingStartupScriptChange={setEditingStartupScript}
        onCancelEditingProject={cancelEditing}
        onSaveProjectName={(projectName) => {
          void saveProjectName(projectName);
        }}
        deleteConfirmation={deleteConfirmation}
        onCancelDeleteProject={() => setDeleteConfirmation(null)}
        onConfirmDeleteProject={confirmDeleteProject}
        sessionDeleteConfirmation={sessionDeleteConfirmation}
        onCancelDeleteSession={() => setSessionDeleteConfirmation(null)}
        onConfirmDeleteSession={confirmDeleteSession}
        showVersionModal={showVersionModal}
        onCloseVersionModal={() => setShowVersionModal(false)}
        releaseInfo={releaseInfo}
        currentVersion={currentVersion}
        latestVersion={latestVersion}
        installMode={installMode}
        t={t}
      />

      {isSidebarCollapsed ? (
        <SidebarCollapsed
          onExpand={handleExpandSidebar}
          onShowSettings={onShowSettings}
          updateAvailable={updateAvailable}
          onShowVersionModal={() => setShowVersionModal(true)}
          t={t}
        />
      ) : (
        <>
          <SidebarContent
            isPWA={isPWA}
            isMobile={isMobile}
            isLoading={isLoading}
            projects={projects}
            searchFilter={searchFilter}
            onSearchFilterChange={setSearchFilter}
            onClearSearchFilter={() => setSearchFilter('')}
            onRefresh={() => {
              void refreshProjects();
            }}
            isRefreshing={isRefreshing}
            onCreateProject={() => setShowNewProject(true)}
            onCollapseSidebar={handleCollapseSidebar}
            updateAvailable={updateAvailable}
            releaseInfo={releaseInfo}
            latestVersion={latestVersion}
            onShowVersionModal={() => setShowVersionModal(true)}
            onShowSettings={onShowSettings}
            onOpenTerminal={handleOpenMobileTerminal}
            onProjectListBackgroundInteraction={clearSwipedProject}
            projectListProps={projectListProps}
            t={t}
          />
        </>
      )}

    </>
  );
}

export default Sidebar;
