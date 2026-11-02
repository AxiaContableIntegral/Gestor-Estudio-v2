"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, User } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch("/api/auth/users");
        const data = await res.json();
        if (res.ok && data.users) {
          setUsers(data.users);
        } else {
          toast.error("Error cargando los usuarios del equipo.");
        }
      } catch {
        toast.error("Error de conexión al cargar usuarios.");
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedUser) {
      setError("Por favor seleccioná un usuario");
      return;
    }

    if (!password) {
      setError("Por favor ingresá tu contraseña");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: selectedUser, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Usuario o contraseña incorrectos");
        setIsSubmitting(false);
        return;
      }

      toast.success(`¡Bienvenido/a, ${data.user?.nombre || selectedUser}!`);
      router.push("/");
      router.refresh();
    } catch {
      setError("Error de red al intentar iniciar sesión. Por favor reintentá.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 relative bg-gradient-to-br from-slate-900 via-axia-blue to-slate-900">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-500 z-10 relative border border-white/10">
        <div className="bg-axia-blue p-10 flex flex-col items-center justify-center">
          <img
            src="/LogoBajada7.png"
            alt="Axia Gestor del Estudio"
            className="h-28 w-auto object-contain drop-shadow-md"
          />
        </div>

        <div className="p-8">
          <h2 className="text-xl font-bold text-axia-dark mb-6 text-center">
            Iniciar Sesión
          </h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-axia-gray mb-1.5">
                Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-gray-400" />
                </div>
                <select
                  value={selectedUser}
                  onChange={(e) => {
                    setSelectedUser(e.target.value);
                    setError("");
                  }}
                  disabled={loading || isSubmitting}
                  className="w-full border border-gray-200 rounded-lg p-3 pl-10 outline-none focus:border-axia-teal bg-white font-medium text-axia-dark appearance-none disabled:opacity-50"
                >
                  <option value="" disabled>
                    {loading ? "Cargando usuarios..." : "Seleccionar usuario..."}
                  </option>
                  {users.map((u) => (
                    <option key={u.nombre} value={u.nombre}>
                      {u.nombre} ({u.rol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-axia-gray mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  disabled={loading || isSubmitting}
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-lg p-3 pl-10 outline-none focus:border-axia-teal bg-white font-medium text-axia-dark disabled:opacity-50"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm font-bold text-rose-500 bg-rose-50 p-2.5 rounded-lg border border-rose-200 text-center animate-in fade-in duration-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || isSubmitting}
              className="w-full bg-axia-blue text-white font-bold rounded-lg p-3 hover:bg-blue-800 transition-colors shadow-md mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verificando credenciales...
                </>
              ) : (
                "Ingresar al Gestor"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
