import React from 'react';
import { useTranslation } from 'react-i18next';
import ThinkingModeSelector from './ThinkingModeSelector';
import TokenUsagePie from './TokenUsagePie';
import type { PermissionMode, Provider } from '../../types/types';

interface ChatInputControlsProps {
  permissionMode: PermissionMode | string;
  onModeSwitch: () => void;
  provider: Provider | string;
  thinkingMode: string;
  setThinkingMode: React.Dispatch<React.SetStateAction<string>>;
  tokenBudget: { used?: number; total?: number } | null;
  slashCommandsCount: number;
  onToggleCommandMenu: () => void;
  hasInput: boolean;
  onClearInput: () => void;
  isUserScrolledUp: boolean;
  hasMessages: boolean;
  onScrollToBottom: () => void;
  openImagePicker?: () => void;
  inline?: boolean;
}

export default function ChatInputControls({
  permissionMode,
  onModeSwitch,
  provider,
  thinkingMode,
  setThinkingMode,
  tokenBudget,
  slashCommandsCount,
  onToggleCommandMenu,
  hasInput,
  onClearInput,
  isUserScrolledUp,
  hasMessages,
  onScrollToBottom,
  openImagePicker,
  inline = false,
}: ChatInputControlsProps) {
  const { t } = useTranslation('chat');
  const modeKey =
    permissionMode === 'acceptEdits'
      ? 'acceptEdits'
      : permissionMode === 'bypassPermissions'
      ? 'bypassPermissions'
      : permissionMode === 'plan'
      ? 'plan'
      : 'default';

  const containerClass = inline
    ? 'flex items-center gap-1.5'
    : 'flex items-center justify-center gap-2 sm:gap-3 flex-wrap';
  const iconButtonClass = inline
    ? 'relative w-7 h-7 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg flex items-center justify-center transition-colors'
    : 'relative w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground hover:text-foreground rounded-lg flex items-center justify-center transition-colors hover:bg-accent/60';
  const clearButtonClass = inline
    ? 'w-7 h-7 text-gray-400 hover:text-white hover:bg-red-500 rounded-lg flex items-center justify-center transition-all'
    : 'w-7 h-7 sm:w-8 sm:h-8 bg-card hover:bg-accent/60 border border-border/50 rounded-lg flex items-center justify-center transition-all duration-200 group shadow-sm';
  const scrollButtonClass = inline
    ? 'w-7 h-7 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-sm flex items-center justify-center transition-all duration-200 hover:scale-105'
    : 'w-7 h-7 sm:w-8 sm:h-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-sm flex items-center justify-center transition-all duration-200 hover:scale-105';
  const permissionClass = inline
    ? 'px-2 py-1 rounded-lg text-xs font-medium transition-all duration-200'
    : 'px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-sm font-medium border transition-all duration-200';
  const thinkingClass = inline ? 'scale-90 origin-left ml-1 sm:ml-0' : '';
  const pieClass = inline ? 'scale-75 origin-center -ml-1' : '';
  const badgeClass = inline
    ? 'absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center'
    : 'absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center';
  const iconSizeClass = inline ? 'w-4 h-4' : 'w-4 h-4 sm:w-5 sm:h-5';
  const clearIconSizeClass = inline ? 'w-4 h-4' : 'w-3.5 h-3.5 sm:w-4 sm:h-4';
  const scrollIconSizeClass = inline ? 'w-4 h-4' : 'w-3.5 h-3.5 sm:w-4 sm:h-4';

  return (
    <div className={containerClass}>
      {openImagePicker && (
        <button
          type="button"
          onClick={openImagePicker}
          className={inline ? 'p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors' : iconButtonClass}
          title={t('input.attachImages')}
        >
          <svg className={iconSizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </button>
      )}

      <button
        type="button"
        onClick={onModeSwitch}
        className={`${permissionClass} ${
          permissionMode === 'default'
            ? inline
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              : 'bg-muted/50 text-muted-foreground border-border/60 hover:bg-muted'
            : permissionMode === 'acceptEdits'
              ? inline
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30'
                : 'bg-green-50 dark:bg-green-900/15 text-green-700 dark:text-green-300 border-green-300/60 dark:border-green-600/40 hover:bg-green-100 dark:hover:bg-green-900/25'
              : permissionMode === 'bypassPermissions'
                ? inline
                  ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                  : 'bg-orange-50 dark:bg-orange-900/15 text-orange-700 dark:text-orange-300 border-orange-300/60 dark:border-orange-600/40 hover:bg-orange-100 dark:hover:bg-orange-900/25'
                : inline
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                  : 'bg-primary/5 text-primary border-primary/20 hover:bg-primary/10'
        }`}
        title={t('input.clickToChangeMode')}
      >
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              permissionMode === 'default'
                ? 'bg-muted-foreground'
                : permissionMode === 'acceptEdits'
                  ? 'bg-green-500'
                  : permissionMode === 'bypassPermissions'
                    ? 'bg-orange-500'
                    : 'bg-primary'
            }`}
          />
          <span>
            <span className="sm:hidden">
              {t(`codex.modes_mobile.${modeKey}`, {
                defaultValue: t(`codex.modes.${modeKey}`),
              })}
            </span>
            <span className="hidden sm:inline">
              {t(`codex.modes.${modeKey}`)}
            </span>
          </span>
        </div>
      </button>

      {provider === 'claude' && (
        <ThinkingModeSelector
          selectedMode={thinkingMode}
          onModeChange={setThinkingMode}
          onClose={() => {}}
          className={thinkingClass}
        />
      )}

      <div className={pieClass}>
        <TokenUsagePie
          used={tokenBudget?.used || 0}
          total={tokenBudget?.total || parseInt(import.meta.env.VITE_CONTEXT_WINDOW) || 160000}
        />
      </div>

      <button
        type="button"
        onClick={onToggleCommandMenu}
        className={inline ? 'relative w-7 h-7 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center justify-center transition-colors' : iconButtonClass}
        title={t('input.showAllCommands')}
      >
        <svg className={iconSizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
        {slashCommandsCount > 0 && (
          <span className={badgeClass}>
            {slashCommandsCount}
          </span>
        )}
      </button>

      {hasInput && (
        <button
          type="button"
          onClick={onClearInput}
          className={clearButtonClass}
          title={t('input.clearInput', { defaultValue: 'Clear input' })}
        >
          <svg
            className={`${clearIconSizeClass} ${inline ? 'text-current' : 'text-muted-foreground group-hover:text-foreground transition-colors'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {isUserScrolledUp && hasMessages && (
        <button
          onClick={onScrollToBottom}
          className={scrollButtonClass}
          title={t('input.scrollToBottom', { defaultValue: 'Scroll to bottom' })}
        >
          <svg className={scrollIconSizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
}

