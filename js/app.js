/*************************************************
 * CONFIG
 *************************************************/
const API_URL = "https://script.google.com/macros/s/AKfycbyZ7coE87QVUmHs9PWo-_oIGFkPh0dfOlwsXt4MmeyZMKJNLRcwnfKMDFPMo_YWqONk/exec";

/*************************************************
 * ELEMENTOS DOM
 *************************************************/
const calendarEl = document.getElementById('calendar');
const mesTitulo = document.getElementById('mesTitulo');
const horaSelect = document.getElementById('hora');
const servicioSelect = document.getElementById('servicio');

/*************************************************
 * ESTADO
 *************************************************/
let fechaActual = new Date();
let fechaSeleccionada = null;
let reservas = {}; // { 'YYYY-MM-DD': ['15:00','16:00'] }

/*************************************************
 * API
 *************************************************/
async function loadReservations() {
  try {
    console.log('🔄 Cargando reservas desde:', API_URL);
    
    const res = await fetch(API_URL);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log('📦 Datos recibidos:', data);
    
    // Normalizar y filtrar fechas válidas
    reservas = {};
    
    for (let fecha in data) {
      let fechaNormalizada = fecha.trim();
      
      // Si la fecha parece ser un string de Date, parsearla
      if (fechaNormalizada.includes('GMT') || fechaNormalizada.includes('Chile') || fechaNormalizada.length > 15) {
        try {
          const fechaObj = new Date(fechaNormalizada);
          if (!isNaN(fechaObj.getTime())) {
            const year = fechaObj.getFullYear();
            const month = String(fechaObj.getMonth() + 1).padStart(2, '0');
            const day = String(fechaObj.getDate()).padStart(2, '0');
            fechaNormalizada = `${year}-${month}-${day}`;
            console.log(`🔄 Fecha parseada: ${fecha} → ${fechaNormalizada}`);
          }
        } catch (e) {
          console.warn('⚠️ No se pudo parsear fecha:', fechaNormalizada);
          continue;
        }
      }
      
      // Validar año razonable
      const año = parseInt(fechaNormalizada.split('-')[0]);
      if (año < 2020 || año > 2030) {
        console.warn('⚠️ Fecha ignorada (año inválido):', fechaNormalizada, 'año:', año);
        continue;
      }
      
      // Procesar horas
      const horasArray = data[fecha];
      const horasLimpias = [];
      
      if (Array.isArray(horasArray)) {
        horasArray.forEach(hora => {
          let horaLimpia = '';
          
          if (typeof hora === 'string') {
            // Si es string Date, parsearlo
            if (hora.includes('GMT') || hora.includes('1899')) {
              try {
                const horaObj = new Date(hora);
                if (!isNaN(horaObj.getTime())) {
                  const h = horaObj.getHours();
                  const m = horaObj.getMinutes();
                  horaLimpia = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                  console.log(`🔄 Hora parseada: ${hora.substring(0, 30)}... → ${horaLimpia}`);
                }
              } catch (e) {
                console.warn('⚠️ No se pudo parsear hora:', hora);
              }
            } else {
              // Ya es HH:MM
              horaLimpia = hora.trim();
            }
          }
          
          if (horaLimpia) {
            horasLimpias.push(horaLimpia);
          }
        });
      }
      
      if (horasLimpias.length > 0) {
        reservas[fechaNormalizada] = horasLimpias;
      }
    }
    
    console.log('✅ Reservas válidas cargadas:', reservas);
    
  } catch (err) {
    console.error('❌ Error al cargar reservas:', err);
    console.error('Stack:', err.stack);
    
    // Mostrar alerta solo si es un error crítico
    if (err.message.includes('Failed to fetch')) {
      alert('⚠️ No se puede conectar con el servidor de reservas.\n\n' + 
            'Verifica:\n' +
            '1. Que estés conectado a internet\n' +
            '2. Que la URL del API sea correcta\n' +
            '3. Que el Apps Script esté desplegado\n\n' +
            'Puedes continuar, pero no verás las reservas existentes.');
    }
    
    reservas = {};
  }
}

