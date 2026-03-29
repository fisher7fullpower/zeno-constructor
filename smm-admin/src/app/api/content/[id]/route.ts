import { NextRequest, NextResponse } from "next/server";
import { checkWorkspaceAccess } from "@/lib/workspace-access";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const workspace = req.nextUrl.searchParams.get("workspace") ?? "";
  const access = await checkWorkspaceAccess(workspace);
  if (!access) return NextResponse.json({ error: "No access" }, { status: 403 });

  // Stub: publication service removed
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const workspace = req.nextUrl.searchParams.get("workspace") ?? "";
  const access = await checkWorkspaceAccess(workspace);
  if (!access) return NextResponse.json({ error: "No access" }, { status: 403 });

  // Stub: publication service removed
  return NextResponse.json(
    { error: "Publication service not configured" },
    { status: 501 }
  );
}
