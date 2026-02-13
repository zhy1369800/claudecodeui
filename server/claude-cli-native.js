import { spawn } from 'child_process';
import crossSpawn from 'cross-spawn';
import path from 'path';
import os from 'os';

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
        let capturedSessionId = sessionId;
        let sessionCreatedSent = false;
        let messageBuffer = '';
        const sendWithRunId = (payload) => ws.send({ ...payload, runId });

        const args = [];

        // Build flags for Claude CLI
        if (command && command.trim()) {
            args.push(command);
            // Request streaming JSON output
            args.push('--output-format', 'stream-json', '--verbose');
        }

        // Optimization: For simple greetings or non-plan mode, use a neutral directory
        // to prevent the CLI from indexing the current project.
        let workingDir = cwd || projectPath || process.cwd();
        if (options.permissionMode !== 'plan' && (command.length < 10 || !command.includes(' '))) {
            workingDir = os.tmpdir();
            console.log('[CLI] Using temp directory to skip indexing:', workingDir);
        }

        console.log('[CLI] Spawning Claude CLI:', 'claude', args.join(' '));

        const claudeProcess = spawnFunction('claude', args, {
            cwd: workingDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, CLAUDE_CODE_OUTPUT_FORMAT: 'stream-json' }
        });

        const processKey = capturedSessionId || `temp-${Date.now()}`;
        activeClaudeProcesses.set(processKey, claudeProcess);

        claudeProcess.stdout.on('data', (data) => {
            const rawOutput = data.toString();
            const lines = rawOutput.split('\n').filter(line => line.trim());

            for (const line of lines) {
                try {
                    const response = JSON.parse(line);

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
                            sendWithRunId({
                                type: 'claude-complete',
                                sessionId: capturedSessionId || sessionId,
                                exitCode: 0,
                                isNewSession: !sessionId && !!command
                            });
                            break;

                        case 'system':
                            if (response.session_id && !capturedSessionId) {
                                capturedSessionId = response.session_id;
                                activeClaudeProcesses.set(capturedSessionId, claudeProcess);
                                if (ws.setSessionId) ws.setSessionId(capturedSessionId);

                                if (!sessionId && !sessionCreatedSent) {
                                    sessionCreatedSent = true;
                                    sendWithRunId({
                                        type: 'session-created',
                                        sessionId: capturedSessionId
                                    });
                                }
                            }
                            break;
                    }
                } catch (e) {
                    // If not JSON, it might be raw text or ANSI
                    // For now, just send as raw output to help debug
                    console.log('[CLI] Raw output:', line);
                }
            }
        });

        claudeProcess.stderr.on('data', (data) => {
            console.error('[CLI] stderr:', data.toString());
        });

        claudeProcess.on('close', (code) => {
            console.log(`[CLI] Process exited with code ${code}`);
            activeClaudeProcesses.delete(capturedSessionId || processKey);
            resolve();
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