/*************************************************
 * CALENDARIO - GRID MENSUAL COMPACTO
 *************************************************/
async function renderCalendar() {
  await loadReservations();
  calendarEl.innerHTML = '';

  const year = fechaActual.getFullYear();
  const month = fechaActual.getMonth();

  mesTitulo.textContent = fechaActual.toLocaleDateString('es-CL', {
    month: 'long',
    year: 'numeric'
  });

  const firstDay = new Date(year, month, 1);
  const startDay = (firstDay.getDay() + 6) % 7; // Lunes = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Crear grid del calendario
  let gridHTML = '<div class="calendar-grid">';

  // Espacios vacíos al inicio
  for (let i = 0; i < startDay; i++) {
    gridHTML += '<div class="calendar-day empty"></div>';
  }

  // Días del mes
  for (let d = 1; d <= daysInMonth; d++) {
    const fecha = new Date(year, month, d);
    
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const fechaKey = `${year}-${mm}-${dd}`;
    
    const dia = fecha.getDay();
    const isDomingo = dia === 0;
    const horasOcupadas = reservas[fechaKey] || [];
    
    // Calcular horas disponibles
    let inicio, fin;
    if (dia >= 1 && dia <= 5) {
      inicio = 15; fin = 21;
    } else if (dia === 6) {
      inicio = 11; fin = 18;
    } else {
      inicio = 0; fin = 0;
    }
    
    const totalHoras = fin - inicio;
    const horasDisponibles = totalHoras - horasOcupadas.length;
    
    // Determinar clase y badge
    let dayClass = 'calendar-day';
    let badge = '';
    let indicator = '';
    
    if (isDomingo) {
      dayClass += ' closed';
      indicator = '<div class="day-indicator closed-indicator">Cerrado</div>';
    } else if (horasDisponibles === 0) {
      dayClass += ' full';
      indicator = '<div class="day-indicator full-indicator">Completo</div>';
    } else if (horasOcupadas.length > 0) {
      dayClass += ' available';
      indicator = `<div class="day-indicator available-indicator">${horasDisponibles} disponibles</div>`;
      badge = `<span class="day-badge">${horasDisponibles}</span>`;
    } else {
      dayClass += ' free';
    }
    
    gridHTML += `
      <div class="${dayClass}" 
           data-fecha="${fechaKey}"
           onclick="mostrarHorasDelDia('${fechaKey}', '${d}')">
        <div class="day-number">${d}</div>
        ${badge}
        ${indicator}
      </div>
    `;
  }

  gridHTML += '</div>';
  
  // Agregar selector de horas (oculto inicialmente)
  gridHTML += `
    <div id="horasSelector" class="horas-selector" style="display: none;">
      <div class="horas-selector-header">
        <h5 class="mb-0">Selecciona una hora</h5>
        <button class="btn-close btn-close-white" onclick="cerrarHorasSelector()"></button>
      </div>
      <div id="horasBtns" class="horas-buttons"></div>
    </div>
  `;
  
  calendarEl.innerHTML = gridHTML;
}

/*************************************************
 * MOSTRAR HORAS DEL DÍA
 *************************************************/
