import { spawn } from 'child_process';
import crossSpawn from 'cross-spawn';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

// Use cross-spawn on Windows for better command execution
const spawnFunction = process.platform === 'win32' ? crossSpawn : spawn;

let activeClaudeProcesses = new Map(); // Track active processes by session ID

/**
 * Checks if Claude CLI is installed in the system
 * @returns {Promise<boolean>}
 */
async function checkClaudeCliInstalled() {
    return new Promise((resolve) => {
        const checkCmd = process.platform === 'win32' ? 'where' : 'which';
        const proc = spawnFunction(checkCmd, ['claude'], { stdio: 'ignore' });
        proc.on('close', (code) => resolve(code === 0));
    });
}

/**
 * Executes Claude using the native CLI via child_process
 */
async function queryClaudeCLI(command, options = {}, ws) {
    return new Promise(async (resolve, reject) => {
        const { sessionId, projectPath, cwd, resume, model, runId = null } = options;
        const generatedSessionId = sessionId || randomUUID();
        let capturedSessionId = generatedSessionId;
        let sessionCreatedSent = false;
        let messageBuffer = '';
        let stdoutBuffer = '';
        let stderrBuffer = '';
        let completionSent = false;
        const requestStartedAt = Date.now();
        let firstStdoutAt = null;
        let firstParsedAt = null;
        const sendWithRunId = (payload) => ws.send({ ...payload, runId });
        const sendComplete = (exitCode = 0) => {
            if (completionSent) {
                return;
            }
            completionSent = true;
            sendWithRunId({
                type: 'claude-complete',
                sessionId: capturedSessionId || sessionId || null,
                exitCode,
                isNewSession: !sessionId && !!command
            });
        };

        const args = [];

        // Build flags for Claude CLI
        if (sessionId) {
            args.push('--resume', sessionId);
        } else {
            // Ensure deterministic session continuity even if CLI stream omits session_id.
            args.push('--session-id', generatedSessionId);
            sessionCreatedSent = true;
            sendWithRunId({
                type: 'session-created',
                sessionId: generatedSessionId
            });
            if (ws.setSessionId) ws.setSessionId(generatedSessionId);
        }

        if (command && command.trim()) {
            // Non-interactive mode is required for machine-readable output.
            args.push('-p', command);
            // Use JSON output for lower overhead and simpler parsing.
            args.push('--output-format', 'json');
        }

        // Respect model selected in UI for new sessions.
        // On resumed sessions Claude will continue with the original model.
        if (!sessionId && model) {
            args.push('--model', model);
        }

        // Always keep Claude CLI on the project directory so new-session and resume
        // runs share the same workspace context.
        let workingDir = cwd || projectPath || process.cwd();

        // Quick local ack so UI can render immediately while CLI request is being processed.
        sendWithRunId({
            type: 'claude-response',
            data: {
                type: 'content_block_delta',
                delta: { type: 'text_delta', text: '已收到，正在调用 Claude CLI...\n' }
            },
            sessionId: capturedSessionId || sessionId || null
        });

        console.log('[CLI] Spawning Claude CLI:', 'claude', args.join(' '));
        console.log('[CLI][Timing] Start -> spawn:', `${Date.now() - requestStartedAt}ms`);

        const claudeProcess = spawnFunction('claude', args, {
            cwd: workingDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, CLAUDE_CODE_OUTPUT_FORMAT: 'stream-json' }
        });

        const processKey = capturedSessionId || `temp-${Date.now()}`;
        activeClaudeProcesses.set(processKey, claudeProcess);

        const captureSessionIdIfPresent = (response) => {
            const candidate = response?.session_id || response?.sessionId || null;
            if (!candidate || capturedSessionId) {
                return;
            }

            capturedSessionId = candidate;
            activeClaudeProcesses.delete(processKey);
            activeClaudeProcesses.set(capturedSessionId, claudeProcess);
            if (ws.setSessionId) ws.setSessionId(capturedSessionId);

            if (!sessionId && !sessionCreatedSent) {
                sessionCreatedSent = true;
                sendWithRunId({
                    type: 'session-created',
                    sessionId: capturedSessionId
                });
            }
        };

        const handleParsedResponse = (response) => {
            if (!firstParsedAt) {
                firstParsedAt = Date.now();
                console.log('[CLI][Timing] Start -> first parsed response:', `${firstParsedAt - requestStartedAt}ms`);
            }
            captureSessionIdIfPresent(response);

            // Map Claude CLI JSON to frontend-compatible format
            switch (response.type) {
                case 'content_block_delta':
                    // Handle streaming text deltas (real-time streaming)
                    if (response.delta?.text) {
                        messageBuffer += response.delta.text;
                        sendWithRunId({
                            type: 'claude-response',
                            data: {
                                type: 'content_block_delta',
                                delta: { type: 'text_delta', text: response.delta.text }
                            },
                            sessionId: capturedSessionId || sessionId || null
                        });
                    }
                    break;

                case 'assistant':
                    // Fallback for complete messages (non-streaming)
                    if (response.message?.content?.[0]?.text) {
                        const textContent = response.message.content[0].text;
                        messageBuffer += textContent;
                        sendWithRunId({
                            type: 'claude-response',
                            data: {
                                type: 'content_block_delta',
                                delta: { type: 'text_delta', text: textContent }
                            },
                            sessionId: capturedSessionId || sessionId || null
                        });
                    }
                    break;

                case 'result':
                    if (typeof response.result === 'string' && response.result.trim()) {
                        sendWithRunId({
                            type: 'claude-response',
                            data: {
                                type: 'content_block_delta',
                                delta: { type: 'text_delta', text: response.result }
                            },
                            sessionId: capturedSessionId || sessionId || null
                        });
                    }
                    sendComplete(0);
                    break;

                default:
                    // JSON mode often returns a single object without stream event types.
                    if (typeof response.result === 'string' && response.result.trim()) {
                        sendWithRunId({
                            type: 'claude-response',
                            data: {
                                type: 'content_block_delta',
                                delta: { type: 'text_delta', text: response.result }
                            },
                            sessionId: capturedSessionId || sessionId || null
                        });
                        sendComplete(0);
                    } else if (typeof response.output === 'string' && response.output.trim()) {
                        sendWithRunId({
                            type: 'claude-response',
                            data: {
                                type: 'content_block_delta',
                                delta: { type: 'text_delta', text: response.output }
                            },
                            sessionId: capturedSessionId || sessionId || null
                        });
                        sendComplete(0);
                    }
                    break;
            }
        };

        claudeProcess.stdout.on('data', (data) => {
            if (!firstStdoutAt) {
                firstStdoutAt = Date.now();
                console.log('[CLI][Timing] Start -> first stdout chunk:', `${firstStdoutAt - requestStartedAt}ms`);
            }
            stdoutBuffer += data.toString();
            const lines = stdoutBuffer.split(/\r?\n/);
            stdoutBuffer = lines.pop() || '';

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) {
                    continue;
                }
                try {
                    const response = JSON.parse(trimmedLine);
                    handleParsedResponse(response);
                } catch (e) {
                    // If not JSON, it might be raw text or ANSI
                    // For now, just log raw output to help debug.
                    console.log('[CLI] Raw output:', trimmedLine);
                }
            }
        });

        claudeProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderrBuffer += chunk;
            console.error('[CLI] stderr:', chunk);
        });

        claudeProcess.on('close', (code) => {
            if (stdoutBuffer.trim()) {
                try {
                    const response = JSON.parse(stdoutBuffer.trim());
                    handleParsedResponse(response);
                } catch {
                    console.log('[CLI] Raw trailing output:', stdoutBuffer.trim());
                }
            }

            if (!capturedSessionId) {
                capturedSessionId = generatedSessionId;
            }

            if (!sessionId && !capturedSessionId) {
                console.warn('[CLI] No session ID captured from Claude CLI output; using generated session ID:', generatedSessionId);
            }

            console.log(`[CLI] Process exited with code ${code}`);
            console.log('[CLI][Timing] Total request duration:', `${Date.now() - requestStartedAt}ms`);
            activeClaudeProcesses.delete(capturedSessionId || processKey);
            if (code === 0) {
                sendComplete(0);
                resolve();
            } else {
                sendWithRunId({
                    type: 'claude-error',
                    sessionId: capturedSessionId || sessionId || null,
                    error: (stderrBuffer || `Claude CLI exited with code ${code}`).trim()
                });
                resolve();
            }
        });

        claudeProcess.on('error', (err) => {
            console.error('[CLI] Process error:', err);
            reject(err);
        });

        claudeProcess.stdin.end();
    });
}

function abortClaudeCLISession(sessionId) {
    const proc = activeClaudeProcesses.get(sessionId);
    if (proc) {
        proc.kill('SIGTERM');
        activeClaudeProcesses.delete(sessionId);
        return true;
    }
    return false;
}

export {
    checkClaudeCliInstalled,
    queryClaudeCLI,
    abortClaudeCLISession
};
