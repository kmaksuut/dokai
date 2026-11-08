export interface CodeRunOutput {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode?: number;
  executionTimeMs?: number;
  source: 'local-native' | 'rust-playground' | 'javascript-sandbox';
  missingToolchain?: boolean;
  toolchainName?: string;
  installCommand?: string;
  wingetId?: string;
}

const NON_EXECUTABLE_LANGS = new Set([
  'text',
  'plaintext',
  'txt',
  'json',
  'yaml',
  'yml',
  'toml',
  'ini',
  'xml',
  'html',
  'css',
  'markdown',
  'md',
  'sql',
  'dockerfile',
  'env',
  'conf'
]);

export function isLanguageRunnable(lang: string): boolean {
  const clean = (lang || 'text').trim().toLowerCase();
  return !NON_EXECUTABLE_LANGS.has(clean);
}

const TOOLCHAIN_GUIDES: Record<string, { name: string; cmd: string; wingetId: string }> = {
  cpp: {
    name: 'C++ Compiler (GCC g++ / MinGW-w64)',
    cmd: 'winget install -e --id BrechtSanders.WinLibs.POSIX.UCRT',
    wingetId: 'BrechtSanders.WinLibs.POSIX.UCRT'
  },
  'c++': {
    name: 'C++ Compiler (GCC g++ / MinGW-w64)',
    cmd: 'winget install -e --id BrechtSanders.WinLibs.POSIX.UCRT',
    wingetId: 'BrechtSanders.WinLibs.POSIX.UCRT'
  },
  c: {
    name: 'C Compiler (GCC / MinGW-w64)',
    cmd: 'winget install -e --id BrechtSanders.WinLibs.POSIX.UCRT',
    wingetId: 'BrechtSanders.WinLibs.POSIX.UCRT'
  },
  python: {
    name: 'Python 3 Interpreter',
    cmd: 'winget install -e --id Python.Python.3.12',
    wingetId: 'Python.Python.3.12'
  },
  py: {
    name: 'Python 3 Interpreter',
    cmd: 'winget install -e --id Python.Python.3.12',
    wingetId: 'Python.Python.3.12'
  },
  go: {
    name: 'Go Toolchain (golang)',
    cmd: 'winget install -e --id GoLang.Go',
    wingetId: 'GoLang.Go'
  },
  golang: {
    name: 'Go Toolchain (golang)',
    cmd: 'winget install -e --id GoLang.Go',
    wingetId: 'GoLang.Go'
  },
  java: {
    name: 'Java Development Kit (JDK 21)',
    cmd: 'winget install -e --id EclipseAdoptium.Temurin.21.JDK',
    wingetId: 'EclipseAdoptium.Temurin.21.JDK'
  },
  csharp: {
    name: '.NET 8 SDK',
    cmd: 'winget install -e --id Microsoft.DotNet.SDK.8',
    wingetId: 'Microsoft.DotNet.SDK.8'
  },
  cs: {
    name: '.NET 8 SDK',
    cmd: 'winget install -e --id Microsoft.DotNet.SDK.8',
    wingetId: 'Microsoft.DotNet.SDK.8'
  },
  bash: {
    name: 'Git Bash / Bash Shell',
    cmd: 'winget install -e --id Git.Git',
    wingetId: 'Git.Git'
  },
  sh: {
    name: 'Git Bash / Bash Shell',
    cmd: 'winget install -e --id Git.Git',
    wingetId: 'Git.Git'
  }
};

/**
 * Triggers native winget installation in an interactive terminal window when running in Tauri.
 */
export async function triggerToolchainInstall(wingetId: string): Promise<boolean> {
  if (!wingetId) return false;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('install_toolchain', { wingetId });
    return true;
  } catch (err) {
    console.warn('Could not launch winget installer directly:', err);
    return false;
  }
}

/**
 * Executes source code safely via either local Tauri native compiler or remote/in-app sandbox.
 */