function mostrarHorasDelDia(fechaKey, dia) {
  const [y, m, d] = fechaKey.split('-');
  const fecha = new Date(y, m - 1, d);
  const diaSemana = fecha.getDay();
  
  // No hacer nada si es domingo
  if (diaSemana === 0) return;
  
  // Marcar fecha seleccionada
  fechaSeleccionada = fechaKey;
  
  // Resaltar día seleccionado
  document.querySelectorAll('.calendar-day').forEach(day => {
    day.classList.remove('selected');
  });
  document.querySelector(`[data-fecha="${fechaKey}"]`).classList.add('selected');
  
  // Determinar horario
  let inicio, fin;
  if (diaSemana >= 1 && diaSemana <= 5) {
    inicio = 15; fin = 21;
  } else if (diaSemana === 6) {
    inicio = 11; fin = 18;
  }
  
  const horasOcupadas = reservas[fechaKey] || [];
  
  // Generar botones de horas
  let horasHTML = '';
  for (let h = inicio; h < fin; h++) {
    const hora = `${h}:00`;
    const ocupada = horasOcupadas.includes(hora);
    
    if (ocupada) {
      horasHTML += `
        <button class="btn btn-outline-secondary hora-btn-disabled" disabled>
          ${hora} <span class="badge bg-danger ms-1">✕</span>
        </button>
      `;
    } else {
      horasHTML += `
        <button class="btn btn-outline-info hora-btn" 
                onclick="seleccionarHoraYCerrar('${fechaKey}', '${hora}')">
          ${hora}
        </button>
      `;
    }
  }
  
  // Mostrar selector de horas
  const selector = document.getElementById('horasSelector');
  const horasBtns = document.getElementById('horasBtns');
  
  const fechaFormato = fecha.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  
  document.querySelector('.horas-selector-header h5').textContent = 
    `Horas disponibles - ${fechaFormato}`;
  
  horasBtns.innerHTML = horasHTML;
  selector.style.display = 'block';
  
  // Scroll al selector
  selector.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/*************************************************
 * CERRAR SELECTOR DE HORAS
 *************************************************/
function cerrarHorasSelector() {
  document.getElementById('horasSelector').style.display = 'none';
  
  // Desmarcar día seleccionado
  document.querySelectorAll('.calendar-day').forEach(day => {
    day.classList.remove('selected');
  });
}

/*************************************************
 * SELECCIONAR HORA Y CERRAR
 *************************************************/
function seleccionarHoraYCerrar(fechaKey, hora) {
  // Marcar fecha y hora seleccionadas
  fechaSeleccionada = fechaKey;
  horaSelect.innerHTML = `<option value="${hora}" selected>${hora}</option>`;
  
  // Cerrar selector
  cerrarHorasSelector();
  
  // Scroll al formulario
  servicioSelect.focus();
  
  console.log(`✅ Seleccionado: ${fechaKey} a las ${hora}`);
}

/*************************************************
 * SELECCIONAR HORA DIRECTAMENTE
 *************************************************/
function seleccionarHoraDirecta(fechaKey, hora) {
  // Marcar fecha seleccionada
  fechaSeleccionada = fechaKey;
  
  // Llenar dropdown de hora con la hora seleccionada
  horaSelect.innerHTML = `<option value="${hora}" selected>${hora}</option>`;
  
  // Resaltar visualmente el botón
  document.querySelectorAll('.hora-badge').forEach(btn => {
    btn.classList.remove('active', 'btn-info');
    btn.classList.add('btn-outline-info');
  });
  
  event.target.classList.remove('btn-outline-info');
  event.target.classList.add('btn-info', 'active');
  
  // Scroll al formulario
  servicioSelect.focus();
  
  console.log(`✅ Seleccionado: ${fechaKey} a las ${hora}`);
}

/*************************************************
 * SELECCIONAR FECHA
 *************************************************/
function seleccionarFecha(fechaKey, btn) {
  fechaSeleccionada = fechaKey;
  horaSelect.innerHTML = '<option value="">Selecciona hora</option>';

  document.querySelectorAll('#calendar .btn')
    .forEach(b => b.classList.remove('selected'));

  btn.classList.add('selected');

  cargarHoras(fechaKey);
  
  // Mostrar información de disponibilidad
  mostrarInfoDisponibilidad(fechaKey);
}

/*************************************************
 * MOSTRAR INFO DE DISPONIBILIDAD
 *************************************************/
function mostrarInfoDisponibilidad(fechaKey) {
  const [y, m, d] = fechaKey.split('-');
  const fecha = new Date(y, m - 1, d);
  const dia = fecha.getDay();
  
  const fechaTexto = fecha.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  
  let horario = '';
  if (dia >= 1 && dia <= 5) {
    horario = '15:00 - 21:00';
  } else if (dia === 6) {
    horario = '11:00 - 18:00';
  } else {
    horario = 'Cerrado';
  }
  
  const horasOcupadas = reservas[fechaKey] || [];
  const totalHoras = dia >= 1 && dia <= 5 ? 6 : dia === 6 ? 7 : 0;
  const disponibles = totalHoras - horasOcupadas.length;
  
  // Mostrar alert con información
  console.log(`📅 ${fechaTexto}\n🕐 Horario: ${horario}\n✅ Disponibles: ${disponibles}/${totalHoras} horas`);
}

/*************************************************
 * HORAS DISPONIBLES
 *************************************************/
function cargarHoras(fechaKey) {
  horaSelect.innerHTML = '<option value="">Selecciona hora</option>';

  // PARSEO SEGURO (evita bug UTC)
  const [y, m, d] = fechaKey.split('-');
  const fecha = new Date(y, m - 1, d);
  const dia = fecha.getDay();

  let inicio, fin;

  // Lunes a Viernes
  if (dia >= 1 && dia <= 5) {
    inicio = 15;
    fin = 21;
  }
  // Sábado
  else if (dia === 6) {
    inicio = 11;
    fin = 18;
  }
  // Domingo (cerrado)
  else {
    return;
  }

  const horasOcupadas = reservas[fechaKey] || [];

  for (let h = inicio; h < fin; h++) {
    const hora = `${h}:00`;

    if (!horasOcupadas.includes(hora)) {
      const opt = document.createElement('option');
      opt.value = hora;
      opt.textContent = hora;
      horaSelect.appendChild(opt);
    }
  }
}


/*************************************************
 * ENVIAR RESERVA
 *************************************************/
async function enviarWhatsApp() {
  const servicio = servicioSelect.value;
  const hora = horaSelect.value;
  const nombreCliente = document.getElementById('nombreCliente').value.trim();
  const telefonoCliente = document.getElementById('telefonoCliente').value.trim();

  // Validar todos los campos
  if (!fechaSeleccionada || !servicio || !hora) {
    alert('⚠️ Por favor completa todos los datos:\n- Fecha\n- Servicio\n- Hora');
    return;
  }

  if (!nombreCliente) {
    alert('⚠️ Por favor ingresa tu nombre');
    document.getElementById('nombreCliente').focus();
    return;
  }

  if (!telefonoCliente) {
    alert('⚠️ Por favor ingresa tu teléfono');
    document.getElementById('telefonoCliente').focus();
    return;
  }

  // Obtener botón y deshabilitar mientras procesa
  const btnEnviar = document.querySelector('button[onclick="enviarWhatsApp()"]');
  const textoOriginal = btnEnviar.innerHTML;
  btnEnviar.disabled = true;
  btnEnviar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';

  // Preparar datos
  const reservaData = {
    date: fechaSeleccionada,
    time: hora,
    service: servicio,
    name: nombreCliente,
    phone: telefonoCliente
  };

  console.log('📤 Enviando reserva:', reservaData);

  // Guardar en Google Sheets
  try {
    // Intento 1: POST normal
    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors', // ← Importante para evitar error CORS desde localhost
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reservaData)
      });

      console.log('📥 Respuesta POST:', response);

      // Con mode: 'no-cors', no podemos leer la respuesta
      // pero si llegamos aquí sin error, asumimos que funcionó
      
    } catch (fetchError) {
      console.error('❌ Error en fetch POST:', fetchError);
      
      // Si falla, intentar método alternativo usando GET con parámetros
      console.log('🔄 Intentando método alternativo...');
      
      const params = new URLSearchParams({
        action: 'create',
        date: fechaSeleccionada,
        time: hora,
        service: servicio
      });
      
      response = await fetch(`${API_URL}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    console.log('✅ Reserva procesada');

    // Recargar calendario para mostrar la nueva reserva
    await renderCalendar();

    // Preparar mensaje WhatsApp
    const [year, month, day] = fechaSeleccionada.split('-');
    const fecha = new Date(year, month - 1, day);
    const fechaTxt = fecha.toLocaleDateString('es-CL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mensaje = `Hola 👋 quiero agendar en Jere Barber:

📅 Día: ${fechaTxt}
⏰ Hora: ${hora}
✂️ Servicio: ${servicio}

👤 Nombre: ${nombreCliente}
📱 Teléfono: ${telefonoCliente}

Quedo atento 👍`;

    // Abrir WhatsApp - MÉTODO MEJORADO PARA MÓVIL
    const numeroWhatsApp = '56956468989';
    const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
    
    console.log('📱 Abriendo WhatsApp:', urlWhatsApp);
    
    // Detectar si es móvil
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // En móvil: usar window.location.href (más confiable)
      console.log('📱 Móvil detectado - usando location.href');
      window.location.href = urlWhatsApp;
    } else {
      // En desktop: intentar window.open
      console.log('💻 Desktop - usando window.open');
      const ventanaWhatsApp = window.open(urlWhatsApp, '_blank');
      
      if (!ventanaWhatsApp || ventanaWhatsApp.closed || typeof ventanaWhatsApp.closed === 'undefined') {
        // Fallback si popup bloqueado
        console.log('🔄 Popup bloqueado, usando location.href');
        window.location.href = urlWhatsApp;
      }
    }

    // Limpiar selección (con delay para móvil)
    setTimeout(() => {
      fechaSeleccionada = null;
      servicioSelect.value = '';
      horaSelect.innerHTML = '<option value="">Selecciona hora</option>';
      document.getElementById('nombreCliente').value = '';
      document.getElementById('telefonoCliente').value = '';
      
      document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('selected');
      });
      
      // Restaurar botón
      btnEnviar.disabled = false;
      btnEnviar.innerHTML = textoOriginal;
      
      // Mostrar confirmación
      if (!isMobile) {
        alert('✅ Solicitud enviada\n\nAhora confirma por WhatsApp');
      }
    }, 500);

  } catch (err) {
    console.error('❌ Error guardando reserva:', err);
    console.error('Stack:', err.stack);
    
    // Restaurar botón
    btnEnviar.disabled = false;
    btnEnviar.innerHTML = textoOriginal;
    
    // Mensaje de error mejorado
    let mensajeError = '❌ Error al procesar la reserva:\n\n';
    
    if (err.message.includes('Failed to fetch')) {
      mensajeError += 'No se pudo conectar con el servidor.\n\n';
      mensajeError += 'OPCIONES:\n';
      mensajeError += '1. Intenta nuevamente\n';
      mensajeError += '2. Envía la solicitud directamente por WhatsApp\n';
      mensajeError += '3. El admin puede agregar la reserva manualmente\n\n';
      mensajeError += '¿Quieres abrir WhatsApp de todas formas?';
      
      if (confirm(mensajeError)) {
        // Abrir WhatsApp aunque no se guardó
        const [year, month, day] = fechaSeleccionada.split('-');
        const fecha = new Date(year, month - 1, day);
        const fechaTxt = fecha.toLocaleDateString('es-CL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        const mensaje = `Hola 👋 quiero agendar en Jere Barber:

📅 Día: ${fechaTxt}
⏰ Hora: ${hora}
✂️ Servicio: ${servicio}

👤 Nombre: ${nombreCliente}
📱 Teléfono: ${telefonoCliente}

Quedo atento 👍`;

        const numeroWhatsApp = '56956468989';
        const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
        
        console.log('📱 Abriendo WhatsApp (fallback):', urlWhatsApp);
        
        // Detectar móvil
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
          window.location.href = urlWhatsApp;
        } else {
          const ventanaWhatsApp = window.open(urlWhatsApp, '_blank');
          if (!ventanaWhatsApp) {
            window.location.href = urlWhatsApp;
          }
        }
      }
    } else {
      mensajeError += err.message;
      alert(mensajeError);
    }
    
  } finally {
    // Restaurar botón
    btnEnviar.disabled = false;
    btnEnviar.innerHTML = textoOriginal;
  }
}

/*************************************************
 * NAVEGACIÓN MESES
 *************************************************/
function cambiarMes(dir) {
  fechaActual.setMonth(fechaActual.getMonth() + dir);
  renderCalendar();
}

/*************************************************
 * INIT
 *************************************************/
renderCalendar();

/*************************************************
 * GALERÍA - Mostrar imagen en modal
 *************************************************/
function mostrarImagen(src) {
  document.getElementById('modalImage').src = src;
}