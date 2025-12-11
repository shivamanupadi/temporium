import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/portal/stablecoins')({
  component: StablecoinsLayout,
})

function StablecoinsLayout() {
  return <Outlet />
}
