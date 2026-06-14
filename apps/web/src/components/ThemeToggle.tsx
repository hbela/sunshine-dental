import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { getStoredTheme, setTheme, type Theme } from '@/lib/theme'

export function ThemeToggle() {
  const { t } = useTranslation()
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    setThemeState(getStoredTheme())
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9"
      onClick={toggle}
      aria-label={t('toggleTheme')}
      title={t('toggleTheme')}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}
