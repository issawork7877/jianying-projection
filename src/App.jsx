import React from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import FullLayout from './components/FullLayout.jsx';
import ProjectionPage from './components/ProjectionPage.jsx';
import ExternalDisplayPage from './components/ExternalDisplayPage.jsx';
import LiveDisplayPage from './components/LiveDisplayPage.jsx';
import StageDisplayPage from './components/StageDisplayPage.jsx';
import NotificationPage from './components/NotificationPage.jsx';
import './index.css';

const router = createHashRouter([
  {
    path: '/',
    element: <FullLayout />,
  },
  {
    path: '/projection',
    element: <ProjectionPage />,
  },
  {
    path: '/external',
    element: <ExternalDisplayPage />,
  },
  {
    path: '/live',
    element: <LiveDisplayPage />,
  },
  {
    path: '/stage',
    element: <StageDisplayPage />,
  },
  {
    path: '/notification',
    element: <NotificationPage />,
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
