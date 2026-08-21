import { registerHooks } from "node:module";

/**
 * Lets scripts run the app's TypeScript modules under Node: resolves the "@/"
 * path alias and the extensionless relative specifiers TypeScript allows but
 * Node's ESM resolver does not.
 */
const root = new URL("../src/", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/")
      ? new URL(specifier.slice(2), root).href
      : specifier;
    try {
      return nextResolve(target, context);
    } catch (error) {
      if (/\.[a-z]+$/i.test(target)) throw error;
      for (const suffix of [".ts", ".tsx", "/index.ts"]) {
        try { return nextResolve(`${target}${suffix}`, context); } catch { /* next */ }
      }
      throw error;
    }
  },
});
