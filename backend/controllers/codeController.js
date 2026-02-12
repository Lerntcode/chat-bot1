const vm = require('vm');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Execute code in a specific language
 */
exports.executeCode = async (req, res) => {
    const { language, code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }




    try {
        switch (language) {
            case 'javascript':
                return executeJavaScript(code, res);
            case 'python':
                return executePython(code, res);
            default:
                return res.status(400).json({
                    error: `Language '${language}' is not supported for local execution yet. Try 'javascript' or 'python'.`
                });
        }
    } catch (error) {
        console.error('Code execution error:', error);
        return res.status(500).json({ error: 'Internal server error during code execution' });
    }
};

/**
 * Execute JavaScript using Node.js vm module
 */
function executeJavaScript(code, res) {
    const sandbox = {
        console: {
            log: (...args) => {
                sandbox.logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
            },
            error: (...args) => {
                sandbox.errors.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
            },
            warn: (...args) => {
                sandbox.logs.push('[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
            }
        },
        logs: [],
        errors: []
    };

    const context = vm.createContext(sandbox);

    try {
        const script = new vm.Script(code);
        // Timeout of 5 seconds to prevent infinite loops
        script.runInContext(context, { timeout: 5000 });

        res.json({
            stdout: sandbox.logs.join('\n'),
            stderr: sandbox.errors.join('\n'),
            message: 'Execution successful'
        });
    } catch (error) {
        res.json({
            stdout: sandbox.logs.join('\n'),
            stderr: (sandbox.errors.join('\n') + '\n' + error.message).trim(),
            message: 'Execution failed'
        });
    }
}

/**
 * Execute Python using child_process
 */
/**
 * Execute Python using child_process (Piped via stdin)
 */
function executePython(code, res) {
    // Use 'python' or 'python3' depending on system
    const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';

    // Spawn without arguments to read from stdin
    const pythonProcess = spawn(pythonCommand);

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
        pythonProcess.kill();
        res.json({ error: 'Execution timed out (limit: 5s)' });
    }, 5000);

    pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        res.json({
            stdout,
            stderr,
            exitCode: code,
            message: code === 0 ? 'Execution successful' : 'Execution failed'
        });
    });

    pythonProcess.on('error', (err) => {
        clearTimeout(timeout);
        res.status(500).json({ error: 'Failed to start Python process. Is Python installed and in your PATH?' });
    });

    // Write code to stdin
    pythonProcess.stdin.write(code);
    pythonProcess.stdin.end();
}
