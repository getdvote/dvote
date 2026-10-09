import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AuthProvider } from './lib/auth';
import { configProblem } from './lib/config';
import { router } from './router';
import { theme } from './theme';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 15_000 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider theme={theme}>
      <AntApp>
        {configProblem ? (
          <div style={{ padding: 40, maxWidth: 560 }}>
            <h2>Setup needed</h2>
            <p>{configProblem}</p>
          </div>
        ) : (
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </QueryClientProvider>
        )}
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);
