import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DashboardClient from "@/components/DashboardClient";

export const revalidate = 0;

export default async function Home() {
  const cookieStore = cookies();
  const isLogin = cookieStore.get("axia_user")?.value;
  const role = cookieStore.get("axia_role")?.value;

  if (!isLogin) {
    redirect("/login");
  }

  // Admin gets everything. Employees get their own data.
  let qTareas = supabase.from("tareas").select("*");
  if (role !== "admin") qTareas = qTareas.eq("responsable", isLogin);
  const { data: tareas } = await qTareas;

  let qTiempos = supabase.from("tiempos_log").select("*");
  if (role !== "admin") qTiempos = qTiempos.eq("persona", isLogin);
  const { data: tiempos } = await qTiempos;

  const { data: clientes } = await supabase.from("clientes").select("*");

  return <DashboardClient tareas={tareas || []} tiempos={tiempos || []} clientes={clientes || []} isEmployee={role !== "admin"} />;
}
