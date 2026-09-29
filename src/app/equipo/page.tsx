import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import EquipoClient from "@/components/EquipoClient";

export const revalidate = 0;

export default async function EquipoPage() {
  const cookieStore = cookies();
  const role = cookieStore.get("axia_role")?.value;

  if (role !== "admin") {
    redirect("/"); // Solo admin
  }

  const { data: equipo, error } = await supabase.from("equipo").select("*").order("nombre");

  if (error) {
    return <div>Error cargando base de datos: {error.message} (Asegurate de haber corrido el SQL en Supabase)</div>;
  }

  return <EquipoClient equipo={equipo || []} />;
}
