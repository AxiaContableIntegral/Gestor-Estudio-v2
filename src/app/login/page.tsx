import { getPublicTeamUsers } from "@/lib/users";
import { LoginClient } from "@/components/LoginClient";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const { users } = await getPublicTeamUsers();
  return <LoginClient initialUsers={users} />;
}
