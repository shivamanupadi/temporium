/**
 * Monaco Editor wrapper with Solidity language support.
 */

import type React from 'react';
import { useRef, useCallback } from 'react';
import Editor, { type OnMount, type Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { CompileError } from '@/lib/compiler';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  errors?: CompileError[];
  readOnly?: boolean;
  className?: string;
}

export function MonacoEditor({
  value,
  onChange,
  errors = [],
  readOnly = false,
  className,
}: MonacoEditorProps): React.ReactElement {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register Solidity language
    monaco.languages.register({ id: 'solidity' });

    // Set Solidity tokenization rules
    monaco.languages.setMonarchTokensProvider('solidity', {
      keywords: [
        'pragma',
        'solidity',
        'contract',
        'interface',
        'library',
        'abstract',
        'function',
        'modifier',
        'event',
        'constructor',
        'fallback',
        'receive',
        'public',
        'private',
        'internal',
        'external',
        'view',
        'pure',
        'payable',
        'virtual',
        'override',
        'returns',
        'return',
        'if',
        'else',
        'for',
        'while',
        'do',
        'break',
        'continue',
        'throw',
        'emit',
        'revert',
        'require',
        'assert',
        'try',
        'catch',
        'new',
        'delete',
        'import',
        'from',
        'as',
        'is',
        'using',
        'mapping',
        'struct',
        'enum',
        'type',
        'error',
        'storage',
        'memory',
        'calldata',
        'constant',
        'immutable',
        'indexed',
        'anonymous',
      ],

      typeKeywords: [
        'bool',
        'address',
        'string',
        'bytes',
        'bytes1',
        'bytes2',
        'bytes4',
        'bytes8',
        'bytes16',
        'bytes32',
        'int',
        'int8',
        'int16',
        'int32',
        'int64',
        'int128',
        'int256',
        'uint',
        'uint8',
        'uint16',
        'uint32',
        'uint64',
        'uint128',
        'uint256',
      ],

      operators: [
        '=',
        '>',
        '<',
        '!',
        '~',
        '?',
        ':',
        '==',
        '<=',
        '>=',
        '!=',
        '&&',
        '||',
        '++',
        '--',
        '+',
        '-',
        '*',
        '/',
        '&',
        '|',
        '^',
        '%',
        '<<',
        '>>',
        '>>>',
        '+=',
        '-=',
        '*=',
        '/=',
        '&=',
        '|=',
        '^=',
        '%=',
        '<<=',
        '>>=',
        '>>>=',
      ],

      symbols: /[=><!~?:&|+\-*/^%]+/,

      tokenizer: {
        root: [
          // Comments
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment'],

          // Pragma
          [/pragma/, 'keyword', '@pragma'],

          // Numbers
          [/\b\d+\b/, 'number'],
          [/\b0x[0-9a-fA-F]+\b/, 'number.hex'],

          // Strings
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string'],

          // Identifiers and keywords
          [
            /[a-zA-Z_$][\w$]*/,
            {
              cases: {
                '@typeKeywords': 'type',
                '@keywords': 'keyword',
                '@default': 'identifier',
              },
            },
          ],

          // Operators
          [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],

          // Delimiters
          [/[{}()[\]]/, '@brackets'],
          [/[;,.]/, 'delimiter'],
        ],

        comment: [
          [/[^/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[/*]/, 'comment'],
        ],

        pragma: [
          [/solidity/, 'keyword'],
          [/[^\n]+/, 'string'],
          [/$/, '', '@pop'],
        ],

        string: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape'],
          [/"/, 'string', '@pop'],
        ],
      },
    });

    // Set Solidity language configuration
    monaco.languages.setLanguageConfiguration('solidity', {
      comments: {
        lineComment: '//',
        blockComment: ['/*', '*/'],
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
    });

    // Define dark theme for Solidity
    monaco.editor.defineTheme('solidity-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'c586c0' },
        { token: 'type', foreground: '4ec9b0' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'number.hex', foreground: 'b5cea8' },
        { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
        { token: 'operator', foreground: 'd4d4d4' },
        { token: 'identifier', foreground: '9cdcfe' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#c6c6c6',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#3a3d41',
      },
    });

    monaco.editor.setTheme('solidity-dark');
  }, []);

  // Update error markers when errors change
  const updateMarkers = useCallback(() => {
    if (!monacoRef.current || !editorRef.current) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const markers: editor.IMarkerData[] = errors.map(error => {
      const startLine = error.sourceLocation?.start
        ? model.getPositionAt(error.sourceLocation.start).lineNumber
        : 1;
      const endLine = error.sourceLocation?.end
        ? model.getPositionAt(error.sourceLocation.end).lineNumber
        : startLine;

      return {
        severity:
          error.severity === 'error'
            ? monacoRef.current!.MarkerSeverity.Error
            : monacoRef.current!.MarkerSeverity.Warning,
        message: error.message,
        startLineNumber: startLine,
        startColumn: 1,
        endLineNumber: endLine,
        endColumn: model.getLineMaxColumn(endLine),
      };
    });

    monacoRef.current.editor.setModelMarkers(model, 'solidity', markers);
  }, [errors]);

  // Update markers when errors change
  if (editorRef.current && monacoRef.current) {
    updateMarkers();
  }

  return (
    <div className={className}>
      <Editor
        height="100%"
        language="solidity"
        value={value}
        onChange={v => onChange(v ?? '')}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          tabSize: 4,
          insertSpaces: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: 'on',
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          padding: { top: 16 },
        }}
        theme="solidity-dark"
      />
    </div>
  );
}
