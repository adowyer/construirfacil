/**
 * app/(auth)/login/page.tsx
 * Login page — redirects to /portal if already authenticated (handled by middleware).
 */

import { Suspense } from 'react'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-black uppercase tracking-tight mb-10">
          Ingresar
        </h1>
        <Suspense fallback={<div className="h-48 animate-pulse bg-neutral-100 rounded" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}
