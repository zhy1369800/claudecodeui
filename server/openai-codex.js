/**
 * OpenAI Codex SDK Integration
 * =============================
 *
 * This module provides integration with the OpenAI Codex SDK for non-interactive
 * chat sessions. It mirrors the pattern used in claude-sdk.js for consistency.
 *
 * ## Usage
 *
 * - queryCodex(command, options, ws) - Execute a prompt with streaming via WebSocket
 * - abortCodexSession(sessionId) - Cancel an active session
 * - isCodexSessionActive(sessionId) - Check if a session is running
 * - getActiveCodexSessions() - List all active sessions
 */

import { Codex } from '@openai/codex-sdk';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Track active sessions
const activeCodexSessions = new Map();

// --- Session Links Management ---
// When the Codex SDK creates a new thread during resume (e.g., with image input),
// we link the new thread ID to the original parent session ID so the UI presents
// all messages as belonging to one session.
const sessionLinksCache = new Map(); // parentId -> [childId1, childId2, ...]
let sessionLinksLoaded = false;

function getSessionLinksPath() {
  return path.join(os.homedir(), '.codex', 'session-links.json');
}

async function loadSessionLinks() {
  if (sessionLinksLoaded) return;
  try {
    const data = await fs.readFile(getSessionLinksPath(), 'utf8');
    const links = JSON.parse(data);
    for (const [parent, children] of Object.entries(links)) {
      sessionLinksCache.set(parent, children);
    }
  } catch {
    // File doesn't exist or is invalid, start fresh
  }
  sessionLinksLoaded = true;
}

async function saveSessionLinks() {
  try {
    await fs.mkdir(path.dirname(getSessionLinksPath()), { recursive: true });
    await fs.writeFile(
      getSessionLinksPath(),
      JSON.stringify(Object.fromEntries(sessionLinksCache), null, 2)
    );
  } catch (error) {
    console.error('[Codex] Failed to save session links:', error);
  }
}

async function addSessionLink(parentId, childId) {
  await loadSessionLinks();
  // Always link to the root parent
  let rootParent = parentId;
  for (const [p, children] of sessionLinksCache) {
    if (children.includes(parentId)) {
      rootParent = p;
      break;
    }
  }
  const list = sessionLinksCache.get(rootParent) || [];
  if (!list.includes(childId)) {
    list.push(childId);
    sessionLinksCache.set(rootParent, list);
    await saveSessionLinks();
  }
}

// Get the latest session ID in a link chain (for SDK resume with full context)
async function getLatestLinkedSessionId(sessionId) {
  await loadSessionLinks();
  const children = sessionLinksCache.get(sessionId);
  if (children && children.length > 0) {
    return children[children.length - 1];
  }
  return sessionId;
}

// Exported helpers for projects.js
export async function ensureSessionLinksLoaded() {
  await loadSessionLinks();
}

export function getLinkedSessionIds(sessionId) {
  return sessionLinksCache.get(sessionId) || [];
}

export function isChildSession(sessionId) {
  for (const [, children] of sessionLinksCache) {
    if (children.includes(sessionId)) {
      return true;
    }
  }
  return false;
}

/**
 * Prepare Codex input with optional local image files.
 * Converts base64 data URLs into temp image files and returns SDK-compatible input.
 * @param {string} command
 * @param {Array} images
 * @param {string} cwd
 * @returns {Promise<{input: string|Array, tempImagePaths: string[], tempDir: string|null}>}
 */
