import { NextResponse } from "next/server";
import { getPublicTeamUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET() {
  const { users, error } = await getPublicTeamUsers();

  if (error) {
    return NextResponse.json(
      { error },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  return NextResponse.json(
    { users },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
