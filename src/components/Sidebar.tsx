import Link from "next/link";
import { cookies } from 'next/headers';
import { LayoutDashboard, Users, Clock, Calculator, CalendarCheck, Settings, CalendarDays, ShieldCheck } from "lucide-react";

export function Sidebar({ user, role }: { user?: string, role?: string }) {

  let menuItems = [
    { name: "Tablero", href: "/", icon: LayoutDashboard },
    { name: "Tareas y Vencimientos", href: "/tareas", icon: CalendarCheck },
    { name: "Generar Mes", href: "/generar", icon: CalendarDays },
    { name: "Consola de Tiempos", href: "/tiempos", icon: Clock },
    { name: "Clientes", href: "/clientes", icon: Users },
    { name: "Rentabilidad", href: "/rentabilidad", icon: Calculator },
    { name: "Equipo y Accesos", href: "/equipo", icon: ShieldCheck },
  ];

  if (role !== 'admin') {
    menuItems = menuItems.filter(i => i.name !== 'Rentabilidad' && i.name !== 'Equipo y Accesos');
  }

  return (
    <aside className="w-64 bg-axia-blue text-white h-screen sticky top-0 flex flex-col overflow-y-auto">
      <div className="p-6">
        <img src="/axia-logo.png" alt="Axia" className="h-10 object-contain mb-1" />
        <p className="text-sm text-axia-orange font-semibold">Gestor del Estudio</p>
      </div>

      <nav className="flex-1 mt-6">
        <ul className="space-y-2 px-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-white/10 hover:text-axia-orange font-medium"
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 mt-auto">
        <div className="mb-4 px-4">
          <p className="text-xs text-axia-cream/50 uppercase tracking-wider font-bold">Usuario activo</p>
          <p className="text-sm font-bold text-white mt-1">{user || "Desconocido"}</p>
        </div>
        <form action={async () => {
          "use server";
          const { cookies } = await import("next/headers");
          cookies().delete("axia_user");
          cookies().delete("axia_role");
          const { redirect } = await import("next/navigation");
          redirect("/login");
        }}>
          <button className="flex items-center gap-3 px-4 py-3 w-full rounded-xl transition-all duration-200 hover:bg-white/10 text-rose-300 hover:text-rose-400 font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span>Cerrar Sesión</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
