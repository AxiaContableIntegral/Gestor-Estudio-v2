"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { LayoutDashboard, Download } from "lucide-react";

export default function DashboardClient({ tareas, tiempos, clientes, isEmployee }: { tareas: any[], tiempos: any[], clientes: any[], isEmployee: boolean }) {
  const [lineaSel, setLineaSel] = useState("Todas");
  const [alcanceHxC, setAlcanceHxC] = useState("Mes actual");

  const calc = useMemo(() => {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    
    // Filtros
    const tTareas = lineaSel === "Todas" ? tareas : tareas.filter(t => t.linea_negocio === lineaSel);
    const tTiempos = tiempos.map(t => {
      const tar = tareas.find(ta => ta.id === t.id_tarea);
      return { ...t, linea_negocio: tar?.linea_negocio || "Sin Línea", cliente: tar?.cliente || "Desconocido" };
    }).filter(t => lineaSel === "Todas" || t.linea_negocio === lineaSel);

    // Tiempos del mes
    const tiemposMes = tTiempos.filter(t => {
      if (!t.fecha_trabajo) return false;
      const d = new Date(t.fecha_trabajo + "T00:00:00");
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });

    // KPI 1: Tareas Pendientes y Vencidas
    let pendientes = 0;
    let vencidas = 0;
    const tareasActivas = tTareas.filter(t => t.estado === "Pendiente" || t.estado === "En Proceso");
    
    tareasActivas.forEach(t => {
      pendientes++;
      if (t.fecha_vencimiento) {
        const v = new Date(t.fecha_vencimiento + "T00:00:00");
        if (v < now) vencidas++;
      }
    });

    // KPI 2: Horas del Mes
    let horasMes = 0;
    let horasEC = 0;
    let horasCFO = 0;
    let horasSin = 0;
    tiemposMes.forEach(t => {
      horasMes += Number(t.horas);
      if (t.linea_negocio === "Estudio Contable") horasEC += Number(t.horas);
      else if (t.linea_negocio === "Consultoría CFO") horasCFO += Number(t.horas);
      else horasSin += Number(t.horas);
    });

    // Gráfico 1: Horas por Cliente
    const hPorClienteMap = new Map();
    const baseHxC = alcanceHxC === "Mes actual" ? tiemposMes : tTiempos;
    baseHxC.forEach(t => {
      if (!hPorClienteMap.has(t.cliente)) hPorClienteMap.set(t.cliente, { name: t.cliente, EC: 0, CFO: 0, Otros: 0 });
      const c = hPorClienteMap.get(t.cliente);
      if (t.linea_negocio === "Estudio Contable") c.EC += Number(t.horas);
      else if (t.linea_negocio === "Consultoría CFO") c.CFO += Number(t.horas);
      else c.Otros += Number(t.horas);
    });
    const chartHorasCliente = Array.from(hPorClienteMap.values())
      .map(c => ({ ...c, Total: c.EC + c.CFO + c.Otros }))
      .sort((a, b) => b.Total - a.Total)
      .slice(0, 15); // Top 15

    // Gráfico 2: Carga Pendiente por Responsable
    const cargaRespMap = new Map();
    tareasActivas.forEach(t => {
      const r = t.responsable || "Sin Asignar";
      if (!cargaRespMap.has(r)) cargaRespMap.set(r, { name: r, Vencida: 0, "En Plazo": 0, "Sin Fecha": 0 });
      const c = cargaRespMap.get(r);
      
      if (!t.fecha_vencimiento) {
        c["Sin Fecha"] += 1; // Count by number of tasks
      } else {
        const v = new Date(t.fecha_vencimiento + "T00:00:00");
        if (v < now) c.Vencida += 1;
        else c["En Plazo"] += 1;
      }
    });
    const chartCargaResp = Array.from(cargaRespMap.values());

    // Gráfico 3: Presupuestado vs Real (por cliente, vencimiento este mes)
    const pvrMap = new Map();
    const tareasDelMes = tTareas.filter(t => t.fecha_vencimiento && t.fecha_vencimiento.startsWith(currentMonthStr));
    const idsTareasMes = new Set(tareasDelMes.map(t => t.id));
    
    tareasDelMes.forEach(t => {
      const c = t.cliente || "Desconocido";
      if (!pvrMap.has(c)) pvrMap.set(c, { name: c, Presupuestadas: 0, Reales: 0 });
      pvrMap.get(c).Presupuestadas += Number(t.horas_presupuestadas || 0);
    });

    tTiempos.forEach(t => {
      if (idsTareasMes.has(t.id_tarea)) {
        const tar = tareasDelMes.find(ta => ta.id === t.id_tarea);
        const c = tar?.cliente || "Desconocido";
        if (pvrMap.has(c)) {
          pvrMap.get(c).Reales += Number(t.horas);
        }
      }
    });
    const chartPvR = Array.from(pvrMap.values()).sort((a,b) => b.Presupuestadas - a.Presupuestadas).slice(0, 15);

    // Rentabilidad del mes (Honorarios / Horas)
    const rentMap = new Map();
    const cLineas = lineaSel === "Todas" ? clientes : clientes.filter(c => c.linea_negocio === lineaSel);
    
    cLineas.forEach(c => {
      if (c.tipo_honorario === "Mensual" && Number(c.ultima_cobranza_monto) > 0) {
        const key = `${c.cliente}-${c.linea_negocio}`;
        rentMap.set(key, { 
          cliente: c.cliente, 
          linea: c.linea_negocio, 
          cobranza: Number(c.ultima_cobranza_monto),
          horasMes: 0,
          valorHora: 0
        });
      }
    });

    tiemposMes.forEach(t => {
      const key = `${t.cliente}-${t.linea_negocio}`;
      if (rentMap.has(key)) {
        rentMap.get(key).horasMes += Number(t.horas);
      }
    });

    const tablaRent = Array.from(rentMap.values()).map(r => {
      r.valorHora = r.horasMes > 0 ? r.cobranza / r.horasMes : r.cobranza;
      return r;
    }).sort((a,b) => a.linea.localeCompare(b.linea) || b.horasMes - a.horasMes);


    return { 
      pendientes, vencidas, horasMes, horasEC, horasCFO, horasSin, 
      currentMonthStr, chartHorasCliente, chartCargaResp, chartPvR, tablaRent 
    };
  }, [tareas, tiempos, clientes, lineaSel, alcanceHxC]);


  const exportCSV = () => {
    let csv = "Cliente;Linea;Honorario;Horas Mes;Valor Hora\n";
    calc.tablaRent.forEach(r => {
      csv += `${r.cliente};${r.linea};${r.cobranza};${r.horasMes.toFixed(2)};${r.valorHora.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rentabilidad_rapida_${calc.currentMonthStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-axia-blue flex items-center gap-3"><LayoutDashboard size={28}/> Tablero de Comandos</h1>
      </div>

      {!isEmployee && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 inline-flex gap-2">
          {["Todas", "Estudio Contable", "Consultoría CFO"].map(opt => (
            <button 
              key={opt} onClick={() => setLineaSel(opt)}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${lineaSel === opt ? "bg-axia-blue text-white" : "bg-slate-100 text-axia-gray hover:bg-slate-200"}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* KPIs Level 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-axia-gray uppercase tracking-wider mb-2">Tareas Pendientes</p>
          <p className="text-4xl font-black text-axia-dark">{calc.pendientes}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-axia-gray uppercase tracking-wider mb-2">Tareas Vencidas</p>
          <p className="text-4xl font-black text-rose-600">{calc.vencidas}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-axia-gray uppercase tracking-wider mb-2">Horas Insumidas (Mes)</p>
          <p className="text-4xl font-black text-axia-teal">{calc.horasMes.toFixed(1)} h</p>
        </div>
      </div>

      {/* KPIs Level 2 (Horas por linea) */}
      {lineaSel === "Todas" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 opacity-90">
           <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
            <p className="text-xs font-bold text-axia-gray uppercase mb-1">Hs Estudio Contable</p>
            <p className="text-xl font-bold text-axia-dark">{calc.horasEC.toFixed(1)} h</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
            <p className="text-xs font-bold text-axia-gray uppercase mb-1">Hs Consultoría CFO</p>
            <p className="text-xl font-bold text-axia-dark">{calc.horasCFO.toFixed(1)} h</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
            <p className="text-xs font-bold text-axia-gray uppercase mb-1">Hs Sin Línea</p>
            <p className="text-xl font-bold text-axia-dark">{calc.horasSin.toFixed(1)} h</p>
          </div>
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Gráfico 1: Horas por cliente */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-axia-dark uppercase tracking-wide">Horas invertidas por cliente</h3>
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button onClick={() => setAlcanceHxC("Mes actual")} className={`px-3 py-1 text-xs font-bold rounded-md ${alcanceHxC==="Mes actual"?"bg-white shadow text-axia-blue":"text-axia-gray"}`}>Mes actual</button>
              <button onClick={() => setAlcanceHxC("Histórico")} className={`px-3 py-1 text-xs font-bold rounded-md ${alcanceHxC==="Histórico"?"bg-white shadow text-axia-blue":"text-axia-gray"}`}>Histórico</button>
            </div>
          </div>
          {calc.chartHorasCliente.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-axia-gray">No hay horas registradas.</div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calc.chartHorasCliente} layout="vertical" margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={150} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Legend wrapperStyle={{fontSize: "12px"}}/>
                  <Bar dataKey="EC" name="Estudio Contable" stackId="a" fill="#1e3a8a" />
                  <Bar dataKey="CFO" name="Consultoría CFO" stackId="a" fill="#0d9488" />
                  <Bar dataKey="Otros" name="Otros" stackId="a" fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Gráfico 2: Carga por Responsable */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-axia-dark uppercase tracking-wide mb-6">Carga pendiente por responsable (Cantidad de Tareas)</h3>
          {calc.chartCargaResp.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-axia-gray">No hay tareas pendientes.</div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calc.chartCargaResp} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Legend wrapperStyle={{fontSize: "12px"}}/>
                  <Bar dataKey="Vencida" stackId="a" fill="#e11d48" />
                  <Bar dataKey="En Plazo" stackId="a" fill="#10b981" />
                  <Bar dataKey="Sin Fecha" stackId="a" fill="#cbd5e1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico 3: Presupuestado vs Real */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <h3 className="text-sm font-bold text-axia-dark uppercase tracking-wide mb-6">Horas presupuestadas vs Reales (Tareas que vencen en {calc.currentMonthStr})</h3>
        {calc.chartPvR.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-axia-gray">No hay tareas que venzan este mes.</div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calc.chartPvR} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Legend wrapperStyle={{fontSize: "12px"}}/>
                  <Bar dataKey="Presupuestadas" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Reales" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
      </div>

      {/* Rentabilidad del mes y Export */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-bold text-axia-dark uppercase tracking-wide">Rentabilidad por Cliente y Línea ({calc.currentMonthStr})</h3>
          <button onClick={exportCSV} className="flex items-center gap-2 text-sm font-bold bg-slate-100 text-axia-dark px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">
            <Download size={16}/> Exportar
          </button>
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-gray-100 text-axia-gray text-[10px] tracking-wider uppercase font-bold">
                  <th className="p-3">Línea</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3 text-right">Última Cobranza</th>
                  <th className="p-3 text-center">Horas del Mes</th>
                  <th className="p-3 text-right">Valor Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {calc.tablaRent.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-3 text-axia-gray">{r.linea}</td>
                    <td className="p-3 font-bold text-axia-dark">{r.cliente}</td>
                    <td className="p-3 text-right font-medium">$ {r.cobranza.toLocaleString("es-AR")}</td>
                    <td className="p-3 text-center text-axia-teal font-bold">{r.horasMes.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-axia-blue">$ {r.valorHora.toLocaleString("es-AR", {maximumFractionDigits: 0})}</td>
                  </tr>
                ))}
                {calc.tablaRent.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-axia-gray">No hay datos de clientes para este mes</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-axia-gray mt-4">Valor hora = Honorario de esa línea ÷ horas del mes en esa línea. Indicativo para comparar clientes.</p>
      </div>

    </div>
  );
}
