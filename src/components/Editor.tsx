import React, { useState } from "react";
import Editor from "@monaco-editor/react";

export default function LLMFileEditor() {
    const [dirHandle, setDirHandle] = useState<any>(null);
    const [fileHandles, setFileHandles] = useState<Record<string, any>>({});
    const [filename, setFilename] = useState<string>("");
    const [code, setCode] = useState<string>("");
    const [logs, setLogs] = useState<string[]>([]);

    const log = (msg: string) => setLogs((prev) => [...prev, msg]);

    const handleDirectoryPick = async () => {
        try {
            const handle = await window.showDirectoryPicker();
            setDirHandle(handle);
            log("✅ ディレクトリ選択完了");

            const fileMap: Record<string, any> = {};
            for await (const [name, entry] of handle.entries()) {
                if (entry.kind === "file" && name.match(/\.(js|ts|tsx)$/)) {
                    fileMap[name] = entry;
                }
            }
            setFileHandles(fileMap);

            const defaultFile = Object.keys(fileMap)[0];
            if (defaultFile) {
                await loadFile(defaultFile);
            } else {
                log("📁 対象ファイルが見つかりませんでした");
            }
        } catch (e: any) {
            log(`❌ エラー: ${e.message}`);
        }
    };

    const loadFile = async (name: string) => {
        try {
            const fh = fileHandles[name];
            const file = await fh.getFile();
            const text = await file.text();

            setFilename(name);
            setCode(text);
            log(`📄 ${name} を読み込みました`);
        } catch (e: any) {
            log(`❌ ファイル読み込みエラー: ${e.message}`);
        }
    };

    return (
        <div className="p-4 space-y-4">
            <div className="flex gap-2">
                <button
                    onClick={handleDirectoryPick}
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                    ディレクトリを選択
                </button>
            </div>

            {Object.keys(fileHandles).length > 0 && (
                <div className="flex gap-2 mt-2">
                    {Object.keys(fileHandles).map((name) => (
                        <button
                            key={name}
                            onClick={() => loadFile(name)}
                            className={`px-2 py-1 rounded text-sm ${name === filename ? "bg-blue-500 text-white" : "bg-gray-200"
                                }`}
                        >
                            {name}
                        </button>
                    ))}
                </div>
            )}

            {filename && <div className="text-sm">📄 現在のファイル: {filename}</div>}

            <Editor
                height="400px"
                defaultLanguage="javascript"
                value={code}
                onChange={(value) => setCode(value || "")}
                theme="vs-dark"
            />

            <div className="bg-gray-100 text-sm p-2 h-40 overflow-auto">
                {logs.map((line, i) => (
                    <div key={i}>{line}</div>
                ))}
            </div>
        </div>
    );
}
