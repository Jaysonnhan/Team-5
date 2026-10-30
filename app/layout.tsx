import type { ReactNode } from 'react';
export const metadata = { title: 'Dream Journey · Student Studio', description: 'Plan, document and share your Dream Journey.' };
export default function Layout({ children }: { children: ReactNode }) { return <html lang="en"><body style={{margin:0}}>{children}</body></html>; }
