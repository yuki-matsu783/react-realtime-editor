import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Tree } from "react-arborist";
import { Button, Box } from "@mui/material";
import { useFileExplorer } from "../contexts/FileExplorerContext";

declare global {
    interface Window {
        showDirectoryPicker: () => Promise<any>;
    }
}

interface FileEntry {
    handle: any;
    path: string;
    type: 'file' | 'directory';
    name: string;
    children?: Record<string, FileEntry>;
}

interface TreeNode {
    id: string;
    name: string;
    type: 'file' | 'directory';
    children?: TreeNode[];
}

const isTextFile = async (fileHandle: any) => {
    try {
        const file = await fileHandle.getFile();
        const text = await file.text();
        return typeof text === 'string';
    } catch {
        return false;
    }
};

const getLanguageFromFileName = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const languageMap: Record<string, string> = {
        js: 'javascript',
        jsx: 'javascript',
        ts: 'typescript',
        tsx: 'typescript',
        html: 'html',
        css: 'css',
        scss: 'css',
        sass: 'css',
        json: 'json',
        md: 'markdown',
        py: 'python',
        java: 'java',
        c: 'c',
        cpp: 'cpp',
        h: 'cpp',
        hpp: 'cpp',
        rs: 'rust',
        go: 'go',
        rb: 'ruby',
        php: 'php',
        sql: 'sql',
        yaml: 'yaml',
        yml: 'yaml',
        xml: 'xml',
        sh: 'shell',
        bash: 'shell',
        zsh: 'shell',
    };
    return languageMap[ext] || 'plaintext';
};

