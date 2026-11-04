export * from "../../src/lib/userPreferences";
export async function hydrateUserPreferences(){return {changed:false,snapshot:{version:1,complete:true,updatedAt:new Date().toISOString(),values:{}}};}
export async function compactLegacyAuthPreferenceMetadata(){}