async function prepareCodexInput(command, images, cwd) {
  const tempImagePaths = [];
  let tempDir = null;

  if (!images || images.length === 0) {
    return { input: command, tempImagePaths, tempDir };
  }

  try {
    const workingDir = cwd || process.cwd();
    tempDir = path.join(workingDir, '.tmp', 'codex-images', Date.now().toString());
    await fs.mkdir(tempDir, { recursive: true });

    for (const [index, image] of images.entries()) {
      if (!image?.data || typeof image.data !== 'string') {
        continue;
      }

      const matches = image.data.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        continue;
      }

      const [, mimeType, base64Data] = matches;
      const extensionRaw = mimeType.split('/')[1] || 'png';
      const extension = extensionRaw.replace(/[^a-zA-Z0-9]/g, '') || 'png';
      const filename = `image_${index}.${extension}`;
      const imagePath = path.join(tempDir, filename);
      await fs.writeFile(imagePath, Buffer.from(base64Data, 'base64'));
      tempImagePaths.push(imagePath);
    }

    if (tempImagePaths.length === 0) {
      return { input: command, tempImagePaths, tempDir };
    }

    const codexInput = [];
    if (command && command.trim()) {
      codexInput.push({ type: 'text', text: command });
    }
    for (const imagePath of tempImagePaths) {
      codexInput.push({ type: 'local_image', path: imagePath });
    }

    return { input: codexInput, tempImagePaths, tempDir };
  } catch (error) {
    console.error('[Codex] Failed to process images:', error);
    return { input: command, tempImagePaths, tempDir };
  }
}

/**
 * Remove temp image files created for Codex turns.
 * @param {string[]} tempImagePaths
 * @param {string|null} tempDir
 */
async function cleanupTempImages(tempImagePaths, tempDir) {
  if (tempImagePaths && tempImagePaths.length > 0) {
    await Promise.all(
      tempImagePaths.map((imagePath) =>
        fs.unlink(imagePath).catch(() => { })
      )
    );
  }

  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
  }
}

/**
 * Transform Codex SDK event to WebSocket message format
 * @param {object} event - SDK event
 * @returns {object} - Transformed event for WebSocket
 */
function transformCodexEvent(event) {
  // Map SDK event types to a consistent format
  switch (event.type) {
    case 'item.started':
    case 'item.updated':
    case 'item.completed':
      const item = event.item;
      if (!item) {
        return { type: event.type, item: null };
      }

      // Transform based on item type
      switch (item.type) {
        case 'agent_message':
          return {
            type: 'item',
            itemType: 'agent_message',
            message: {
              role: 'assistant',
              content: item.text
            }
          };

        case 'reasoning':
          return {
            type: 'item',
            itemType: 'reasoning',
            message: {
              role: 'assistant',
              content: item.text,
              isReasoning: true
            }
          };

        case 'command_execution':
          return {
            type: 'item',
            itemType: 'command_execution',
            command: item.command,
            output: item.aggregated_output,
            exitCode: item.exit_code,
            status: item.status
          };

        case 'file_change':
          return {
            type: 'item',
            itemType: 'file_change',
            changes: item.changes,
            status: item.status
          };

        case 'mcp_tool_call':
          return {
            type: 'item',
            itemType: 'mcp_tool_call',
            server: item.server,
            tool: item.tool,
            arguments: item.arguments,
            result: item.result,
            error: item.error,
            status: item.status
          };

        case 'web_search':
          return {
            type: 'item',
            itemType: 'web_search',
            query: item.query
          };

        case 'todo_list':
          return {
            type: 'item',
            itemType: 'todo_list',
            items: item.items
          };

        case 'error':
          return {
            type: 'item',
            itemType: 'error',
            message: {
              role: 'error',
              content: item.message
            }
          };

        default:
          return {
            type: 'item',
            itemType: item.type,
            item: item
          };
      }

    case 'turn.started':
      return {
        type: 'turn_started'
      };

    case 'turn.completed':
      return {
        type: 'turn_complete',
        usage: event.usage
      };

    case 'turn.failed':
      return {
        type: 'turn_failed',
        error: event.error
      };

    case 'thread.started':
      return {
        type: 'thread_started',
        threadId: event.id
      };

    case 'error':
      return {
        type: 'error',
        message: event.message
      };

    default:
      return {
        type: event.type,
        data: event
      };
  }
}