export default function FileExplorer() {
    const { fileEntries, setFileEntries, selectedFile, setSelectedFile, editedFiles, setEditedFiles } = useFileExplorer();
    const [logs, setLogs] = useState<string[]>([]);
    const [treeSize, setTreeSize] = useState({ width: 0, height: 0 });
    const treeContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateTreeSize = () => {
            if (treeContainerRef.current) {
                setTreeSize({
                    width: treeContainerRef.current.clientWidth,
                    height: treeContainerRef.current.clientHeight
                });
            }
        };

        updateTreeSize();
        window.addEventListener('resize', updateTreeSize);
        return () => window.removeEventListener('resize', updateTreeSize);
    }, []);

    const log = (msg: string) => setLogs((prev) => [...prev, msg]);

    const handleEditorBeforeMount = (monaco: any) => {
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: true,
        });
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: true,
        });
    };

    const handleEditorChange = (value: string | undefined) => {
        const newCode = value || "";
        setSelectedFile({
            ...selectedFile,
            code: newCode,
            isModified: true,
        });
        
        // 編集情報を保存
        setEditedFiles({
            ...editedFiles,
            [selectedFile.filename]: {
                code: newCode,
                language: selectedFile.language,
                isModified: true,
            },
        });
    };

    const scanDirectory = async (dirHandle: any, path = ""): Promise<Record<string, FileEntry>> => {
        const entries: Record<string, FileEntry> = {};
        for await (const [name, entry] of dirHandle.entries()) {
            if (name.startsWith(".")) continue;

            const fullPath = path ? `${path}/${name}` : name;

            if (entry.kind === "file") {
                if (await isTextFile(entry)) {
                    entries[fullPath] = {
                        handle: entry,
                        path: fullPath,
                        type: "file",
                        name,
                    };
                }
            } else if (entry.kind === "directory") {
                const subEntries = await scanDirectory(entry, fullPath);
                entries[fullPath] = {
                    handle: entry,
                    path: fullPath,
                    type: "directory",
                    name,
                    children: subEntries,
                };
            }
        }
        return entries;
    };

    const findEntryByPath = (entries: Record<string, FileEntry>, path: string): FileEntry | null => {
        for (const entry of Object.values(entries)) {
            if (entry.path === path) return entry;
            if (entry.type === "directory" && entry.children) {
                const found = findEntryByPath(entry.children, path);
                if (found) return found;
            }
        }
        return null;
    };

    const handleDirectoryPick = async () => {
        try {
            const handle = await window.showDirectoryPicker();
            log("✅ ディレクトリ選択完了");
            const entries = await scanDirectory(handle);
            setFileEntries(entries);
        } catch (e: any) {
            log(`❌ エラー: ${e.message}`);
        }
    };

    const loadFile = async (path: string) => {
        try {
            // 既に編集情報がある場合はそれを使用
            const editedFile = editedFiles[path];
            if (editedFile) {
                setSelectedFile({
                    filename: path,
                    ...editedFile,
                });
                log(`📄 ${path} を編集中の状態から復元しました`);
                return;
            }

            const entry = findEntryByPath(fileEntries, path);
            if (!entry) {
                log(`❌ ファイルが見つかりません: ${path}`);
                return;
            }
            if (!entry || entry.type !== "file") return;

            const file = await entry.handle.getFile();
            const text = await file.text();

            setSelectedFile({
                filename: path,
                code: text,
                language: getLanguageFromFileName(path),
                isModified: false,
            });
            log(`📄 ${path} を読み込みました (${text.length}文字)`);
        } catch (e: any) {
            log(`❌ ファイル読み込みエラー: ${e.message}`);
        }
    };

    const saveFile = async () => {
        console.log('保存開始:', { selectedFile });
        try {
            if (!selectedFile.filename) {
                console.error('ファイル名が未指定');
                log(`❌ ファイル名が指定されていません`);
                return;
            }
    
            console.log('ファイルエントリを検索:', selectedFile.filename);
            const entry = findEntryByPath(fileEntries, selectedFile.filename);
            console.log('検索結果:', { entry });

            if (!entry || entry.type !== "file") {
                console.error('保存対象が見つからない:', { entry });
                log(`❌ 保存対象が見つかりません: ${selectedFile.filename}`);
                return;
            }
    
            try {
                console.log('書き込み準備開始');
                const writable = await entry.handle.createWritable();
                console.log('書き込みストリーム作成完了');

                console.log('ファイル書き込み開始:', { length: selectedFile.code.length });
                await writable.write(selectedFile.code);
                console.log('ファイル書き込み完了');

                console.log('書き込みストリームのクローズ開始');
                await writable.close();
                console.log('書き込みストリームのクローズ完了');
        
                setSelectedFile({ ...selectedFile, isModified: false });
                // 保存成功後、編集情報を更新
                setEditedFiles({
                    ...editedFiles,
                    [selectedFile.filename]: {
                        code: selectedFile.code,
                        language: selectedFile.language,
                        isModified: false,
                    },
                });
                log(`💾 ${selectedFile.filename} を保存しました (${selectedFile.code.length}文字)`);
                console.log('保存処理完了');
            } catch (writeError: any) {
                console.error('ファイル書き込みエラー:', writeError);
                log(`❌ ファイル書き込みエラー: ${writeError.message}`);
                throw writeError;
            }
        } catch (e: any) {
            console.error('保存エラー:', e);
            log(`❌ 保存エラー: ${e.message}`);
        }
    };

    const convertToTreeData = (entries: Record<string, FileEntry>): TreeNode[] => {
        const buildTree = (entry: FileEntry): TreeNode => {
            const node: TreeNode = {
                id: entry.path,
                name: entry.name,
                type: entry.type,
            };
            if (entry.type === "directory" && entry.children) {
                // ディレクトリの子要素もソート
                node.children = Object.values(entry.children)
                    .sort((a, b) => {
                        // まずディレクトリとファイルで分ける
                        if (a.type !== b.type) {
                            return a.type === "directory" ? -1 : 1;
                        }
                        // 同じタイプ同士なら名前でソート
                        return a.name.localeCompare(b.name);
                    })
                    .map(buildTree);
            }
            return node;
        };
        
        // ルートレベルのエントリをソート
        return Object.values(entries)
            .filter((entry) => !entry.path.includes("/"))
            .sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === "directory" ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            })
            .map(buildTree);
    };

    const handleNodeClick = (node: any) => {
        const entry = findEntryByPath(fileEntries, node.id);
        if (entry?.type === "file") {
            loadFile(entry.path);
        }
    };

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Button
                    variant="contained"
                    onClick={handleDirectoryPick}
                    sx={{ mr: 2 }}
                >
                    ディレクトリを選択
                </Button>
                {selectedFile.filename && (
                    <Button
                        onClick={saveFile}
                        variant={selectedFile.isModified ? "contained" : "outlined"}
                        color={selectedFile.isModified ? "success" : "inherit"}
                        disabled={!selectedFile.isModified}
                    >
                        保存
                    </Button>
                )}
            </Box>

            <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <Box 
                    ref={treeContainerRef}
                    sx={{ 
                        width: '25%', 
                        borderRight: 1, 
                        borderColor: 'divider', 
                        p: 2, 
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    {Object.keys(fileEntries).length > 0 && (
                        <Tree
                            data={convertToTreeData(fileEntries)}
                            openByDefault={false}
                            width={treeSize.width}
                            height={treeSize.height}
                            onActivate={(node) => {
                                const { type } = node.data;
                                if (type === "directory") {
                                    node.toggle();
                                } else {
                                    handleNodeClick(node.data);
                                }
                            }}
                        >
                            {({ node, style, dragHandle }) => (
                                <div
                                    style={style}
                                    ref={dragHandle}
                                    className="flex items-center gap-2 py-1 cursor-pointer"
                                >
                                    <span>{node.data.type === "file" ? "📄" : node.isOpen ? "📂" : "📁"}</span>
                                    <span className="truncate max-w-[180px] text-sm" title={node.data.name}>
                                        {node.data.name}
                                    </span>
                                </div>
                            )}
                        </Tree>
                    )}
                </Box>

                <Box sx={{ width: '75%', p: 2, display: 'flex', flexDirection: 'column' }}>
                    {selectedFile.filename && (
                        <Box sx={{ mb: 2, typography: 'body2' }}>
                            📄 現在のファイル: {selectedFile.filename} ({selectedFile.code.length}文字)
                            {selectedFile.isModified && (
                                <Box component="span" sx={{ ml: 1, color: 'warning.main' }}>●</Box>
                            )}
                        </Box>
                    )}

                    <Box sx={{ flex: 1 }}>
                        <Editor
                            height="75vh"
                            width="100%"
                            language={selectedFile.language}
                            value={selectedFile.code}
                            onChange={handleEditorChange}
                            theme="vs-dark"
                            beforeMount={handleEditorBeforeMount}
                            options={{
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                formatOnPaste: true,
                                formatOnType: true,
                                renderValidationDecorations: "off",
                                // キーボードショートカットを有効化
                                quickSuggestions: true,
                                // 基本的なエディターコマンドを有効化
                                autoClosingBrackets: 'always',
                                autoClosingQuotes: 'always',
                                // カスタムキーバインディングを設定
                                selectOnLineNumbers: true,
                                roundedSelection: false,
                                readOnly: false,
                            }}
                            onMount={(editor, monaco) => {
                                // キーボードショートカットの設定
                                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, (e) => {
                                    // ブラウザのデフォルトの保存動作を防ぐ
                                    e?.preventDefault();
                                    if (selectedFile.isModified) {
                                        saveFile();
                                    }
                                });
                                
                                // 標準的なキーバインディングを有効化
                                editor.createContextKey('inEditorContext', true);

                                // エディターにフォーカスがある時のキーイベントをキャプチャ
                                editor.onKeyDown((e) => {
                                    if ((e.ctrlKey || e.metaKey) && e.keyCode === monaco.KeyCode.KeyS) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }
                                });
                            }}
                        />
                    </Box>

                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', height: '32vh', overflowY: 'auto' }}>
                        {logs.map((line, i) => (
                            <Box key={i} sx={{ typography: 'body2' }}>{line}</Box>
                        ))}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
