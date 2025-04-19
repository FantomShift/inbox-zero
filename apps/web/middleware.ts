import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname, searchParams, origin } = req.nextUrl;
  const sessionToken = await getToken({ req, secret: process.env.AUTH_SECRET });

  const isLoginPage = pathname === "/login";
  const needsConsent = searchParams.get("consent") === "true";
  const hasError = searchParams.has("error"); // Consider errors as needing login page view

  // If user is logged in (has session token)
  if (sessionToken) {
    // And they are trying to access a page *other* than login
    // And they haven't already been flagged as needing consent or having an error
    if (!isLoginPage && !needsConsent && !hasError) {
      // Assume they need to grant permissions for this app specifically.
      // Redirect them to the login page with the consent flag.
      // Note: We don't do a full scope check here for simplicity,
      // assuming arrival implies potential need for app-specific consent.
      const loginUrl = new URL(
        `${process.env.NEXT_PUBLIC_BASE_URL}${pathname.startsWith("/") ? "" : "/"}login`,
        origin,
      );
      loginUrl.searchParams.set("consent", "true");
      // Preserve original destination via 'next' param if needed, e.g.:
      // loginUrl.searchParams.set('next', pathname + req.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Allow the request to proceed if:
  // - User is not logged in (auth check happens in layout/page)
  // - User is logged in and on the login page
  // - User is logged in and has consent=true or an error flag (login page handles this)
  return NextResponse.next();
}

// Matcher configuration:
// Apply middleware to all paths except:
// - API routes (/api/...)
// - Next.js internal paths (/_next/...)
// - Static files (files with extensions like .png, .ico)
// - Public files that might be needed before auth (e.g., /images, /terms, /privacy)
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images/|terms|privacy|sw.js|site.webmanifest|robots.txt|manifest.json).*)", // Adjust public paths as needed
  ],
};
