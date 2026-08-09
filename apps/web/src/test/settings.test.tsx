import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { LocaleProvider } from '../core/i18n/LocaleContext';
import { ThemeProvider } from '../core/theme/ThemeContext';
import { SettingsScreen } from '../features/settings/settings_screen';

beforeEach(() => {
  localStorage.clear();
});

describe('SettingsScreen', () => {
  it('switches to dark theme', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <LocaleProvider>
          <SettingsScreen />
        </LocaleProvider>
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'काळा' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('switches language to English', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <LocaleProvider>
          <SettingsScreen />
        </LocaleProvider>
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(document.documentElement.lang).toBe('en');
  });
});