export async function executeCode(code: string, language: string = 'rust'): Promise<CodeRunOutput> {
  const lang = (language || 'rust').trim().toLowerCase();
  const startTime = Date.now();

  // 1. Try Local Tauri Native IPC execution
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const result: any = await invoke('execute_code', { code, language: lang });
    return {
      success: result.success,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exit_code,
      executionTimeMs: result.execution_time_ms,
      source: 'local-native',
      missingToolchain: Boolean(result.missing_toolchain),
      toolchainName: result.toolchain_name || undefined,
      installCommand: result.install_command || undefined,
      wingetId: result.winget_id || undefined
    };
  } catch (tauriError: any) {
    console.info('Local native runner skipped, trying built-in sandbox fallback:', tauriError);
  }

  // 2. Built-in Sandbox Fallbacks (Rust & JavaScript/TypeScript always work out-of-the-box)
  if (lang === 'rust' || lang === 'rs') {
    return await executeRustViaPlayground(code, startTime);
  } else if (lang === 'javascript' || lang === 'js' || lang === 'ts' || lang === 'typescript' || lang === 'node') {
    return executeJsSandbox(code, startTime);
  }

  // 3. Guided Toolchain Installation Prompt for other languages when not available
  const guide = TOOLCHAIN_GUIDES[lang];
  if (guide) {
    return {
      success: false,
      stdout: '',
      stderr: `⚠️ The compiler/runtime environment for '${lang.toUpperCase()}' (${guide.name}) was not found on your system.\n\nTo install it, execute the following command in your terminal or click 'Install via Winget':\n  ${guide.cmd}`,
      exitCode: 127,
      executionTimeMs: Date.now() - startTime,
      source: 'local-native',
      missingToolchain: true,
      toolchainName: guide.name,
      installCommand: guide.cmd,
      wingetId: guide.wingetId
    };
  }

  return {
    success: false,
    stdout: '',
    stderr: `⚠️ To run '${language.toUpperCase()}' code, the corresponding compiler or runtime environment must be installed on your system.`,
    exitCode: 127,
    executionTimeMs: Date.now() - startTime,
    source: 'local-native',
    missingToolchain: true,
    toolchainName: `${language.toUpperCase()} Runtime / Compiler`,
    installCommand: `winget search ${lang}`
  };
}

async function executeRustViaPlayground(code: string, startTime: number): Promise<CodeRunOutput> {
  let finalCode = code.trim();
  if (!finalCode.includes('fn main')) {
    finalCode = `fn main() {\n${finalCode}\n}`;
  }

  try {
    const response = await fetch('https://play.rust-lang.org/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'stable',
        mode: 'debug',
        edition: '2021',
        crateType: 'bin',
        tests: false,
        code: finalCode,
        backtrace: false
      })
    });

    if (!response.ok) {
      throw new Error(`Rust Playground HTTP error ${response.status}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      stdout: data.stdout || '',
      stderr: data.stderr || '',
      exitCode: data.success ? 0 : 1,
      executionTimeMs: Date.now() - startTime,
      source: 'rust-playground'
    };
  } catch (err: any) {
    return {
      success: false,
      stdout: '',
      stderr: `Execution Error: ${err.message || 'Failed to reach Rust compiler environment.'}`,
      exitCode: 1,
      executionTimeMs: Date.now() - startTime,
      source: 'rust-playground'
    };
  }
}

function executeJsSandbox(code: string, startTime: number): CodeRunOutput {
  const logs: string[] = [];
  const errors: string[] = [];

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  try {
    const formatArg = (a: any) => {
      if (typeof a === 'object' && a !== null) {
        try {
          return JSON.stringify(a, null, 2);
        } catch {
          return String(a);
        }
      }
      return String(a);
    };

    console.log = (...args: any[]) => logs.push(args.map(formatArg).join(' '));
    console.warn = (...args: any[]) => logs.push('[WARN] ' + args.map(formatArg).join(' '));
    console.error = (...args: any[]) => errors.push(args.map(formatArg).join(' '));

    const runner = new Function(code);
    const returnVal = runner();
    if (returnVal !== undefined && logs.length === 0) {
      logs.push(formatArg(returnVal));
    }

    return {
      success: errors.length === 0,
      stdout: logs.join('\n'),
      stderr: errors.join('\n'),
      exitCode: errors.length === 0 ? 0 : 1,
      executionTimeMs: Date.now() - startTime,
      source: 'javascript-sandbox'
    };
  } catch (e: any) {
    return {
      success: false,
      stdout: logs.join('\n'),
      stderr: e.message || String(e),
      exitCode: 1,
      executionTimeMs: Date.now() - startTime,
      source: 'javascript-sandbox'
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  }
}
