import { createBrowserRouter } from 'react-router-dom';

import { AppShell } from '../components/AppShell';
import { FinanceScreen } from '../features/finance/finance_screen';
import { HomeScreen } from '../features/home/home_screen';
import { PanchayatScreen } from '../features/panchayat/panchayat_screen';
import { SettingsScreen } from '../features/settings/settings_screen';
import { AdvisorScreen } from '../features/advisor/advisor_screen';
import { VideosScreen } from '../features/videos/videos_screen';
import { AccountScreen } from '../features/account/account_screen';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'panchayat/:id', element: <PanchayatScreen /> },
      { path: 'panchayat/:id/finance', element: <FinanceScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: 'advisor', element: <AdvisorScreen /> },
      { path: 'videos', element: <VideosScreen /> },
      { path: 'account', element: <AccountScreen /> },
    ],
  },
]);