/**
 * Map permission mode to Codex SDK options
 * @param {string} permissionMode - 'default', 'acceptEdits', or 'bypassPermissions'
 * @returns {object} - { sandboxMode, approvalPolicy }
 */
function mapPermissionModeToCodexOptions(permissionMode) {
  switch (permissionMode) {
    case 'acceptEdits':
      return {
        sandboxMode: 'workspace-write',
        approvalPolicy: 'never'
      };
    case 'bypassPermissions':
      return {
        sandboxMode: 'danger-full-access',
        approvalPolicy: 'never'
      };
    case 'default':
    default:
      return {
        sandboxMode: 'workspace-write',
        approvalPolicy: 'untrusted'
      };
  }
}

/**
 * Execute a Codex query with streaming
 * @param {string} command - The prompt to send
 * @param {object} options - Options including cwd, sessionId, model, permissionMode
 * @param {WebSocket|object} ws - WebSocket connection or response writer
 */
export async function queryCodex(command, options = {}, ws) {
  const {
    sessionId,
    cwd,
    projectPath,
    model,
    permissionMode = 'default',
    images,
    runId = null
  } = options;

  const workingDirectory = cwd || projectPath || process.cwd();
  const { sandboxMode, approvalPolicy } = mapPermissionModeToCodexOptions(permissionMode);

  let codex;
  let thread;
  // The session ID used for all WS messages (always the original from frontend)
  let currentSessionId = sessionId;
  let tempImagePaths = [];
  let tempDir = null;

  try {
    // Initialize Codex SDK
    codex = new Codex();

    // Thread options with sandbox and approval settings
    const threadOptions = {
      workingDirectory,
      skipGitRepoCheck: true,
      sandboxMode,
      approvalPolicy,
      model
    };

    // Start or resume thread
    if (sessionId) {
      // When resuming, use the latest linked session for SDK operations.
      // This ensures the SDK has full context including previous image conversations.
      const sdkSessionId = await getLatestLinkedSessionId(sessionId);
      thread = codex.resumeThread(sdkSessionId, threadOptions);
    } else {
      thread = codex.startThread(threadOptions);
    }

    // For new sessions (no original sessionId), use the thread's ID.
    // For existing sessions, ALWAYS keep the original sessionId for WS messages
    // so the frontend treats everything as belonging to the same session.
    if (!sessionId) {
      currentSessionId = thread.id || `codex-${Date.now()}`;
    }

    console.log(`[Codex] Thread created: thread.id=${thread.id}, originalSessionId=${sessionId}, currentSessionId=${currentSessionId}`);

    // Track the session (use thread.id for internal tracking)
    activeCodexSessions.set(currentSessionId, {
      thread,
      codex,
      status: 'running',
      startedAt: new Date().toISOString()
    });
    // Also track by thread.id so abort by either ID works
    if (thread.id && thread.id !== currentSessionId) {
      activeCodexSessions.set(thread.id, {
        thread,
        codex,
        status: 'running',
        startedAt: new Date().toISOString()
      });
    }

    // Send session created event with the ORIGINAL session ID
    sendMessage(ws, {
      type: 'session-created',
      sessionId: currentSessionId,
      provider: 'codex',
      runId
    });

    const preparedInput = await prepareCodexInput(command, images, workingDirectory);
    tempImagePaths = preparedInput.tempImagePaths;
    tempDir = preparedInput.tempDir;
    const codexInput = preparedInput.input;

    const trackedSession = activeCodexSessions.get(currentSessionId);
    if (trackedSession) {
      trackedSession.tempImagePaths = tempImagePaths;
      trackedSession.tempDir = tempDir;
    }

    // Execute with streaming
    const streamedTurn = await thread.runStreamed(codexInput);

    for await (const event of streamedTurn.events) {
      // Check if session was aborted
      const session = activeCodexSessions.get(currentSessionId);
      if (!session || session.status === 'aborted') {
        break;
      }

      if (event.type === 'item.started' || event.type === 'item.updated') {
        continue;
      }

      const transformed = transformCodexEvent(event);

      sendMessage(ws, {
        type: 'codex-response',
        data: transformed,
        sessionId: currentSessionId,
        runId
      });

      // Extract and send token usage if available (normalized to match Claude format)
      if (event.type === 'turn.completed' && event.usage) {
        const totalTokens = (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0);
        sendMessage(ws, {
          type: 'token-budget',
          data: {
            used: totalTokens,
            total: 200000 // Default context window for Codex models
          },
          sessionId: currentSessionId,
          runId
        });
      }
    }

    // Post-streaming drift detection: thread.id may only be available after runStreamed.
    // If the SDK created a new thread (e.g., due to image input on resume),
    // record the link so the sidebar hides the child session and message loading merges them.
    if (sessionId && thread.id && thread.id !== sessionId) {
      const latestLinked = await getLatestLinkedSessionId(sessionId);
      if (thread.id !== latestLinked) {
        console.log(`[Codex] Session drift detected (post-stream): original=${sessionId}, new=${thread.id}`);
        await addSessionLink(sessionId, thread.id);
      }
    }

    // Send completion event
    // Use currentSessionId for both fields. When resuming, currentSessionId is
    // the original session ID even if the SDK created a new thread internally.
    // This prevents the frontend from navigating to the SDK's internal thread.
    sendMessage(ws, {
      type: 'codex-complete',
      sessionId: currentSessionId,
      actualSessionId: currentSessionId,
      runId
    });

  } catch (error) {
    console.error('[Codex] Error:', error);

    sendMessage(ws, {
      type: 'codex-error',
      error: error.message,
      sessionId: currentSessionId,
      runId
    });

  } finally {
    await cleanupTempImages(tempImagePaths, tempDir);

    // Update session status
    if (currentSessionId) {
      const session = activeCodexSessions.get(currentSessionId);
      if (session) {
        session.status = 'completed';
      }
    }
  }
}

