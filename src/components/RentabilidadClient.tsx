"use client";

import { useState, useMemo } from "react";
import { Calculator, Calendar, DollarSign, Users, Briefcase, TrendingUp } from "lucide-react";

export default function RentabilidadClient({ clientes, equipo, tiempos }: { clientes: any[], equipo: any[], tiempos: any[] }) {
  const [mesSel, setMesSel] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [lineaSel, setLineaSel] = useState("Todas");
  const [activeTab, setActiveTab] = useState("cliente");

  // Calculations
  const calc = useMemo(() => {
    const [anioStr, mesStr] = mesSel.split("-");
    const anio = parseInt(anioStr);
    const mes = parseInt(mesStr);

    // Filter tiempos by month
    const tMes = tiempos.filter(t => {
      if (!t.fecha_trabajo) return false;
      const d = new Date(t.fecha_trabajo + "T00:00:00");
      return d.getFullYear() === anio && (d.getMonth() + 1) === mes;
    });

    // 1. Ingresos Mensuales (de clientes)
    let ingresosMensuales = 0;
    clientes.forEach(c => {
      if (c.tipo_honorario === "Mensual" && c.ultima_cobranza_monto > 0) {
        if (lineaSel === "Todas" || c.linea_negocio === lineaSel) {
          ingresosMensuales += Number(c.ultima_cobranza_monto);
        }
      }
    });

    // 2. Horas y Costo Estándar
    let horasFacturables = 0;
    let horasInternas = 0;
    let costoStd = 0;

    const statsCliente = new Map(); // cliente -> { horas, costo, ingresos }
    
    // Init statsCliente with incomes
    clientes.forEach(c => {
      if (c.tipo_honorario === "Mensual" && (lineaSel === "Todas" || c.linea_negocio === lineaSel)) {
        statsCliente.set(c.cliente, { ingresos: Number(c.ultima_cobranza_monto), horas: 0, costo: 0, linea: c.linea_negocio });
      }
    });

    const statsEquipo = new Map(); // nombre -> { horasFact, horasInt, costo, sueldo, tarifa }
    equipo.forEach(e => {
      statsEquipo.set(e.nombre, { horasFact: 0, horasInt: 0, costo: 0, sueldo: Number(e.sueldo_mensual), tarifa: Number(e.tarifa_hora), es_socio: e.es_socio === "Si" });
    });

    tMes.forEach(t => {
      if (lineaSel !== "Todas" && t.linea_negocio !== lineaSel) return;
      
      const pers = equipo.find(e => e.nombre === t.persona);
      const tarifa = pers ? Number(pers.tarifa_hora) : 0;
      const costo = Number(t.horas) * tarifa;
      
      const esInterno = t.cliente?.toLowerCase().includes("interno") || clientes.find(c => c.cliente === t.cliente)?.tipo_honorario === "Interno";

      if (esInterno) {
        horasInternas += Number(t.horas);
      } else {
        horasFacturables += Number(t.horas);
        costoStd += costo;
        
        if (!statsCliente.has(t.cliente)) {
          statsCliente.set(t.cliente, { ingresos: 0, horas: 0, costo: 0, linea: t.linea_negocio });
        }
        const stC = statsCliente.get(t.cliente);
        stC.horas += Number(t.horas);
        stC.costo += costo;
      }

      if (statsEquipo.has(t.persona)) {
        const stE = statsEquipo.get(t.persona);
        if (esInterno) stE.horasInt += Number(t.horas);
        else stE.horasFact += Number(t.horas);
        stE.costo += costo;
      }
    });

    const pctFacturable = (horasFacturables + horasInternas) > 0 ? (horasFacturables / (horasFacturables + horasInternas)) * 100 : 0;
    const margenBruto = ingresosMensuales - costoStd;

    // Convert stats maps to arrays
    const listClientes = Array.from(statsCliente.entries()).map(([k, v]) => ({
      cliente: k,
      linea: v.linea,
      ingresos: v.ingresos,
      horas: v.horas,
      costo: v.costo,
      margen: v.ingresos - v.costo,
      margen_pct: v.ingresos > 0 ? ((v.ingresos - v.costo) / v.ingresos) * 100 : 0
    })).sort((a, b) => b.margen - a.margen);

    const listEquipo = Array.from(statsEquipo.entries()).map(([k, v]) => {
      const hTot = v.horasFact + v.horasInt;
      return {
        nombre: k,
        horas: hTot,
        horas_fact: v.horasFact,
        pct_fact: hTot > 0 ? (v.horasFact / hTot) * 100 : 0,
        tarifa: v.tarifa,
        imputado: v.costo,
        sueldo: v.sueldo,
        ajuste: v.es_socio ? 0 : v.costo - v.sueldo,
        costo_real: hTot > 0 && !v.es_socio ? v.sueldo / hTot : 0,
        es_socio: v.es_socio
      };
    });

    return { ingresosMensuales, horasFacturables, horasInternas, pctFacturable, costoStd, margenBruto, listClientes, listEquipo };
  }, [mesSel, lineaSel, clientes, equipo, tiempos]);

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-axia-blue">💰 Rentabilidad</h1>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6 flex items-center gap-6">
        <div>
          <label className="block text-xs font-bold text-axia-gray uppercase mb-1">Mes</label>
          <input type="month" value={mesSel} onChange={e => setMesSel(e.target.value)} className="border border-gray-200 rounded-lg p-2 outline-none focus:border-axia-teal font-bold" />
        </div>
        <div>
          <label className="block text-xs font-bold text-axia-gray uppercase mb-1">Centro de Costos</label>
          <div className="flex gap-2">
            {["Todas", "Estudio Contable", "Consultoría CFO"].map(opt => (
              <button 
                key={opt} onClick={() => setLineaSel(opt)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${lineaSel === opt ? "bg-axia-blue text-white" : "bg-slate-100 text-axia-gray hover:bg-slate-200"}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-axia-gray uppercase tracking-wider">Ingresos</p>
          <p className="text-3xl font-bold text-axia-blue mt-1">$ {calc.ingresosMensuales.toLocaleString("es-AR")}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-axia-gray uppercase tracking-wider">% Horas Facturables</p>
          <p className="text-3xl font-bold text-axia-teal mt-1">{calc.pctFacturable.toFixed(0)}%</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-axia-gray uppercase tracking-wider">Margen Bruto Std</p>
          <p className={`text-3xl font-bold mt-1 ${calc.margenBruto >= 0 ? "text-emerald-600" : "text-rose-500"}`}>$ {calc.margenBruto.toLocaleString("es-AR")}</p>
          <p className="text-xs text-axia-gray mt-1">{calc.ingresosMensuales ? ((calc.margenBruto / calc.ingresosMensuales) * 100).toFixed(0) : 0}% s/ Ingresos</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 opacity-70">
          <p className="text-xs font-bold text-axia-gray uppercase tracking-wider">Resultado Final</p>
          <p className="text-sm font-bold mt-1 text-gray-400 italic">Requiere módulo de Costos</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button onClick={() => setActiveTab("cliente")} className={`pb-3 px-4 font-bold text-sm transition-colors relative ${activeTab === "cliente" ? "text-axia-blue" : "text-gray-400 hover:text-gray-600"}`}>
          <span className="flex items-center gap-2"><Briefcase size={18}/> Por Cliente</span>
          {activeTab === "cliente" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-axia-blue rounded-t-full"></div>}
        </button>
        <button onClick={() => setActiveTab("equipo")} className={`pb-3 px-4 font-bold text-sm transition-colors relative ${activeTab === "equipo" ? "text-axia-blue" : "text-gray-400 hover:text-gray-600"}`}>
          <span className="flex items-center gap-2"><Users size={18}/> Equipo</span>
          {activeTab === "equipo" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-axia-blue rounded-t-full"></div>}
        </button>
      </div>

      {/* Por Cliente */}
      {activeTab === "cliente" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-in slide-in-from-right-2 duration-300">
          <div className="p-4 border-b border-gray-100 bg-slate-50"><p className="text-sm text-axia-gray font-medium">Margen de rentabilidad calculado cliente por cliente (Ingresos - Costo Horas).</p></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-100 text-axia-gray text-[10px] tracking-wider uppercase font-bold">
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Línea</th>
                  <th className="p-4 text-right">Ingresos</th>
                  <th className="p-4 text-center">Hs</th>
                  <th className="p-4 text-right">Costo Std</th>
                  <th className="p-4 text-right">Margen $</th>
                  <th className="p-4 text-right">Margen %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {calc.listClientes.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-axia-dark">{c.cliente}</td>
                    <td className="p-4 text-axia-gray">{c.linea}</td>
                    <td className="p-4 text-right font-medium">$ {c.ingresos.toLocaleString("es-AR")}</td>
                    <td className="p-4 text-center text-axia-teal font-bold">{c.horas.toFixed(1)}</td>
                    <td className="p-4 text-right text-rose-500 font-medium">$ {c.costo.toLocaleString("es-AR")}</td>
                    <td className={`p-4 text-right font-bold ${c.margen >= 0 ? "text-emerald-600" : "text-rose-500"}`}>$ {c.margen.toLocaleString("es-AR")}</td>
                    <td className="p-4 text-right font-bold">{c.margen_pct.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Equipo */}
      {activeTab === "equipo" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-in slide-in-from-left-2 duration-300">
          <div className="p-4 border-b border-gray-100 bg-slate-50"><p className="text-sm text-axia-gray font-medium">Análisis de horas facturables y costos imputados por persona.</p></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-100 text-axia-gray text-[10px] tracking-wider uppercase font-bold">
                  <th className="p-4">Persona</th>
                  <th className="p-4 text-center">Hs Totales</th>
                  <th className="p-4 text-center">Hs Facturables</th>
                  <th className="p-4 text-center">% Facturable</th>
                  <th className="p-4 text-right">Tarifa/h</th>
                  <th className="p-4 text-right">Imputado a Clientes</th>
                  <th className="p-4 text-right">Sueldo Real</th>
                  <th className="p-4 text-right">Ajuste</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {calc.listEquipo.map((e, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-axia-dark">{e.nombre} {e.es_socio && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded ml-2">SOCIO</span>}</td>
                    <td className="p-4 text-center font-bold text-axia-teal">{e.horas.toFixed(1)}</td>
                    <td className="p-4 text-center font-medium">{e.horas_fact.toFixed(1)}</td>
                    <td className="p-4 text-center font-medium">{e.pct_fact.toFixed(0)}%</td>
                    <td className="p-4 text-right text-gray-500">$ {e.tarifa.toLocaleString("es-AR")}</td>
                    <td className="p-4 text-right font-medium">$ {e.imputado.toLocaleString("es-AR")}</td>
                    <td className="p-4 text-right font-medium text-rose-500">$ {e.sueldo.toLocaleString("es-AR")}</td>
                    <td className={`p-4 text-right font-bold ${e.ajuste >= 0 ? "text-emerald-600" : "text-rose-500"}`}>$ {e.ajuste.toLocaleString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
