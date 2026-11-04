import React from "react";
const router = { push: () => {}, prefetch: () => {}, replace: () => {} };
export const useRouter = () => router;
export const usePathname = () => "/algo";
export const warmWorkspaceNavigation = () => {};
export const startRendererHealthRecorder = () => () => {};
export const Null = () => null;
export default function Link({ href, children, prefetch: _prefetch, ...props }: { href: string; children: React.ReactNode; prefetch?: boolean; [key: string]: unknown }) {
  return <a href={href} {...props}>{children}</a>;
}

export const useSearchParams = () => new URLSearchParams(window.location.search);
