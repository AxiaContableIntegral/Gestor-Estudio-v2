"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      const { data, error } = await supabase.from("equipo").select("nombre, rol, password").order("rol", { ascending: true });
      if (!error && data) {
        setUsers(data);
      } else {
        toast.error("Aún no se creó la tabla de equipo en Supabase.");
      }
      setLoading(false);
    }
    loadUsers();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setError("Por favor seleccioná un usuario");
      return;
    }
    
    const userObj = users.find(u => u.nombre === selectedUser);
    
    if (userObj?.password !== password) {
      setError("Contraseña incorrecta");
      return;
    }

    document.cookie = `axia_user=${selectedUser}; path=/; max-age=86400`;
    document.cookie = `axia_role=${userObj?.rol}; path=/; max-age=86400`;
    
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 relative">
      <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/BackGrounAxia.jpg')" }}>
        <div className="absolute inset-0 bg-axia-dark/60 backdrop-blur-[2px]"></div>
      </div>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 z-10 relative">
        <div className="bg-axia-blue p-8 flex flex-col items-center justify-center">
          <img src="/LogoBajada7.png" alt="Axia Gestor del Estudio" className="h-16 object-contain" />
        </div>
        
        <div className="p-8">
          <h2 className="text-xl font-bold text-axia-dark mb-6 text-center">Iniciar Sesión</h2>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-axia-gray mb-1.5">Usuario</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-gray-400"/>
                </div>
                <select 
                  value={selectedUser} 
                  onChange={e => {setSelectedUser(e.target.value); setError("");}}
                  disabled={loading}
                  className="w-full border border-gray-200 rounded-lg p-3 pl-10 outline-none focus:border-axia-teal bg-white font-medium text-axia-dark appearance-none disabled:opacity-50"
                >
                  <option value="" disabled>{loading ? "Cargando usuarios..." : "Seleccionar usuario..."}</option>
                  {users.map(u => <option key={u.nombre} value={u.nombre}>{u.nombre} ({u.rol})</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-axia-gray mb-1.5">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400"/>
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => {setPassword(e.target.value); setError("");}}
                  disabled={loading}
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-lg p-3 pl-10 outline-none focus:border-axia-teal bg-white font-medium text-axia-dark disabled:opacity-50"
                />
              </div>
            </div>

            {error && <p className="text-sm font-bold text-rose-500 bg-rose-50 p-2 rounded text-center">{error}</p>}

            <button type="submit" disabled={loading} className="w-full bg-axia-blue text-white font-bold rounded-lg p-3 hover:bg-blue-800 transition-colors shadow-md mt-4 disabled:opacity-50">
              Ingresar al Gestor
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
