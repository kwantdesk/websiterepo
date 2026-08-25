import { cookies } from "next/headers";

import LabAccessGate from "@/components/lab/LabAccessGate";
import LabWorkspace from "@/components/lab/LabWorkspace";
import { LAB_ACCESS_COOKIE, isValidLabAccessToken } from "@/lib/labAccess";

export const dynamic = "force-dynamic";

export default async function LabPage() {
  const cookieStore = await cookies();
  const unlocked = await isValidLabAccessToken(cookieStore.get(LAB_ACCESS_COOKIE)?.value);
  return unlocked ? <LabWorkspace /> : <LabAccessGate />;
}
