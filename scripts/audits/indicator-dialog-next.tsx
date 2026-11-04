import React from 'react';
export const useRouter = () => ({ push() { }, prefetch() { }, replace() { } });
export const usePathname = () => '/isolated-indicator-audit';
export default function Link({ href, children, ...props }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
}) { return <a href={href} {...props}>{children}</a>; }
