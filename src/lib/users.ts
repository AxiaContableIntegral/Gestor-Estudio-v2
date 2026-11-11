import { supabase } from "@/lib/supabase";

export interface PublicTeamUser {
  nombre: string;
  rol: string;
}

/** Fetches team names and roles for login selection (never passwords). */
export async function getPublicTeamUsers(): Promise<{
  users: PublicTeamUser[];
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from("equipo")
      .select("nombre, rol")
      .order("rol", { ascending: true });

    if (error) {
      return { users: [], error: error.message };
    }

    return { users: data || [], error: null };
  } catch (err: any) {
    return { users: [], error: err?.message || "Error al cargar usuarios" };
  }
}

