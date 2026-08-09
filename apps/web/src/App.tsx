import { RouterProvider } from 'react-router-dom';

import { LocaleProvider } from './core/i18n/LocaleContext';
import { router } from './core/router';
import { ThemeProvider } from './core/theme/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <RouterProvider router={router} />
      </LocaleProvider>
    </ThemeProvider>
  );
}
