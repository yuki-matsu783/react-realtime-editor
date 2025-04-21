import { useState } from "react";
import Editor from "@monaco-editor/react";
import Tree from 'rc-tree';
import 'rc-tree/assets/index.css';
import { DataNode, Key } from "rc-tree/lib/interface";

// Extend the Window interface to include showDirectoryPicker
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

const isTextFile = async (fileHandle: any) => {
    try {
        const file = await fileHandle.getFile();
        const text = await file.text();
        return typeof text === 'string';
    } catch {
        return false;
    }
};

export default function LLMFileEditor() {
    const [fileEntries, setFileEntries] = useState<Record<string, FileEntry>>({});
    const [filename, setFilename] = useState<string>("");
    const [code, setCode] = useState<string>("");
    const [logs, setLogs] = useState<string[]>([]);

    const log = (msg: string) => setLogs((prev) => [...prev, msg]);

    const scanDirectory = async (dirHandle: any, path = ""): Promise<Record<string, FileEntry>> => {
        const entries: Record<string, FileEntry> = {};
        
        for await (const [name, entry] of dirHandle.entries()) {
            const fullPath = path ? `${path}/${name}` : name;

            if (entry.kind === "file") {
                if (await isTextFile(entry)) {
                    entries[fullPath] = {
                        handle: entry,
                        path: fullPath,
                        type: 'file',
                        name
                    };
                }
            } else if (entry.kind === "directory") {
                const subEntries = await scanDirectory(entry, fullPath);
                entries[fullPath] = {
                    handle: entry,
                    path: fullPath,
                    type: 'directory',
                    name,
                    children: subEntries
                };
            }
        }

        return entries;
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
            if (!entry || entry.type !== 'file') {
                return;
            }
            const file = await entry.handle.getFile();
            const text = await file.text();

            setFilename(path);
            setCode(text);
            log(`📄 ${path} を読み込みました (${text.length}文字)`);
        } catch (e: any) {
            log(`❌ ファイル読み込みエラー: ${e.message}`);
        }
    };

    const convertToTreeData = (entries: Record<string, FileEntry>, parentPath = ""): DataNode[] => {
        return Object.entries(entries)
            .filter(([path]) => {
                // 親パスで始まるエントリーのみをフィルタリング
                if (!parentPath) {
                    return !path.includes('/'); // ルートレベルのエントリーのみ
                }
                return path.startsWith(parentPath + '/') && 
                       path.split('/').length === parentPath.split('/').length + 1;
            })
            .map(([path, entry]) => ({
                key: path,
                title: entry.name,
                isLeaf: entry.type === 'file',
                children: entry.type === 'directory' ? convertToTreeData(entries, path) : undefined
            }));
    };

    const handleSelect = (_selectedKeys: Key[], info: { selectedNodes: DataNode[] }) => {
        const selectedNode = info.selectedNodes[0];
        if (selectedNode) {
            const path = selectedNode.key as string;
            const entry = fileEntries[path];
            if (entry && entry.type === 'file') {
                loadFile(path);
            }
        }
    };

    return (
        <div className="p-4 h-screen flex flex-col">
            <div className="flex gap-2 mb-4">
                <button
                    onClick={handleDirectoryPick}
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                    ディレクトリを選択
                </button>
            </div>

            <div className="flex flex-1 gap-4">
                <div className="w-64 border rounded">
                    {Object.keys(fileEntries).length > 0 && (
                        <div className="h-full overflow-y-auto p-2">
                            <Tree
                                treeData={convertToTreeData(fileEntries)}
                                onSelect={handleSelect}
                                defaultExpandAll
                            />
                        </div>
                    )}
                </div>

                <div className="flex-1 flex flex-col">
                    {filename && (
                        <div className="text-sm mb-2">
                            📄 現在のファイル: {filename} ({code.length}文字)
                        </div>
                    )}

                    <div className="flex-1">
                        <Editor
                            height="75vh"
                            width="100%"
                            defaultLanguage="typescript"
                            value={code}
                            onChange={(value) => setCode(value || "")}
                            theme="vs-dark"
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
