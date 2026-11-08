import hljs from 'highlight.js/lib/core';

import rust from 'highlight.js/lib/languages/rust';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import powershell from 'highlight.js/lib/languages/powershell';
import dos from 'highlight.js/lib/languages/dos';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import ini from 'highlight.js/lib/languages/ini';
import sql from 'highlight.js/lib/languages/sql';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import markdown from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import plaintext from 'highlight.js/lib/languages/plaintext';

let initialized = false;

export function ensureHighlighterInitialized() {
  if (initialized) return;
  initialized = true;

  hljs.registerLanguage('rust', rust);
  hljs.registerAliases(['rs'], { languageName: 'rust' });

  hljs.registerLanguage('javascript', javascript);
  hljs.registerAliases(['js', 'mjs', 'cjs', 'jsx', 'node'], { languageName: 'javascript' });

  hljs.registerLanguage('typescript', typescript);
  hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' });

  hljs.registerLanguage('powershell', powershell);
  hljs.registerAliases(['ps1', 'pwsh', 'ps'], { languageName: 'powershell' });

  hljs.registerLanguage('dos', dos);
  hljs.registerAliases(['cmd', 'bat', 'batch'], { languageName: 'dos' });

  hljs.registerLanguage('bash', bash);
  hljs.registerAliases(['sh', 'shell', 'zsh'], { languageName: 'bash' });

  hljs.registerLanguage('c', c);
  hljs.registerAliases(['h'], { languageName: 'c' });

  hljs.registerLanguage('cpp', cpp);
  hljs.registerAliases(['c++', 'cc', 'cxx', 'hpp', 'hxx'], { languageName: 'cpp' });

  hljs.registerLanguage('csharp', csharp);
  hljs.registerAliases(['cs', 'c#', 'dotnet'], { languageName: 'csharp' });

  hljs.registerLanguage('python', python);
  hljs.registerAliases(['py'], { languageName: 'python' });

  hljs.registerLanguage('go', go);
  hljs.registerAliases(['golang'], { languageName: 'go' });

  hljs.registerLanguage('java', java);
  hljs.registerLanguage('json', json);
  hljs.registerLanguage('yaml', yaml);
  hljs.registerAliases(['yml'], { languageName: 'yaml' });

  hljs.registerLanguage('ini', ini);
  hljs.registerAliases(['toml', 'conf', 'env'], { languageName: 'ini' });

  hljs.registerLanguage('sql', sql);
  hljs.registerLanguage('xml', xml);
  hljs.registerAliases(['html', 'svg'], { languageName: 'xml' });

  hljs.registerLanguage('css', css);
  hljs.registerLanguage('markdown', markdown);
  hljs.registerAliases(['md'], { languageName: 'markdown' });

  hljs.registerLanguage('dockerfile', dockerfile);
  hljs.registerAliases(['docker'], { languageName: 'dockerfile' });

  hljs.registerLanguage('plaintext', plaintext);
  hljs.registerAliases(['text', 'txt', 'output', 'console'], { languageName: 'plaintext' });
}

/**
 * Globally highlights a code element and returns its normalized language identifier.
 */
export function highlightCodeElement(block: HTMLElement): string {
  ensureHighlighterInitialized();

  let detectedLang = 'text';
  for (const cls of Array.from(block.classList)) {
    if (cls.startsWith('language-')) {
      detectedLang = cls.replace('language-', '').trim().toLowerCase();
      break;
    }
  }

  try {
    if (detectedLang && detectedLang !== 'text' && hljs.getLanguage(detectedLang)) {
      hljs.highlightElement(block);
    } else if (detectedLang && detectedLang !== 'text') {
      // Unknown language tag: use auto-detection so any language still gets syntax coloring
      const auto = hljs.highlightAuto(block.textContent || '');
      block.innerHTML = auto.value;
      block.classList.add('hljs');
    } else {
      block.classList.add('hljs');
    }
  } catch {
    block.classList.add('hljs');
  }

  return detectedLang || 'text';
}
