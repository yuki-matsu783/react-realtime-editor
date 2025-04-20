import React, { useState } from "react";
import Editor from "@monaco-editor/react";

// Extend the Window interface to include showDirectoryPicker
declare global {
    interface Window {
        showDirectoryPicker: () => Promise<any>;
    }
}

interface FileEntry {
    handle: any;
    path: string;
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
    const [dirHandle, setDirHandle] = useState<any>(null);
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
                        path: fullPath
                    };
                }
            } else if (entry.kind === "directory") {
                const subEntries = await scanDirectory(entry, fullPath);
                Object.assign(entries, subEntries);
            }
        }

        return entries;
    };

    const handleDirectoryPick = async () => {
        try {
            const handle = await window.showDirectoryPicker();
            setDirHandle(handle);
            log("✅ ディレクトリ選択完了");

            const entries = await scanDirectory(handle);
            setFileEntries(entries);

            const defaultFile = Object.keys(entries)[0];
            if (defaultFile) {
                await loadFile(defaultFile);
            } else {
                log("📁 対象ファイルが見つかりませんでした");
            }
        } catch (e: any) {
            log(`❌ エラー: ${e.message}`);
        }
    };

    const loadFile = async (path: string) => {
        try {
            const entry = fileEntries[path];
            if (!entry) {
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

    return (
        <div className="p-4 space-y-4 h-screen flex flex-col">
            <div className="flex gap-2">
                <button
                    onClick={handleDirectoryPick}
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                    ディレクトリを選択
                </button>
            </div>

            {Object.keys(fileEntries).length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto">
                    {Object.keys(fileEntries).map((path) => (
                        <button
                            key={path}
                            onClick={() => loadFile(path)}
                            className={`px-2 py-1 rounded text-sm whitespace-nowrap ${path === filename ? "bg-blue-500 text-white" : "bg-gray-200"
                                }`}
                        >
                            {path.split('/').pop()}
                        </button>
                    ))}
                </div>
            )}

            {filename && (
                <div className="text-sm">
                    📄 現在のファイル: {filename} ({code.length}文字)
                </div>
            )}

            <div>
                <Editor
                    height="75vh"
                    width="100%"
                    defaultLanguage="typescript"
                    value={code}
                    onChange={(value) => setCode(value || "")}
                    theme="vs-dark"
                />
            </div>

            <div className="bg-gray-100 text-sm p-2 h-32">
                {logs.map((line, i) => (
                    <div key={i}>{line}</div>
                ))}
            </div>
        </div>
    );
}
