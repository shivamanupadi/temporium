import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTempo } from '@/hooks/useTempo'
import { PortalHeader } from '@/components/PortalHeader'

export const Route = createFileRoute('/portal')({
  component: PortalLayout,
})

function PortalLayout() {
  const { isConnected } = useTempo()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isConnected) {
      navigate({ to: '/' })
    }
  }, [isConnected, navigate])

  if (!isConnected) return null

  return (
    <div className="min-h-screen bg-background" style={{ scrollbarGutter: 'stable' }}>
      <PortalHeader />
      <main className="mx-auto max-w-6xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}
