import { Loader2 } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { AuthShell, Field, FormError } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"

const MIN_PASSWORD = 10

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  // Mirror the server's rules for instant feedback. The server still validates
  // independently — this is a convenience, never the enforcement point.
  const passwordIssue =
    touched && password.length > 0 && password.length < MIN_PASSWORD
      ? `Use at least ${MIN_PASSWORD} characters`
      : undefined
  const usernameIssue =
    touched && username.length > 0 && !/^[a-zA-Z0-9_-]{3,24}$/.test(username)
      ? "3–24 characters: letters, numbers, hyphen, underscore"
      : undefined

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (password.length < MIN_PASSWORD || !/^[a-zA-Z0-9_-]{3,24}$/.test(username))
      return
    setBusy(true)
    try {
      await register(email, username, password)
      navigate("/play", { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Save your games and track your history."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className="rounded text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormError message={error} />

        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Field
          id="username"
          label="Username"
          autoComplete="username"
          placeholder="magnus"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onBlur={() => setTouched(true)}
          error={usernameIssue}
          required
        />

        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched(true)}
          error={passwordIssue}
          hint={`At least ${MIN_PASSWORD} characters. Length beats complexity.`}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="mt-1 w-full"
          disabled={busy}
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          {busy ? "Creating account" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  )
}

export default RegisterPage
