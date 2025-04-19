// 単純な正規表現で import 文を除去
export const removeImports = (code: string): string => {
  return code.replace(/^import\s.*from\s.*;?$/gm, '');
};
