import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { verifySession, hashPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("axia_session")?.value;
    const session = token ? await verifySession(token) : null;

    if (!session || session.rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { action, id, nombre, rol, password, tarifa_hora, sueldo_mensual, es_socio } = body;

    if (action === "delete") {
      if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

      // Verify not deleting the last admin
      const { data: admins } = await supabase.from("equipo").select("id").eq("rol", "admin");
      if (admins && admins.length === 1 && admins[0].id === id) {
        return NextResponse.json({ error: "No podés eliminar al único administrador" }, { status: 400 });
      }

      const { error } = await supabase.from("equipo").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    // Save (insert or update)
    if (!nombre || !rol) {
      return NextResponse.json({ error: "Nombre y rol son requeridos" }, { status: 400 });
    }

    const payload: Record<string, any> = {
      nombre,
      rol,
      es_socio: es_socio || "No",
      tarifa_hora: Number(tarifa_hora || 0),
      sueldo_mensual: Number(sueldo_mensual || 0),
    };

    if (password && password.trim()) {
      payload.password = await hashPassword(password.trim());
    }

    if (id) {
      // Update
      const { error } = await supabase.from("equipo").update(payload).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // Insert: password is required
      if (!payload.password) {
        return NextResponse.json({ error: "La contraseña es requerida para nuevos usuarios" }, { status: 400 });
      }
      const { error } = await supabase.from("equipo").insert([payload]);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
