import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { verifySession } from "@/lib/auth";
import EquipoClient from "@/components/EquipoClient";

export const revalidate = 0;

export default async function EquipoPage() {
  const cookieStore = cookies();
  const token = cookieStore.get("axia_session")?.value;
  const session = token ? await verifySession(token) : null;

  if (!session || session.rol !== "admin") {
    redirect("/");
  }

  // Fetch team without selecting passwords!
  const { data: equipo, error } = await supabase
    .from("equipo")
    .select("id, nombre, rol, es_socio, tarifa_hora, sueldo_mensual, created_at")
    .order("nombre");

  if (error) {
    return <div>Error cargando base de datos: {error.message}</div>;
  }

  return <EquipoClient equipo={equipo || []} />;
}
