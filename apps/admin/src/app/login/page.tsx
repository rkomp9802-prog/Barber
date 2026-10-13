'use client'

import { useState } from 'react'
import { adminClient, ApiError } from '@/lib/admin-client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await adminClient.login({ login, password })
      router.push('/bookings')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.code || 'Login failed')
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-raised p-4">
      <div className="w-full max-w-md">
        <div className="bg-surface border border-border rounded-lg p-8 shadow-sm">
          <h1 className="text-2xl font-bold mb-6 text-text-body">
            Barbershop Admin
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login" className="block text-sm font-medium mb-1">
                Login
              </label>
              <input
                id="login"
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-border rounded bg-surface text-text-body disabled:opacity-50"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-border rounded bg-surface text-text-body disabled:opacity-50"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
