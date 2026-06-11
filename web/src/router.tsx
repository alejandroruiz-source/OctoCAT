import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import type { ReactNode } from 'react'

function RoleGuard({ role, children }: { role: string; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <div className="p-8 text-center text-gray-500">Loading...</div>
  if (user.role !== role) return <Navigate to="/" replace />
  return <>{children}</>
}

// Lazy imports
const POListPage = () => import('./pages/buyer/POListPage').then((m) => ({ default: m.POListPage }))
const POCreatePage = () => import('./pages/buyer/POCreatePage').then((m) => ({ default: m.POCreatePage }))
const PODetailPage = () => import('./pages/buyer/PODetailPage').then((m) => ({ default: m.PODetailPage }))
const POSubmitPage = () => import('./pages/buyer/POSubmitPage').then((m) => ({ default: m.POSubmitPage }))
const ApprovalQueuePage = () => import('./pages/approver/ApprovalQueuePage').then((m) => ({ default: m.ApprovalQueuePage }))
const ApprovalDetailPage = () => import('./pages/approver/ApprovalDetailPage').then((m) => ({ default: m.ApprovalDetailPage }))
const SupplierPOListPage = () => import('./pages/supplier/SupplierPOListPage').then((m) => ({ default: m.SupplierPOListPage }))
const SupplierPODetailPage = () => import('./pages/supplier/SupplierPODetailPage').then((m) => ({ default: m.SupplierPODetailPage }))

import { lazy, Suspense } from 'react'

const LazyPOList = lazy(POListPage)
const LazyPOCreate = lazy(POCreatePage)
const LazyPODetail = lazy(PODetailPage)
const LazyPOSubmit = lazy(POSubmitPage)
const LazyApprovalQueue = lazy(ApprovalQueuePage)
const LazyApprovalDetail = lazy(ApprovalDetailPage)
const LazySupplierPOList = lazy(SupplierPOListPage)
const LazySupplierPODetail = lazy(SupplierPODetailPage)

function RootRedirect() {
  const { user } = useAuth()
  if (!user) return <div className="p-8 text-center text-gray-500">Loading...</div>
  if (user.role === 'APPROVER') return <Navigate to="/approver/queue" replace />
  if (user.role === 'SUPPLIER') return <Navigate to="/supplier/po" replace />
  return <Navigate to="/buyer/po" replace />
}

function PageWrapper({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading...</div>}>
      {children}
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootRedirect />,
  },
  // Buyer routes
  {
    path: '/buyer/po',
    element: (
      <RoleGuard role="BUYER">
        <PageWrapper><LazyPOList /></PageWrapper>
      </RoleGuard>
    ),
  },
  {
    path: '/buyer/po/new',
    element: (
      <RoleGuard role="BUYER">
        <PageWrapper><LazyPOCreate /></PageWrapper>
      </RoleGuard>
    ),
  },
  {
    path: '/buyer/po/:poId',
    element: (
      <RoleGuard role="BUYER">
        <PageWrapper><LazyPODetail /></PageWrapper>
      </RoleGuard>
    ),
  },
  {
    path: '/buyer/po/:poId/submit',
    element: (
      <RoleGuard role="BUYER">
        <PageWrapper><LazyPOSubmit /></PageWrapper>
      </RoleGuard>
    ),
  },
  // Approver routes
  {
    path: '/approver/queue',
    element: (
      <RoleGuard role="APPROVER">
        <PageWrapper><LazyApprovalQueue /></PageWrapper>
      </RoleGuard>
    ),
  },
  {
    path: '/approver/queue/:poId',
    element: (
      <RoleGuard role="APPROVER">
        <PageWrapper><LazyApprovalDetail /></PageWrapper>
      </RoleGuard>
    ),
  },
  // Supplier routes
  {
    path: '/supplier/po',
    element: (
      <RoleGuard role="SUPPLIER">
        <PageWrapper><LazySupplierPOList /></PageWrapper>
      </RoleGuard>
    ),
  },
  {
    path: '/supplier/po/:poId',
    element: (
      <RoleGuard role="SUPPLIER">
        <PageWrapper><LazySupplierPODetail /></PageWrapper>
      </RoleGuard>
    ),
  },
  {
    path: '*',
    element: <div className="p-8 text-center text-gray-500">Page not found</div>,
  },
])
