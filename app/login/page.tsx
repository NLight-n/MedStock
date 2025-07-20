'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { FaRegHospital } from 'react-icons/fa'

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        username: formData.username,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid username or password')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError('An error occurred during login. Please try again.')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-cyan-100 to-green-50 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {/* Decorative blurred circles for modern look */}
        <div className="absolute top-10 left-10 w-72 h-72 bg-cyan-200 opacity-30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-green-200 opacity-20 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 max-w-md w-full mx-auto">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3">
            <span className="text-4xl text-cyan-600"><FaRegHospital /></span>
            <span className="text-3xl font-extrabold text-gray-800 tracking-tight">MedStock</span>
          </div>
          <span className="mt-2 text-cyan-800 text-base font-medium tracking-wide text-center">Smart Inventory for Modern Healthcare</span>
        </div>
        <div className="bg-white/70 backdrop-blur-md shadow-2xl rounded-2xl px-8 py-8">
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-6">Sign in to your account</h2>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="sr-only">Username</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="block w-full px-4 py-3 rounded-lg border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 bg-white/80 shadow-sm transition"
                  placeholder="Username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="block w-full px-4 py-3 rounded-lg border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 bg-white/80 shadow-sm transition"
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>
            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 rounded-lg text-base font-semibold text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 shadow-lg transition disabled:opacity-60"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 