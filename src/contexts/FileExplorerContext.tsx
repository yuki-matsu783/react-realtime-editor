import { createContext, useContext, useState, ReactNode } from 'react';

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

    return (
        <FileExplorerContext.Provider value={{
            fileEntries,
            setFileEntries,
            selectedFile,
            setSelectedFile
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