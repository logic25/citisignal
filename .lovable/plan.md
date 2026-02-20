
## Fix: Google OAuth redirect loops to marketing page

### Root Cause

In `src/hooks/useAuth.tsx`, the `onAuthStateChange` callback has this guard:

```typescript
if (!isMounted || !initializedRef.current) return;
```

This was meant to prevent double-setState during initial load, but it has a fatal flaw for OAuth callbacks:

1. Google redirects back to `citisignal.com/#access_token=...`
2. Supabase's `createClient` immediately detects the hash and fires `SIGNED_IN` via `onAuthStateChange`
3. But `initializedRef.current` is still `false` at this point (it's set to `true` only after `getSession()` resolves)
4. So the callback is **silently ignored** — the session is set in Supabase internally but the React state is never updated
5. `getSession()` then runs and DOES return the session, setting `user` correctly
6. But by then, `Index.tsx` has already rendered the marketing page, and the `onAuthStateChange` listener in `Index.tsx` only fires for **future** state changes — not the one that already happened

### The Fix (3 files)

**1. `src/hooks/useAuth.tsx` — Remove the `initializedRef` guard from `onAuthStateChange`**

The listener should ALWAYS respond to auth events. The double-setState concern is harmless (React batches them). Instead, let `onAuthStateChange` handle ALL session state, and use it to also set `loading = false`. Drop the separate `getSession()` / `initializedRef` pattern:

```typescript
useEffect(() => {
  let isMounted = true;

  // onAuthStateChange fires for BOTH the initial session AND future changes.
  // It fires with the current session immediately on subscribe (including OAuth hash tokens).
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // Always mark loaded once we get any event
    }
  );

  return () => {
    isMounted = false;
    subscription.unsubscribe();
  };
}, []);
```

This is the pattern Supabase officially recommends. `onAuthStateChange` fires synchronously with the current session state when you subscribe, including detecting OAuth hash tokens in the URL — so `getSession()` becomes redundant.

**2. `src/pages/Index.tsx` — Add an early hash-detection guard**

Even with the AuthProvider fix, there's a brief render gap. Add an early check: if the URL hash contains `access_token`, render a full-screen spinner immediately (before auth state even loads) so the marketing page never flashes:

```typescript
// Early exit if we're handling an OAuth callback
if (window.location.hash.includes('access_token')) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
```

This is placed before the `if (loading)` check, so it runs on the very first render.

**3. `src/pages/Auth.tsx` — Remove `skipBrowserRedirect: true`**

The `skipBrowserRedirect: true` option was added to manually control the redirect, but this actually causes the problem — it prevents Supabase from handling the OAuth callback hash automatically. Remove it so Supabase handles the full redirect flow natively:

```typescript
// BEFORE (broken):
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: window.location.origin,
    skipBrowserRedirect: true,  // ← this is the problem
  },
});
if (data?.url) window.location.href = data.url;

// AFTER (fixed):
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: window.location.origin,
  },
});
```

Without `skipBrowserRedirect`, Supabase handles the OAuth redirect natively and the session is properly detected on return.

### Summary of Changes

| File | Change |
|---|---|
| `src/hooks/useAuth.tsx` | Remove `initializedRef` guard; let `onAuthStateChange` handle all session state including `loading` |
| `src/pages/Index.tsx` | Add early hash-detection to show spinner during OAuth callback |
| `src/pages/Auth.tsx` | Remove `skipBrowserRedirect: true` from the custom domain Google sign-in path |

### Why You Do NOT Need Your Own Google OAuth Credentials

The branding ("Lovable" name) and the redirect bug are two separate issues. The redirect is purely a code bug in the auth initialization order. Lovable's managed Google OAuth works perfectly fine for handling the actual authentication — it's just the post-auth redirect handling in your React app that was broken.