/**
 * Abort an active Codex session
 * @param {string} sessionId - Session ID to abort
 * @returns {boolean} - Whether abort was successful
 */
export function abortCodexSession(sessionId) {
  const session = activeCodexSessions.get(sessionId);

  if (!session) {
    return false;
  }

  session.status = 'aborted';

  // The SDK doesn't have a direct abort method, but marking status
  // will cause the streaming loop to exit

  return true;
}

/**
 * Check if a session is active
 * @param {string} sessionId - Session ID to check
 * @returns {boolean} - Whether session is active
 */
export function isCodexSessionActive(sessionId) {
  const session = activeCodexSessions.get(sessionId);
  return session?.status === 'running';
}

/**
 * Get all active sessions
 * @returns {Array} - Array of active session info
 */
export function getActiveCodexSessions() {
  const sessions = [];

  for (const [id, session] of activeCodexSessions.entries()) {
    if (session.status === 'running') {
      sessions.push({
        id,
        status: session.status,
        startedAt: session.startedAt
      });
    }
  }

  return sessions;
}

/**
 * Helper to send message via WebSocket or writer
 * @param {WebSocket|object} ws - WebSocket or response writer
 * @param {object} data - Data to send
 */
function sendMessage(ws, data) {
  try {
    if (ws.isSSEStreamWriter || ws.isWebSocketWriter) {
      // Writer handles stringification (SSEStreamWriter or WebSocketWriter)
      ws.send(data);
    } else if (typeof ws.send === 'function') {
      // Raw WebSocket - stringify here
      ws.send(JSON.stringify(data));
    }
  } catch (error) {
    console.error('[Codex] Error sending message:', error);
  }
}

// Clean up old completed sessions periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes

  for (const [id, session] of activeCodexSessions.entries()) {
    if (session.status !== 'running') {
      const startedAt = new Date(session.startedAt).getTime();
      if (now - startedAt > maxAge) {
        activeCodexSessions.delete(id);
      }
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes
