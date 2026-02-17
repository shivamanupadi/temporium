import { useRef, useEffect, useCallback } from 'react';
import Editor, { type OnMount, type OnChange } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { CompilationError } from '@/hooks/useCompiler';

interface MonacoEditorProps {
  fileId: string;
  path: string;
  defaultValue: string;
  onChange: (value: string) => void;
  compileErrors?: CompilationError[];
}

// Custom warm Solidity theme
const WARM_THEME: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'E07A5F', fontStyle: 'bold' },
    { token: 'type', foreground: '9B72CF' },
    { token: 'string', foreground: '5B9A6F' },
    { token: 'number', foreground: 'D4A574' },
    { token: 'comment', foreground: '6B6560', fontStyle: 'italic' },
    { token: 'function', foreground: '2D3436', fontStyle: 'bold' },
    { token: 'variable', foreground: '2D3436' },
    { token: 'operator', foreground: '6B6560' },
    // Solidity-specific
    { token: 'keyword.solidity', foreground: 'E07A5F', fontStyle: 'bold' },
    { token: 'type.solidity', foreground: '9B72CF' },
    { token: 'string.solidity', foreground: '5B9A6F' },
    { token: 'number.solidity', foreground: 'D4A574' },
    { token: 'comment.solidity', foreground: '6B6560', fontStyle: 'italic' },
  ],
  colors: {
    'editor.background': '#FEFDFB',
    'editor.foreground': '#2D3436',
    'editor.lineHighlightBackground': '#FAF8F5',
    'editor.selectionBackground': '#E07A5F1F',
    'editor.inactiveSelectionBackground': '#E07A5F0F',
    'editorCursor.foreground': '#E07A5F',
    'editorLineNumber.foreground': '#B5B0AA',
    'editorLineNumber.activeForeground': '#6B6560',
    'editor.lineHighlightBorder': '#00000000',
    'editorIndentGuide.background': '#EDE9E3',
    'editorIndentGuide.activeBackground': '#D4D0CA',
    'editorBracketMatch.background': '#E07A5F1A',
    'editorBracketMatch.border': '#E07A5F40',
    'editorWidget.background': '#FAF8F5',
    'editorWidget.border': '#EDE9E3',
    'editorSuggestWidget.background': '#FFFFFF',
    'editorSuggestWidget.border': '#EDE9E3',
    'editorSuggestWidget.selectedBackground': '#F5F2ED',
    'minimap.background': '#FAF8F5',
  },
};

export function MonacoEditor({
  fileId,
  path,
  defaultValue,
  onChange,
  compileErrors,
}: MonacoEditorProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register custom theme
    monaco.editor.defineTheme('temporium-warm', WARM_THEME);
    monaco.editor.setTheme('temporium-warm');

    // Register Solidity language if not already
    if (!monaco.languages.getLanguages().some((l: any) => l.id === 'solidity')) {
      monaco.languages.register({ id: 'solidity' });
      monaco.languages.setMonarchTokensProvider('solidity', getSolidityMonarch());
    }

    editor.focus();
  };

  const handleChange: OnChange = (value) => {
    if (value !== undefined) {
      onChange(value);
    }
  };

  // Set error markers from compile results
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const monaco = monacoRef.current;
    const model = editorRef.current.getModel();
    if (!model) return;

    if (!compileErrors || compileErrors.length === 0) {
      monaco.editor.setModelMarkers(model, 'solc', []);
      return;
    }

    const markers = compileErrors
      .filter(err => err.sourceLocation)
      .map(err => {
        const loc = err.sourceLocation!;
        const startPos = model.getPositionAt(loc.start);
        const endPos = model.getPositionAt(loc.end);
        return {
          severity:
            err.severity === 'error'
              ? monaco.MarkerSeverity.Error
              : monaco.MarkerSeverity.Warning,
          message: err.message,
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column,
        };
      });

    monaco.editor.setModelMarkers(model, 'solc', markers);
  }, [compileErrors]);

  const language = path.endsWith('.sol') ? 'solidity' : 'plaintext';

  return (
    <Editor
      height="100%"
      language={language}
      defaultValue={defaultValue}
      onChange={handleChange}
      onMount={handleMount}
      options={{
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontLigatures: true,
        lineHeight: 22,
        tabSize: 4,
        insertSpaces: true,
        wordWrap: 'on',
        minimap: {
          enabled: window.innerWidth > 1440,
        },
        scrollBeyondLastLine: false,
        renderLineHighlight: 'line',
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        padding: { top: 12, bottom: 12 },
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true },
        suggest: { showKeywords: true },
        quickSuggestions: true,
        automaticLayout: true,
      }}
      theme="temporium-warm"
    />
  );
}

// Solidity Monarch language definition
function getSolidityMonarch(): any {
  return {
    keywords: [
      'pragma', 'solidity', 'contract', 'interface', 'library', 'abstract',
      'function', 'modifier', 'event', 'struct', 'enum', 'mapping',
      'public', 'private', 'internal', 'external', 'pure', 'view',
      'payable', 'virtual', 'override', 'returns', 'return',
      'if', 'else', 'for', 'while', 'do', 'break', 'continue',
      'new', 'delete', 'this', 'super', 'emit', 'revert', 'require',
      'assert', 'try', 'catch', 'import', 'using', 'is', 'as',
      'memory', 'storage', 'calldata', 'constant', 'immutable',
      'constructor', 'fallback', 'receive', 'error', 'unchecked',
      'assembly', 'type',
    ],
    typeKeywords: [
      'address', 'bool', 'string', 'bytes', 'byte', 'int', 'uint',
      'int8', 'int16', 'int32', 'int64', 'int128', 'int256',
      'uint8', 'uint16', 'uint32', 'uint64', 'uint128', 'uint256',
      'bytes1', 'bytes2', 'bytes4', 'bytes8', 'bytes16', 'bytes32',
      'fixed', 'ufixed',
    ],
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string_double'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/'/, 'string', '@string_single'],
        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
        [/\d+/, 'number'],
        [/[a-zA-Z_$][\w$]*/, {
          cases: {
            '@typeKeywords': 'type',
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        }],
        [/[{}()\[\]]/, '@brackets'],
        [/[<>](?![=<>])/, '@brackets'],
        [/[=><!~?:&|+\-*/^%]+/, 'operator'],
        [/;/, 'delimiter'],
        [/,/, 'delimiter'],
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],
      string_double: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
      string_single: [
        [/[^\\']+/, 'string'],
        [/\\./, 'string.escape'],
        [/'/, 'string', '@pop'],
      ],
    },
  };
}
