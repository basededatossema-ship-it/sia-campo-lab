/**
 * SIA / banimApp - BA-02 (candidato sin desplegar)
 * Edición EXCLUSIVAMENTE de borradores BA-05F propios en IndexedDB.
 * Necesita la ruta central AUTORIZAR_EDICION_BORRADOR_BANIMAPP publicada.
 * Utiliza sesión temporal BA-02 emitida por el servidor en el ingreso normal.
 * Nunca guarda el ID token Google. El permiso se revalida en cada operación.
 */
(function () {
  'use strict';
  const CLIENT_ID = '539376159794-mp0qjge29fhkudf2tdp9cu8knfq3qhlv.apps.googleusercontent.com';
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbx8xZx31rH7LERYaSrwv6NzdNHjVKP0-AH_y6WZGSrp3IeOekC6JbgEFx-K4S0Ywg77/exec';
  const DB = 'SIA_CAMPO_PWA_LAB', STORE = 'borradores';
  const OPERACION = 'AUTORIZAR_EDICION_BA02_SESION';
  const CLAVE_SESION = 'SIA_BA02_SESION_V1';
  const CONTRATO = 'SIA-BA02-CAPACIDAD-01';
  const SNAPSHOT_KEYS = ['SIA_BA_IDENTIDAD_05G14','SIA_BA_ACCESO_GOOGLE_05G19A','SIA_BA_PERMISOS_05G21I'];
  let ocupado = false;

  function identidad() {
    try {
      const sesion = JSON.parse(sessionStorage.getItem(SNAPSHOT_KEYS[0]) || 'null');
      const acceso = JSON.parse(sessionStorage.getItem(SNAPSHOT_KEYS[1]) || 'null');
      const permiso = JSON.parse(sessionStorage.getItem(SNAPSHOT_KEYS[2]) || 'null');
      if (!sesion || !acceso || !permiso || !sesion.usuarioId ||
          sesion.usuarioId !== acceso.usuarioId || sesion.usuarioId !== permiso.usuarioId ||
          sesion.verificadoEn !== acceso.verificadoEn || sesion.verificadoEn !== permiso.verificadoEn ||
          permiso.contrato !== 'SIA-PERMISOS-BA-01' ||
          permiso.permisos?.CONSULTAR !== true || sesion.modulo !== 'BIENESTAR_ANIMAL') return null;
      return sesion.usuarioId;
    } catch (_) { return null; }
  }
  function selloSesion() { return SNAPSHOT_KEYS.map(k => sessionStorage.getItem(k) || '').join('\n'); }
  function propio(borrador, usuarioId) {
    return Boolean(borrador && borrador.formularioVersion === 'BA-05F' &&
      borrador.estado === 'BORRADOR' && borrador.autoriaInstitucional &&
      borrador.autoriaInstitucional.usuarioId === usuarioId &&
      typeof borrador.id === 'string' && borrador.id.length === 36);
  }
  function abrirBase() {
    return new Promise((resolve,reject) => {
      const req = indexedDB.open(DB); // Sin upgrade ni creación de almacenes
      req.onupgradeneeded = () => req.transaction.abort();
      req.onerror = () => reject(new Error('ALMACEN_NO_DISPONIBLE'));
      req.onsuccess = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.close(); reject(new Error('BORRADORES_NO_DISPONIBLES'));return;
        }
        resolve(req.result);
      };
    });
  }
  async function leer(uuid) {
    const db=await abrirBase();
    try {return await new Promise((resolve,reject) => {
      const tx=db.transaction(STORE,'readonly'); const req=tx.objectStore(STORE).get(uuid);
      req.onsuccess=()=>resolve(req.result || null);
      req.onerror=()=>reject(new Error('LECTURA_LOCAL_FALLIDA'));
    });} finally {db.close();}
  }
  function texto(v,max) { return String(v == null ? '' : v).trim().slice(0,max); }
  function cambiosValidos(c) {
    return c && typeof c === 'object' && !Array.isArray(c) &&
      Object.keys(c).every(k=>['asunto','tematica','lugar','numeroInforme','fechaInforme','numeroRadicado','fechaRadicado'].includes(k)) &&
      Object.keys(c).length>0;
  }
  function aplicarCambios(original,cambios) {
    if(!cambiosValidos(cambios)) throw new Error('CAMBIOS_NO_ADMITIDOS');
    const copia=JSON.parse(JSON.stringify(original));
    const f=copia.formulario;
    if(!f || typeof f!=='object' || !f.ubicacion) throw new Error('FORMULARIO_INCOMPLETO');
    if (Object.hasOwn(cambios,'lugar')) {
      f.ubicacion.lugar=texto(cambios.lugar,180);
      copia.lugar=f.ubicacion.lugar;
    }
    // Evitar recortes silenciosos: los borradores previos siguen intactos.
    for (const campo of ['asunto','tematica']) {
      if (Object.hasOwn(cambios,campo)) {
        const valor = String(cambios[campo] ?? '').trim();
        if (valor.length > 100) throw new Error(campo.toUpperCase() + '_MAXIMO_100_CARACTERES');
        f[campo] = valor;
      }
    }
    
const limitesOpcionales = {
  numeroInforme: 20,
  fechaInforme: 10,
  numeroRadicado: 20,
  fechaRadicado: 10
};

    for (const [campo, maximo] of Object.entries(limitesOpcionales)) {
      if (Object.hasOwn(cambios,campo)) {
        const valor = String(cambios[campo] ?? '').trim();
        if (valor.length > maximo) throw new Error(campo.toUpperCase() + '_LONGITUD_INVALIDA');
        f[campo] = valor;
      }
    }
    // No tocar: id, operacion_id, autoriaInstitucional, estado, creadoEn, tipo, formularioVersion
    if(!window.SIABanimContrato ||
       window.SIABanimContrato.validar(copia).ok!==true) throw new Error('FORMULARIO_EDITADO_INVALIDO');
    return copia;
  }
  async function guardarAtomicamente(original,copia,usuarioId,sello) {
    if(identidad()!==usuarioId || selloSesion()!==sello) throw new Error('SESION_CAMBIADA');
    const db=await abrirBase();
    try {return await new Promise((resolve,reject) => {
      const tx=db.transaction(STORE,'readwrite'); const store=tx.objectStore(STORE);
      const req=store.get(original.id); let fallo=null;
      req.onsuccess=()=>{
        try {
          const actual=req.result;
          if (!propio(actual,usuarioId) || JSON.stringify(actual)!==JSON.stringify(original)) {
            throw new Error('BORRADOR_MODIFICADO_O_NO_AUTORIZADO');
          }
          if(identidad()!==usuarioId || selloSesion()!==sello) throw new Error('SESION_CAMBIADA');
          store.put(copia);
        } catch(err) {fallo=err;tx.abort();}
      };
      req.onerror=()=>{fallo=new Error('LECTURA_LOCAL_FALLIDA');tx.abort();};
      tx.oncomplete=()=>resolve({ok:true,uuid:original.id});
      tx.onabort=()=>reject(fallo || new Error('GUARDADO_CANCELADO'));
      tx.onerror=()=>reject(fallo || new Error('GUARDADO_LOCAL_FALLIDO'));
    });} finally {db.close();}
  }
  function mostrarError(mensajeEl, err) {
    mensajeEl.textContent='Edición no realizada: '+(err?.message||'ERROR_DE_AUTORIZACION');
  }
  // Sesión BA-02 emitida por el Servicio Central tras autenticación Google.
  // Solamente se almacena una capacidad opaca con caducidad de cinco minutos.
  // No se almacena la credencial Google ni se registran tokens.
  async function autorizar(usuarioId, senal) {
    const bruto = sessionStorage.getItem(CLAVE_SESION);
    let sesion;
    try { sesion = JSON.parse(bruto || 'null'); } catch (_) { sesion = null; }
    if (!sesion || sesion.usuarioId !== usuarioId ||
        typeof sesion.sesion !== 'string' ||
        !Number.isFinite(sesion.expira) || Date.now() >= sesion.expira) {
      sessionStorage.removeItem(CLAVE_SESION);
      throw new Error('SESION_BA02_NO_DISPONIBLE. Vuelve a iniciar sesión institucional con permiso de edición activo.');
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20000);
    const cancelar = () => ac.abort();
    if (senal) {
      if (senal.aborted) ac.abort();
      else senal.addEventListener('abort', cancelar, {once:true});
    }
    try {
      const resp = await fetch(ENDPOINT, {
        method:'POST', mode:'cors', credentials:'omit', redirect:'follow',
        headers:{'Content-Type':'text/plain'},
        body:JSON.stringify({operacion:OPERACION, sesion:sesion.sesion}),signal:ac.signal
      });
      if (!resp.ok) throw new Error('HTTP_AUTORIZACION_'+resp.status);
      const datos = await resp.json();
      if (datos?.ok !== true || datos.permitido !== true ||
          datos.modulo !== 'BIENESTAR_ANIMAL' || datos.accion !== 'EDITAR_BORRADOR' ||
          datos.contrato !== CONTRATO || datos.motivo !== 'AUTORIZADO' ||
          datos.usuarioId !== usuarioId) {
        if (['SESION_VENCIDA','SESION_INVALIDA','EDICION_NO_AUTORIZADA'].includes(datos?.motivo)) {
          sessionStorage.removeItem(CLAVE_SESION);
        }
        throw new Error(datos?.motivo || 'EDICION_NO_AUTORIZADA');
      }
      return true;
    } finally {
      clearTimeout(timer);
      if (senal) senal.removeEventListener('abort', cancelar);
    }
  }
  function campo(form,etiqueta,prop,valor,max=180) {
    const label=document.createElement('label');label.textContent=etiqueta;
    
const el = document.createElement('input');

const esFecha = [
  'fechaInforme',
  'fechaRadicado'
].includes(prop);

el.type = esFecha ? 'date' : 'text';
el.name = prop;

if (!esFecha) {
  el.maxLength = max;
}

el.value = valor == null ? '' : String(valor);

    label.appendChild(el);
    if (prop === 'asunto' || prop === 'tematica') {
      const contador=document.createElement('small');
      contador.className='ba02-contador';
      const actualizar=()=>{
        const longitud=el.value.length;
        contador.textContent=longitud+'/100 caracteres'+(longitud>100?' · Debes reducir el texto antes de guardar':'');
        contador.style.color=longitud>100?'#b42318':'';
      };
      el.addEventListener('input',actualizar);
      actualizar();
      label.appendChild(contador);
    }
    form.appendChild(label);
  }
  function construirPanel(original,usuarioId,sello,mensaje,ancla,botonAbrir) {
    const panel=document.createElement('div');panel.className='ba02-panel';
    const titulo=document.createElement('h4');titulo.textContent='Edición autorizada de borrador local';
    const nota=document.createElement('p');nota.textContent='Solo campos descriptivos; UUID, titular y estado se conservan. Para guardar se requiere una nueva verificación Google.';
    const form=document.createElement('form'); const f=original.formulario;
    if(original.tipo==='VISITA_TECNICA') campo(form,'Asunto','asunto',f.asunto,100);
    if(original.tipo==='SENSIBILIZACION') campo(form,'Temática','tematica',f.tematica,100);
    campo(form,'Lugar','lugar',f.ubicacion?.lugar,180);
    campo(form,'Número de informe','numeroInforme',f.numeroInforme,20);
    campo(form,'Fecha de informe (AAAA-MM-DD)','fechaInforme',f.fechaInforme,10);
    if(original.tipo==='SENSIBILIZACION') {
      campo(form,'Número de radicado','numeroRadicado',f.numeroRadicado,20);
      campo(form,'Fecha de radicado (AAAA-MM-DD)','fechaRadicado',f.fechaRadicado,10);
    }
    const guardar=document.createElement('button');guardar.type='submit';guardar.textContent='Solicitar autorización para guardar';
    const salir=document.createElement('button');salir.type='button';salir.textContent='Cancelar';
    salir.addEventListener('click',()=>{panel.remove();ocupado=false;botonAbrir.disabled=false;});
    const googleDiv=document.createElement('div');
    form.append(guardar,salir);panel.append(titulo,nota,form,googleDiv);ancla.appendChild(panel);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(identidad()!==usuarioId||selloSesion()!==sello) {mensaje.textContent='Sesión cambiada. Vuelve a entrar.';return;}
      const cambios={};for(const input of form.querySelectorAll('input[name]')) cambios[input.name]=input.value;
      let copia;try{copia=aplicarCambios(original,cambios);}catch(e){mostrarError(mensaje,e);return;}
      mensaje.textContent='Verificando nuevamente autorización institucional para guardar…';
      guardar.disabled = true;
      try {
        await autorizar(usuarioId);
        const resultado = await guardarAtomicamente(original,copia,usuarioId,sello);
        mensaje.textContent='Borrador actualizado localmente: '+resultado.uuid;
        panel.remove();ocupado=false;
        if (typeof window.mostrarRegistros === 'function') await window.mostrarRegistros();
        else botonAbrir.disabled=false;
      } catch (err) {mostrarError(mensaje,err);}
      finally {guardar.disabled=false;}
    });
  }
  function agregarAccion(elemento,registro,usuarioId) {
    if (!propio(registro,usuarioId)) return;
    const boton=document.createElement('button');
    boton.type='button';boton.className='secondary-button';
    boton.textContent='Solicitar edición (BA-02)';
    const mensaje=document.createElement('p'); mensaje.setAttribute('role','status');
    elemento.append(boton,mensaje);
    boton.addEventListener('click',async()=>{
      if (ocupado) {mensaje.textContent='Existe una edición en curso. Cancélala antes de continuar.';return;}
      if (identidad()!==usuarioId) {mensaje.textContent='Identidad no vigente.';return;}
      ocupado=true; boton.disabled=true;
      const sello=selloSesion();
      const cancelar=document.createElement('button');
      cancelar.type='button'; cancelar.className='secondary-button';
      cancelar.textContent='Cancelar solicitud de edición';
      const ac=new AbortController();
      let vigente=true; let editorAbierto=false;
      elemento.appendChild(cancelar);
      function terminar(texto) {
        if (!vigente) return; vigente=false;
        ac.abort(); cancelar.remove();
        if (!editorAbierto) {ocupado=false; boton.disabled=false;}
        if (texto) mensaje.textContent=texto;
      }
      cancelar.addEventListener('click',()=>terminar('Solicitud cancelada. Puedes reintentar.'));
      mensaje.textContent='Consultando tu autorización BA-02 sin repetir el inicio de sesión Google…';
      try {
        await autorizar(usuarioId,ac.signal);
        if (!vigente) return;
        if (identidad()!==usuarioId||selloSesion()!==sello) throw new Error('SESION_CAMBIADA');
        const actual=await leer(registro.id);
        if (!vigente) return;
        if (!propio(actual,usuarioId)) throw new Error('BORRADOR_NO_AUTORIZADO');
        editorAbierto=true; vigente=false; cancelar.remove();
        construirPanel(actual,usuarioId,sello,mensaje,elemento,boton);
        mensaje.textContent='Autorizado. Puedes editar los campos descriptivos.';
      } catch(e) {
        if (vigente) terminar('Edición no realizada: '+(e?.name==='AbortError'?'SOLICITUD_CANCELADA':e?.message||'AUTORIZACION_FALLIDA'));
      }
    });
  }
  window.SIABanimBA02=Object.freeze({agregarAccion});
})();
