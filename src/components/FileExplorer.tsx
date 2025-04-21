import { useState } from "react";
import Editor from "@monaco-editor/react";
import { Tree } from "react-arborist";
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
        <div className="h-screen flex flex-col">
            <div className="flex gap-2 p-4 border-b">
                <button
                    onClick={handleDirectoryPick}
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                    ディレクトリを選択
                </button>
                {selectedFile.filename && (
                    <button
                        onClick={saveFile}
                        className={`px-4 py-2 rounded ${
                            selectedFile.isModified
                                ? "bg-green-600 text-white"
                                : "bg-gray-300 text-gray-600"
                        }`}
                        disabled={!selectedFile.isModified}
                    >
                        保存
                    </button>
                )}
            </div>

            <div className="flex flex-1 overflow-hidden">
                <div className="w-64 border-r overflow-y-auto p-2">
                    {Object.keys(fileEntries).length > 0 && (
                        <Tree
                            data={convertToTreeData(fileEntries)}
                            openByDefault={false}
                            width={240}
                            height={600}
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
                </div>

                <div className="flex-1 flex flex-col p-4">
                    {selectedFile.filename && (
                        <div className="text-sm mb-2">
                            📄 現在のファイル: {selectedFile.filename} ({selectedFile.code.length}文字)
                            {selectedFile.isModified && (
                                <span className="text-yellow-600 ml-2">●</span>
                            )}
                        </div>
                    )}

                    <div className="flex-1">
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
                    </div>

                    <div className="bg-gray-100 text-sm p-2 h-32 overflow-y-auto mt-4">
                        {logs.map((line, i) => (
                            <div key={i}>{line}</div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
