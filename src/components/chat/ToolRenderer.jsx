import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TodoList from '../TodoList';

function safeParse(data) {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function getToolCategory(toolName) {
  if (['Edit', 'Write', 'ApplyPatch'].includes(toolName)) return 'edit';
  if (['Grep', 'Glob'].includes(toolName)) return 'search';
  if (toolName === 'Bash') return 'bash';
  if (['TodoWrite', 'TodoRead'].includes(toolName)) return 'todo';
  if (toolName === 'exit_plan_mode' || toolName === 'ExitPlanMode') return 'plan';
  return 'default';
}

function getToolConfig(toolName) {
  const configs = {
    Bash: {
      input: {
        type: 'one-line',
        icon: 'terminal',
        style: 'terminal',
        wrapText: true,
        action: 'copy',
        getValue: (input) => input?.command || '',
        getSecondary: (input) => input?.description || undefined,
      },
      result: {
        hideOnSuccess: true,
      },
    },
    Read: {
      input: {
        type: 'one-line',
        label: 'Read',
        action: 'open-file',
        getValue: (input) => input?.file_path || '',
      },
      result: {
        hidden: true,
      },
    },
    Edit: {
      input: {
        type: 'collapsible',
        title: (input) => input?.file_path?.split('/').pop() || input?.file_path || 'file',
        defaultOpen: false,
        contentType: 'diff',
        getContentProps: (input) => ({
          oldContent: input?.old_string || '',
          newContent: input?.new_string || '',
          filePath: input?.file_path,
        }),
      },
      result: {
        hideOnSuccess: true,
      },
    },
    Write: {
      input: {
        type: 'collapsible',
        title: (input) => input?.file_path?.split('/').pop() || input?.file_path || 'file',
        defaultOpen: false,
        contentType: 'diff',
        getContentProps: (input) => ({
          oldContent: '',
          newContent: input?.content || '',
          filePath: input?.file_path,
        }),
      },
      result: {
        hideOnSuccess: true,
      },
    },
    ApplyPatch: {
      input: {
        type: 'collapsible',
        title: (input) => input?.file_path?.split('/').pop() || input?.file_path || 'file',
        defaultOpen: false,
        contentType: 'diff',
        getContentProps: (input) => ({
          oldContent: input?.old_string || '',
          newContent: input?.new_string || '',
          filePath: input?.file_path,
        }),
      },
      result: {
        hideOnSuccess: true,
      },
    },
    Grep: {
      input: {
        type: 'one-line',
        label: 'Grep',
        action: 'jump-to-results',
        getValue: (input) => input?.pattern || '',
        getSecondary: (input) => (input?.path ? `in ${input.path}` : undefined),
      },
      result: {
        type: 'collapsible',
        defaultOpen: false,
        title: (result) => {
          const toolData = result?.toolUseResult || {};
          const count = toolData.numFiles || toolData.filenames?.length || 0;
          return `Found ${count} ${count === 1 ? 'file' : 'files'}`;
        },
        contentType: 'file-list',
        getContentProps: (result) => ({
          files: result?.toolUseResult?.filenames || [],
        }),
      },
    },
    Glob: {
      input: {
        type: 'one-line',
        label: 'Glob',
        action: 'jump-to-results',
        getValue: (input) => input?.pattern || '',
        getSecondary: (input) => (input?.path ? `in ${input.path}` : undefined),
      },
      result: {
        type: 'collapsible',
        defaultOpen: false,
        title: (result) => {
          const toolData = result?.toolUseResult || {};
          const count = toolData.numFiles || toolData.filenames?.length || 0;
          return `Found ${count} ${count === 1 ? 'file' : 'files'}`;
        },
        contentType: 'file-list',
        getContentProps: (result) => ({
          files: result?.toolUseResult?.filenames || [],
        }),
      },
    },
    TodoWrite: {
      input: {
        type: 'collapsible',
        title: 'Updating todo list',
        defaultOpen: false,
        contentType: 'todo-list',
        getContentProps: (input) => ({
          todos: input?.todos || [],
        }),
      },
      result: {
        type: 'collapsible',
        defaultOpen: false,
        contentType: 'success-message',
        getMessage: () => 'Todo list updated',
      },
    },
    TodoRead: {
      input: {
        type: 'one-line',
        label: 'TodoRead',
        action: 'none',
        getValue: () => 'reading list',
      },
      result: {
        type: 'collapsible',
        defaultOpen: false,
        contentType: 'todo-list',
        getContentProps: (result) => {
          try {
            const content = String(result?.content || '');
            const todos = content.startsWith('[') ? JSON.parse(content) : [];
            return { todos, isResult: true };
          } catch {
            return { todos: [], isResult: true };
          }
        },
      },
    },
    exit_plan_mode: {
      input: {
        type: 'one-line',
        label: 'Plan',
        action: 'none',
        getValue: () => 'exiting plan mode',
      },
      result: {
        type: 'collapsible',
        title: 'Implementation plan',
        defaultOpen: false,
        contentType: 'markdown',
        getContentProps: (result) => {
          try {
            const parsed = JSON.parse(String(result?.content || '{}'));
            return { content: parsed?.plan ? String(parsed.plan).replace(/\\n/g, '\n') : String(result?.content || '') };
          } catch {
            return { content: String(result?.content || '') };
          }
        },
      },
    },
    Default: {
      input: {
        type: 'collapsible',
        title: 'Parameters',
        defaultOpen: false,
        contentType: 'text',
        getContentProps: (input) => ({
          content: typeof input === 'string' ? input : JSON.stringify(input, null, 2),
          format: 'code',
        }),
      },
      result: {
        type: 'collapsible',
        title: 'Result',
        defaultOpen: false,
        contentType: 'text',
        getContentProps: (result) => ({
          content: String(result?.content || ''),
          format: 'plain',
        }),
      },
    },
  };

  return configs[toolName] || configs.Default;
}

export function shouldHideToolResult(toolName, toolResult) {
  const config = getToolConfig(toolName);
  if (!config?.result) return false;
  if (config.result.hidden) return true;
  if (config.result.hideOnSuccess && toolResult && !toolResult.isError) return true;
  return false;
}

async function copyText(value) {
  if (!value) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function OneLineDisplay({ toolName, label, value, secondary, action = 'none', onAction, style, wrapText, resultId, hasResult }) {
  const [copied, setCopied] = useState(false);

  const handleAction = async () => {
    if (action === 'copy') {
      const ok = await copyText(value);
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
      return;
    }
    onAction?.();
  };

  if (style === 'terminal') {
    return (
      <div className="group my-1">
        <div className="flex items-start gap-2">
          <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
            <svg className="w-3 h-3 text-green-500 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 bg-gray-900 dark:bg-black rounded px-2.5 py-1">
            <code className={`text-xs text-green-400 font-mono ${wrapText ? 'whitespace-pre-wrap break-all' : 'truncate block'}`}>
              <span className="text-green-600 dark:text-green-500 select-none">$ </span>{value}
            </code>
          </div>
          <button
            type="button"
            onClick={handleAction}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-200 transition-colors"
            title="Copy"
          >
            {copied ? '✓' : '⧉'}
          </button>
        </div>
        {secondary && <div className="ml-7 mt-1 text-[11px] text-gray-400 italic">{secondary}</div>}
      </div>
    );
  }

  if (action === 'open-file') {
    const filename = value?.split('/').pop() || value;
    return (
      <div className="group flex items-center gap-1.5 border-l-2 border-gray-400 dark:border-gray-500 pl-3 py-0.5 my-0.5">
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{label || toolName}</span>
        <span className="text-gray-300 dark:text-gray-600 text-[10px]">/</span>
        <button type="button" onClick={handleAction} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-mono truncate">
          {filename}
        </button>
      </div>
    );
  }

  if (action === 'jump-to-results') {
    return (
      <div className="group flex items-center gap-1.5 border-l-2 border-gray-400 dark:border-gray-500 pl-3 py-0.5 my-0.5">
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{label || toolName}</span>
        <span className="text-gray-300 dark:text-gray-600 text-[10px]">/</span>
        <span className="text-xs font-mono truncate flex-1 min-w-0 text-gray-700 dark:text-gray-300">{value}</span>
        {secondary && <span className="text-[11px] text-gray-400 italic flex-shrink-0">{secondary}</span>}
        {hasResult && resultId && (
          <a href={`#${resultId}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0">
            v
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1.5 border-l-2 border-gray-300 dark:border-gray-600 pl-3 py-0.5 my-0.5">
      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{label || toolName}</span>
      <span className="text-gray-300 dark:text-gray-600 text-[10px]">/</span>
      <span className={`text-xs font-mono flex-1 min-w-0 text-gray-700 dark:text-gray-300 ${wrapText ? 'whitespace-pre-wrap break-all' : 'truncate'}`}>{value}</span>
      {secondary && <span className="text-[11px] text-gray-400 italic flex-shrink-0">{secondary}</span>}
    </div>
  );
}

function CollapsibleDisplay({ toolName, toolCategory = 'default', title, defaultOpen = false, children, showRawParameters = false, rawContent, onTitleClick }) {
  const borderColorMap = {
    edit: 'border-amber-500 dark:border-amber-400',
    search: 'border-gray-400 dark:border-gray-500',
    bash: 'border-green-500 dark:border-green-400',
    todo: 'border-violet-500 dark:border-violet-400',
    plan: 'border-indigo-500 dark:border-indigo-400',
    default: 'border-gray-300 dark:border-gray-600',
  };
  const borderColor = borderColorMap[toolCategory] || borderColorMap.default;

  return (
    <div className={`border-l-2 ${borderColor} pl-3 py-0.5 my-1`}>
      <details open={defaultOpen} className="group/details">
        <summary className="cursor-pointer text-xs text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5">
          <svg className="w-3 h-3 text-gray-400 dark:text-gray-500 transition-transform group-open/details:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {toolName && <span className="font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">{toolName}</span>}
          {toolName && <span className="text-gray-300 dark:text-gray-600 text-[10px] flex-shrink-0">/</span>}
          {onTitleClick ? (
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTitleClick(); }} className="text-blue-600 dark:text-blue-400 hover:underline truncate flex-1 text-left">
              {title}
            </button>
          ) : <span className="text-gray-600 dark:text-gray-400 truncate flex-1">{title}</span>}
        </summary>
        <div className="mt-2">{children}</div>
        {showRawParameters && rawContent && (
          <details className="mt-2 group/raw">
            <summary className="cursor-pointer text-[11px] text-gray-500 hover:text-gray-700">raw params</summary>
            <pre className="mt-1 text-[11px] bg-gray-50 dark:bg-gray-900/40 border border-gray-200/50 dark:border-gray-700/50 p-2 rounded whitespace-pre-wrap break-words font-mono text-gray-700 dark:text-gray-300">
              {rawContent}
            </pre>
          </details>
        )}
      </details>
    </div>
  );
}

function renderDiff({ oldContent, newContent, createDiff }) {
  if (!createDiff) return null;
  const diff = createDiff(String(oldContent || ''), String(newContent || ''));
  return (
    <div className="text-xs font-mono border border-gray-200/60 dark:border-gray-700/60 rounded overflow-hidden">
      {diff.map((line, idx) => (
        <div key={idx} className="flex">
          <span className={`w-8 text-center border-r ${line.type === 'removed'
            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
            : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'}`}>
            {line.type === 'removed' ? '-' : '+'}
          </span>
          <span className={`px-2 py-0.5 flex-1 whitespace-pre-wrap ${line.type === 'removed'
            ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
            : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'}`}>
            {line.content}
          </span>
        </div>
      ))}
    </div>
  );
}

function renderContent(contentType, contentProps, context) {
  switch (contentType) {
    case 'diff':
      return renderDiff({
        oldContent: contentProps.oldContent,
        newContent: contentProps.newContent,
        createDiff: context.createDiff,
      });
    case 'file-list':
      return (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {(contentProps.files || []).map((filePath, idx) => {
            const fileName = filePath.split('/').pop();
            return (
              <button
                key={`${filePath}-${idx}`}
                type="button"
                onClick={() => context.onFileOpen?.(filePath)}
                className="w-full text-left group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-green-100/50 dark:hover:bg-green-800/20"
              >
                <span className="font-mono text-sm text-green-800 dark:text-green-200 truncate">{fileName}</span>
              </button>
            );
          })}
        </div>
      );
    case 'todo-list':
      return <TodoList todos={contentProps.todos || []} isResult={contentProps.isResult} />;
    case 'markdown':
      return (
        <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none dark:prose-invert">
          {String(contentProps.content || '')}
        </ReactMarkdown>
      );
    case 'success-message':
      return (
        <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {contentProps.message || 'Success'}
        </div>
      );
    case 'text':
    default:
      if (contentProps.format === 'code') {
        return (
          <pre className="text-xs bg-gray-50 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-700/60 p-2 rounded whitespace-pre-wrap break-words font-mono text-gray-700 dark:text-gray-300">
            {String(contentProps.content || '')}
          </pre>
        );
      }
      return <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{String(contentProps.content || '')}</div>;
  }
}

export default function ToolRenderer({
  toolName,
  toolInput,
  toolResult,
  toolId,
  mode,
  onFileOpen,
  createDiff,
  autoExpandTools = false,
  showRawParameters = false,
  rawToolInput,
}) {
  const config = getToolConfig(toolName);
  const displayConfig = mode === 'input' ? config.input : config.result;

  const parsedData = useMemo(() => {
    const rawData = mode === 'input' ? toolInput : toolResult;
    return safeParse(rawData);
  }, [mode, toolInput, toolResult]);

  if (!displayConfig) return null;

  if (displayConfig.type === 'one-line') {
    const value = displayConfig.getValue?.(parsedData) || '';
    const secondary = displayConfig.getSecondary?.(parsedData);

    return (
      <OneLineDisplay
        toolName={toolName}
        label={displayConfig.label}
        value={value}
        secondary={secondary}
        action={displayConfig.action}
        style={displayConfig.style}
        wrapText={displayConfig.wrapText}
        hasResult={Boolean(toolResult)}
        resultId={toolId ? `tool-result-${toolId}` : undefined}
        onAction={() => {
          if (displayConfig.action === 'open-file') {
            onFileOpen?.(value);
          }
        }}
      />
    );
  }

  const title = typeof displayConfig.title === 'function'
    ? displayConfig.title(parsedData)
    : displayConfig.title || 'Details';

  const defaultOpen = displayConfig.defaultOpen !== undefined
    ? displayConfig.defaultOpen
    : autoExpandTools;

  const contentProps = displayConfig.getContentProps?.(parsedData, {
    createDiff,
    onFileOpen,
  }) || (mode === 'result'
    ? { content: String(parsedData?.content || ''), format: 'plain' }
    : { content: typeof parsedData === 'string' ? parsedData : JSON.stringify(parsedData, null, 2), format: 'code' });

  if (displayConfig.contentType === 'success-message') {
    contentProps.message = displayConfig.getMessage?.(parsedData) || contentProps.message;
  }

  const onTitleClick = contentProps.filePath
    ? () => onFileOpen?.(contentProps.filePath, { old_string: contentProps.oldContent, new_string: contentProps.newContent })
    : undefined;

  return (
    <CollapsibleDisplay
      toolName={toolName}
      toolCategory={getToolCategory(toolName)}
      title={title}
      defaultOpen={defaultOpen}
      showRawParameters={mode === 'input' && showRawParameters}
      rawContent={rawToolInput}
      onTitleClick={onTitleClick}
    >
      {renderContent(displayConfig.contentType, contentProps, { createDiff, onFileOpen })}
    </CollapsibleDisplay>
  );
}
