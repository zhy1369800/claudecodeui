import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { TFunction } from 'i18next';
import { api } from '../../../utils/api';
import type { Project, ProjectSession, SessionProvider } from '../../../types/app';
import type {
  AdditionalSessionsByProject,
  DeleteProjectConfirmation,
  LoadingSessionsByProject,
  ProjectSortOrder,
  RunningProjectInfo,
  SessionDeleteConfirmation,
  SessionWithProvider,
} from '../types/types';
import {
  filterProjects,
  getAllSessions,
  loadStarredProjects,
  persistStarredProjects,
  readProjectSortOrder,
  sortProjects,
} from '../utils/utils';

type UseSidebarControllerArgs = {
  projects: Project[];
  selectedProject: Project | null;
  selectedSession: ProjectSession | null;
  isLoading: boolean;
  isMobile: boolean;
  t: TFunction;
  onRefresh: () => Promise<void> | void;
  onProjectSelect: (project: Project) => void;
  onSessionSelect: (session: ProjectSession) => void;
  onSessionDelete?: (sessionId: string) => void;
  onProjectDelete?: (projectName: string) => void;
  setCurrentProject: (project: Project) => void;
  setSidebarVisible: (visible: boolean) => void;
  sidebarVisible: boolean;
  isMobileSidebarOpen: boolean;
};

type StartupScriptOption = {
  name: string;
  command: string;
  type?: string;
};

