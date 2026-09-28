import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function useInstallPrompt(): {
  canInstall: boolean
  installed: boolean
  install: () => Promise<void>
} {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    function onPrompt(event: Event): void {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    function onInstalled(): void {
      setInstalled(true)
      setPromptEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    const event = promptEvent
    if (!event) return
    await event.prompt()
    const choice = await event.userChoice
    if (choice.outcome === 'accepted') {
      setInstalled(true)
    }
    setPromptEvent(null)
  }, [promptEvent])

  return { canInstall: !installed && promptEvent != null, installed, install }
}