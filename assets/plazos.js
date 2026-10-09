/* AuxilioLegal · Módulo de plazos para /panel
   - Pestaña "Plazos" con semáforo de todos los casos
   - Tarjeta "Plazos" dentro del detalle de cada caso
   - Registrar reclamo a la aseguradora, plazos propios, confirmar / cumplir / descartar
   Usa la sesión que guarda el panel (sessionStorage "al_panel"); no renueva tokens por su cuenta
   para no invalidar el refresh token del panel. */
(function(){
  "use strict";
  var U="https://hfwqpjmbqsjtdyeajhqv.supabase.co", K="sb_publishable_bVyhboFI2QwZqvKTOF9Quw_klcuXkdV";
  var COL={verde:"#1d7a4c",amarillo:"#c98a00",rojo:"#b3261e",negro:"#141a2e",gris:"#9aa0b4"};
  var TIPOS={denuncia_siniestro:"Denuncia del siniestro",respuesta_aseguradora:"Respuesta de la aseguradora",prescripcion:"Prescripción",personalizado:"Plazo propio"};
  var $=function(id){return document.getElementById(id);};
  if(!$("v-app")||!$("casos-det")) return;

  /* ---- utilidades ---- */
  function h(tag,attrs,kids){ var e=document.createElement(tag); attrs=attrs||{};
    for(var k in attrs){ if(k==="text") e.textContent=attrs[k]; else if(k==="class") e.className=attrs[k]; else if(k.slice(0,2)==="on") e.addEventListener(k.slice(2),attrs[k]); else if(attrs[k]!=null) e.setAttribute(k,attrs[k]); }
    (kids||[]).forEach(function(c){ if(c!=null) e.appendChild(typeof c==="string"?document.createTextNode(c):c); }); return e; }
  function say(el,t,ok){ el.textContent=t; el.className="msg "+(ok?"ok":"err"); }
  function fecha(iso){ if(!iso) return "—"; var p=String(iso).slice(0,10).split("-"); return p[2]+"/"+p[1]+"/"+p[0]; }
  function hoy(){ return new Date(Date.now()-3*36e5).toISOString().slice(0,10); }
  function ses(){ try{ return JSON.parse(sessionStorage.getItem("al_panel")||"null"); }catch(x){ return null; } }
  function uid(){ var s=ses(); try{ return JSON.parse(atob(s.at.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).sub; }catch(x){ return null; } }
  function api(path,opt){ opt=opt||{}; var s=ses();
    if(!s) return Promise.reject(new Error("No hay sesión iniciada."));
    if(Date.now()>s.exp) return Promise.reject(new Error("La sesión venció: recargá la página (F5)."));
    return fetch(U+path,{method:opt.method||"GET",headers:Object.assign({apikey:K,Authorization:"Bearer "+s.at,"Content-Type":"application/json"},opt.headers||{}),body:opt.body?JSON.stringify(opt.body):undefined})
      .then(function(r){ return r.text().then(function(x){ var j=x?JSON.parse(x):null; if(!r.ok) throw new Error((j&&(j.message||j.error))||("Error "+r.status)); return j; }); }); }
  function patch(id,body){ return api("/rest/v1/plazos?id=eq."+id,{method:"PATCH",headers:{Prefer:"return=minimal"},body:body}); }

  /* ---- estilos ---- */
  document.head.appendChild(h("style",{text:
    ".pz-dot{display:inline-block;width:12px;height:12px;border-radius:50%;flex:none}"+
    ".pz-row{display:grid;grid-template-columns:14px 1fr auto;gap:4px 10px;align-items:center;border-top:1px solid var(--line);padding:10px 0}"+
    ".pz-row b{color:var(--ink);font-weight:650}.pz-row a{color:var(--navy);font-weight:750;text-decoration:none}"+
    ".pz-row .d{font-weight:700;font-size:.86rem;white-space:nowrap}"+
    ".pz-row small{grid-column:2/4;color:var(--muted);font-size:.82rem}"+
    ".pz-act{grid-column:2/4;display:flex;gap:6px;flex-wrap:wrap;align-items:center}"+
    ".pz-act input{width:auto;min-height:38px}"+
    ".pz-form{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:.7rem}"+
    ".pz-form .field{margin:0}.pz-form input{width:auto}.pz-form input[type=text]{min-width:220px}"+
    ".pz-sec{border-top:1px solid var(--line);margin-top:1rem;padding-top:.8rem}"+
    ".pz-sec h4{margin:0 0 .2rem;font-size:.92rem}"+
    ".pz-res{display:flex;gap:14px;flex-wrap:wrap;margin:0 0 12px;font-size:.88rem;color:var(--muted)}"+
    ".pz-res span{display:flex;align-items:center;gap:6px}"+
    ".pz-sin{color:#8a3b00;font-weight:650}"+
    ".pz-tab-n{display:inline-block;background:#b3261e;color:#fff;border-radius:9px;font-size:.72rem;padding:0 .4rem;margin-left:.35rem;vertical-align:1px}"
  }));

  /* ---- fila de un plazo ---- */
  function diasTxt(p){ if(p.estado!=="pendiente") return p.estado==="vencido"?"VENCIDO":p.estado;
    var d=p.dias_restantes; return d<0?"vencido hace "+(-d)+" d":d===0?"vence HOY":d===1?"vence mañana":d+" días"; }
  function fila(p,conCaso,recargar){
    var titulo=TIPOS[p.tipo]||p.tipo; if(p.tipo==="personalizado"||p.tipo==="respuesta_aseguradora") titulo=p.descripcion||titulo;
    var cab=h("span",{},[ conCaso?h("a",{href:"/panel?caso="+encodeURIComponent(p.numero||""),text:(p.numero||"sin número")}):null,
      conCaso?" · ":null, h("b",{text:titulo}), conCaso&&p.asegurado_nombre?h("span",{class:"mini",text:" · "+p.asegurado_nombre}):null ]);
    var row=h("div",{class:"pz-row"},[ h("span",{class:"pz-dot",style:"background:"+(COL[p.semaforo]||COL.gris),title:p.semaforo}),
      cab, h("span",{class:"d",style:"color:"+(COL[p.semaforo]||COL.gris),text:diasTxt(p)}),
      h("small",{},[ "Vence "+fecha(p.vence)+" · desde "+fecha(p.fecha_inicio)+" · ",
        p.confirmado?h("span",{text:"fecha confirmada"}):h("span",{class:"pz-sin",text:"FECHA SIN CONFIRMAR"}),
        p.base_legal?" · "+p.base_legal:null ]) ]);
    if(p.estado==="pendiente"||p.estado==="vencido"){
      var act=h("div",{class:"pz-act"}), msg=h("span",{class:"mini"});
      var hecho=function(t){ return function(){ msg.textContent=t; recargar(); }; };
      var falla=function(e){ msg.textContent="No se pudo: "+e.message; msg.className="err"; };
      if(!p.confirmado){
        var dv=h("input",{type:"date",value:p.vence,"aria-label":"Fecha de vencimiento"});
        act.appendChild(dv);
        act.appendChild(h("button",{class:"btn btn-primary btn-s",type:"button",text:"Confirmar fecha",onclick:function(){
          if(!dv.value) return; patch(p.id,{vence:dv.value,confirmado:true,confirmado_por:uid(),confirmado_en:new Date().toISOString(),estado:"pendiente"})
            .then(hecho("Confirmado.")).catch(falla); }}));
      }
      act.appendChild(h("button",{class:"btn btn-ghost btn-s",type:"button",text:"Cumplido",onclick:function(){
        patch(p.id,{estado:"cumplido",cumplido_en:new Date().toISOString()}).then(hecho("Marcado como cumplido.")).catch(falla); }}));
      act.appendChild(h("button",{class:"btn btn-ghost btn-s",type:"button",text:"Descartar",onclick:function(){
        if(!confirm("¿Descartar este plazo? Deja de generar avisos.")) return;
        patch(p.id,{estado:"descartado"}).then(hecho("Descartado.")).catch(falla); }}));
      act.appendChild(msg); row.appendChild(act);
    }
    return row; }

  /* ---- tarjeta dentro del caso ---- */
  function tarjeta(numero){
    var sid=null, lista=h("div",{},[h("p",{class:"mini",text:"Cargando plazos…"})]);
    var card=h("div",{class:"card",id:"pz-card",style:"margin-bottom:16px"},[ h("h3",{text:"Plazos"}), lista ]);
    function cargar(){ if(!sid) return;
      api("/rest/v1/plazos_tablero?siniestro_id=eq."+sid+"&select=*&order=vence").then(function(a){ lista.replaceChildren();
        if(!a.length){ lista.appendChild(h("p",{class:"mini",text:"Sin plazos. Se generan solos cuando el caso tiene fecha de siniestro, o agregalos abajo."})); return; }
        a.forEach(function(p){ lista.appendChild(fila(p,false,cargar)); }); })
      .catch(function(e){ lista.replaceChildren(h("p",{class:"err",text:e.message})); }); }

    /* registrar reclamo */
    var fr=h("input",{type:"date",value:hoy(),max:hoy(),id:"pz-fr"}), dr=h("input",{type:"number",value:"30",min:"1",max:"365",style:"width:90px",id:"pz-dr"}), mr=h("p",{class:"msg",style:"text-align:left"});
    var br=h("button",{class:"btn btn-primary btn-s",type:"button",text:"Registrar reclamo",onclick:function(){
      if(!sid||!fr.value) return; br.disabled=true; say(mr,"Registrando…",true);
      api("/rest/v1/rpc/registrar_reclamo_aseguradora",{method:"POST",body:{p_siniestro:sid,p_fecha:fr.value,p_dias:+dr.value||30}})
        .then(function(){ say(mr,"Listo: se creó el plazo de respuesta y se avisará antes del vencimiento.",true); cargar(); })
        .catch(function(e){ say(mr,"No se pudo: "+e.message,false); }).then(function(){ br.disabled=false; }); }});
    /* plazo propio */
    var dp=h("input",{type:"text",placeholder:"Ej.: Audiencia de mediación",maxlength:"300",id:"pz-dp"}), vp=h("input",{type:"date",min:hoy(),id:"pz-vp"}), mp=h("p",{class:"msg",style:"text-align:left"});
    var bp=h("button",{class:"btn btn-ghost btn-s",type:"button",text:"Agregar plazo",onclick:function(){
      if(!sid) return; var d=dp.value.trim(); if(d.length<2||!vp.value) return say(mp,"Completá descripción y fecha.",false);
      bp.disabled=true;
      api("/rest/v1/plazos",{method:"POST",headers:{Prefer:"return=minimal"},body:{siniestro_id:sid,tipo:"personalizado",descripcion:d,fecha_inicio:hoy(),vence:vp.value,automatico:false,confirmado:true,confirmado_por:uid(),confirmado_en:new Date().toISOString()}})
        .then(function(){ dp.value=""; vp.value=""; say(mp,"Plazo agregado.",true); cargar(); })
        .catch(function(e){ say(mp,"No se pudo: "+e.message,false); }).then(function(){ bp.disabled=false; }); }});

    card.appendChild(h("div",{class:"pz-sec"},[ h("h4",{text:"Reclamo presentado a la aseguradora"}),
      h("p",{class:"mini",style:"margin:0",text:"Abre el plazo de respuesta (30 días por defecto, art. 56 Ley 17.418; en reclamos de terceros es control interno)."}),
      h("div",{class:"pz-form"},[ h("div",{class:"field"},[h("label",{for:"pz-fr",text:"Fecha del reclamo"}),fr]), h("div",{class:"field"},[h("label",{for:"pz-dr",text:"Días"}),dr]), br ]), mr ]));
    card.appendChild(h("div",{class:"pz-sec"},[ h("h4",{text:"Plazo propio"}),
      h("div",{class:"pz-form"},[ h("div",{class:"field"},[h("label",{for:"pz-dp",text:"Descripción"}),dp]), h("div",{class:"field"},[h("label",{for:"pz-vp",text:"Vence"}),vp]), bp ]), mp,
      h("p",{class:"mini",style:"margin:.6rem 0 0",text:"Los plazos automáticos se calculan desde la fecha del siniestro. Confirmá la fecha real de inicio antes de usarlos."}) ]));

    api("/rest/v1/siniestros_web?numero=eq."+encodeURIComponent(numero)+"&select=id").then(function(a){
      if(!a||!a.length){ lista.replaceChildren(h("p",{class:"err",text:"No se encontró el caso."})); return; }
      sid=a[0].id; cargar(); }).catch(function(e){ lista.replaceChildren(h("p",{class:"err",text:e.message})); });
    return card; }

  new MutationObserver(function(){
    var det=document.querySelector("#casos-det .det"); if(!det||det.querySelector("#pz-card")) return;
    var t=det.querySelector("h2"); if(!t) return;
    var num=t.textContent.split(" · ")[0].trim(); if(!num||/^sin n[uú]mero$/i.test(num)) return;
    det.insertBefore(tarjeta(num), det.querySelector(".grid2"));
  }).observe($("casos-det"),{childList:true});

  /* ---- pestaña Plazos ---- */
  var tabs=document.querySelector(".tabs"); if(!tabs) return;
  var cuenta=h("span",{class:"pz-tab-n",hidden:"hidden"});
  var btn=h("button",{role:"tab","data-tab":"plazos","aria-selected":"false",type:"button"},["Plazos",cuenta]);
  var casosBtn=tabs.querySelector('[data-tab="casos"]'); tabs.insertBefore(btn, casosBtn?casosBtn.nextSibling:null);
  var sel=h("select",{style:"width:auto"},[h("option",{value:"act",text:"Pendientes y vencidos"}),h("option",{value:"todos",text:"Todos"})]);
  var res=h("div",{class:"pz-res"}), cont=h("div",{class:"card"},[h("p",{class:"mini",text:"Cargando…"})]);
  var vista=h("div",{id:"t-plazos",hidden:"hidden"},[ h("div",{class:"bar2"},[sel]), res, cont ]);
  $("v-app").appendChild(vista);

  function tablero(){ cont.replaceChildren(h("p",{class:"mini",text:"Cargando…"}));
    api("/rest/v1/plazos_tablero?select=*&order=vence&limit=500"+(sel.value==="act"?"&estado=in.(pendiente,vencido)":"")).then(function(a){
      cont.replaceChildren(); res.replaceChildren();
      var n={negro:0,rojo:0,amarillo:0,verde:0};
      a.forEach(function(p){ if(p.estado==="vencido") n.negro++; else if(n[p.semaforo]!=null) n[p.semaforo]++; });
      [["negro","vencidos"],["rojo","vencen en 2 días o menos"],["amarillo","en 10 días o menos"],["verde","en plazo"]].forEach(function(x){
        res.appendChild(h("span",{},[h("span",{class:"pz-dot",style:"background:"+COL[x[0]]}),n[x[0]]+" "+x[1]])); });
      if(!a.length){ cont.appendChild(h("p",{class:"mini",style:"margin:0",text:"No hay plazos para mostrar."})); return; }
      a.forEach(function(p){ cont.appendChild(fila(p,true,tablero)); });
      contar(a); })
    .catch(function(e){ cont.replaceChildren(h("p",{class:"err",text:e.message})); }); }
  sel.addEventListener("change",tablero);

  function contar(a){ var urg=a.filter(function(p){ return p.estado==="vencido"||(p.estado==="pendiente"&&(p.semaforo==="rojo"||p.semaforo==="negro")); }).length;
    cuenta.textContent=urg; cuenta.hidden=!urg; }
  function refrescarCuenta(){ api("/rest/v1/plazos_tablero?select=estado,semaforo&estado=in.(pendiente,vencido)").then(contar).catch(function(){}); }

  btn.addEventListener("click",function(){
    [].forEach.call(document.querySelectorAll("[data-tab]"),function(b){ b.setAttribute("aria-selected",b===btn?"true":"false"); });
    ["casos","consultas","equipo"].forEach(function(x){ var el=$("t-"+x); if(el) el.hidden=true; });
    vista.hidden=false; tablero(); });
  tabs.addEventListener("click",function(e){ var b=e.target.closest("[data-tab]"); if(b&&b!==btn) vista.hidden=true; });

  /* contador de urgentes al entrar al panel */
  new MutationObserver(function(){ if(!$("v-app").hidden) refrescarCuenta(); }).observe($("v-app"),{attributes:true,attributeFilter:["hidden"]});
  if(!$("v-app").hidden) refrescarCuenta();
})();
