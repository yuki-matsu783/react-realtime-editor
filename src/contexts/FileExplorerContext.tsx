import { createContext, useContext, useState, ReactNode } from 'react';
import ignore from 'ignore';

interface FileEntry {
    handle: any;
    path: string;
    type: 'file' | 'directory';
    name: string;
    children?: Record<string, FileEntry>;
}

interface FileExplorerContextType {
    fileEntries: Record<string, FileEntry>;
    setFileEntries: (entries: Record<string, FileEntry>) => void;
    selectedFile: {
        filename: string;
        code: string;
        language: string;
        isModified: boolean;
    };
    setSelectedFile: (file: {
        filename: string;
        code: string;
        language: string;
        isModified: boolean;
    }) => void;
    editedFiles: Record<string, {
        code: string;
        language: string;
        isModified: boolean;
    }>;
    setEditedFiles: (files: Record<string, {
        code: string;
        language: string;
        isModified: boolean;
    }>) => void;
    gitignorePatterns: string[];
    setGitignorePatterns: (patterns: string[]) => void;
    isIgnored: (path: string) => boolean;
}

const FileExplorerContext = createContext<FileExplorerContextType | undefined>(undefined);

export function FileExplorerProvider({ children }: { children: ReactNode }) {
    const [fileEntries, setFileEntries] = useState<Record<string, FileEntry>>({});
    const [selectedFile, setSelectedFile] = useState({
        filename: '',
        code: '',
        language: 'plaintext',
        isModified: false
    });
    const [editedFiles, setEditedFiles] = useState<Record<string, {
        code: string;
        language: string;
        isModified: boolean;
    }>>({});
    const [gitignorePatterns, setGitignorePatterns] = useState<string[]>([]);

    // gitignoreパターンに基づいてファイルやディレクトリを無視するかどうかを判定
    const isIgnored = (path: string): boolean => {
        const ig = ignore().add(gitignorePatterns);
        return ig.ignores(path);
    };

    return (
        <FileExplorerContext.Provider value={{
            fileEntries,
            setFileEntries,
            selectedFile,
            setSelectedFile,
            editedFiles,
            setEditedFiles,
            gitignorePatterns,
            setGitignorePatterns,
            isIgnored
        }}>
            {children}
        </FileExplorerContext.Provider>
    );
}

export function useFileExplorer() {
    const context = useContext(FileExplorerContext);
    if (context === undefined) {
        throw new Error('useFileExplorer must be used within a FileExplorerProvider');
    }
    return context;
}