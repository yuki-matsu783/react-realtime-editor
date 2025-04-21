import { useState } from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import FileExplorer from './components/FileExplorer';
import { FileExplorerProvider } from './contexts/FileExplorerContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && (
        <Box>{children}</Box>
      )}
    </div>
  );
}

const App: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <FileExplorerProvider>
      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleChange}>
            <Tab label="File Explorer" />
            <Tab label="view" />
          </Tabs>
        </Box>
        <TabPanel value={tabValue} index={0}>
          <Box p={2}>
            <FileExplorer />
          </Box>
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <Box p={2} sx={{ height: 'calc(100vh - 100px)' }}>
            <iframe 
              src="http://localhost:5174" 
              style={{
                width: '100%',
                height: '100%',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
          </Box>
        </TabPanel>
      </Box>
    </FileExplorerProvider>
  );
};

export default App;
