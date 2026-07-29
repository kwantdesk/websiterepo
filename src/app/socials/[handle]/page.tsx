import KwantifyWorkspace from "@/components/KwantifyWorkspace";

export default async function SocialProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return <KwantifyWorkspace section="socials" socialProfileHandle={decodeURIComponent(handle)} />;
}
