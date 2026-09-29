import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import RentabilidadClient from "@/components/RentabilidadClient";

export const revalidate = 0;

export default async function RentabilidadPage() {
  const cookieStore = cookies();
  const role = cookieStore.get("axia_role")?.value;

  if (role !== "admin") {
    redirect("/"); 
  }

  // Fetch all required data
  const { data: clientes } = await supabase.from("clientes").select("*");
  const { data: equipo } = await supabase.from("equipo").select("*");
  const { data: tiempos } = await supabase.from("tiempos_log").select("*");
  const { data: gastos } = await supabase.from("gastos").select("*");

  return (
    <RentabilidadClient 
      clientes={clientes || []} 
      equipo={equipo || []} 
      tiempos={tiempos || []} 
      gastos_db={gastos || []}
    />
  );
}
