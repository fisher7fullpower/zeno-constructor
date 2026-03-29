import { NextRequest, NextResponse } from "next/server";
import { checkWorkspaceAccess } from "@/lib/workspace-access";

export async function GET(req: NextRequest) {
  const workspace = req.nextUrl.searchParams.get("workspace") ?? "";
  const access = await checkWorkspaceAccess(workspace);
  if (!access) return NextResponse.json({ data: [], total: 0 });

  // Stub: publication service removed
  return NextResponse.json({ data: [], total: 0, page: 1, per_page: 30 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { workspace } = body;

  const access = await checkWorkspaceAccess(workspace);
  if (!access) {
    return NextResponse.json({ error: "No access" }, { status: 403 });
  }

  // Stub: publication service removed
  return NextResponse.json(
    { error: "Publication service not configured" },
    { status: 501 }
  );
}

export async function DELETE(req: NextRequest) {
  const workspace = req.nextUrl.searchParams.get("workspace") ?? "";
  const access = await checkWorkspaceAccess(workspace);
  if (!access) {
    return NextResponse.json({ error: "No access" }, { status: 403 });
  }

  // Stub: publication service removed
  return NextResponse.json(
    { error: "Publication service not configured" },
    { status: 501 }
  );
}
