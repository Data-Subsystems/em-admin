import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SITE_PASSWORD = process.env.SITE_PASSWORD || "emadmin2026!";
const COOKIE_NAME = "em-admin-auth";

export async function middleware(request: NextRequest) {
  // Skip auth for API routes, static files, and login endpoint
  if (
    request.nextUrl.pathname.startsWith("/api/") ||
    request.nextUrl.pathname.startsWith("/_next/") ||
    request.nextUrl.pathname.startsWith("/favicon") ||
    request.nextUrl.pathname === "/login"
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authCookie = request.cookies.get(COOKIE_NAME);
  if (authCookie?.value === "authenticated") {
    return NextResponse.next();
  }

  // Show login page
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - EM Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #f3f4f6;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .login-box {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 400px;
    }
    h1 {
      color: #8B3A3A;
      margin-bottom: 0.5rem;
      font-size: 1.5rem;
    }
    p {
      color: #6b7280;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
    }
    form { display: flex; flex-direction: column; gap: 1rem; }
    input {
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 1rem;
    }
    input:focus {
      outline: none;
      border-color: #8B3A3A;
      box-shadow: 0 0 0 3px rgba(139,58,58,0.1);
    }
    button {
      padding: 0.75rem;
      background: #8B3A3A;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #6B2A2A; }
    .error {
      color: #dc2626;
      font-size: 0.875rem;
      display: none;
    }
    .error.show { display: block; }
  </style>
</head>
<body>
  <div class="login-box">
    <h1>EM Admin</h1>
    <p>Enter password to access the scoreboard tool</p>
    <form id="loginForm">
      <input type="password" id="password" placeholder="Password" required autofocus>
      <button type="submit">Login</button>
      <div class="error" id="error">Invalid password</div>
    </form>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('password').value;
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        window.location.href = '/';
      } else {
        document.getElementById('error').classList.add('show');
      }
    });
  </script>
</body>
</html>`,
    {
      status: 401,
      headers: { "Content-Type": "text/html" },
    }
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
