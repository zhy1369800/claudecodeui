import React from 'react';

function DiffViewer({ diff, fileName, isMobile, wrapText, selectable = false, selectedHunkHeaders, onToggleHunk }) {
  if (!diff) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
        No diff available
      </div>
    );
  }

  const selected = selectedHunkHeaders instanceof Set ? selectedHunkHeaders : new Set();

  let currentHunkHeader = null;

  const renderDiffLine = (line, index) => {
    const isAddition = line.startsWith('+') && !line.startsWith('+++');
    const isDeletion = line.startsWith('-') && !line.startsWith('---');
    const isHeader = line.startsWith('@@');

    if (isHeader) {
      currentHunkHeader = line;
    }

    const canSelectHunk = selectable && !!currentHunkHeader && (isAddition || isDeletion || isHeader);
    const isSelected = currentHunkHeader ? selected.has(currentHunkHeader) : false;

    const baseClass = `font-mono text-xs p-2 ${
      isMobile && wrapText ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-x-auto'
    } ${
      isAddition ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300' :
      isDeletion ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300' :
      isHeader ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300' :
      'text-gray-600 dark:text-gray-400'
    }`;

    const selectableClass = canSelectHunk
      ? `cursor-pointer ${isSelected ? 'ring-2 ring-blue-400 dark:ring-blue-600' : 'hover:brightness-95 dark:hover:brightness-110'}`
      : '';

    return (
      <div
        key={index}
        className={`${baseClass} ${selectableClass}`}
        onClick={() => {
          if (!canSelectHunk || !onToggleHunk || !currentHunkHeader) return;
          onToggleHunk(currentHunkHeader);
        }}
        role={canSelectHunk ? 'button' : undefined}
        tabIndex={canSelectHunk ? 0 : undefined}
        onKeyDown={(e) => {
          if (!canSelectHunk || !onToggleHunk || !currentHunkHeader) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleHunk(currentHunkHeader);
          }
        }}
        title={canSelectHunk ? 'Click to select/unselect this change for revert' : undefined}
      >
        {canSelectHunk && (
          <span className="inline-block w-10 text-center select-none opacity-80">
            {isSelected ? '[x]' : '[ ]'}
          </span>
        )}
        {line}
      </div>
    );
  };

  return (
    <div className="diff-viewer">
      {diff.split('\n').map((line, index) => renderDiffLine(line, index))}
    </div>
  );
}

export default DiffViewer;
