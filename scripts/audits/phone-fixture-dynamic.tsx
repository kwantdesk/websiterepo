import React, { lazy, Suspense } from "react";
export default function dynamic(loader: () => Promise<{ default: React.ComponentType<unknown> }>) {
  const Component = lazy(loader);
  return function FixtureDynamic(props: object) { return <Suspense fallback={null}><Component {...props} /></Suspense>; };
}