export function useSidebarController({
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
  setSidebarVisible,
  sidebarVisible,
  isMobileSidebarOpen,
}: UseSidebarControllerArgs) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editingStartupScript, setEditingStartupScript] = useState('');
  const [availableScripts, setAvailableScripts] = useState<StartupScriptOption[]>([]);
  const [isLoadingScripts, setIsLoadingScripts] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState<LoadingSessionsByProject>({});
  const [additionalSessions, setAdditionalSessions] = useState<AdditionalSessionsByProject>({});
  const [initialSessionsLoaded, setInitialSessionsLoaded] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [projectSortOrder, setProjectSortOrder] = useState<ProjectSortOrder>('name');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [projectHasMoreOverrides, setProjectHasMoreOverrides] = useState<Record<string, boolean>>({});
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [deletingProjects, setDeletingProjects] = useState<Set<string>>(new Set());
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteProjectConfirmation | null>(null);
  const [sessionDeleteConfirmation, setSessionDeleteConfirmation] = useState<SessionDeleteConfirmation | null>(null);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [starredProjects, setStarredProjects] = useState<Set<string>>(() => loadStarredProjects());
  const [swipedProject, setSwipedProject] = useState<string | null>(null);
  const [runningProjects, setRunningProjects] = useState<Record<string, RunningProjectInfo>>({});
  const [stoppingProjects, setStoppingProjects] = useState<Set<string>>(new Set());
  const touchStartX = useRef<number | null>(null);
  const runningFetchIdRef = useRef(0);

  const isSidebarCollapsed = !isMobile && !sidebarVisible;
  const shouldPollRunningProjects = isMobile ? isMobileSidebarOpen : sidebarVisible;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setAdditionalSessions({});
    setInitialSessionsLoaded(new Set());
    setProjectHasMoreOverrides({});
  }, [projects]);

  useEffect(() => {
    if (selectedProject) {
      setExpandedProjects((prev) => {
        if (prev.has(selectedProject.name)) {
          return prev;
        }
        const next = new Set(prev);
        next.add(selectedProject.name);
        return next;
      });
    }
  }, [selectedSession, selectedProject]);

  useEffect(() => {
    setSwipedProject((prev) => (prev === null ? prev : null));
  }, [projects, sidebarVisible]);

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      setSwipedProject((prev) => (prev === null ? prev : null));
    }
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    if (projects.length > 0 && !isLoading) {
      const loadedProjects = new Set<string>();
      projects.forEach((project) => {
        if (project.sessions && project.sessions.length >= 0) {
          loadedProjects.add(project.name);
        }
      });
      setInitialSessionsLoaded(loadedProjects);
    }
  }, [projects, isLoading]);

  useEffect(() => {
    const loadSortOrder = () => {
      setProjectSortOrder(readProjectSortOrder());
    };

    loadSortOrder();

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'claude-settings') {
        loadSortOrder();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    const interval = setInterval(() => {
      if (document.hasFocus()) {
        loadSortOrder();
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const handleTouchClick = useCallback(
    (callback: () => void) =>
      (event: React.TouchEvent<HTMLElement>) => {
        const target = event.target as HTMLElement;
        if (target.closest('.overflow-y-auto') || target.closest('[data-scroll-container]')) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        callback();
      },
    [],
  );

  const clearSwipedProject = useCallback(() => {
    setSwipedProject((prev) => (prev === null ? prev : null));
  }, []);

  const handleProjectTouchStart = useCallback((event: React.TouchEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (
      target?.closest('button') ||
      target?.closest('input') ||
      target?.closest('textarea') ||
      target?.closest('a') ||
      target?.closest('[role="button"]')
    ) {
      touchStartX.current = null;
      return;
    }

    const pointX = event.touches[0]?.clientX;
    if (typeof pointX !== 'number') {
      touchStartX.current = null;
      return;
    }

    touchStartX.current = pointX;
  }, []);

  const handleProjectTouchMove = useCallback(
    (event: React.TouchEvent<HTMLElement>, projectName: string) => {
      if (touchStartX.current === null) {
        return;
      }

      const pointX = event.touches[0]?.clientX;
      if (typeof pointX !== 'number') {
        return;
      }

      const diff = touchStartX.current - pointX;

      if (diff > 40) {
        setSwipedProject((prev) => (prev === projectName ? prev : projectName));
      } else if (diff < -40) {
        setSwipedProject((prev) => (prev === null ? prev : null));
      }
    },
    [],
  );

  const toggleProject = useCallback((projectName: string) => {
    setExpandedProjects((prev) => {
      const next = new Set<string>();
      if (!prev.has(projectName)) {
        next.add(projectName);
      }
      return next;
    });
  }, []);

  const handleSessionClick = useCallback(
    (session: SessionWithProvider, projectName: string) => {
      onSessionSelect({ ...session, __projectName: projectName });
    },
    [onSessionSelect],
  );

  const toggleStarProject = useCallback((projectName: string) => {
    setStarredProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectName)) {
        next.delete(projectName);
      } else {
        next.add(projectName);
      }

      persistStarredProjects(next);
      return next;
    });
  }, []);

  const isProjectStarred = useCallback(
    (projectName: string) => starredProjects.has(projectName),
    [starredProjects],
  );

  const getProjectSessions = useCallback(
    (project: Project) => getAllSessions(project, additionalSessions),
    [additionalSessions],
  );

  const projectsWithSessionMeta = useMemo(
    () =>
      projects.map((project) => {
        const hasMoreOverride = projectHasMoreOverrides[project.name];
        if (hasMoreOverride === undefined) {
          return project;
        }

        return {
          ...project,
          sessionMeta: { ...project.sessionMeta, hasMore: hasMoreOverride },
        };
      }),
    [projectHasMoreOverrides, projects],
  );

  const sortedProjects = useMemo(
    () => sortProjects(projectsWithSessionMeta, projectSortOrder, starredProjects, additionalSessions),
    [additionalSessions, projectSortOrder, projectsWithSessionMeta, starredProjects],
  );

  const filteredProjects = useMemo(
    () => filterProjects(sortedProjects, searchFilter),
    [searchFilter, sortedProjects],
  );

  const startEditing = useCallback(async (project: Project) => {
    setEditingProject(project.name);
    setEditingName(project.displayName);
    setEditingStartupScript(typeof project.startupScript === 'string' ? project.startupScript : '');
    setAvailableScripts([]);
    setIsLoadingScripts(true);

    try {
      const response = await api.scanScripts(project.fullPath);
      if (response.ok) {
        const payload = (await response.json()) as { scripts?: StartupScriptOption[] };
        setAvailableScripts(payload.scripts || []);
      }
    } catch (error) {
      console.error('Error scanning scripts:', error);
    } finally {
      setIsLoadingScripts(false);
    }
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingProject(null);
    setEditingName('');
    setEditingStartupScript('');
    setAvailableScripts([]);
    setIsLoadingScripts(false);
  }, []);

  const saveProjectName = useCallback(
    async (projectName: string) => {
      try {
        const response = await api.renameProject(projectName, editingName, editingStartupScript || null);
        if (response.ok) {
          if (window.refreshProjects) {
            await window.refreshProjects();
          } else {
            window.location.reload();
          }
        } else {
          console.error('Failed to rename project');
        }
      } catch (error) {
        console.error('Error renaming project:', error);
      } finally {
        setEditingProject(null);
        setEditingName('');
        setEditingStartupScript('');
        setAvailableScripts([]);
        setIsLoadingScripts(false);
      }
    },
    [editingName, editingStartupScript],
  );

  const showDeleteSessionConfirmation = useCallback(
    (
      projectName: string,
      sessionId: string,
      sessionTitle: string,
      provider: SessionDeleteConfirmation['provider'] = 'claude',
    ) => {
      setSessionDeleteConfirmation({ projectName, sessionId, sessionTitle, provider });
    },
    [],
  );

  const confirmDeleteSession = useCallback(async () => {
    if (!sessionDeleteConfirmation) {
      return;
    }

    const { projectName, sessionId, provider } = sessionDeleteConfirmation;
    setSessionDeleteConfirmation(null);

    try {
      let response;
      if (provider === 'codex') {
        response = await api.deleteCodexSession(sessionId);
      } else if (provider === 'gemini') {
        response = await api.deleteGeminiSession(sessionId);
      } else {
        response = await api.deleteSession(projectName, sessionId);
      }

      if (response.ok) {
        onSessionDelete?.(sessionId);
      } else {
        const errorText = await response.text();
        console.error('[Sidebar] Failed to delete session:', {
          status: response.status,
          error: errorText,
        });
        alert(t('messages.deleteSessionFailed'));
      }
    } catch (error) {
      console.error('[Sidebar] Error deleting session:', error);
      alert(t('messages.deleteSessionError'));
    }
  }, [onSessionDelete, sessionDeleteConfirmation, t]);

  const requestProjectDelete = useCallback(
    (project: Project) => {
      setDeleteConfirmation({
        project,
        sessionCount: getProjectSessions(project).length,
      });
    },
    [getProjectSessions],
  );

  const confirmDeleteProject = useCallback(async () => {
    if (!deleteConfirmation) {
      return;
    }

    const { project, sessionCount } = deleteConfirmation;
    const isEmpty = sessionCount === 0;

    setDeleteConfirmation(null);
    setDeletingProjects((prev) => new Set([...prev, project.name]));

    try {
      const response = await api.deleteProject(project.name, !isEmpty);

      if (response.ok) {
        onProjectDelete?.(project.name);
      } else {
        const error = (await response.json()) as { error?: string };
        alert(error.error || t('messages.deleteProjectFailed'));
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert(t('messages.deleteProjectError'));
    } finally {
      setDeletingProjects((prev) => {
        const next = new Set(prev);
        next.delete(project.name);
        return next;
      });
    }
  }, [deleteConfirmation, onProjectDelete, t]);

  const loadMoreSessions = useCallback(
    async (project: Project) => {
      const hasMoreOverride = projectHasMoreOverrides[project.name];
      const canLoadMore =
        hasMoreOverride !== undefined ? hasMoreOverride : project.sessionMeta?.hasMore === true;
      if (!canLoadMore || loadingSessions[project.name]) {
        return;
      }

      setLoadingSessions((prev) => ({ ...prev, [project.name]: true }));

      try {
        const currentSessionCount =
          (project.sessions?.length || 0) + (additionalSessions[project.name]?.length || 0);
        const response = await api.sessions(project.name, 5, currentSessionCount);

        if (!response.ok) {
          return;
        }

        const result = (await response.json()) as {
          sessions?: ProjectSession[];
          hasMore?: boolean;
        };

        setAdditionalSessions((prev) => ({
          ...prev,
          [project.name]: [...(prev[project.name] || []), ...(result.sessions || [])],
        }));

        if (result.hasMore === false) {
          // Keep hasMore state in local hook state instead of mutating the project prop object.
          setProjectHasMoreOverrides((prev) => ({ ...prev, [project.name]: false }));
        }
      } catch (error) {
        console.error('Error loading more sessions:', error);
      } finally {
        setLoadingSessions((prev) => ({ ...prev, [project.name]: false }));
      }
    },
    [additionalSessions, loadingSessions, projectHasMoreOverrides],
  );

  const handleProjectSelect = useCallback(
    (project: Project) => {
      onProjectSelect(project);
      setCurrentProject(project);
    },
    [onProjectSelect, setCurrentProject],
  );

  const refreshProjects = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  const updateSessionSummary = useCallback(
    async (_projectName: string, sessionId: string, summary: string, provider: SessionProvider) => {
      const trimmed = summary.trim();
      if (!trimmed) {
        setEditingSession(null);
        setEditingSessionName('');
        return;
      }
      try {
        const response = await api.renameSession(sessionId, trimmed, provider);
        if (response.ok) {
          await onRefresh();
        } else {
          console.error('[Sidebar] Failed to rename session:', response.status);
          alert(t('messages.renameSessionFailed'));
        }
      } catch (error) {
        console.error('[Sidebar] Error renaming session:', error);
        alert(t('messages.renameSessionError'));
      } finally {
        setEditingSession(null);
        setEditingSessionName('');
      }
    },
    [onRefresh, t],
  );

  const collapseSidebar = useCallback(() => {
    setSidebarVisible(false);
  }, [setSidebarVisible]);

  const expandSidebar = useCallback(() => {
    setSidebarVisible(true);
  }, [setSidebarVisible]);

  const fetchRunningProjects = useCallback(async () => {
    const requestId = ++runningFetchIdRef.current;
    try {
      const response = await api.getRunningProjects();
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { running?: RunningProjectInfo[] };
      if (requestId !== runningFetchIdRef.current) {
        return;
      }

      const next: Record<string, RunningProjectInfo> = {};
      for (const item of payload.running || []) {
        if (!item?.name) {
          continue;
        }
        next[item.name] = item;
      }
      setRunningProjects(next);
    } catch (error) {
      console.error('Error fetching running projects:', error);
    }
  }, []);

  const stopProject = useCallback(
    async (projectName: string) => {
      setStoppingProjects((prev) => new Set([...prev, projectName]));
      setRunningProjects((prev) => {
        const next = { ...prev };
        delete next[projectName];
        return next;
      });

      try {
        const response = await api.stopProject(projectName);
        if (!response.ok) {
          throw new Error(`Failed to stop project: ${response.status}`);
        }
      } catch (error) {
        console.error('Error stopping project:', error);
      } finally {
        await fetchRunningProjects();
        setStoppingProjects((prev) => {
          const next = new Set(prev);
          next.delete(projectName);
          return next;
        });
      }
    },
    [fetchRunningProjects],
  );

  useEffect(() => {
    if (!shouldPollRunningProjects) {
      return;
    }

    let timer: number | null = null;
    const pollIntervalMs = 12000;

    const schedule = () => {
      if (timer !== null) {
        window.clearInterval(timer);
      }
      timer = window.setInterval(() => {
        if (document.visibilityState !== 'visible') {
          return;
        }
        void fetchRunningProjects();
      }, pollIntervalMs);
    };

    void fetchRunningProjects();
    schedule();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchRunningProjects();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (timer !== null) {
        window.clearInterval(timer);
      }
    };
  }, [fetchRunningProjects, shouldPollRunningProjects]);

  return {
    isSidebarCollapsed,
    expandedProjects,
    editingProject,
    showNewProject,
    editingName,
    editingStartupScript,
    availableScripts,
    isLoadingScripts,
    loadingSessions,
    additionalSessions,
    initialSessionsLoaded,
    currentTime,
    projectSortOrder,
    isRefreshing,
    editingSession,
    editingSessionName,
    searchFilter,
    deletingProjects,
    deleteConfirmation,
    sessionDeleteConfirmation,
    showVersionModal,
    starredProjects,
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
    collapseSidebar,
    expandSidebar,
    setShowNewProject,
    setEditingName,
    setEditingStartupScript,
    setEditingSession,
    setEditingSessionName,
    setSearchFilter,
    setDeleteConfirmation,
    setSessionDeleteConfirmation,
    setShowVersionModal,
  };
}
