import React from 'react';
import { Box } from '@mui/material';
import LLMFileEditor from './components/FileExplorer';


const App: React.FC = () => {
  return (
    <Box p={2}>
      <LLMFileEditor />
    </Box>
  );
};

export default App;
