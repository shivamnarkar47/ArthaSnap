"use client"

import * as React from 'react'
import { ThemeToggle, applyTheme, type ThemeMode } from '#/components/ui/theme-toggle'

const KEY = 'arthasnap-mode'

function current(): ThemeMode {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function ThemeSwitch() {
  const [mode, setMode] = React.useState<ThemeMode>('light')
  React.useEffect(() => setMode(current()), [])
  return (
    <ThemeToggle
      mode={mode}
      showLabel={false}
      aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
      onModeChange={(next) => {
        setMode(next)
        try {
          localStorage.setItem(KEY, next)
        } catch { /* private mode */ }
        // applyTheme commits data-mode AND the .dark class inside the
        // view-transition callback — toggling the class here would leak the
        // new theme into the old snapshot and kill the reveal.
        applyTheme(next)
      }}
    />
  )
}
