import type { Documentation } from './types';

export const initialDocs: Documentation[] = [
  /* ============================================================================
   * 0. WELCOME TO DOKAI STUDIO (Single-Section Comprehensive Guide)
   * ============================================================================ */
  {
    id: 'welcome-to-dokai',
    title: 'Welcome to DokAI Studio',
    description:
      'Quick-start guide, workspace tour, feature overview, and shortcuts for DokAI — the AI-powered technical documentation studio and runnable code environment.',
    version: '2.0.0',
    category: 'Getting Started',
    author: 'DokAI Core Team',
    tags: ['welcome', 'getting-started', 'guide', 'features', 'shortcuts'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: [
      {
        id: 'sec-welcome-guide',
        title: '1. Welcome & Complete Feature Tour',
        slug: 'welcome-feature-tour',
        order: 1,
        content: `## Welcome to DokAI Studio 🚀

**DokAI** is a high-performance, developer-first documentation suite built for authoring, testing, and managing technical engineering guides with built-in artificial intelligence and runnable code sandboxes.

---

### Key Capabilities at a Glance

| Feature | Description | Shortcut / Action |
| :--- | :--- | :--- |
| **Document Tabs** | Chrome-style draggable tabs with smooth reordering | Click or drag tabs |
| **Docs Library (DocsBar)** | Fast collapsible document drawer with instant search | Top-left Docs toggle or \`Ctrl+B\` |
| **Section Manager (Sidebar)** | Reorganize, add, rename, and drag sections | Left panel toggle |
| **Live Markdown Preview** | GitHub Flavored Markdown, KaTeX math, GFM alerts | Split Editor / Preview |
| **Interactive Code Runner** | Execute Rust, JavaScript, PowerShell, and CMD live | Click **Run Code** button |
| **AI Documentation Generator** | Generate structured docs from prompts | TitleBar ✨ button |
| **AI Section Enhancer** | Enhance single sections or entire documents | Footer ✨ **Enhance This Docs** |
| **AI Accuracy Auditor** | Scan docs for technical flaws, security holes & bugs | TitleBar 🔍 **AI Audit** |
| **Global Typography** | Set any system or uploaded font across the whole UI | Settings (⚙️) → Typography |
| **Command Palette** | Instant full-text fuzzy search across all sections | \`Ctrl+K\` or TitleBar Search |

---

### Interactive Code Runner

DokAI embeds execution environments so you can test code snippets directly inside your documentation:

- **Rust:** Compiled and run via native Rust toolchain (\`rustc\` / \`cargo\`) or online compiler sandbox.
- **JavaScript:** Executed locally in an isolated web sandbox.
- **PowerShell & Windows CMD:** Executed natively via Windows process host.
- **C++, Python, Go:** Toolchain auto-detection with one-click Winget setup commands if missing.

Test it right now by clicking **Run Code** on this snippet:

\`\`\`javascript
// Test runnable JavaScript in DokAI
const platform = "DokAI Studio";
const features = ["AI Generation", "Live Markdown", "Runnable Sandboxes", "Multi-Language"];

console.log("Welcome to " + platform + "!");
features.forEach((feat, idx) => {
  console.log(\`  \${idx + 1}. \${feat} ✓\`);
});
\`\`\`

---

### Markdown Formatting Tips

DokAI supports full GitHub Flavored Markdown (GFM) including alerts:

> [!NOTE]
> Useful background context, implementation details, or explanations.

> [!TIP]
> Helpful recommendations, best practices, and performance suggestions.

> [!IMPORTANT]
> Essential requirements, critical steps, and must-know information.

> [!WARNING]
> Breaking changes, compatibility warnings, and potential gotchas.

> [!CAUTION]
> High-risk actions that could cause data loss or security vulnerabilities.

---

### Workspace Shortcuts Cheat Sheet

- **\`Ctrl + K\`**: Open Global Search & Command Palette (search documents, sections, and actions).
- **\`Ctrl + S\`**: Explicitly trigger save (documents auto-save continuously in real-time).
- **Right-Click**: Access the desktop context menu with Cut, Copy, Paste, and quick actions.
- **Drag & Drop**: Rearrange open tabs horizontally in the TitleBar.

> [!TIP]
> Ready to explore? Select any document from the **DocsBar** on the left (e.g. *Rust: Zero to Mastery*, *JavaScript: Zero to Mastery*, or *PowerShell Mastery*) or click **✨ AI Generator** in the titlebar to create your own documentation in seconds!`
      }
    ]
  },

  /* ============================================================================
   * 1. RUST: ZERO TO MASTERY COMPLETE GUIDE
   * ============================================================================ */
  {
    id: 'rust-zero-to-mastery',
    title: 'Rust: Zero to Mastery Complete Guide',
    description:
      'Complete from-scratch to advanced systems programming guide for Rust: Memory safety, Ownership, Borrow Checker, Lifetimes, Traits, Smart Pointers, Concurrency, Async/Tokio, and Cargo optimization.',
    version: '2.0.0',
    category: 'Systems Programming',
    author: 'DokAI Core Engineering',
    tags: ['rust', 'cargo', 'systems', 'memory-safety', 'ownership', 'concurrency', 'tokio'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: [
      {
        id: 'sec-rust-1-toolchain',
        title: '1. Toolchain, Cargo & Workspace Architecture',
        slug: 'toolchain-cargo-workspace',
        order: 1,
        content: `## 1. Toolchain, Cargo & Workspace Architecture

Rust is a modern systems programming language that guarantees **compile-time memory safety** and **data-race protection** without requiring a runtime Garbage Collector.

### Rust Toolchain Components

| Tool | Responsibility | Example Command |
| :--- | :--- | :--- |
| **\`rustup\`** | Toolchain & cross-compilation target manager | \`rustup update stable\` |
| **\`rustc\`** | Official LLVM-based Rust compiler | \`rustc main.rs -O\` |
| **\`cargo\`** | Package manager, build system & test orchestrator | \`cargo run --release\` |
| **\`clippy\`** | Advanced static analysis linter | \`cargo clippy -- -D warnings\` |
| **\`rustfmt\`** | Standard automated code formatter | \`cargo fmt --check\` |

### Verification via PowerShell

\`\`\`powershell
# Verify installed Rust environment:
Write-Output "Checking Rust Toolchain:"
rustc --version
cargo --version
\`\`\`

### First Runnable Rust Program

Click **Run Code** on the top-right of the snippet below to execute it:

\`\`\`rust
fn main() {
    let language = "Rust";
    let edition = 2024;
    let zero_cost_abstractions = true;

    println!("Language: {} (Edition {})", language, edition);
    println!("Zero-cost abstractions: {}", zero_cost_abstractions);

    let scores = [95, 88, 92, 100];
    let sum: i32 = scores.iter().sum();
    println!("Total Score: {} | Average: {:.1}", sum, sum as f64 / scores.len() as f64);
}
\`\`\`

> [!NOTE]
> The exclamation mark (\`!\`) at the end of \`println!\` designates a declarative **macro**, which expands at compile-time with full type verification.`
      },
      {
        id: 'sec-rust-2-types-memory',
        title: '2. Variables, Shadowing, Stack vs Heap & Types',
        slug: 'variables-shadowing-stack-heap-types',
        order: 2,
        content: `## 2. Variables, Shadowing, Stack vs Heap & Types

In Rust, variables are **immutable by default**. To allow mutation, you must explicitly annotate the declaration with the \`mut\` keyword.

### Immutability, \`mut\`, \`const\` and Shadowing

\`\`\`rust
const MAX_CONNECTIONS: usize = 10_000;

fn main() {
    // 1. Immutable variable
    let port = 8080;
    println!("Server Port: {} (Max Connections: {})", port, MAX_CONNECTIONS);

    // 2. Mutable variable
    let mut active_users = 0;
    active_users += 15;
    println!("Active Users: {}", active_users);

    // 3. Variable Shadowing (rebinding name, changing type or value)
    let raw_input = "   42   ";
    let raw_input = raw_input.trim();
    let raw_input: u32 = raw_input.parse().expect("Invalid number");
    println!("Parsed numeric value after shadowing: {}", raw_input * 2);
}
\`\`\`

### Stack vs. Heap Allocation

| Characteristic | Stack | Heap |
| :--- | :--- | :--- |
| **Access Speed** | Extremely fast (L1/L2 cache locality) | Involves pointer indirection |
| **Size Requirement** | Fixed, known at compile-time | Dynamic, expandable at runtime |
| **Management** | Auto LIFO push/pop | Managed by Ownership & RAII |
| **Examples** | \`i32\`, \`bool\`, \`[u8; 32]\`, slices \`&str\` | \`String\`, \`Vec<T>\`, \`Box<T>\` |`
      },
      {
        id: 'sec-rust-3-ownership',
        title: '3. Ownership, Borrowing & Lifetimes (The Heart of Rust)',
        slug: 'ownership-borrowing-lifetimes',
        order: 3,
        content: `## 3. Ownership, Borrowing & Lifetimes

Rust's core innovation is its **Ownership** system, enforced entirely at compile-time by the **Borrow Checker**.

### The Three Rules of Ownership

1. Each value in Rust has an **owner**.
2. There can only be **one owner at a time**.
3. When the owner goes out of scope, the value is automatically **dropped** (RAII).

### Move Semantics vs. Copy Trait

\`\`\`rust
fn main() {
    // Types that implement Copy (primitives on the stack)
    let a = 100;
    let b = a; // Copied bitwise
    println!("Stack values: a = {}, b = {}", a, b);

    // Heap-allocated types without Copy (Move semantics)
    let s1 = String::from("Rust Ownership");
    let s2 = s1; // s1 is MOVED into s2; s1 becomes invalid!
    
    // println!("{}", s1); // Compile Error: borrow of moved value
    println!("Moved value in s2: {}", s2);
}
\`\`\`

### The Rules of Borrowing

- You can have **any number of immutable references** (\`&T\`), OR
- Exactly **one mutable reference** (\`&mut T\`) at any given time.
- References must **always be valid** (dangling pointers are prevented at compile-time).

\`\`\`rust
fn calculate_length(text: &String) -> usize {
    text.len() // Borrowed immutably; original owner retains value
}

fn append_suffix(target: &mut String) {
    target.push_str(" [Verified]");
}

fn main() {
    let mut doc_name = String::from("Rust Guide");
    
    // Immutable borrow
    let length = calculate_length(&doc_name);
    println!("Doc: '{}', Length: {}", doc_name, length);

    // Mutable borrow
    append_suffix(&mut doc_name);
    println!("Updated Doc: '{}'", doc_name);
}
\`\`\``
      },
      {
        id: 'sec-rust-4-structs-enums',
        title: '4. Structs, Enums & Exhaustive Pattern Matching',
        slug: 'structs-enums-pattern-matching',
        order: 4,
        content: `## 4. Structs, Enums & Exhaustive Pattern Matching

Rust models domains using **Structs** (Product types) and **Enums** (Algebraic Data Types / Sum types).

\`\`\`rust
#[derive(Debug)]
enum DeploymentStatus {
    Pending,
    Active { ip_address: String, port: u16 },
    Failed(String),
}

#[derive(Debug)]
struct ServerService {
    name: String,
    status: DeploymentStatus,
}

impl ServerService {
    fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            status: DeploymentStatus::Pending,
        }
    }

    fn print_summary(&self) {
        match &self.status {
            DeploymentStatus::Pending => println!("Service '{}' is awaiting initialization.", self.name),
            DeploymentStatus::Active { ip_address, port } => {
                println!("Service '{}' live at http://{}:{}", self.name, ip_address, port);
            }
            DeploymentStatus::Failed(reason) => {
                println!("Service '{}' failed: {}", self.name, reason);
            }
        }
    }
}

fn main() {
    let mut web_node = ServerService::new("api-gateway");
    web_node.print_summary();

    web_node.status = DeploymentStatus::Active {
        ip_address: "127.0.0.1".to_string(),
        port: 8080,
    };
    web_node.print_summary();
}
\`\`\``
      },
      {
        id: 'sec-rust-5-error-handling',
        title: '5. Robust Error Handling (Result, Option & ? Operator)',
        slug: 'error-handling-result-option',
        order: 5,
        content: `## 5. Robust Error Handling (Result, Option & '?' Operator)

Rust does **not** have null values or unhandled runtime exceptions. Instead, potential failures and absence of values are encoded into type signatures:

- **\`Option<T>\`**: \`Some(T)\` or \`None\`
- **\`Result<T, E>\`**: \`Ok(T)\` or \`Err(E)\`

\`\`\`rust
fn parse_port(input: &str) -> Result<u16, String> {
    let value: u16 = input
        .trim()
        .parse()
        .map_err(|e| format!("Failed to parse port '{}': {}", input, e))?;

    if value < 1024 {
        return Err(format!("Privileged port {} requires root permissions", value));
    }

    Ok(value)
}

fn main() {
    let test_ports = ["8080", " 9000 ", "80", "invalid_port"];

    for raw in test_ports {
        match parse_port(raw) {
            Ok(port) => println!("✓ Port allowed: {}", port),
            Err(err) => println!("✗ Configuration rejected: {}", err),
        }
    }
}
\`\`\`

> [!TIP]
> The \`?\` operator automatically returns early on \`Err\`, unpacking \`Ok(T)\` seamlessly.`
      },
      {
        id: 'sec-rust-6-traits-generics',
        title: '6. Traits, Generics & Dynamic Dispatch',
        slug: 'traits-generics-dispatch',
        order: 6,
        content: `## 6. Traits, Generics & Dynamic Dispatch

Traits define shared interfaces and behavior across types, similar to interfaces in other languages but with zero-cost static dispatch.

\`\`\`rust
trait Summarizable {
    fn summarize(&self) -> String;
}

struct Article {
    headline: String,
    author: String,
}

impl Summarizable for Article {
    fn summarize(&self) -> String {
        format!("'{}' by {}", self.headline, self.author)
    }
}

// Static Dispatch with Generics (Monomorphization - Zero Runtime Overhead)
fn print_static<T: Summarizable>(item: &T) {
    println!("Static: {}", item.summarize());
}

// Dynamic Dispatch with Trait Objects (vtable)
fn print_dynamic(item: &dyn Summarizable) {
    println!("Dynamic: {}", item.summarize());
}

fn main() {
    let post = Article {
        headline: "Understanding Rust Lifetimes".into(),
        author: "Ferris".into(),
    };

    print_static(&post);
    print_dynamic(&post);
}
\`\`\``
      },
      {
        id: 'sec-rust-7-collections-iterators',
        title: '7. Collections, Iterators & Functional Pipelines',
        slug: 'collections-iterators-pipelines',
        order: 7,
        content: `## 7. Collections, Iterators & Functional Pipelines

Rust's \`Iterator\` adapters (\`map\`, \`filter\`, \`fold\`, \`collect\`) are lazy and compile down to the exact same assembly as hand-tuned C \`for\` loops.

\`\`\`rust
fn main() {
    let numbers = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    // Functional pipeline: filter even -> square -> collect
    let squares: Vec<i32> = numbers
        .iter()
        .filter(|&&x| x % 2 == 0)
        .map(|&x| x * x)
        .collect();

    println!("Original: {:?}", numbers);
    println!("Even Squares: {:?}", squares);

    let sum_of_squares: i32 = squares.iter().sum();
    println!("Sum of Squares: {}", sum_of_squares);
}
\`\`\``
      },
      {
        id: 'sec-rust-8-smart-pointers-concurrency',
        title: '8. Smart Pointers & Fearless Concurrency',
        slug: 'smart-pointers-concurrency',
        order: 8,
        content: `## 8. Smart Pointers & Fearless Concurrency

Rust guarantees **Fearless Concurrency**: data races are caught at compile-time by the \`Send\` and \`Sync\` marker traits.

### Core Smart Pointers

- **\`Box<T>\`**: Unique ownership of data on the heap.
- **\`Rc<T>\`**: Reference counting for single-threaded multiple ownership.
- **\`Arc<T>\`**: Atomic Reference Counting for thread-safe shared ownership.
- **\`Mutex<T>\`**: Mutual exclusion locking protecting internal data.

\`\`\`rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..5 {
        let counter_clone = Arc::clone(&counter);
        let handle = thread::spawn(move || {
            let mut num = counter_clone.lock().unwrap();
            *num += 1;
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }

    println!("Final Counter Result: {}", *counter.lock().unwrap());
}
\`\`\``
      },
      {
        id: 'sec-rust-9-macros-release',
        title: '9. Macros, Cargo Profiles & Production Optimization',
        slug: 'macros-cargo-profiles-production',
        order: 9,
        content: `## 9. Macros, Cargo Profiles & Production Optimization

### Recommended \`Cargo.toml\` Production Release Profile

\`\`\`toml
[profile.release]
opt-level = 3          # Maximum LLVM optimization
lto = "fat"            # Fat Link-Time Optimization across crates
codegen-units = 1      # Maximize inline optimization
panic = "abort"        # Strip stack unwinding tables for smaller binary size
strip = true           # Strip debug symbols automatically
\`\`\`

### Declarative Macro Example

\`\`\`rust
macro_rules! log_info {
    ($($arg:tt)*) => {
        println!("[INFO {:?}] {}", std::time::SystemTime::now(), format!($($arg)*));
    };
}

fn main() {
    log_info!("DokAI production service started on port {}", 8080);
}
\`\`\``
      }
    ]
  },

  /* ============================================================================
   * 2. JAVASCRIPT: ZERO TO MASTERY (ES2025+ Guide)
   * ============================================================================ */
  {
    id: 'javascript-zero-to-mastery',
    title: 'JavaScript: Zero to Mastery (ES2025+ Guide)',
    description:
      'Complete from-scratch to advanced guide for modern JavaScript: V8 Engine, Execution Context, Closures, Prototypes, Classes, Event Loop, Promises, Async/Await, Functional Programming, and Memory Optimization.',
    version: '2.0.0',
    category: 'Web & Runtime Development',
    author: 'DokAI Core Engineering',
    tags: ['javascript', 'es2025', 'v8', 'async', 'closures', 'promises', 'nodejs'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: [
      {
        id: 'sec-js-1-engine-types',
        title: '1. V8 Engine Architecture & Execution Context',
        slug: 'v8-engine-types-context',
        order: 1,
        content: `## 1. V8 Engine Architecture & Execution Context

Modern JavaScript (ECMAScript) runs on high-performance JIT engines (such as V8 in Chromium/Node.js, JavaScriptCore in WebKit, and SpiderMonkey in Firefox).

### The V8 Compilation Pipeline

1. **Parser:** Converts source code into an Abstract Syntax Tree (AST).
2. **Ignition Interpreter:** Emits lightweight bytecode quickly for fast first startup.
3. **TurboFan Optimizing Compiler:** Compiles hot functions into optimized machine code based on runtime profile types.

### Primitive Types vs. Reference Objects

\`\`\`javascript
// 1. Primitives (stored by value)
const id = Symbol('doc_id');
const bigVal = 9007199254740991n; // BigInt
const version = 2.0;

// 2. Objects (stored by reference in Memory Heap)
const documentMeta = {
  title: "JavaScript Zero to Mastery",
  tags: ["v8", "javascript", "ecmascript"],
  isPublished: true
};

// Immutability via Object.freeze
Object.freeze(documentMeta);

console.log("Document Title:", documentMeta.title);
console.log("BigInt Calculation:", bigVal + 10n);
\`\`\``
      },
      {
        id: 'sec-js-2-closures-scope',
        title: '2. Scope, Closures & Lexical Environments',
        slug: 'scope-closures-lexical',
        order: 2,
        content: `## 2. Scope, Closures & Lexical Environments

A **closure** is the combination of a function bundled together with references to its surrounding state (**lexical environment**). Closures give functions access to outer scope even after the outer function has returned.

\`\`\`javascript
function createRateLimiter(maxCalls, timeWindowMs) {
  let callTimestamps = [];

  return function executeCall(callerId) {
    const now = Date.now();
    callTimestamps = callTimestamps.filter(t => now - t < timeWindowMs);

    if (callTimestamps.length >= maxCalls) {
      console.warn(\`[429 Rate Limit] \${callerId} exceeded \${maxCalls} calls per \${timeWindowMs}ms\`);
      return false;
    }

    callTimestamps.push(now);
    console.log(\`[200 OK] \${callerId} executed (\${callTimestamps.length}/\${maxCalls})\`);
    return true;
  };
}

const limiter = createRateLimiter(3, 1000);
limiter("User-A");
limiter("User-A");
limiter("User-A");
limiter("User-A"); // Rejection triggered
\`\`\``
      },
      {
        id: 'sec-js-3-objects-classes',
        title: '3. Prototypes, Classes & Modern OOP (ES2022+)',
        slug: 'prototypes-classes-oop',
        order: 3,
        content: `## 3. Prototypes, Classes & Modern OOP (ES2022+)

JavaScript uses **prototypal inheritance**. ES2022+ introduced official private class fields using the \`#\` prefix, providing real runtime privacy.

\`\`\`javascript
class BaseRepository {
  #connectionString;
  static poolCount = 0;

  constructor(connectionString) {
    this.#connectionString = connectionString;
    BaseRepository.poolCount++;
  }

  // Private helper method
  #maskSecret() {
    return this.#connectionString.replace(/://.*@/, '://***@');
  }

  connect() {
    console.log(\`Connected to: \${this.#maskSecret()}\`);
  }
}

class DocRepository extends BaseRepository {
  constructor(uri, collection) {
    super(uri);
    this.collection = collection;
  }

  query(filter) {
    console.log(\`Querying collection '\${this.collection}' with filter:\`, filter);
    return [{ id: 'doc-1', status: 'ready' }];
  }
}

const repo = new DocRepository('postgres://admin:secret123@localhost:5432/dokai', 'documents');
repo.connect();
repo.query({ category: 'web' });
\`\`\``
      },
      {
        id: 'sec-js-4-arrays-collections',
        title: '4. Arrays, Iterables & Modern Transformations',
        slug: 'arrays-iterables-transformations',
        order: 4,
        content: `## 4. Arrays, Iterables & Modern Transformations

Modern ECMAScript provides expressive, non-mutating array transformation methods (\`map\`, \`filter\`, \`reduce\`, \`flatMap\`, \`toSorted\`, \`Object.groupBy\`).

\`\`\`javascript
const docs = [
  { id: 1, title: 'Rust Systems', category: 'Systems', rating: 4.9 },
  { id: 2, title: 'JavaScript Mastery', category: 'Web', rating: 4.8 },
  { id: 3, title: 'PowerShell Scripts', category: 'Systems', rating: 4.7 },
  { id: 4, title: 'CSS Layouts', category: 'Web', rating: 4.6 }
];

// 1. Immutable sort with toSorted
const byRating = docs.toSorted((a, b) => b.rating - a.rating);
console.log("Top Rated:", byRating[0].title);

// 2. Group by category using Object.groupBy (ES2024)
const grouped = Object.groupBy ? Object.groupBy(docs, d => d.category) : {};
console.log("Grouped Categories:", Object.keys(grouped));

// 3. Transformation pipeline
const formattedSummaries = docs
  .filter(d => d.rating >= 4.8)
  .map(d => \`★ \${d.title} (\${d.rating})\`);

console.log("Featured Summaries:", formattedSummaries);
\`\`\``
      },
      {
        id: 'sec-js-5-async-event-loop',
        title: '5. Asynchronous Architecture & The Event Loop',
        slug: 'async-event-loop-promises',
        order: 5,
        content: `## 5. Asynchronous Architecture & The Event Loop

JavaScript executes on a single-threaded Call Stack, orchestrating non-blocking I/O through the **Event Loop**, **Microtask Queue** (Promises, \`queueMicrotask\`), and **Macrotask Queue** (\`setTimeout\`, I/O).

\`\`\`javascript
async function simulateConcurrentFetch() {
  console.log("1. Starting async batch fetch...");

  const fetchDoc = (id, delayMs) =>
    new Promise(resolve => {
      setTimeout(() => resolve({ id, payload: \`Data for #\${id}\` }), delayMs);
    });

  // Parallel execution with Promise.allSettled
  const results = await Promise.allSettled([
    fetchDoc("A", 80),
    fetchDoc("B", 40),
    fetchDoc("C", 60)
  ]);

  results.forEach((res, idx) => {
    if (res.status === 'fulfilled') {
      console.log(\`  Response \${idx + 1}: \${res.value.payload}\`);
    }
  });

  console.log("2. Batch fetch completed!");
}

simulateConcurrentFetch();
\`\`\``
      },
      {
        id: 'sec-js-6-generators-proxies-perf',
        title: '6. Generators, Proxies & Performance Optimization',
        slug: 'generators-proxies-performance',
        order: 6,
        content: `## 6. Generators, Proxies & Performance Optimization

### Metaprogramming with \`Proxy\` and \`Reflect\`

\`\`\`javascript
// Observable state store with automatic validation
function createObservedStore(initial) {
  return new Proxy(initial, {
    set(target, prop, value, receiver) {
      console.log(\`[State Change] \${String(prop)}: \${target[prop]} -> \${value}\`);
      return Reflect.set(target, prop, value, receiver);
    }
  });
}

const state = createObservedStore({ activeTab: 'home', count: 0 });
state.activeTab = 'editor';
state.count = 42;
\`\`\``
      }
    ]
  },

  /* ============================================================================
   * 3. POWERSHELL: SYSTEMS & AUTOMATION MASTERY
   * ============================================================================ */
  {
    id: 'powershell-basics-mastery',
    title: 'PowerShell: Systems & Automation Mastery',
    description:
      'Essential to advanced Windows automation and systems scripting with PowerShell: Cmdlets, Object Pipeline, Functions, JSON/REST APIs, Error Handling, and Native OS Administration.',
    version: '2.0.0',
    category: 'Systems Automation',
    author: 'DokAI Automation Engineers',
    tags: ['powershell', 'automation', 'sysadmin', 'windows', 'scripting', 'json'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: [
      {
        id: 'sec-ps-1-fundamentals',
        title: '1. Architecture & The Verb-Noun Cmdlet Syntax',
        slug: 'powershell-architecture-cmdlets',
        order: 1,
        content: `## 1. Architecture & The Verb-Noun Cmdlet Syntax

PowerShell is an object-oriented automation platform. Unlike Unix text streams, PowerShell passes rich .NET objects through the pipeline.

### Core Discovery Cmdlets

- **\`Get-Command\`**: Discover cmdlets by verb or noun (e.g. \`Get-Command *Process*\`).
- **\`Get-Help\`**: Access official cmdlet manuals and syntax.
- **\`Get-Member\`**: Inspect properties and methods of any object in the pipeline.

\`\`\`powershell
# Inspect system environment and host
$HostInfo = [PSCustomObject]@{
    PowerShellVersion = $PSVersionTable.PSVersion.ToString()
    OperatingSystem   = [System.Environment]::OSVersion.VersionString
    MachineName       = [System.Environment]::MachineName
    ProcessorCount    = [System.Environment]::ProcessorCount
}

Write-Output "PowerShell Environment Summary:"
$HostInfo | Format-List
\`\`\``
      },
      {
        id: 'sec-ps-2-object-pipeline',
        title: '2. The Object-Oriented Pipeline',
        slug: 'powershell-object-pipeline',
        order: 2,
        content: `## 2. The Object-Oriented Pipeline

Because pipelines transport objects, filtering and projections avoid fragile regular expressions or string parsing.

\`\`\`powershell
# Pipeline filtering and calculation
$Processes = Get-Process | 
    Where-Object { $_.WorkingSet64 -gt 50MB } | 
    Sort-Object WorkingSet64 -Descending | 
    Select-Object -First 5 ProcessName, @{Name="MemoryMB"; Expression={[math]::Round($_.WorkingSet64 / 1MB, 2)}}

Write-Output "Top 5 Memory-Consuming Processes:"
$Processes | Format-Table -AutoSize
\`\`\``
      },
      {
        id: 'sec-ps-3-functions-error-handling',
        title: '3. Advanced Functions & Structured Error Handling',
        slug: 'powershell-functions-error-handling',
        order: 3,
        content: `## 3. Advanced Functions & Structured Error Handling

\`\`\`powershell
function Invoke-SafeApiPing {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$EndpointUrl,

        [int]$TimeoutSeconds = 5
    )

    try {
        Write-Verbose "Pinging endpoint: $EndpointUrl"
        $Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $Response = Invoke-WebRequest -Uri $EndpointUrl -TimeoutSec $TimeoutSeconds -UseBasicParsing -ErrorAction Stop
        $Stopwatch.Stop()

        return [PSCustomObject]@{
            Success       = $true
            StatusCode    = $Response.StatusCode
            LatencyMs     = $Stopwatch.ElapsedMilliseconds
            Timestamp     = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        }
    }
    catch {
        return [PSCustomObject]@{
            Success       = $false
            ErrorMessage  = $_.Exception.Message
            Timestamp     = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        }
    }
}

Invoke-SafeApiPing -EndpointUrl "https://httpbin.org/get"
\`\`\``
      },
      {
        id: 'sec-ps-4-json-files-automation',
        title: '4. JSON, REST APIs & Automated Workflows',
        slug: 'powershell-json-rest-files',
        order: 4,
        content: `## 4. JSON, REST APIs & Automated Workflows

PowerShell provides first-class JSON serialization through \`ConvertFrom-Json\` and \`ConvertTo-Json\`.

\`\`\`powershell
$DokAiConfig = @{
    AppName    = "DokAI Studio"
    Version    = "2.0.0"
    Features   = @("CodeRunner", "AiEnhancer", "LiveMarkdown", "CommandPalette")
    MaxThreads = 8
}

# Serialize hashtable to formatted JSON
$JsonOutput = $DokAiConfig | ConvertTo-Json -Depth 4
Write-Output "Serialized Configuration:"
Write-Output $JsonOutput

# Deserialize back to PSCustomObject
$RestoredConfig = $JsonOutput | ConvertFrom-Json
Write-Output "Restored App Name: $($RestoredConfig.AppName)"
\`\`\``
      }
    ]
  },

  /* ============================================================================
   * 4. WINDOWS COMMAND LINE & BATCH SCRIPTING
   * ============================================================================ */
  {
    id: 'windows-cmd-batch-guide',
    title: 'Windows Command Line & Batch Guide',
    description:
      'Complete command-line and batch scripting reference for Windows Command Prompt: Core utilities, Environment Variables, Redirection, Errorlevel, and Batch Control Flow.',
    version: '2.0.0',
    category: 'Systems Automation',
    author: 'DokAI Core Engineering',
    tags: ['cmd', 'batch', 'windows', 'cli', 'automation'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: [
      {
        id: 'sec-cmd-1-essentials',
        title: '1. Core Utilities, Variables & Stream Redirection',
        slug: 'cmd-core-utilities-redirection',
        order: 1,
        content: `## 1. Core Utilities, Variables & Stream Redirection

Windows Command Prompt (\`cmd.exe\`) remains critical for low-level bootstrapping, CI/CD runners, and fast batch automation across Windows platforms.

### Essential Batch Command Reference

| Command | Function | Example |
| :--- | :--- | :--- |
| **\`echo\`** | Display text or toggle command echoing | \`@echo off\` |
| **\`set\`** | Define or display environment variables | \`set PORT=8080\` |
| **\`dir\`** | List directory contents | \`dir /b /s *.md\` |
| **\`type\`** | Print text file contents | \`type package.json\` |
| **\`findstr\`** | Search strings using regex | \`findstr /i "error" log.txt\` |

### Runnable CMD Script

Click **Run Code** to execute this command script natively:

\`\`\`cmd
@echo off
echo ==============================================
echo DokAI Studio - Windows CMD Environment
echo ==============================================
echo System Architecture: %PROCESSOR_ARCHITECTURE%
echo Current Computer:    %COMPUTERNAME%
echo Current User:        %USERNAME%
echo OS Directory:        %SYSTEMROOT%
echo ==============================================
\`\`\``
      },
      {
        id: 'sec-cmd-2-loops-conditionals',
        title: '2. Batch Control Flow, Loops & %ERRORLEVEL%',
        slug: 'batch-control-flow-loops-errorlevel',
        order: 2,
        content: `## 2. Batch Control Flow, Loops & %ERRORLEVEL%

### Testing Exit Codes with \`%ERRORLEVEL%\`

In Windows batch, \`%ERRORLEVEL%\` stores the return code of the last executed command (\`0\` indicates success).

\`\`\`cmd
@echo off
set TARGET_DIR=%TEMP%

if exist "%TARGET_DIR%" (
    echo [OK] Temporary directory exists: %TARGET_DIR%
) else (
    echo [ERROR] Target directory not found.
    exit /b 1
)

for %%I in (Rust JavaScript PowerShell Batch) do (
    echo Supported language: %%I
)

echo Script completed successfully.
\`\`\``
      }
    ]
  }
];
