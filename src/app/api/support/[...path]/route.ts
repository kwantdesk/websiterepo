import { NextRequest } from "next/server";
import { supportProxy } from "@/lib/supportDesk.server";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
type Context = {
    params: Promise<{
        path: string[];
    }>;
};
export async function GET(request: NextRequest, context: Context) { return supportProxy(request, (await context.params).path); }
export async function POST(request: NextRequest, context: Context) { return supportProxy(request, (await context.params).path); }
