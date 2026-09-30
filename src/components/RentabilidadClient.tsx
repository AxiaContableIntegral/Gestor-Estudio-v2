"use client";

import { useState, useMemo, useEffect } from "react";
import { Calculator, Calendar, DollarSign, Users, Briefcase, TrendingUp, Receipt, Plus, Copy, CheckCircle2, Save, Trash2, Download, Lock, Unlock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

export default function RentabilidadClient({ clientes, tareas, equipo, tiempos, costos, parametros, cobranzas_unicas, cobros, cierres }: any) {
  const router = useRouter();
  const [mesSel, setMesSel] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [lineaSel, setLineaSel] = useState("Todas");
  const [activeTab, setActiveTab] = useState("cobranzas");
  
  // Modals / State for forms
  const [isAddingCosto, setIsAddingCosto] = useState(false);
  const [newCosto, setNewCosto] = useState({ concepto: "", categoria: "Otros", moneda: "ARS", monto: "", recurrente: "No", nota: "" });
  
  const [isAddingCobranza, setIsAddingCobranza] = useState(false);
  const [newCobranza, setNewCobranza] = useState({ fecha: mesSel + "-01", cliente_linea: "", concepto: "", monto: "", id_tarea: "" });

  const [tcUSD, setTcUSD] = useState("");

  useEffect(() => {
    const param = parametros.find((p: any) => p.clave === "Tipo_Cambio_USD");
    if (param) setTcUSD(param.valor);
  }, [parametros]);

  const saveTC = async () => {
    const param = parametros.find((p: any) => p.clave === "Tipo_Cambio_USD");
    if (param) {
      await supabase.from("parametros").update({ valor: tcUSD }).eq("clave", "Tipo_Cambio_USD");
    } else {
      await supabase.from("parametros").insert([{ clave: "Tipo_Cambio_USD", valor: tcUSD }]);
    }
    toast.success("Tipo de cambio guardado");
    router.refresh();
  };

  const isInterno = (cName: string) => {
    const c = clientes.find((cl: any) => cl.cliente === cName);
    if (c && c.tipo_honorario === "Interno") return true;
    if (cName && cName.toLowerCase().includes("interno")) return true;
    return false;
  };

  const calc = useMemo(() => {
    let missingTarifa: string[] = [];

    const tc = Number(tcUSD) || 0;
    const tMes = tiempos.filter((t: any) => t.fecha_trabajo && t.fecha_trabajo.startsWith(mesSel));
    const cuMes = cobranzas_unicas.filter((cu: any) => cu.fecha && cu.fecha.startsWith(mesSel));
    const costosMes = costos.filter((c: any) => c.mes === mesSel);

    const isCerradoObj = cierres.find((c: any) => c.mes === mesSel && c.linea === lineaSel);
    const isMesCerrado = isCerradoObj != null;

    const tMesEnriquecido = tMes.map((t: any) => {
      const tarea = tareas.find((ta: any) => ta.id === t.id_tarea);
      return { ...t, 
        cliente: tarea ? tarea.cliente : t.cliente,
        linea_negocio: tarea ? tarea.linea_negocio : "", 
        persona: t.persona || (tarea ? tarea.responsable : "") 
      };
    });

    const equipoMap = new Map();
    equipo.forEach((e: any) => {
      equipoMap.set(e.persona, {
        ...e,
        tarifa: Number(e.tarifa_hora),
        sueldo: Number(e.sueldo_mensual),
        es_socio: e.es_socio === "Si" || e.es_socio === true,
        horas_fact_totales: 0,
        horas_fact_linea: 0,
        horas_int_totales: 0,
        horas_int_linea: 0,
        imputado_fact_totales: 0,
        imputado_fact_linea: 0,
        imputado_int_totales: 0,
        imputado_int_linea: 0
      });
    });

    let horas_fact_totales = 0;
    let horas_fact_linea = 0;

    tMesEnriquecido.forEach((t: any) => {
      const h = Number(t.horas) || 0;
      const interno = isInterno(t.cliente);
      
      if (!equipoMap.has(t.persona)) {
        if (t.persona && !missingTarifa.includes(t.persona)) missingTarifa.push(t.persona);
        return;
      }
      
      const eInfo = equipoMap.get(t.persona);
      const costo = h * eInfo.tarifa;

      if (interno) {
        eInfo.horas_int_totales += h;
        eInfo.imputado_int_totales += costo;
        if (lineaSel === "Todas" || t.linea_negocio === lineaSel) {
           eInfo.horas_int_linea += h;
           eInfo.imputado_int_linea += costo;
        }
      } else {
        eInfo.horas_fact_totales += h;
        horas_fact_totales += h;
        eInfo.imputado_fact_totales += costo;
        if (lineaSel === "Todas" || t.linea_negocio === lineaSel) {
           eInfo.horas_fact_linea += h;
           horas_fact_linea += h;
           eInfo.imputado_fact_linea += costo;
        }
      }
    });

    let propFijos = lineaSel === "Todas" ? 1 : (horas_fact_totales > 0 ? (horas_fact_linea / horas_fact_totales) : 0.5);

    let ingresosMensualesLinea = 0;
    clientes.forEach((c: any) => {
      if (c.tipo_honorario === "Mensual" && Number(c.ultima_cobranza_monto) > 0 && !isInterno(c.cliente)) {
        if (lineaSel === "Todas" || c.linea_negocio === lineaSel) {
           ingresosMensualesLinea += Number(c.ultima_cobranza_monto);
        }
      }
    });

    let ingresosUnicosLinea = 0;
    cuMes.forEach((cu: any) => {
      if (lineaSel === "Todas" || cu.linea_negocio === lineaSel) {
         ingresosUnicosLinea += Number(cu.monto);
      }
    });

    const ingresos = ingresosMensualesLinea + ingresosUnicosLinea;

    let costoStdLinea = 0;
    let costoInternasTotal = 0;
    let revSocioTotal = 0;
    let ajusteLinea = 0;

    equipoMap.forEach((eInfo) => {
      costoStdLinea += eInfo.imputado_fact_linea;
      costoInternasTotal += eInfo.imputado_int_totales;

      const imputado_total_emp = eInfo.imputado_fact_totales + eInfo.imputado_int_totales;
      const imputado_linea_emp = eInfo.imputado_fact_linea + eInfo.imputado_int_linea;

      if (eInfo.es_socio) {
        revSocioTotal += imputado_total_emp;
      } else {
        let propSueldo = 0;
        if (lineaSel === "Todas") {
          propSueldo = 1;
        } else {
          propSueldo = eInfo.horas_fact_totales > 0 ? (eInfo.horas_fact_linea / eInfo.horas_fact_totales) : propFijos;
        }
        const sueldoLinea = eInfo.sueldo * propSueldo;
        ajusteLinea += (imputado_linea_emp - sueldoLinea);
      }
    });

    const costoInternasLinea = costoInternasTotal * propFijos;
    const revSocioLinea = revSocioTotal * propFijos;

    let fijosTotal = 0;
    costosMes.forEach((c: any) => {
      let m = Number(c.monto);
      if (c.moneda === "USD") m *= tc;
      fijosTotal += m;
    });
    const fijosLinea = fijosTotal * propFijos;

    const margenBruto = ingresos - costoStdLinea;
    const resultado = margenBruto - costoInternasLinea - ajusteLinea + revSocioLinea - fijosLinea;

    // Control de cobranzas
    const ctrlCobranzas: any[] = [];
    clientes.filter((c: any) => c.tipo_honorario === "Mensual" && Number(c.ultima_cobranza_monto) > 0 && !isInterno(c.cliente)).forEach((c: any) => {
      if (lineaSel !== "Todas" && c.linea_negocio !== lineaSel) return;
      const db = cobros.find((cb: any) => cb.mes === mesSel && cb.cliente === c.cliente && cb.linea_negocio === c.linea_negocio && cb.concepto === "Honorario Mensual");
      ctrlCobranzas.push(db ? { ...db, _isSaved: true } : { mes: mesSel, cliente: c.cliente, linea_negocio: c.linea_negocio, concepto: "Honorario Mensual", devengado: Number(c.ultima_cobranza_monto), cobrado: "No", fecha: null, _isSaved: false });
    });
    cuMes.forEach((cu: any) => {
      if (lineaSel !== "Todas" && cu.linea_negocio !== lineaSel) return;
      const db = cobros.find((cb: any) => cb.mes === mesSel && cb.cliente === cu.cliente && cb.linea_negocio === cu.linea_negocio && cb.concepto === cu.concepto);
      ctrlCobranzas.push(db ? { ...db, _isSaved: true } : { mes: mesSel, cliente: cu.cliente, linea_negocio: cu.linea_negocio, concepto: cu.concepto, devengado: Number(cu.monto), cobrado: "Si", fecha: cu.fecha, _isSaved: false });
    });

    const totDevengado = ctrlCobranzas.reduce((a, b) => a + b.devengado, 0);
    const totCobrado = ctrlCobranzas.filter(c => c.cobrado === "Si" || c.cobrado === true).reduce((a, b) => a + b.devengado, 0);
    const totPendiente = totDevengado - totCobrado;

    const cobrosHastaMes = cobros.filter((c: any) => c.mes <= mesSel && (c.cobrado === "No" || c.cobrado === false));
    const cobrosViejos = cobrosHastaMes.filter((c: any) => c.mes < mesSel);
    const acumPendiente = cobrosViejos.reduce((a: any, b: any) => a + Number(b.devengado), 0) + totPendiente;

    // Por cliente
    const pClienteMap = new Map();
    clientes.forEach((c: any) => {
      if (isInterno(c.cliente) || (lineaSel !== "Todas" && c.linea_negocio !== lineaSel)) return;
      const key = c.cliente + "|||" + c.linea_negocio;
      pClienteMap.set(key, { cliente: c.cliente, linea: c.linea_negocio, hm: 0, cu: 0, hs: 0, costo: 0 });
      if (c.tipo_honorario === "Mensual") {
         pClienteMap.get(key).hm = Number(c.ultima_cobranza_monto);
      }
    });
    cuMes.forEach((cu: any) => {
      if (lineaSel !== "Todas" && cu.linea_negocio !== lineaSel) return;
      const key = cu.cliente + "|||" + cu.linea_negocio;
      if (!pClienteMap.has(key)) pClienteMap.set(key, { cliente: cu.cliente, linea: cu.linea_negocio, hm: 0, cu: 0, hs: 0, costo: 0 });
      pClienteMap.get(key).cu += Number(cu.monto);
    });
    tMesEnriquecido.forEach((t: any) => {
      if (isInterno(t.cliente) || (lineaSel !== "Todas" && t.linea_negocio !== lineaSel)) return;
      const key = t.cliente + "|||" + t.linea_negocio;
      if (!pClienteMap.has(key)) pClienteMap.set(key, { cliente: t.cliente, linea: t.linea_negocio, hm: 0, cu: 0, hs: 0, costo: 0 });
      const eInfo = equipoMap.get(t.persona);
      if (eInfo) {
        pClienteMap.get(key).hs += Number(t.horas);
        pClienteMap.get(key).costo += Number(t.horas) * eInfo.tarifa;
      }
    });

    const pCliente = Array.from(pClienteMap.values()).map(p => {
       const ing = p.hm + p.cu;
       const margen = ing - p.costo;
       const margenPct = ing > 0 ? (margen / ing) * 100 : 0;
       return { ...p, ing, margen, margenPct };
    }).sort((a, b) => a.linea.localeCompare(b.linea) || b.margen - a.margen);

    const intPorPersona = Array.from(equipoMap.values()).map(e => ({ persona: e.persona, hsInt: e.horas_int_totales }));

    // Equipo Stats
    const pEquipo = Array.from(equipoMap.values()).map(e => {
       const hsTot = e.horas_fact_totales + e.horas_int_totales;
       const pctF = hsTot > 0 ? (e.horas_fact_totales / hsTot) * 100 : 0;
       const impFact = e.imputado_fact_totales;
       const impTot = e.imputado_fact_totales + e.imputado_int_totales;
       const ajuste = e.es_socio ? 0 : impTot - e.sueldo;
       const costoReal = (hsTot > 0 && !e.es_socio) ? e.sueldo / hsTot : 0;
       return { ...e, hsTot, pctF, impFact, impTot, ajuste, costoReal };
    });

    return {
      ingresosMensualesLinea, ingresosUnicosLinea, ingresos,
      costoStdLinea, margenBruto,
      costoInternasLinea, ajusteLinea, revSocioLinea, fijosLinea, resultado,
      ctrlCobranzas, totDevengado, totCobrado, totPendiente, acumPendiente,
      pCliente, intPorPersona, pEquipo, cuMes, costosMes, isMesCerrado, isCerradoObj, missingTarifa
    };
  }, [mesSel, lineaSel, clientes, tareas, equipo, tiempos, costos, cobranzas_unicas, cobros, cierres, tcUSD]);

  useEffect(() => {
    if (calc.missingTarifa.length > 0) {
      toast.warning("Personas sin tarifa: " + calc.missingTarifa.join(", "));
    }
  }, [calc.missingTarifa]);

  // Actions
  const guardarCobro = async (c: any, pagado: boolean, fechaVal: string) => {
    let f = fechaVal;
    if (pagado && !f) {
      f = new Date().toISOString().split("T")[0];
    } else if (!pagado) {
      f = "";
    }
    const payload = {
      mes: c.mes, cliente: c.cliente, linea_negocio: c.linea_negocio, concepto: c.concepto,
      devengado: c.devengado, cobrado: pagado ? "Si" : "No", fecha: f || null
    };
    if (c._isSaved && c.id) {
      await supabase.from("cobros").update(payload).eq("id", c.id);
    } else {
      await supabase.from("cobros").insert([payload]);
    }
    router.refresh();
  };

  const guardarEquipo = async (e: any, prop: string, val: any) => {
    await supabase.from("equipo").update({ [prop]: val }).eq("persona", e.persona);
    router.refresh();
  };

  const guardarCosto = async () => {
    if (!newCosto.concepto || !newCosto.monto) return;
    await supabase.from("costos").insert([{ ...newCosto, mes: mesSel, monto: parseFloat(newCosto.monto) }]);
    setIsAddingCosto(false);
    setNewCosto({ concepto: "", categoria: "Otros", moneda: "ARS", monto: "", recurrente: "No", nota: "" });
    router.refresh();
  };

  const eliminarCosto = async (id: string) => {
    if (confirm("Eliminar costo?")) {
      await supabase.from("costos").delete().eq("id", id);
      router.refresh();
    }
  };

  const copiarFijos = async () => {
    const [y, m] = mesSel.split("-").map(Number);
    let pm = m - 1; let py = y; if (pm === 0) { pm = 12; py--; }
    const pMes = `${py}-${String(pm).padStart(2, "0")}`;
    
    const pCostos = costos.filter((c: any) => c.mes === pMes && c.recurrente === "Si");
    for (const c of pCostos) {
      if (!calc.costosMes.some((cm: any) => cm.concepto === c.concepto)) {
        let nota = c.nota;
        let monto = c.monto;
        if (c.concepto.toLowerCase().includes("fondo fijo")) {
          monto = 200000;
          nota = "Estimado: reemplazar por la reposición real";
        }
        await supabase.from("costos").insert([{ mes: mesSel, concepto: c.concepto, categoria: c.categoria, moneda: c.moneda, monto, recurrente: "Si", nota }]);
      }
    }
    toast.success("Costos recurrentes copiados");
    router.refresh();
  };

  const guardarCobranzaUnica = async () => {
    const [cName, lName] = newCobranza.cliente_linea.split("|||");
    await supabase.from("cobranzas_unicas").insert([{
      fecha: newCobranza.fecha, cliente: cName, linea_negocio: lName, concepto: newCobranza.concepto, monto: parseFloat(newCobranza.monto), id_tarea: newCobranza.id_tarea || null
    }]);
    setIsAddingCobranza(false);
    router.refresh();
  };

  const eliminarCobranzaUnica = async (id: string) => {
    if (confirm("Eliminar?")) {
      await supabase.from("cobranzas_unicas").delete().eq("id", id);
      router.refresh();
    }
  };

  const toggleCierre = async () => {
    if (calc.isMesCerrado) {
      if (confirm("¿Reabrir el mes para todas las líneas?")) {
        await supabase.from("cierres").delete().eq("mes", mesSel);
        toast.success("Mes reabierto para todas las lineas");
        router.refresh();
      }
    } else {
      if (costos.some((c: any) => c.mes === mesSel && c.moneda === "USD") && !tcUSD) {
        toast.error("Falta cargar tipo de cambio USD para cerrar el mes");
        return;
      }

      if (!confirm("¿Cerrar el mes y congelar resultados para todas las líneas?")) return;
      
      const tc = Number(tcUSD) || 0;
      const tMes = tiempos.filter((t: any) => t.fecha_trabajo && t.fecha_trabajo.startsWith(mesSel));
      const cuMes = cobranzas_unicas.filter((cu: any) => cu.fecha && cu.fecha.startsWith(mesSel));
      const costosMes = costos.filter((c: any) => c.mes === mesSel);

      const tMesEnriquecido = tMes.map((t: any) => {
        const tarea = tareas.find((ta: any) => ta.id === t.id_tarea);
        return { ...t, 
          cliente: tarea ? tarea.cliente : t.cliente,
          linea_negocio: tarea ? tarea.linea_negocio : "", 
          persona: t.persona || (tarea ? tarea.responsable : "") 
        };
      });

      const lineasToClose = ["Todas", "Estudio Contable", "Consultoría CFO"];
      const payloads = [];

      for (const lineaT of lineasToClose) {
        const equipoMap = new Map();
        equipo.forEach((e: any) => {
          equipoMap.set(e.persona, { ...e, tarifa: Number(e.tarifa_hora), sueldo: Number(e.sueldo_mensual), es_socio: e.es_socio === "Si" || e.es_socio === true, horas_fact_totales: 0, horas_fact_linea: 0, horas_int_totales: 0, horas_int_linea: 0, imputado_fact_totales: 0, imputado_fact_linea: 0, imputado_int_totales: 0, imputado_int_linea: 0 });
        });

        let horas_fact_totales = 0;
        let horas_fact_linea = 0;

        tMesEnriquecido.forEach((t: any) => {
          if (!equipoMap.has(t.persona)) return;
          const h = Number(t.horas) || 0;
          const interno = isInterno(t.cliente);
          const eInfo = equipoMap.get(t.persona);
          const costo = h * eInfo.tarifa;

          if (interno) {
            eInfo.horas_int_totales += h; eInfo.imputado_int_totales += costo;
            if (lineaT === "Todas" || t.linea_negocio === lineaT) { eInfo.horas_int_linea += h; eInfo.imputado_int_linea += costo; }
          } else {
            eInfo.horas_fact_totales += h; horas_fact_totales += h; eInfo.imputado_fact_totales += costo;
            if (lineaT === "Todas" || t.linea_negocio === lineaT) { eInfo.horas_fact_linea += h; horas_fact_linea += h; eInfo.imputado_fact_linea += costo; }
          }
        });

        let propFijos = lineaT === "Todas" ? 1 : (horas_fact_totales > 0 ? (horas_fact_linea / horas_fact_totales) : 0.5);

        let hmLinea = 0;
        clientes.forEach((c: any) => {
          if (c.tipo_honorario === "Mensual" && Number(c.ultima_cobranza_monto) > 0 && !isInterno(c.cliente)) {
            if (lineaT === "Todas" || c.linea_negocio === lineaT) hmLinea += Number(c.ultima_cobranza_monto);
          }
        });

        let cuLinea = 0;
        cuMes.forEach((cu: any) => {
          if (lineaT === "Todas" || cu.linea_negocio === lineaT) cuLinea += Number(cu.monto);
        });

        const ingresos = hmLinea + cuLinea;
        let costoStdLinea = 0; let costoInternasTotal = 0; let revSocioTotal = 0; let ajusteLinea = 0;

        equipoMap.forEach((eInfo) => {
          costoStdLinea += eInfo.imputado_fact_linea;
          costoInternasTotal += eInfo.imputado_int_totales;
          const imp_tot = eInfo.imputado_fact_totales + eInfo.imputado_int_totales;
          const imp_lin = eInfo.imputado_fact_linea + eInfo.imputado_int_linea;

          if (eInfo.es_socio) revSocioTotal += imp_tot;
          else {
            let propSueldo = lineaT === "Todas" ? 1 : (eInfo.horas_fact_totales > 0 ? (eInfo.horas_fact_linea / eInfo.horas_fact_totales) : propFijos);
            ajusteLinea += (imp_lin - (eInfo.sueldo * propSueldo));
          }
        });

        const costoInternasLinea = costoInternasTotal * propFijos;
        const revSocioLinea = revSocioTotal * propFijos;
        let fijosTotal = 0;
        costosMes.forEach((c: any) => { let m = Number(c.monto); if (c.moneda === "USD") m *= tc; fijosTotal += m; });
        const fijosLinea = fijosTotal * propFijos;

        const margen_std = ingresos - costoStdLinea;
        const resultado = margen_std - costoInternasLinea - ajusteLinea + revSocioLinea - fijosLinea;

        payloads.push({
           mes: mesSel, linea: lineaT,
           mensual: hmLinea, unica: cuLinea, ingresos,
           costo_std: costoStdLinea, margen_std,
           costo_int: costoInternasLinea, ajuste: ajusteLinea, reversion: revSocioLinea, fijos: fijosLinea,
           resultado, cerrado_en: new Date().toISOString()
        });
      }
      
      await supabase.from("cierres").insert(payloads);
      toast.success("Mes cerrado para todas las líneas");
      router.refresh();
    }
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    
    const wsER = XLSX.utils.json_to_sheet([
      { Concepto: "1. Honorarios mensuales", Monto: calc.ingresosMensualesLinea },
      { Concepto: "2. Cobranzas únicas", Monto: calc.ingresosUnicosLinea },
      { Concepto: "3. INGRESOS", Monto: calc.ingresos },
      { Concepto: "4. Costo std clientes", Monto: -calc.costoStdLinea },
      { Concepto: "5. MARGEN BRUTO ESTÁNDAR", Monto: calc.margenBruto },
      { Concepto: "6. Costo horas internas", Monto: -calc.costoInternasLinea },
      { Concepto: "7. Ajuste mano de obra", Monto: -calc.ajusteLinea },
      { Concepto: "8. Reversión socio", Monto: calc.revSocioLinea },
      { Concepto: "9. Costos fijos", Monto: -calc.fijosLinea },
      { Concepto: "10. RESULTADO ANTES RETIRO", Monto: calc.resultado }
    ]);
    XLSX.utils.book_append_sheet(wb, wsER, "Estado de Resultados");

    const wsCC = XLSX.utils.json_to_sheet(calc.ctrlCobranzas);
    XLSX.utils.book_append_sheet(wb, wsCC, "Control de cobranzas");

    const wsPC = XLSX.utils.json_to_sheet(calc.pCliente);
    XLSX.utils.book_append_sheet(wb, wsPC, "Por cliente");

    const wsEq = XLSX.utils.json_to_sheet(calc.pEquipo);
    XLSX.utils.book_append_sheet(wb, wsEq, "Equipo");

    const wsCF = XLSX.utils.json_to_sheet(calc.costosMes);
    XLSX.utils.book_append_sheet(wb, wsCF, "Costos fijos");

    const wsCU = XLSX.utils.json_to_sheet(calc.cuMes);
    XLSX.utils.book_append_sheet(wb, wsCU, "Cobranzas unicas");

    XLSX.writeFile(wb, `Rentabilidad_${mesSel}_${lineaSel}.xlsx`);
  };

  const renderMoney = (val: number) => {
    const isNeg = val < 0;
    return <span className={isNeg ? "text-rose-600" : ""}>{isNeg ? "-" : ""}$ {Math.abs(val).toLocaleString("es-AR", {maximumFractionDigits:0})}</span>;
  };

  const renderPct = (val: number, base: number) => {
    if (base === 0) return "0%";
    return ((val / base) * 100).toFixed(1) + "%";
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-axia-blue">Gestor: Estado de Resultados</h1>
        <div className="flex gap-2">
           <button onClick={exportExcel} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold"><Download size={18}/> Excel</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6 flex items-center justify-between gap-6">
        <div className="flex gap-6">
          <div>
            <label className="block text-xs font-bold text-axia-gray uppercase mb-1">Mes</label>
            <input type="month" value={mesSel} onChange={e => setMesSel(e.target.value)} className="border border-gray-200 rounded-lg p-2 outline-none font-bold text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-axia-gray uppercase mb-1">Centro de Costos</label>
            <select value={lineaSel} onChange={e => setLineaSel(e.target.value)} className="border border-gray-200 rounded-lg p-2 outline-none font-bold text-sm">
              <option value="Todas">Todas</option>
              <option value="Estudio Contable">Estudio Contable</option>
              <option value="Consultoría CFO">Consultoría CFO</option>
            </select>
          </div>
        </div>
        <div>
           <button onClick={toggleCierre} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-white text-sm ${calc.isMesCerrado ? 'bg-amber-500' : 'bg-axia-blue'}`}>
             {calc.isMesCerrado ? <><Unlock size={18}/> Reabrir Mes</> : <><Lock size={18}/> Cerrar Mes</>}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"><p className="text-xs font-bold text-axia-gray uppercase">Ingresos</p><p className="text-2xl font-bold text-axia-blue">{calc.isCerradoObj ? renderMoney(calc.isCerradoObj.ingresos) : renderMoney(calc.ingresos)}</p><p className="text-xs text-axia-gray mt-1">{calc.isMesCerrado ? "Cerrado" : `${renderPct(calc.pEquipo.reduce((a,b)=>a+b.horas_fact_totales,0), calc.pEquipo.reduce((a,b)=>a+b.hsTot,0))} hs facturables`}</p></div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"><p className="text-xs font-bold text-axia-gray uppercase">Margen Bruto Std</p><p className="text-2xl font-bold">{calc.isCerradoObj ? renderMoney(calc.isCerradoObj.margen_std) : renderMoney(calc.margenBruto)}</p><p className="text-xs text-axia-gray mt-1">{renderPct(calc.isCerradoObj ? calc.isCerradoObj.margen_std : calc.margenBruto, calc.isCerradoObj ? calc.isCerradoObj.ingresos : calc.ingresos)} s/ ingresos</p></div>
        <div className="bg-axia-blue rounded-xl p-5 shadow-sm text-white md:col-span-2"><p className="text-xs font-bold text-blue-200 uppercase">Resultado Antes de Retiro</p><p className="text-2xl font-bold">{calc.isCerradoObj ? renderMoney(calc.isCerradoObj.resultado) : renderMoney(calc.resultado)}</p><p className="text-xs text-blue-200 mt-1">{renderPct(calc.isCerradoObj ? calc.isCerradoObj.resultado : calc.resultado, calc.isCerradoObj ? calc.isCerradoObj.ingresos : calc.ingresos)} s/ ingresos</p></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8 relative">
        {calc.isMesCerrado && <div className="absolute top-3 right-4 bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded">Mes Cerrado (Datos congelados)</div>}
        <div className="p-4 border-b border-gray-100 bg-slate-50"><h3 className="font-bold text-axia-dark">Estado de Resultados</h3></div>
        <table className="w-full text-left border-collapse text-sm">
          <tbody className="divide-y divide-gray-100">
            <tr className="hover:bg-slate-50"><td className="p-3 w-12 text-center text-gray-400">1</td><td className="p-3">Honorarios mensuales devengados</td><td className="p-3 text-right font-medium">{renderMoney(calc.isCerradoObj ? calc.isCerradoObj.mensual : calc.ingresosMensualesLinea)}</td><td className="p-3 text-right text-gray-500 w-24">{renderPct(calc.isCerradoObj ? calc.isCerradoObj.mensual : calc.ingresosMensualesLinea, calc.isCerradoObj ? calc.isCerradoObj.ingresos : calc.ingresos)}</td></tr>
            <tr className="hover:bg-slate-50"><td className="p-3 w-12 text-center text-gray-400">2</td><td className="p-3">Cobranzas únicas</td><td className="p-3 text-right font-medium">{renderMoney(calc.isCerradoObj ? calc.isCerradoObj.unica : calc.ingresosUnicosLinea)}</td><td className="p-3 text-right text-gray-500">{renderPct(calc.isCerradoObj ? calc.isCerradoObj.unica : calc.ingresosUnicosLinea, calc.isCerradoObj ? calc.isCerradoObj.ingresos : calc.ingresos)}</td></tr>
            <tr className="bg-blue-50 font-bold"><td className="p-3 w-12 text-center text-blue-400">3</td><td className="p-3 text-axia-blue">INGRESOS</td><td className="p-3 text-right text-axia-blue">{renderMoney(calc.isCerradoObj ? calc.isCerradoObj.ingresos : calc.ingresos)}</td><td className="p-3 text-right text-blue-400">100.0%</td></tr>
            <tr className="hover:bg-slate-50"><td className="p-3 w-12 text-center text-gray-400">4</td><td className="p-3">Costo de horas en clientes (std)</td><td className="p-3 text-right font-medium">{renderMoney(-(calc.isCerradoObj ? calc.isCerradoObj.costo_std : calc.costoStdLinea))}</td><td className="p-3 text-right text-gray-500">{renderPct(-(calc.isCerradoObj ? calc.isCerradoObj.costo_std : calc.costoStdLinea), calc.isCerradoObj ? calc.isCerradoObj.ingresos : calc.ingresos)}</td></tr>
            <tr className="bg-slate-100 font-bold"><td className="p-3 w-12 text-center text-gray-500">5</td><td className="p-3">MARGEN BRUTO ESTÁNDAR</td><td className="p-3 text-right">{renderMoney(calc.isCerradoObj ? calc.isCerradoObj.margen_std : calc.margenBruto)}</td><td className="p-3 text-right text-gray-500">{renderPct(calc.isCerradoObj ? calc.isCerradoObj.margen_std : calc.margenBruto, calc.isCerradoObj ? calc.isCerradoObj.ingresos : calc.ingresos)}</td></tr>
            <tr className="hover:bg-slate-50"><td className="p-3 w-12 text-center text-gray-400">6</td><td className="p-3">Costo de horas internas</td><td className="p-3 text-right font-medium">{renderMoney(-(calc.isCerradoObj ? calc.isCerradoObj.costo_int : calc.costoInternasLinea))}</td><td className="p-3 text-right text-gray-500">{renderPct(-(calc.isCerradoObj ? calc.isCerradoObj.costo_int : calc.costoInternasLinea), calc.isCerradoObj ? calc.isCerradoObj.ingresos : calc.ingresos)}</td></tr>
            <tr className="hover:bg-slate-50"><td className="p-3 w-12 text-center text-gray-400">7</td><td className="p-3">Ajuste de mano de obra</td><td className="p-3 text-right font-medium">{renderMoney(-(calc.isCerradoObj ? calc.isCerradoObj.ajuste : calc.ajusteLinea))}</td><td className="p-3 text-right text-gray-500">{renderPct(-(calc.isCerradoObj ? calc.isCerradoObj.ajuste : calc.ajusteLinea), calc.isCerradoObj ? calc.isCerradoObj.ingresos : calc.ingresos)}</td></tr>
            <tr className="hover:bg-slate-50"><td className="p-3 w-12 text-center text-gray-400">8</td><td className="p-3">Reversión horas del socio</td><td className="p-3 text-right font-medium">{renderMoney(calc.isCerradoObj ? calc.isCerradoObj.reversion : calc.revSocioLinea)}</td><td className="p-3 text-right text-gray-500">{renderPct(calc.isCerradoObj ? calc.isCerradoObj.reversion : calc.revSocioLinea, calc.isCerradoObj ? calc.isCerradoObj.ingresos : calc.ingresos)}</td></tr>
            <tr className="hover:bg-slate-50"><td className="p-3 w-12 text-center text-gray-400">9</td><td className="p-3">Costos fijos</td><td className="p-3 text-right font-medium">{renderMoney(-(calc.isCerradoObj ? calc.isCerradoObj.fijos : calc.fijosLinea))}</td><td className="p-3 text-right text-gray-500">{renderPct(-(calc.isCerradoObj ? calc.isCerradoObj.fijos : calc.fijosLinea), calc.isCerradoObj ? calc.isCerradoObj.ingresos : calc.ingresos)}</td></tr>
            <tr className="bg-axia-blue text-white font-bold text-lg"><td className="p-4 w-12 text-center text-blue-300">10</td><td className="p-4">RESULTADO ANTES DE RETIRO DEL SOCIO</td><td className="p-4 text-right">{renderMoney(calc.isCerradoObj ? calc.isCerradoObj.resultado : calc.resultado)}</td><td className="p-4 text-right text-blue-200 text-sm">{renderPct(calc.isCerradoObj ? calc.isCerradoObj.resultado : calc.resultado, calc.isCerradoObj ? calc.isCerradoObj.ingresos : calc.ingresos)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 mb-6 border-b border-gray-200">
        {[ {id:"cobranzas", label:"Control de cobranzas"}, {id:"cliente", label:"Por cliente"}, {id:"equipo", label:"Equipo"}, {id:"unicas", label:"Cobranzas únicas"}, {id:"fijos", label:"Costos fijos"} ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`pb-3 px-4 font-bold text-sm transition-colors relative ${activeTab === t.id ? "text-axia-blue" : "text-gray-400 hover:text-gray-600"}`}>
            {t.label} {activeTab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-axia-blue rounded-t-full"></div>}
          </button>
        ))}
      </div>

      {activeTab === "cobranzas" && (
        <div className="space-y-4">
           <div className="grid grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"><p className="text-xs text-axia-gray uppercase font-bold">Devengado Mes</p><p className="text-xl font-bold">{renderMoney(calc.totDevengado)}</p></div>
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"><p className="text-xs text-axia-gray uppercase font-bold">Cobrado Mes</p><p className="text-xl font-bold text-emerald-600">{renderMoney(calc.totCobrado)}</p></div>
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"><p className="text-xs text-axia-gray uppercase font-bold">Pendiente Mes</p><p className="text-xl font-bold text-amber-500">{renderMoney(calc.totPendiente)}</p><p className="text-xs text-gray-400 mt-1">{renderPct(calc.totCobrado, calc.totDevengado)} cobrado</p></div>
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"><p className="text-xs text-axia-gray uppercase font-bold">Pendiente Acumulado</p><p className="text-xl font-bold text-rose-500">{renderMoney(calc.acumPendiente)}</p></div>
           </div>
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <table className="w-full text-left text-sm">
               <thead className="bg-slate-50 border-b border-gray-100 text-axia-gray font-bold uppercase text-[10px]"><tr><th className="p-3">Cliente</th><th className="p-3">Linea</th><th className="p-3">Concepto</th><th className="p-3 text-right">Devengado</th><th className="p-3 text-center">¿Pagó?</th><th className="p-3">Fecha</th><th className="p-3"></th></tr></thead>
               <tbody className="divide-y divide-gray-50">
                 {calc.ctrlCobranzas.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-bold">{c.cliente}</td><td className="p-3 text-gray-500">{c.linea_negocio}</td><td className="p-3">{c.concepto}</td><td className="p-3 text-right font-medium">{renderMoney(c.devengado)}</td>
                      <td className="p-3 text-center"><input type="checkbox" checked={c.cobrado === "Si" || c.cobrado === true} onChange={e => { c.cobrado = e.target.checked; }} className="w-4 h-4 cursor-pointer"/></td>
                      <td className="p-3"><input type="date" defaultValue={c.fecha || ""} onChange={e => c.fecha = e.target.value} className="border p-1 rounded text-xs"/></td>
                      <td className="p-3"><button onClick={() => guardarCobro(c, c.cobrado === "Si" || c.cobrado === true, c.fecha)} className="text-axia-blue font-bold text-xs hover:underline">Guardar</button></td>
                    </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {activeTab === "cliente" && (
        <div className="space-y-6">
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <table className="w-full text-left text-sm">
               <thead className="bg-slate-50 border-b border-gray-100 text-axia-gray font-bold uppercase text-[10px]"><tr><th className="p-3">Cliente</th><th className="p-3">Línea</th><th className="p-3 text-right">Mensual</th><th className="p-3 text-right">Únicas</th><th className="p-3 text-right">Ingresos</th><th className="p-3 text-center">Hs</th><th className="p-3 text-right">Costo Hs</th><th className="p-3 text-right">Margen</th><th className="p-3 text-right">%</th></tr></thead>
               <tbody className="divide-y divide-gray-50">
                 {calc.pCliente.map((c:any, i:number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-bold">{c.cliente}</td><td className="p-3 text-gray-500">{c.linea}</td><td className="p-3 text-right">{renderMoney(c.hm)}</td><td className="p-3 text-right">{renderMoney(c.cu)}</td><td className="p-3 text-right font-bold text-axia-blue">{renderMoney(c.ing)}</td><td className="p-3 text-center font-medium">{c.hs.toFixed(1)}</td><td className="p-3 text-right text-rose-500">{renderMoney(c.costo)}</td><td className="p-3 text-right font-bold">{renderMoney(c.margen)}</td><td className="p-3 text-right font-bold">{c.margenPct.toFixed(0)}%</td>
                    </tr>
                 ))}
               </tbody>
             </table>
           </div>
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-1/2">
             <div className="p-3 bg-slate-50 border-b border-gray-100 font-bold text-sm text-axia-gray">Trabajo Interno por Persona</div>
             <table className="w-full text-sm">
               <tbody className="divide-y divide-gray-50">
                 {calc.intPorPersona.filter((i:any) => i.hsInt > 0).map((p:any, idx:number) => (
                   <tr key={idx}><td className="p-3 font-medium">{p.persona}</td><td className="p-3 text-right text-amber-600 font-bold">{p.hsInt.toFixed(1)} hs</td></tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {activeTab === "equipo" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-gray-100 text-axia-gray font-bold uppercase text-[10px]"><tr><th className="p-3">Persona</th><th className="p-3 text-center">Hs Tot</th><th className="p-3 text-center">Hs Fact</th><th className="p-3 text-center">% Fact</th><th className="p-3 text-right">Tarifa/h</th><th className="p-3 text-right">Imp Clientes</th><th className="p-3 text-right">Sueldo</th><th className="p-3 text-right">Ajuste</th><th className="p-3 text-right">Costo Real/h</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {calc.pEquipo.map((e:any, i:number) => (
                 <tr key={i} className="hover:bg-slate-50">
                   <td className="p-3 font-bold flex flex-col gap-1">
                      {e.persona}
                      <label className="text-[10px] flex items-center gap-1 font-normal text-gray-500"><input type="checkbox" checked={e.es_socio} onChange={ev=>guardarEquipo(e, "es_socio", ev.target.checked ? "Si" : "No")}/> Socio</label>
                   </td>
                   <td className="p-3 text-center font-medium">{e.hsTot.toFixed(1)}</td><td className="p-3 text-center">{e.horas_fact_totales.toFixed(1)}</td><td className="p-3 text-center">{e.pctF.toFixed(0)}%</td>
                   <td className="p-3 text-right"><input type="number" defaultValue={e.tarifa} onBlur={ev=>guardarEquipo(e, "tarifa_hora", ev.target.value)} className="w-20 text-right border-b" /></td>
                   <td className="p-3 text-right">{renderMoney(e.impFact)}</td>
                   <td className="p-3 text-right"><input type="number" defaultValue={e.sueldo} onBlur={ev=>guardarEquipo(e, "sueldo_mensual", ev.target.value)} className="w-24 text-right border-b" /></td>
                   <td className="p-3 text-right font-bold">{e.es_socio ? "-" : renderMoney(e.ajuste)}</td><td className="p-3 text-right font-bold text-rose-500">{e.es_socio ? "-" : renderMoney(e.costoReal)}</td>
                 </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "unicas" && (
        <div className="space-y-4">
           <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
             <h3 className="font-bold">Cobranzas Eventuales</h3>
             <button onClick={() => setIsAddingCobranza(!isAddingCobranza)} disabled={calc.isMesCerrado} className="bg-axia-orange text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1"><Plus size={16}/> Nueva</button>
           </div>
           {isAddingCobranza && (
             <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex gap-3 items-end">
                <div><label className="text-xs font-bold block mb-1">Fecha</label><input type="date" value={newCobranza.fecha} onChange={e=>setNewCobranza({...newCobranza, fecha: e.target.value})} className="border p-2 rounded w-32 text-sm"/></div>
                <div>
                   <label className="text-xs font-bold block mb-1">Cliente / Línea</label>
                   <select value={newCobranza.cliente_linea} onChange={e=>setNewCobranza({...newCobranza, cliente_linea: e.target.value})} className="border p-2 rounded text-sm w-48">
                      <option value="">Seleccione...</option>
                      {clientes.map((c:any, i:number) => !isInterno(c.cliente) && <option key={i} value={c.cliente+"|||"+c.linea_negocio}>{c.cliente} - {c.linea_negocio}</option>)}
                   </select>
                </div>
                <div><label className="text-xs font-bold block mb-1">Concepto</label><input type="text" value={newCobranza.concepto} onChange={e=>setNewCobranza({...newCobranza, concepto: e.target.value})} className="border p-2 rounded w-40 text-sm"/></div>
                <div><label className="text-xs font-bold block mb-1">Monto $</label><input type="number" value={newCobranza.monto} onChange={e=>setNewCobranza({...newCobranza, monto: e.target.value})} className="border p-2 rounded w-28 text-sm"/></div>
                <button onClick={guardarCobranzaUnica} className="bg-axia-blue text-white px-4 py-2 rounded font-bold text-sm">Guardar</button>
             </div>
           )}
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <table className="w-full text-left text-sm">
               <thead className="bg-slate-50 border-b border-gray-100 text-axia-gray font-bold uppercase text-[10px]"><tr><th className="p-3">Fecha</th><th className="p-3">Cliente</th><th className="p-3">Línea</th><th className="p-3">Concepto</th><th className="p-3 text-right">Monto</th><th className="p-3 w-10"></th></tr></thead>
               <tbody className="divide-y divide-gray-50">
                 {calc.cuMes.map((cu:any, i:number) => (
                    <tr key={i} className="hover:bg-slate-50"><td className="p-3">{cu.fecha}</td><td className="p-3 font-bold">{cu.cliente}</td><td className="p-3 text-gray-500">{cu.linea_negocio}</td><td className="p-3">{cu.concepto}</td><td className="p-3 text-right font-medium">{renderMoney(cu.monto)}</td><td className="p-3"><button onClick={()=>eliminarCobranzaUnica(cu.id)} disabled={calc.isMesCerrado} className="text-rose-400 hover:text-rose-600"><Trash2 size={16}/></button></td></tr>
                 ))}
                 <tr className="bg-slate-50 font-bold"><td colSpan={4} className="p-3 text-right">Total:</td><td className="p-3 text-right text-axia-blue">{renderMoney(calc.cuMes.reduce((a:any, b:any)=>a+Number(b.monto), 0))}</td><td></td></tr>
               </tbody>
             </table>
           </div>
        </div>
      )}

      {activeTab === "fijos" && (
        <div className="space-y-4">
           <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
             <div className="flex items-center gap-4">
               <h3 className="font-bold">Costos Fijos del Mes</h3>
               <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                 <span className="text-xs font-bold text-slate-600">Tipo de Cambio USD:</span>
                 <input type="number" value={tcUSD} onChange={e=>setTcUSD(e.target.value)} disabled={calc.isMesCerrado} className="w-20 bg-white border border-slate-300 rounded p-1 text-xs text-right"/>
                 {!calc.isMesCerrado && <button onClick={saveTC} className="text-axia-blue"><Save size={16}/></button>}
               </div>
             </div>
             <div className="flex gap-2">
               <button onClick={copiarFijos} disabled={calc.isMesCerrado} className="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1"><Copy size={16}/> Copiar Recurrentes</button>
               <button onClick={() => setIsAddingCosto(!isAddingCosto)} disabled={calc.isMesCerrado} className="bg-axia-orange text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1"><Plus size={16}/> Nuevo</button>
             </div>
           </div>
           {isAddingCosto && (
             <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 grid grid-cols-6 gap-3 items-end">
                <div className="col-span-2"><label className="text-xs font-bold block mb-1">Concepto</label><input type="text" value={newCosto.concepto} onChange={e=>setNewCosto({...newCosto, concepto: e.target.value})} className="border p-2 rounded w-full text-sm"/></div>
                <div>
                   <label className="text-xs font-bold block mb-1">Categoría</label>
                   <select value={newCosto.categoria} onChange={e=>setNewCosto({...newCosto, categoria: e.target.value})} className="border p-2 rounded w-full text-sm">
                      <option>Alquiler</option><option>Sistemas</option><option>Oficina</option><option>Otros</option>
                   </select>
                </div>
                <div>
                   <label className="text-xs font-bold block mb-1">Recurrente</label>
                   <select value={newCosto.recurrente} onChange={e=>setNewCosto({...newCosto, recurrente: e.target.value})} className="border p-2 rounded w-full text-sm">
                      <option>Si</option><option>No</option>
                   </select>
                </div>
                <div className="flex gap-1">
                   <div className="w-1/3">
                      <label className="text-xs font-bold block mb-1">Moneda</label>
                      <select value={newCosto.moneda} onChange={e=>setNewCosto({...newCosto, moneda: e.target.value})} className="border p-2 rounded w-full text-sm">
                         <option>ARS</option><option>USD</option>
                      </select>
                   </div>
                   <div className="w-2/3">
                      <label className="text-xs font-bold block mb-1">Monto</label>
                      <input type="number" value={newCosto.monto} onChange={e=>setNewCosto({...newCosto, monto: e.target.value})} className="border p-2 rounded w-full text-sm"/>
                   </div>
                </div>
                <button onClick={guardarCosto} className="bg-axia-blue text-white px-4 py-2 rounded font-bold text-sm h-[38px]">Guardar</button>
                <div className="col-span-6"><input type="text" placeholder="Nota opcional..." value={newCosto.nota} onChange={e=>setNewCosto({...newCosto, nota: e.target.value})} className="border p-2 rounded w-full text-sm"/></div>
             </div>
           )}
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <table className="w-full text-left text-sm">
               <thead className="bg-slate-50 border-b border-gray-100 text-axia-gray font-bold uppercase text-[10px]"><tr><th className="p-3">Rec</th><th className="p-3">Categoría</th><th className="p-3">Concepto</th><th className="p-3">Nota</th><th className="p-3 text-right">Monto ARS</th><th className="p-3 text-right">Monto USD</th><th className="p-3 w-10"></th></tr></thead>
               <tbody className="divide-y divide-gray-50">
                 {calc.costosMes.map((c:any, i:number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3">{c.recurrente === "Si" ? "🔄" : ""}</td>
                      <td className="p-3 text-gray-500">{c.categoria}</td>
                      <td className="p-3 font-bold">{c.concepto}</td>
                      <td className="p-3 text-xs text-gray-400">{c.nota}</td>
                      <td className="p-3 text-right font-medium">{c.moneda === "ARS" ? renderMoney(c.monto) : ""}</td>
                      <td className="p-3 text-right font-medium text-emerald-600">{c.moneda === "USD" ? `US$ ${c.monto}` : ""}</td>
                      <td className="p-3"><button onClick={()=>eliminarCosto(c.id)} disabled={calc.isMesCerrado} className="text-rose-400 hover:text-rose-600"><Trash2 size={16}/></button></td>
                    </tr>
                 ))}
                 <tr className="bg-slate-50 font-bold"><td colSpan={4} className="p-3 text-right text-gray-500">Total en Pesos:</td><td colSpan={2} className="p-3 text-right text-rose-500">{renderMoney(calc.costosMes.reduce((a:any, b:any) => a + (b.moneda==="USD" ? Number(b.monto)*Number(tcUSD) : Number(b.monto)), 0))}</td><td></td></tr>
               </tbody>
             </table>
           </div>
        </div>
      )}

    </div>
  );
}
