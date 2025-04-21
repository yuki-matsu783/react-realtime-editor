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
    const { fileEntries, setFileEntries, selectedFile, setSelectedFile } = useFileExplorer();
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
        setSelectedFile({
            ...selectedFile,
            code: value || "",
            isModified: true,
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
            const entry = fileEntries[path];
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
        try {
            if (!selectedFile.filename || !fileEntries[selectedFile.filename]) return;

            const entry = fileEntries[selectedFile.filename];
            const writable = await entry.handle.createWritable();
            await writable.write(selectedFile.code);
            await writable.close();

            setSelectedFile({ ...selectedFile, isModified: false });
            log(`💾 ${selectedFile.filename} を保存しました`);
        } catch (e: any) {
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
                node.children = Object.values(entry.children).map(buildTree);
            }
            return node;
        };
        return Object.values(entries)
            .filter((entry) => !entry.path.includes("/"))
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
