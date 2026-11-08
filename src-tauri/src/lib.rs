use std::fs;
use std::process::Command;
use std::time::Instant;

#[derive(serde::Serialize)]
pub struct CodeExecutionResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub execution_time_ms: u64,
    pub missing_toolchain: bool,
    pub toolchain_name: Option<String>,
    pub install_command: Option<String>,
    pub winget_id: Option<String>,
}

impl CodeExecutionResult {
    fn missing(name: &str, cmd: &str, winget: &str, lang: &str) -> Self {
        Self {
            success: false,
            stdout: String::new(),
            stderr: format!(
                "⚠️ The required compiler/runtime for '{}' ({}) is not installed on your system.\n\nYou can run the following command or use the installer button below:\n  {}",
                lang.to_uppercase(),
                name,
                cmd
            ),
            exit_code: 127,
            execution_time_ms: 0,
            missing_toolchain: true,
            toolchain_name: Some(name.to_string()),
            install_command: Some(cmd.to_string()),
            winget_id: Some(winget.to_string()),
        }
    }
}

#[tauri::command]
fn execute_code(code: String, language: String) -> Result<CodeExecutionResult, String> {
    if code.len() > 65_536 {
        return Err("Payload exceeds maximum permitted size of 64 KB.".into());
    }

    let lang = language.trim().to_lowercase();
    let start_time = Instant::now();
    let temp_dir = std::env::temp_dir();
    let unique_id = format!(
        "dokai_{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    );

    match lang.as_str() {
        // 1. Built-in Core: Windows Command Prompt (CMD / Batch)
        "cmd" | "bat" | "batch" | "dos" => {
            let cmd_file = temp_dir.join(format!("{}.cmd", unique_id));
            let script = format!("@echo off\r\nchcp 65001 >nul\r\n{}", code.replace('\n', "\r\n"));
            if let Err(e) = fs::write(&cmd_file, &script) {
                return Err(format!("Failed to write temporary CMD file: {}", e));
            }

            let run_output = Command::new("cmd.exe")
                .args(["/d", "/c"])
                .arg(&cmd_file)
                .output();

            let _ = fs::remove_file(&cmd_file);

            match run_output {
                Ok(res) => Ok(CodeExecutionResult {
                    success: res.status.success(),
                    stdout: String::from_utf8_lossy(&res.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&res.stderr).to_string(),
                    exit_code: res.status.code().unwrap_or(0),
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                    missing_toolchain: false,
                    toolchain_name: None,
                    install_command: None,
                    winget_id: None,
                }),
                Err(e) => Err(format!("CMD invocation failed: {}", e)),
            }
        }

        // 2. Built-in Core: PowerShell
        "powershell" | "pwsh" | "ps" | "ps1" => {
            let ps_file = temp_dir.join(format!("{}.ps1", unique_id));
            if let Err(e) = fs::write(&ps_file, &code) {
                return Err(format!("Failed to write temporary PowerShell script: {}", e));
            }

            let mut cmd = if cfg!(windows) {
                let mut c = Command::new("powershell.exe");
                c.args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                ]);
                c
            } else {
                let mut c = Command::new("pwsh");
                c.args(["-NoProfile", "-NonInteractive", "-File"]);
                c
            };

            let run_output = cmd.arg(&ps_file).output();
            let _ = fs::remove_file(&ps_file);

            match run_output {
                Ok(res) => Ok(CodeExecutionResult {
                    success: res.status.success(),
                    stdout: String::from_utf8_lossy(&res.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&res.stderr).to_string(),
                    exit_code: res.status.code().unwrap_or(0),
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                    missing_toolchain: false,
                    toolchain_name: None,
                    install_command: None,
                    winget_id: None,
                }),
                Err(_) => Ok(CodeExecutionResult::missing(
                    "PowerShell (pwsh)",
                    "winget install -e --id Microsoft.PowerShell",
                    "Microsoft.PowerShell",
                    &lang,
                )),
            }
        }

        // 3. Built-in Core: JavaScript / Node.js
        "javascript" | "js" | "node" | "mjs" => {
            let js_file = temp_dir.join(format!("{}.js", unique_id));
            if let Err(e) = fs::write(&js_file, &code) {
                return Err(format!("Failed to write temporary JS file: {}", e));
            }

            let run_output = Command::new("node")
                .arg(&js_file)
                .output()
                .or_else(|_| Command::new("bun").arg("run").arg(&js_file).output());

            let _ = fs::remove_file(&js_file);

            match run_output {
                Ok(res) => Ok(CodeExecutionResult {
                    success: res.status.success(),
                    stdout: String::from_utf8_lossy(&res.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&res.stderr).to_string(),
                    exit_code: res.status.code().unwrap_or(0),
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                    missing_toolchain: false,
                    toolchain_name: None,
                    install_command: None,
                    winget_id: None,
                }),
                // Return Err so frontend falls back to in-app JS sandbox seamlessly
                Err(e) => Err(format!("Node runtime not in PATH, using built-in JS sandbox: {}", e)),
            }
        }

        // 4. Built-in Core: Rust
        "rust" | "rs" => {
            let mut final_code = code.clone();
            if !code.contains("fn main") {
                final_code = format!("fn main() {{\n{}\n}}", code);
            }

            let rs_file = temp_dir.join(format!("{}.rs", unique_id));
            let exe_file = temp_dir.join(if cfg!(windows) {
                format!("{}.exe", unique_id)
            } else {
                unique_id.clone()
            });

            if let Err(e) = fs::write(&rs_file, &final_code) {
                return Err(format!("Failed to write temporary Rust file: {}", e));
            }

            let compile_output = Command::new("rustc")
                .arg(&rs_file)
                .arg("-o")
                .arg(&exe_file)
                .output();

            let _ = fs::remove_file(&rs_file);

            match compile_output {
                Ok(compile_res) => {
                    if !compile_res.status.success() {
                        let stderr = String::from_utf8_lossy(&compile_res.stderr).to_string();
                        return Ok(CodeExecutionResult {
                            success: false,
                            stdout: String::new(),
                            stderr: format!("Compilation Error:\n{}", stderr),
                            exit_code: compile_res.status.code().unwrap_or(1),
                            execution_time_ms: start_time.elapsed().as_millis() as u64,
                            missing_toolchain: false,
                            toolchain_name: None,
                            install_command: None,
                            winget_id: None,
                        });
                    }

                    let run_output = Command::new(&exe_file).output();
                    let _ = fs::remove_file(&exe_file);

                    match run_output {
                        Ok(run_res) => Ok(CodeExecutionResult {
                            success: run_res.status.success(),
                            stdout: String::from_utf8_lossy(&run_res.stdout).to_string(),
                            stderr: String::from_utf8_lossy(&run_res.stderr).to_string(),
                            exit_code: run_res.status.code().unwrap_or(0),
                            execution_time_ms: start_time.elapsed().as_millis() as u64,
                            missing_toolchain: false,
                            toolchain_name: None,
                            install_command: None,
                            winget_id: None,
                        }),
                        Err(e) => Err(format!("Failed to execute compiled Rust binary: {}", e)),
                    }
                }
                // Return Err so frontend falls back to Rust Playground seamlessly
                Err(e) => Err(format!("rustc not found locally, falling back to Rust Playground: {}", e)),
            }
        }

        // 5. On-Demand Compiler: C++ (g++ / clang++)
        "cpp" | "c++" | "cc" | "cxx" => {
            let mut final_code = code.clone();
            if !code.contains("main(") && !code.contains("main (") {
                final_code = format!(
                    "#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\nint main() {{\n{}\nreturn 0;\n}}",
                    code
                );
            }

            let cpp_file = temp_dir.join(format!("{}.cpp", unique_id));
            let exe_file = temp_dir.join(if cfg!(windows) {
                format!("{}.exe", unique_id)
            } else {
                unique_id.clone()
            });

            if let Err(e) = fs::write(&cpp_file, &final_code) {
                return Err(format!("Failed to write temporary C++ file: {}", e));
            }

            let compile_output = Command::new("g++")
                .arg("-std=c++20")
                .arg(&cpp_file)
                .arg("-o")
                .arg(&exe_file)
                .output()
                .or_else(|_| {
                    Command::new("clang++")
                        .arg("-std=c++20")
                        .arg(&cpp_file)
                        .arg("-o")
                        .arg(&exe_file)
                        .output()
                });

            let _ = fs::remove_file(&cpp_file);

            match compile_output {
                Ok(compile_res) => {
                    if !compile_res.status.success() {
                        return Ok(CodeExecutionResult {
                            success: false,
                            stdout: String::new(),
                            stderr: format!(
                                "C++ Compilation Error:\n{}",
                                String::from_utf8_lossy(&compile_res.stderr)
                            ),
                            exit_code: compile_res.status.code().unwrap_or(1),
                            execution_time_ms: start_time.elapsed().as_millis() as u64,
                            missing_toolchain: false,
                            toolchain_name: None,
                            install_command: None,
                            winget_id: None,
                        });
                    }

                    let run_output = Command::new(&exe_file).output();
                    let _ = fs::remove_file(&exe_file);

                    match run_output {
                        Ok(run_res) => Ok(CodeExecutionResult {
                            success: run_res.status.success(),
                            stdout: String::from_utf8_lossy(&run_res.stdout).to_string(),
                            stderr: String::from_utf8_lossy(&run_res.stderr).to_string(),
                            exit_code: run_res.status.code().unwrap_or(0),
                            execution_time_ms: start_time.elapsed().as_millis() as u64,
                            missing_toolchain: false,
                            toolchain_name: None,
                            install_command: None,
                            winget_id: None,
                        }),
                        Err(e) => Err(format!("Failed to execute C++ binary: {}", e)),
                    }
                }
                Err(_) => Ok(CodeExecutionResult::missing(
                    "C++ Compiler (GCC g++ / MinGW-w64 veya Clang)",
                    "winget install -e --id BrechtSanders.WinLibs.POSIX.UCRT",
                    "BrechtSanders.WinLibs.POSIX.UCRT",
                    "C++",
                )),
            }
        }

        // 6. On-Demand Compiler: C (gcc / clang)
        "c" => {
            let mut final_code = code.clone();
            if !code.contains("main(") && !code.contains("main (") {
                final_code = format!("#include <stdio.h>\n#include <stdlib.h>\nint main() {{\n{}\nreturn 0;\n}}", code);
            }

            let c_file = temp_dir.join(format!("{}.c", unique_id));
            let exe_file = temp_dir.join(if cfg!(windows) {
                format!("{}.exe", unique_id)
            } else {
                unique_id.clone()
            });

            if let Err(e) = fs::write(&c_file, &final_code) {
                return Err(format!("Failed to write temporary C file: {}", e));
            }

            let compile_output = Command::new("gcc")
                .arg(&c_file)
                .arg("-o")
                .arg(&exe_file)
                .output()
                .or_else(|_| Command::new("clang").arg(&c_file).arg("-o").arg(&exe_file).output());

            let _ = fs::remove_file(&c_file);

            match compile_output {
                Ok(compile_res) => {
                    if !compile_res.status.success() {
                        return Ok(CodeExecutionResult {
                            success: false,
                            stdout: String::new(),
                            stderr: format!(
                                "C Compilation Error:\n{}",
                                String::from_utf8_lossy(&compile_res.stderr)
                            ),
                            exit_code: compile_res.status.code().unwrap_or(1),
                            execution_time_ms: start_time.elapsed().as_millis() as u64,
                            missing_toolchain: false,
                            toolchain_name: None,
                            install_command: None,
                            winget_id: None,
                        });
                    }

                    let run_output = Command::new(&exe_file).output();
                    let _ = fs::remove_file(&exe_file);

                    match run_output {
                        Ok(run_res) => Ok(CodeExecutionResult {
                            success: run_res.status.success(),
                            stdout: String::from_utf8_lossy(&run_res.stdout).to_string(),
                            stderr: String::from_utf8_lossy(&run_res.stderr).to_string(),
                            exit_code: run_res.status.code().unwrap_or(0),
                            execution_time_ms: start_time.elapsed().as_millis() as u64,
                            missing_toolchain: false,
                            toolchain_name: None,
                            install_command: None,
                            winget_id: None,
                        }),
                        Err(e) => Err(format!("Failed to execute C binary: {}", e)),
                    }
                }
                Err(_) => Ok(CodeExecutionResult::missing(
                    "C Compiler (GCC / MinGW-w64 veya Clang)",
                    "winget install -e --id BrechtSanders.WinLibs.POSIX.UCRT",
                    "BrechtSanders.WinLibs.POSIX.UCRT",
                    "C",
                )),
            }
        }

        // 7. On-Demand Runtime: Python
        "python" | "py" => {
            let py_file = temp_dir.join(format!("{}.py", unique_id));
            if let Err(e) = fs::write(&py_file, &code) {
                return Err(format!("Failed to write temporary Python file: {}", e));
            }

            let run_output = Command::new(if cfg!(windows) { "python" } else { "python3" })
                .arg(&py_file)
                .output();

            let _ = fs::remove_file(&py_file);

            match run_output {
                Ok(res) => Ok(CodeExecutionResult {
                    success: res.status.success(),
                    stdout: String::from_utf8_lossy(&res.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&res.stderr).to_string(),
                    exit_code: res.status.code().unwrap_or(0),
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                    missing_toolchain: false,
                    toolchain_name: None,
                    install_command: None,
                    winget_id: None,
                }),
                Err(_) => Ok(CodeExecutionResult::missing(
                    "Python 3 Interpreter",
                    "winget install -e --id Python.Python.3.12",
                    "Python.Python.3.12",
                    "Python",
                )),
            }
        }

        // 8. On-Demand Runtime: Go
        "go" | "golang" => {
            let mut final_code = code.clone();
            if !code.contains("package main") {
                final_code = format!("package main\nimport \"fmt\"\nfunc main() {{\n{}\n}}", code);
            }
            let go_file = temp_dir.join(format!("{}.go", unique_id));
            if let Err(e) = fs::write(&go_file, &final_code) {
                return Err(format!("Failed to write temporary Go file: {}", e));
            }

            let run_output = Command::new("go").arg("run").arg(&go_file).output();
            let _ = fs::remove_file(&go_file);

            match run_output {
                Ok(res) => Ok(CodeExecutionResult {
                    success: res.status.success(),
                    stdout: String::from_utf8_lossy(&res.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&res.stderr).to_string(),
                    exit_code: res.status.code().unwrap_or(0),
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                    missing_toolchain: false,
                    toolchain_name: None,
                    install_command: None,
                    winget_id: None,
                }),
                Err(_) => Ok(CodeExecutionResult::missing(
                    "Go Toolchain (go)",
                    "winget install -e --id GoLang.Go",
                    "GoLang.Go",
                    "Go",
                )),
            }
        }

        // 9. On-Demand Runtime: Bash / Shell
        "bash" | "sh" | "shell" | "zsh" => {
            let sh_file = temp_dir.join(format!("{}.sh", unique_id));
            let normalized_code = code.replace("\r\n", "\n");
            if let Err(e) = fs::write(&sh_file, &normalized_code) {
                return Err(format!("Failed to write temporary shell file: {}", e));
            }

            let run_output = Command::new("bash")
                .arg(&sh_file)
                .output()
                .or_else(|_| Command::new("sh").arg(&sh_file).output());

            let _ = fs::remove_file(&sh_file);

            match run_output {
                Ok(res) => Ok(CodeExecutionResult {
                    success: res.status.success(),
                    stdout: String::from_utf8_lossy(&res.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&res.stderr).to_string(),
                    exit_code: res.status.code().unwrap_or(0),
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                    missing_toolchain: false,
                    toolchain_name: None,
                    install_command: None,
                    winget_id: None,
                }),
                Err(_) => Ok(CodeExecutionResult::missing(
                    "Bash Shell (Git Bash / WSL)",
                    "winget install -e --id Git.Git",
                    "Git.Git",
                    "Bash",
                )),
            }
        }

        // 10. On-Demand Runtime: Java (JDK 11+ single-file source execution)
        "java" => {
            let java_file = temp_dir.join(format!("DokaiRun_{}.java", unique_id));
            if let Err(e) = fs::write(&java_file, &code) {
                return Err(format!("Failed to write temporary Java file: {}", e));
            }

            let run_output = Command::new("java").arg(&java_file).output();
            let _ = fs::remove_file(&java_file);

            match run_output {
                Ok(res) => Ok(CodeExecutionResult {
                    success: res.status.success(),
                    stdout: String::from_utf8_lossy(&res.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&res.stderr).to_string(),
                    exit_code: res.status.code().unwrap_or(0),
                    execution_time_ms: start_time.elapsed().as_millis() as u64,
                    missing_toolchain: false,
                    toolchain_name: None,
                    install_command: None,
                    winget_id: None,
                }),
                Err(_) => Ok(CodeExecutionResult::missing(
                    "Java Development Kit (JDK 21)",
                    "winget install -e --id EclipseAdoptium.Temurin.21.JDK",
                    "EclipseAdoptium.Temurin.21.JDK",
                    "Java",
                )),
            }
        }

        _ => Ok(CodeExecutionResult::missing(
            &format!("{} Compiler / Runtime", lang.to_uppercase()),
            &format!("winget search {}", lang),
            "",
            &lang,
        )),
    }
}

/// Launches an interactive terminal window to install a missing language toolchain via winget.
#[tauri::command]
fn install_toolchain(winget_id: String) -> Result<String, String> {
    let clean_id = winget_id.trim();
    if clean_id.is_empty()
        || !clean_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_')
    {
        return Err("Invalid package identifier.".into());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd.exe")
            .args([
                "/c",
                "start",
                "cmd.exe",
                "/k",
                &format!(
                    "echo Installing {} via Winget... && winget install -e --id {}",
                    clean_id, clean_id
                ),
            ])
            .spawn()
            .map_err(|e| format!("Failed to launch Winget installer terminal: {}", e))?;
        return Ok(format!("Started installation for {}", clean_id));
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Automatic winget installer is only supported on Windows.".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![execute_code, install_toolchain])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
