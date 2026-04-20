import ClientRedirect from './ClientRedirect';

/**
 * Zenvy Rider Portal - Catch-all Redirection
 */
export default function CatchAllRedirect() {
  return <ClientRedirect />;
}

// Required for next build "output: export" with dynamic/catch-all routes
export function generateStaticParams() {
  // Generate a dummy static route so Next.js can resolve this catch-all
  return [{ "not-found": ["404"] }];
}
