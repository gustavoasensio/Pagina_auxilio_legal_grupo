/* AuxilioLegal: utilidades compartidas */
var AL=(function(){
  var U="https://hfwqpjmbqsjtdyeajhqv.supabase.co", K="sb_publishable_bVyhboFI2QwZqvKTOF9Quw_klcuXkdV";
  var H={"apikey":K,"Authorization":"Bearer "+K};
  function post(t,o){ return fetch(U+"/rest/v1/"+t,{method:"POST",headers:Object.assign({"Content-Type":"application/json","Prefer":"return=minimal"},H),body:JSON.stringify(o)}); }
  function rpc(f,o){ return fetch(U+"/rest/v1/rpc/"+f,{method:"POST",headers:Object.assign({"Content-Type":"application/json"},H),body:JSON.stringify(o)}).then(function(r){return r.json();}); }
  function upload(path,blob){ return fetch(U+"/storage/v1/object/siniestros/"+path,{method:"POST",headers:Object.assign({"Content-Type":blob.type||"application/octet-stream"},H),body:blob}); }
  function uuid(){ if(crypto.randomUUID) return crypto.randomUUID(); var b=crypto.getRandomValues(new Uint8Array(16)); b[6]=b[6]&15|64; b[8]=b[8]&63|128;
    var h=[].map.call(b,function(x){return (x+256).toString(16).slice(1)}).join(""); return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20); }
  function code(n){ var a="abcdefghijkmnpqrstuvwxyz23456789",s="",r=crypto.getRandomValues(new Uint8Array(n)); for(var i=0;i<n;i++) s+=a[r[i]%a.length]; return s; }
  var MES=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  function larga(iso){ if(!iso) return "____"; var p=iso.split("-"); return (+p[2])+" de "+MES[+p[1]-1]+" de "+p[0]; }
  function hoy(){ var d=new Date(); return d.getDate()+" de "+MES[d.getMonth()]+" de "+d.getFullYear(); }
  /* Fecha de hoy en Mendoza (UTC-3, sin horario de verano) */
  function hoyIso(){ return new Date(Date.now()-3*36e5).toISOString().slice(0,10); }
  function say(el,t,ok){ el.textContent=t; el.style.color= ok?"#1d7a4c":"#b3261e"; }
  /* Reduce fotos a 1600px JPEG para que suban rápido desde el celular */
  function shrink(file){ return new Promise(function(ok){
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)) return ok(file);
    var img=new Image(), url=URL.createObjectURL(file);
    img.onload=function(){ var m=1600, s=Math.min(1,m/Math.max(img.width,img.height)), c=document.createElement("canvas");
      c.width=Math.round(img.width*s); c.height=Math.round(img.height*s); c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      c.toBlob(function(b){ URL.revokeObjectURL(url); ok(b&&b.size<file.size?b:file); },"image/jpeg",.82); };
    img.onerror=function(){ ok(file); }; img.src=url; }); }
  /* Asistente por pasos: <form class="wiz"> con <fieldset class="step"> */
  function wizard(form,onDone){
    var steps=[].slice.call(form.querySelectorAll(".step")), i=0, bar=form.querySelector(".bar-fill"), lab=form.querySelector(".step-lab"),
        prev=form.querySelector("[data-prev]"), next=form.querySelector("[data-next]"), msg=form.querySelector(".msg");
    function show(){ steps.forEach(function(s,k){ s.hidden=k!==i; });
      if(bar) bar.style.width=((i+1)/steps.length*100)+"%";
      if(lab) lab.textContent="Paso "+(i+1)+" de "+steps.length+" · "+steps[i].dataset.t;
      prev.style.visibility=i?"visible":"hidden"; next.textContent= i===steps.length-1 ? next.dataset.last : "Siguiente";
      msg.textContent=""; }
    function valid(){ var bad=[].slice.call(steps[i].querySelectorAll("[required]")).filter(function(e){ return e.type==="checkbox"?!e.checked:!e.value.trim(); });
      if(bad.length){ say(msg,"Completá los campos marcados con *.",false); bad[0].focus(); return false; }
      var tel=[].slice.call(steps[i].querySelectorAll("input[type=tel][required],input[data-digits]")).filter(function(e){ var n=e.value.replace(/\D/g,"").length, mn=+(e.dataset.digits||8); return e.value.trim()&&(n<mn||n>(+e.dataset.maxd||15)); });
      if(tel.length){ say(msg,tel[0].dataset.err||"Revisá el número: parece incompleto.",false); tel[0].focus(); return false; }
      var fut=[].slice.call(steps[i].querySelectorAll("input[type=date][data-pasado]")).filter(function(e){ return e.value && e.value>hoyIso(); });
      if(fut.length){ say(msg,"La fecha no puede ser posterior a hoy.",false); fut[0].focus(); return false; }
      var chk=steps[i].dataset.check&&window[steps[i].dataset.check]; if(chk){ var r=chk(); if(r){ say(msg,r,false); return false; } }
      var em=steps[i].querySelector("input[type=email]"); if(em&&em.value&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.value)){ say(msg,"Revisá el correo.",false); em.focus(); return false; }
      return true; }
    prev.addEventListener("click",function(){ if(i){ i--; show(); form.scrollIntoView({block:"start"}); } });
    form.addEventListener("submit",function(e){ e.preventDefault(); if(!valid()) return;
      if(i<steps.length-1){ i++; show(); form.scrollIntoView({block:"start"}); } else onDone(msg,next); });
    show();
  }
  /* Borrador local: si el cliente cierra, al volver sigue donde estaba */
  function draft(form,key){ var f=[].slice.call(form.querySelectorAll("input:not([type=file]):not([data-nodraft]),textarea,select"));
    try{ var d=JSON.parse(localStorage.getItem(key)||"{}"); f.forEach(function(e){ if(e.id in d){ if(e.type==="checkbox"||e.type==="radio") e.checked=d[e.id]; else e.value=d[e.id]; } }); }catch(x){}
    form.addEventListener("input",function(){ var d={}; f.forEach(function(e){ d[e.id]= (e.type==="checkbox"||e.type==="radio")?e.checked:e.value; }); try{ localStorage.setItem(key,JSON.stringify(d)); }catch(x){} });
    return function(){ try{ localStorage.removeItem(key); }catch(x){} }; }
  function val(id){ var e=document.getElementById(id); if(!e) return null; if(e.type==="checkbox") return e.checked; var v=e.value.trim(); return v===""?null:v; }
  return {hoyIso:hoyIso,post:post,rpc:rpc,upload:upload,uuid:uuid,code:code,larga:larga,hoy:hoy,say:say,shrink:shrink,wizard:wizard,draft:draft,val:val};
})();
(function(){var b=document.getElementById("navToggle"),u=document.getElementById("navLinks");if(!b||!u)return;
b.addEventListener("click",function(){var o=u.classList.toggle("open");b.setAttribute("aria-expanded",o?"true":"false");});
u.addEventListener("click",function(e){if(e.target.tagName==="A"){u.classList.remove("open");b.setAttribute("aria-expanded","false");}});})();
