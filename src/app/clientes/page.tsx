import { supabase } from "@/lib/supabase";
import ClientesClient from "@/components/ClientesClient";

export const revalidate = 0;

export default async function ClientesPage() {
  const { data: clientes, error: errorClientes } = await supabase
    .from("clientes")
    .select("*")
    .order("cliente", { ascending: true });

  const { data: sociedades, error: errorSociedades } = await supabase
    .from("sociedades")
    .select("*")
    .order("sociedad", { ascending: true });

  if (errorClientes || errorSociedades) {
    console.error("Error cargando base de datos:", errorClientes || errorSociedades);
    return <div>Error cargando la base de datos. Verificá la consola.</div>;
  }

  return <ClientesClient clientes={clientes || []} sociedades={sociedades || []} />;
}
