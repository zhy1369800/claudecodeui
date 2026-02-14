import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Folder, FolderOpen, File, FileText, FileCode, List, TableProperties, Eye, Search, X, FilePlus2, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import CodeEditor from './CodeEditor';
import ImageViewer from './ImageViewer';
import { api } from '../utils/api';

function FileTree({ selectedProject, onFileOpen = null, onSelectionChange = null }) {
  const { t } = useTranslation();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [viewMode, setViewMode] = useState('detailed'); // 'simple', 'detailed', 'compact'
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [isMutating, setIsMutating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createType, setCreateType] = useState('file');
  const [createNameInput, setCreateNameInput] = useState('');
  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  useEffect(() => {
    if (selectedProject) {
      fetchFiles();
    }
  }, [selectedProject]);

  useEffect(() => {
    const validPaths = new Set(collectDirectoryPaths(files, []).map(item => item.path));
    setSelectedPaths((prev) => {
      const next = new Set();
      prev.forEach((path) => {
        if (validPaths.has(path)) next.add(path);
      });
      return next;
    });
  }, [files]);

  // Report selection count to parent
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectionMode ? selectedPaths.size : 0);
    }
  }, [selectedPaths.size, selectionMode, onSelectionChange]);

  // Load view mode preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('file-tree-view-mode');
    if (savedViewMode && ['simple', 'detailed', 'compact'].includes(savedViewMode)) {
      setViewMode(savedViewMode);
    } else {
      setViewMode('simple');
    }
  }, []);

  // Filter files based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFiles(files);
    } else {
      const filtered = filterFiles(files, searchQuery.toLowerCase());
      setFilteredFiles(filtered);

      // Auto-expand directories that contain matches
      const expandMatches = (items) => {
        items.forEach(item => {
          if (item.type === 'directory' && item.children && item.children.length > 0) {
            setExpandedDirs(prev => new Set(prev.add(item.path)));
            expandMatches(item.children);
          }
        });
      };
      expandMatches(filtered);
    }
  }, [files, searchQuery]);

  // Recursively filter files and directories based on search query
  const filterFiles = (items, query) => {
    return items.reduce((filtered, item) => {
      const matchesName = item.name.toLowerCase().includes(query);
      let filteredChildren = [];

      if (item.type === 'directory' && item.children) {
        filteredChildren = filterFiles(item.children, query);
      }

      // Include item if:
      // 1. It matches the search query, or
      // 2. It's a directory with matching children
      if (matchesName || filteredChildren.length > 0) {
        filtered.push({
          ...item,
          children: filteredChildren
        });
      }

      return filtered;
    }, []);
  };

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const response = await api.getFiles(selectedProject.name);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ File fetch failed:', response.status, errorText);
        setFiles([]);
        return;
      }
      
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      console.error('❌ Error fetching files:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const openTextFile = (item) => {
    if (typeof onFileOpen === 'function') {
      onFileOpen(item.path);
      return;
    }

    setSelectedFile({
      name: item.name,
      path: item.path,
      projectPath: selectedProject.path,
      projectName: selectedProject.name
    });
  };

  const combineRelativePath = (basePath, namePath) => {
    const normalizedBase = (basePath || '').trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
    const normalizedName = (namePath || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalizedBase || normalizedBase === '.') return normalizedName;
    return normalizedName ? `${normalizedBase}/${normalizedName}` : normalizedBase;
  };

  const collectDirectoryPaths = (items, acc = []) => {
    items.forEach((item) => {
      acc.push(item);
      if (Array.isArray(item.children) && item.children.length > 0) {
        collectDirectoryPaths(item.children, acc);
      }
    });
    return acc;
  };

  const flatItems = collectDirectoryPaths(files, []);

  const getItemByPath = (targetPath) => flatItems.find(item => item.path === targetPath) || null;

  const getVisibleItems = (items, acc = []) => {
    items.forEach((item) => {
      acc.push(item);
      if (item.type === 'directory' && expandedDirs.has(item.path) && Array.isArray(item.children) && item.children.length > 0) {
        getVisibleItems(item.children, acc);
      }
    });
    return acc;
  };

  const visibleItems = getVisibleItems(filteredFiles, []);

  const getCreateBasePath = () => {
    if (selectedPaths.size !== 1) return '.';
    const selectedPath = Array.from(selectedPaths)[0];
    const selectedItem = getItemByPath(selectedPath);
    if (!selectedItem) return '.';
    if (selectedItem.type === 'directory') return selectedItem.path;
    const normalizedPath = selectedItem.path.replace(/\\/g, '/');
    const lastSlash = normalizedPath.lastIndexOf('/');
    return lastSlash > 0 ? normalizedPath.slice(0, lastSlash) : '.';
  };

  const createBasePath = getCreateBasePath();
  const createTargetPath = combineRelativePath(createBasePath, createNameInput);

  const toggleRowSelection = (itemPath, additive = false) => {
    setSelectedPaths((prev) => {
      if (!additive) {
        return new Set([itemPath]);
      }
      const next = new Set(prev);
      if (next.has(itemPath)) next.delete(itemPath);
      else next.add(itemPath);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedPaths(new Set());
  };

  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every(item => selectedPaths.has(item.path));

  const toggleSelectAllVisible = () => {
    setSelectedPaths((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        visibleItems.forEach(item => next.delete(item.path));
        return next;
      }
      const next = new Set(prev);
      visibleItems.forEach(item => next.add(item.path));
      return next;
    });
  };

  const handleCreate = async () => {
    if (!selectedProject?.name) return;

    const targetPath = createTargetPath;
    if (!targetPath) return;

    setIsMutating(true);
    try {
      const response = await api.createFileSystemEntry(selectedProject.name, targetPath, createType, '');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || t('messages.operationFailed'));
      }
      await fetchFiles();
      setShowCreateDialog(false);
      setCreateNameInput('');
    } catch (error) {
      alert(`${t('messages.operationFailed') || 'Operation failed'}: ${error.message}`);
    } finally {
      setIsMutating(false);
    }
  };

  const openCreateDialog = () => {
    setCreateType('file');
    setCreateNameInput('');
    setShowCreateDialog(true);
  };

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) {
        clearSelection();
      }
      return !prev;
    });
  };

  const handleBatchDelete = async () => {
    if (!selectedProject?.name || selectedPaths.size === 0) return;
    const confirmText = t('fileTree.deleteSelectedConfirm', { defaultValue: 'Delete selected items?' });
    if (!window.confirm(`${confirmText} (${selectedPaths.size})`)) return;

    setIsMutating(true);
    try {
      const paths = Array.from(selectedPaths).sort((a, b) => b.length - a.length);
      const failed = [];
      for (const itemPath of paths) {
        const response = await api.deleteFileSystemEntry(selectedProject.name, itemPath);
        if (!response.ok) {
          failed.push(itemPath);
        }
      }
      if (failed.length > 0) {
        throw new Error(`${failed.length} ${t('messages.operationFailed') || 'operation failed'}`);
      }
      setSelectedFile(null);
      setSelectedImage(null);
      clearSelection();
      await fetchFiles();
    } catch (error) {
      alert(`${t('messages.operationFailed') || 'Operation failed'}: ${error.message}`);
    } finally {
      setIsMutating(false);
    }
  };

  const openItem = (item) => {
    if (item.type === 'directory') {
      toggleDirectory(item.path);
    } else if (isImageFile(item.name)) {
      setSelectedImage({
        name: item.name,
        path: item.path,
        projectPath: selectedProject.path,
        projectName: selectedProject.name
      });
    } else {
      openTextFile(item);
    }
  };

  const toggleDirectory = (path) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  };

  // Change view mode and save preference
  const changeViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('file-tree-view-mode', mode);
  };

  const cycleMobileViewMode = () => {
    const orderedModes = ['simple', 'compact', 'detailed'];
    const currentIndex = orderedModes.indexOf(viewMode);
    const nextMode = orderedModes[(currentIndex + 1) % orderedModes.length];
    changeViewMode(nextMode);
  };

  const getViewModeIcon = () => {
    if (viewMode === 'compact') return <Eye className="w-4 h-4" />;
    if (viewMode === 'detailed') return <TableProperties className="w-4 h-4" />;
    return <List className="w-4 h-4" />;
  };

  const getViewModeTitle = () => {
    if (viewMode === 'compact') return t('fileTree.compactView');
    if (viewMode === 'detailed') return t('fileTree.detailedView');
    return t('fileTree.simpleView');
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format date as relative time
  const formatRelativeTime = (date) => {
    if (!date) return '-';
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now - past) / 1000);

    if (diffInSeconds < 60) return t('fileTree.justNow');
    if (diffInSeconds < 3600) return t('fileTree.minAgo', { count: Math.floor(diffInSeconds / 60) });
    if (diffInSeconds < 86400) return t('fileTree.hoursAgo', { count: Math.floor(diffInSeconds / 3600) });
    if (diffInSeconds < 2592000) return t('fileTree.daysAgo', { count: Math.floor(diffInSeconds / 86400) });
    return past.toLocaleDateString();
  };

  const renderFileTree = (items, level = 0) => {
    return items.map((item) => (
      <div key={item.path} className="select-none">
        <div
          className={cn(
            "w-full p-2 h-auto font-normal text-left hover:bg-accent rounded-md cursor-pointer",
            selectedPaths.has(item.path) && "bg-accent/70",
          )}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={(e) => {
            if (selectionMode) {
              toggleRowSelection(item.path, e.ctrlKey || e.metaKey);
            } else {
              openItem(item);
            }
          }}
          onDoubleClick={() => {
            if (selectionMode) {
              openItem(item);
            }
          }}
        >
          <div className="flex items-center gap-2 min-w-0 w-full">
            {selectionMode && (
              <input
                type="checkbox"
                checked={selectedPaths.has(item.path)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleRowSelection(item.path, true);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {item.type === 'directory' ? (
              expandedDirs.has(item.path) ? (
                <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              getFileIcon(item.name)
            )}
            <span className="text-sm truncate text-foreground">
              {item.name}
            </span>
          </div>
        </div>
        
        {item.type === 'directory' && 
         expandedDirs.has(item.path) && 
         item.children && 
         item.children.length > 0 && (
          <div>
            {renderFileTree(item.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const isImageFile = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
    return imageExtensions.includes(ext);
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'];
    const docExtensions = ['md', 'txt', 'doc', 'pdf'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
    
    if (codeExtensions.includes(ext)) {
      return <FileCode className="w-4 h-4 text-green-500 flex-shrink-0" />;
    } else if (docExtensions.includes(ext)) {
      return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    } else if (imageExtensions.includes(ext)) {
      return <File className="w-4 h-4 text-purple-500 flex-shrink-0" />;
    } else {
      return <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
    }
  };

  // Render detailed view with table-like layout
  const renderDetailedView = (items, level = 0) => {
    return items.map((item) => (
      <div key={item.path} className="select-none">
        <div
          className={cn(
            "grid grid-cols-12 gap-2 p-2 hover:bg-accent cursor-pointer items-center",
            selectedPaths.has(item.path) && "bg-accent/70",
          )}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={(e) => {
            if (selectionMode) {
              toggleRowSelection(item.path, e.ctrlKey || e.metaKey);
            } else {
              openItem(item);
            }
          }}
          onDoubleClick={() => {
            if (selectionMode) {
              openItem(item);
            }
          }}
        >
          {selectionMode && (
            <div className="col-span-1 flex items-center">
              <input
                type="checkbox"
                checked={selectedPaths.has(item.path)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleRowSelection(item.path, true);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className={cn('flex items-center gap-2 min-w-0', selectionMode ? 'col-span-4' : 'col-span-5')}>
            {item.type === 'directory' ? (
              expandedDirs.has(item.path) ? (
                <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              getFileIcon(item.name)
            )}
            <span className="text-sm truncate text-foreground">
              {item.name}
            </span>
          </div>
          <div className="col-span-2 text-sm text-muted-foreground">
            {item.type === 'file' ? formatFileSize(item.size) : '-'}
          </div>
          <div className="col-span-3 text-sm text-muted-foreground">
            {formatRelativeTime(item.modified)}
          </div>
          <div className="col-span-2 text-sm text-muted-foreground font-mono">
            {item.permissionsRwx || '-'}
          </div>
        </div>
        
        {item.type === 'directory' && 
         expandedDirs.has(item.path) && 
         item.children && 
         renderDetailedView(item.children, level + 1)}
      </div>
    ));
  };

  // Render compact view with inline details
  const renderCompactView = (items, level = 0) => {
    return items.map((item) => (
      <div key={item.path} className="select-none">
        <div
          className={cn(
            "flex items-center justify-between p-2 hover:bg-accent cursor-pointer",
            selectedPaths.has(item.path) && "bg-accent/70",
          )}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={(e) => {
            if (selectionMode) {
              toggleRowSelection(item.path, e.ctrlKey || e.metaKey);
            } else {
              openItem(item);
            }
          }}
          onDoubleClick={() => {
            if (selectionMode) {
              openItem(item);
            }
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {selectionMode && (
              <input
                type="checkbox"
                checked={selectedPaths.has(item.path)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleRowSelection(item.path, true);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {item.type === 'directory' ? (
              expandedDirs.has(item.path) ? (
                <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              getFileIcon(item.name)
            )}
            <span className="text-sm truncate text-foreground">
              {item.name}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {item.type === 'file' && (
              <>
                <span>{formatFileSize(item.size)}</span>
                <span className="font-mono">{item.permissionsRwx}</span>
              </>
            )}
          </div>
        </div>
        
        {item.type === 'directory' && 
         expandedDirs.has(item.path) && 
         item.children && 
         renderCompactView(item.children, level + 1)}
      </div>
    ));
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">
          {t('fileTree.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header with Search and View Mode Toggle */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {selectionMode && (
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAllVisible}
                disabled={visibleItems.length === 0}
              />
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary transition-colors"
              onClick={toggleSelectionMode}
              title={t('fileTree.toggleSelectionMode', { defaultValue: 'Toggle selection mode' })}
            >
              <span>{t('fileTree.files')}</span>
              {selectionMode ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="relative w-full max-w-[520px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('fileTree.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-8 h-10 text-sm"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-accent"
                  onClick={() => setSearchQuery('')}
                  title={t('fileTree.clearSearch')}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0"
                onClick={openCreateDialog}
                title={t('buttons.create')}
                disabled={isMutating || !selectedProject}
              >
                <FilePlus2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-10 w-10 p-0 hover:text-red-600",
                  selectionMode ? "text-red-500" : "text-white"
                )}
                onClick={handleBatchDelete}
                title={t('fileTree.deleteSelected', { defaultValue: 'Delete selected' })}
                disabled={isMutating || !selectionMode || selectedPaths.size === 0}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <div className="flex gap-1 sm:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0"
                  onClick={cycleMobileViewMode}
                  title={getViewModeTitle()}
                >
                  {getViewModeIcon()}
                </Button>
              </div>
              <div className="hidden sm:flex gap-1">
                <Button
                  variant={viewMode === 'simple' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-10 w-10 p-0"
                  onClick={() => changeViewMode('simple')}
                  title={t('fileTree.simpleView')}
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'compact' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-10 w-10 p-0"
                  onClick={() => changeViewMode('compact')}
                  title={t('fileTree.compactView')}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'detailed' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-10 w-10 p-0"
                  onClick={() => changeViewMode('detailed')}
                  title={t('fileTree.detailedView')}
                >
                  <TableProperties className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Column Headers for Detailed View */}
      {viewMode === 'detailed' && filteredFiles.length > 0 && (
        <div className="px-4 pt-2 pb-1 border-b border-border">
          <div className="grid grid-cols-12 gap-2 px-2 text-xs font-medium text-muted-foreground">
            {selectionMode && (
              <div className="col-span-1">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  disabled={visibleItems.length === 0}
                />
              </div>
            )}
            <div className={selectionMode ? 'col-span-4' : 'col-span-5'}>{t('fileTree.name')}</div>
            <div className="col-span-2">{t('fileTree.size')}</div>
            <div className="col-span-3">{t('fileTree.modified')}</div>
            <div className="col-span-2">{t('fileTree.permissions')}</div>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        {files.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3">
              <Folder className="w-6 h-6 text-muted-foreground" />
            </div>
            <h4 className="font-medium text-foreground mb-1">{t('fileTree.noFilesFound')}</h4>
            <p className="text-sm text-muted-foreground">
              {t('fileTree.checkProjectPath')}
            </p>
          </div>
        ) : filteredFiles.length === 0 && searchQuery ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <h4 className="font-medium text-foreground mb-1">{t('fileTree.noMatchesFound')}</h4>
            <p className="text-sm text-muted-foreground">
              {t('fileTree.tryDifferentSearch')}
            </p>
          </div>
        ) : (
          <div className={viewMode === 'detailed' ? '' : 'space-y-1'}>
            {viewMode === 'simple' && renderFileTree(filteredFiles)}
            {viewMode === 'compact' && renderCompactView(filteredFiles)}
            {viewMode === 'detailed' && renderDetailedView(filteredFiles)}
          </div>
        )}
      </ScrollArea>
      
      {/* Code Editor Modal */}
      {selectedFile && !onFileOpen && (
        <CodeEditor
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          projectPath={selectedFile.projectPath}
        />
      )}
      
      {/* Image Viewer Modal */}
      {selectedImage && (
        <ImageViewer
          file={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}

      {showCreateDialog && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">
                {t('fileTree.createEntryTitle', { defaultValue: 'Create new entry' })}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setShowCreateDialog(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <div className="text-sm font-medium text-foreground mb-2">
                  {t('fileTree.createType', { defaultValue: 'Type' })}
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="radio"
                      name="create-type"
                      checked={createType === 'file'}
                      onChange={() => setCreateType('file')}
                    />
                    {t('fileTree.fileLabel', { defaultValue: 'file' })}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="radio"
                      name="create-type"
                      checked={createType === 'directory'}
                      onChange={() => setCreateType('directory')}
                    />
                    {t('fileTree.folderLabel', { defaultValue: 'folder' })}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('fileTree.parentDirectory', { defaultValue: 'Parent directory' })}
                </label>
                <div className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground flex items-center font-mono">
                  {createBasePath || '.'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('fileTree.nameOrPath', { defaultValue: 'Name or relative path' })}
                </label>
                <Input
                  value={createNameInput}
                  onChange={(e) => setCreateNameInput(e.target.value)}
                  placeholder={
                    createType === 'file'
                      ? t('fileTree.filePlaceholder', { defaultValue: 'example.txt or src/example.txt' })
                      : t('fileTree.folderPlaceholder', { defaultValue: 'new-folder or src/new-folder' })
                  }
                />
              </div>

              <div className="text-xs text-muted-foreground">
                {t('fileTree.finalPath', { defaultValue: 'Final path:' })}{' '}
                <span className="font-mono">
                  {createTargetPath || '-'}
                </span>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isMutating}>
                {t('buttons.cancel')}
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isMutating || !createTargetPath}
              >
                {t('buttons.create')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileTree;
