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
 * CALENDARIO
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
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Agrupar días por semanas
  let semanaActual = [];
  let todasLasSemanas = [];
  
  // Calcular día de inicio (lunes = 0)
  const primerDiaSemana = (firstDay.getDay() + 6) % 7;
  
  // Agregar días vacíos al inicio
  for (let i = 0; i < primerDiaSemana; i++) {
    semanaActual.push(null);
  }
  
  // Agregar todos los días del mes
  for (let d = 1; d <= daysInMonth; d++) {
    semanaActual.push(d);
    
    if (semanaActual.length === 7) {
      todasLasSemanas.push([...semanaActual]);
      semanaActual = [];
    }
  }
  
  // Completar última semana si es necesario
  if (semanaActual.length > 0) {
    while (semanaActual.length < 7) {
      semanaActual.push(null);
    }
    todasLasSemanas.push(semanaActual);
  }

  // Renderizar cada semana
  todasLasSemanas.forEach((semana, indexSemana) => {
    // Crear fila para la semana
    const semanaDiv = document.createElement('div');
    semanaDiv.className = 'row mb-4 week-row';
    
    // Renderizar cada día de la semana
    semana.forEach((dia, indexDia) => {
      const colDiv = document.createElement('div');
      colDiv.className = 'col p-1';
      
      if (dia === null) {
        // Día vacío
        colDiv.innerHTML = '<div style="min-height: 100px;"></div>';
      } else {
        const fecha = new Date(year, month, dia);
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(dia).padStart(2, '0');
        const fechaKey = `${year}-${mm}-${dd}`;
        
        const diaSemana = fecha.getDay();
        const isDomingo = diaSemana === 0;
        const horasOcupadas = reservas[fechaKey] || [];
        
        // Determinar horario según día
        let inicio, fin;
        if (diaSemana >= 1 && diaSemana <= 5) {
          inicio = 15; fin = 21;
        } else if (diaSemana === 6) {
          inicio = 11; fin = 18;
        } else {
          inicio = 0; fin = 0;
        }
        
        // Nombre corto del día
        const nombreDia = fecha.toLocaleDateString('es-CL', { weekday: 'short' }).toUpperCase();
        
        // Construir HTML del día
        let horasHTML = '';
        
        if (isDomingo) {
          horasHTML = '<div class="text-muted small mt-3">Cerrado</div>';
        } else {
          // Generar badges de horas (mostrar todas, ocupadas y disponibles)
          for (let h = inicio; h < fin; h++) {
            const hora = `${h}:00`;
            const ocupada = horasOcupadas.includes(hora);
            
            if (ocupada) {
              // Hora ocupada - mostrar deshabilitada
              horasHTML += `
                <button 
                  class="btn btn-sm btn-outline-secondary mb-1 hora-ocupada" 
                  disabled
                  style="font-size: 0.75rem; padding: 4px 8px; width: 100%; text-decoration: line-through; opacity: 0.5;">
                  ${hora}
                </button>
              `;
            } else {
              // Hora disponible - clickable
              horasHTML += `
                <button 
                  class="btn btn-sm btn-outline-info mb-1 hora-badge" 
                  onclick="seleccionarHoraDirecta('${fechaKey}', '${hora}')"
                  style="font-size: 0.75rem; padding: 4px 8px; width: 100%;">
                  ${hora}
                </button>
              `;
            }
          }
          
          if (horasHTML === '') {
            horasHTML = '<div class="text-danger small mt-3">Sin horas disponibles</div>';
          }
        }
        
        // Color del encabezado según día
        let headerClass = isDomingo ? 'bg-secondary' : indexDia === 5 ? 'bg-primary' : 'bg-dark';
        
        colDiv.innerHTML = `
          <div class="card h-100 ${isDomingo ? 'border-secondary' : 'border-info'}" style="min-height: 200px;">
            <div class="card-header text-center ${headerClass} text-white py-2">
              <small class="d-block" style="font-size: 0.7rem;">${nombreDia}</small>
              <strong style="font-size: 1.2rem;">${dia}</strong>
            </div>
            <div class="card-body p-2 d-flex flex-column gap-1" style="overflow-y: auto; max-height: 300px;">
              ${horasHTML}
            </div>
          </div>
        `;
      }
      
      semanaDiv.appendChild(colDiv);
    });
    
    calendarEl.appendChild(semanaDiv);
  });
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

  if (!fechaSeleccionada || !servicio || !hora) {
    alert('⚠️ Por favor completa todos los datos:\n- Fecha\n- Servicio\n- Hora');
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
    service: servicio
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

Quedo atento 👍`;

    // Abrir WhatsApp
    window.open(
      `https://wa.me/56956468989?text=${encodeURIComponent(mensaje)}`,
      '_blank'
    );

    // Limpiar selección
    fechaSeleccionada = null;
    servicioSelect.value = '';
    horaSelect.innerHTML = '<option value="">Selecciona hora</option>';
    
    document.querySelectorAll('#calendar .btn.selected')
      .forEach(b => b.classList.remove('selected'));

    // Mostrar confirmación
    alert('✅ Solicitud enviada correctamente\n\nAhora confirma por WhatsApp');

  } catch (err) {
    console.error('❌ Error guardando reserva:', err);
    console.error('Stack:', err.stack);
    
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

Quedo atento 👍`;

        window.open(
          `https://wa.me/56956468989?text=${encodeURIComponent(mensaje)}`,
          '_blank'
        );
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