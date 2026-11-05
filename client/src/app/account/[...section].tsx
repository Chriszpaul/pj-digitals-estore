// Clerk owns the content; this route accepts its profile/security subpaths.
export default function AccountSection() { return null; }

export function generateStaticParams() {
  return [{ section: ['security'] }, { section: ['profile'] }];
}
