import { useTheme } from '../../hooks/useTheme';
import { toggleTheme } from '../../theme/toggleTheme';
import { MoonIcon } from '../icons/MoonIcon';
import { SunIcon } from '../icons/SunIcon';

export function ThemeToggle() {
  const theme = useTheme();
  const isDark = theme === 'dark';
  const nextLabel = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button type="button" className="theme-toggle" onClick={toggleTheme} title={nextLabel} aria-label={nextLabel}>
      {isDark ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
