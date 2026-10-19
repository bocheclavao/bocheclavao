document.addEventListener('DOMContentLoaded', async function() {
  const db = window.supabaseClient;
  if (!db) {
    window.location.href = 'index.html';
    return;
  }
  const { data: { session } } = await db.auth.getSession();
  if (!session || !session.user) {
    window.location.href = 'index.html';
    return;
  }

// ==========================================
// DICCIONARIO COMPLETO DE PAÍSES → CÓDIGO ISO
// ==========================================
const paisesAISO = {
  // América
  'Argentina': 'ar', 'Bolivia': 'bo', 'Brasil': 'br', 'Chile': 'cl',
  'Colombia': 'co', 'Costa Rica': 'cr', 'Cuba': 'cu', 'Ecuador': 'ec',
  'El Salvador': 'sv', 'Estados Unidos': 'us', 'Guatemala': 'gt',
  'Haití': 'ht', 'Honduras': 'hn', 'Jamaica': 'jm', 'México': 'mx',
  'Nicaragua': 'ni', 'Panamá': 'pa', 'Paraguay': 'py', 'Perú': 'pe',
  'República Dominicana': 'do', 'Uruguay': 'uy', 'Venezuela': 've',
  'Bahamas': 'bs', 'Barbados': 'bb', 'Belice': 'bz', 'Guyana': 'gy',
  'Surinam': 'sr', 'Trinidad y Tobago': 'tt',
  
  // Europa
  'España': 'es', 'Alemania': 'de', 'Francia': 'fr', 'Italia': 'it',
  'Reino Unido': 'gb', 'Portugal': 'pt', 'Países Bajos': 'nl',
  'Bélgica': 'be', 'Suiza': 'ch', 'Austria': 'at', 'Grecia': 'gr',
  'Polonia': 'pl', 'República Checa': 'cz', 'Hungría': 'hu',
  'Rumania': 'ro', 'Bulgaria': 'bg', 'Croacia': 'hr', 'Serbia': 'rs',
  'Ucrania': 'ua', 'Rusia': 'ru', 'Bielorrusia': 'by', 'Lituania': 'lt',
  'Letonia': 'lv', 'Estonia': 'ee', 'Finlandia': 'fi', 'Suecia': 'se',
  'Noruega': 'no', 'Dinamarca': 'dk', 'Islandia': 'is', 'Irlanda': 'ie',
  
  // Asia
  'China': 'cn', 'Japón': 'jp', 'Corea del Sur': 'kr', 'Corea del Norte': 'kp',
  'India': 'in', 'Pakistán': 'pk', 'Bangladés': 'bd', 'Indonesia': 'id',
  'Filipinas': 'ph', 'Tailandia': 'th', 'Vietnam': 'vn', 'Malasia': 'my',
  'Singapur': 'sg', 'Hong Kong': 'hk', 'Taiwán': 'tw', 'Mongolia': 'mn',
  'Nepal': 'np', 'Sri Lanka': 'lk', 'Myanmar': 'mm', 'Camboya': 'kh',
  'Laos': 'la', 'Brunéi': 'bn', 'Maldivas': 'mv', 'Bután': 'bt',
  
  // África
  'Sudáfrica': 'za', 'Egipto': 'eg', 'Nigeria': 'ng', 'Kenia': 'ke',
  'Etiopía': 'et', 'Ghana': 'gh', 'Marruecos': 'ma', 'Argelia': 'dz',
  'Túnez': 'tn', 'Libia': 'ly', 'Sudán': 'sd', 'Tanzania': 'tz',
  'Uganda': 'ug', 'Zimbabue': 'zw', 'Angola': 'ao', 'Mozambique': 'mz',
  'Madagascar': 'mg', 'Mauricio': 'mu', 'Seychelles': 'sc',
  
  // Oriente Medio
  'Arabia Saudita': 'sa', 'Emiratos Árabes Unidos': 'ae', 'Qatar': 'qa',
  'Kuwait': 'kw', 'Baréin': 'bh', 'Omán': 'om', 'Yemen': 'ye',
  'Irak': 'iq', 'Irán': 'ir', 'Israel': 'il', 'Jordania': 'jo',
  'Líbano': 'lb', 'Siria': 'sy', 'Turquía': 'tr',
  
  // Oceanía
  'Australia': 'au', 'Nueva Zelanda': 'nz', 'Fiyi': 'fj',
  'Papúa Nueva Guinea': 'pg', 'Samoa': 'ws', 'Tonga': 'to',
  'Vanuatu': 'vu', 'Islas Salomón': 'sb',
  
  // Caribe
  'Antigua y Barbuda': 'ag', 'Dominica': 'dm', 'Granada': 'gd',
  'San Cristóbal y Nieves': 'kn', 'Santa Lucía': 'lc',
  'San Vicente y las Granadinas': 'vc'
};

// Función para obtener código ISO desde nombre de país
const obtenerCodigoPais = (nombrePais) => {
  if (!nombrePais) return null;
  
  // Buscar exacto
  if (paisesAISO[nombrePais]) {
    return paisesAISO[nombrePais];
  }
  
  // Buscar ignorando mayúsculas/minúsculas
  const nombreNormalizado = nombrePais.trim().toLowerCase();
  for (const [pais, codigo] of Object.entries(paisesAISO)) {
    if (pais.toLowerCase() === nombreNormalizado) {
      return codigo;
    }
  }
  
  // Si no encuentra, retorna null
  return null;
};

// Función principal para obtener URL de bandera
const getBanderaUrl = (pais, tamaño = 80) => {
  const codigo = obtenerCodigoPais(pais);
  if (!codigo) return null;
  
  // FlagCDN soporta: w40, w80, w160, w320, w640 o .svg
  return `https://flagcdn.com/w${tamaño}/${codigo}.png`;
};

// Función para verificar si un país existe en el diccionario
const paisExiste = (pais) => obtenerCodigoPais(pais) !== null;

// Función para agregar un país nuevo al diccionario (útil si falta alguno)
const agregarPais = (nombre, codigoISO) => {
  paisesAISO[nombre] = codigoISO.toLowerCase();
};

  const safeSetText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  const safeSetHTML = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };

  try {
    // 1. Obtener perfil
    const { data: perfil, error } = await db
      .from('perfiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error || !perfil) throw new Error('No se pudo cargar el perfil del bochador.');

    // 2. Procesar datos
    const nombre = perfil.nombre || 'Bochador';
    const userId = perfil.user_id || 'N/A';
    const email = session.user.email;
    const nacionalidad = perfil.nacionalidad || 'No especificada';
    const flag = banderas[nacionalidad] || '🏳️';

    let edad = 0;
    let edadTexto = '--';
    if (perfil.fecha_nacimiento) {
      const hoy = new Date();
      const nacimiento = new Date(perfil.fecha_nacimiento);
      edad = hoy.getFullYear() - nacimiento.getFullYear();
      const mes = hoy.getMonth() - nacimiento.getMonth();
      if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
      edadTexto = edad + ' años';
    }

    const manoHabil = perfil.mano_habil ? perfil.mano_habil.charAt(0).toUpperCase() + perfil.mano_habil.slice(1) : 'No especificada';
    const peso = perfil.peso || 0;
    const estatura = perfil.estatura || 0;
    const brazo = perfil.longitud_brazo || 0;
    const sexo = perfil.sexo || 'No especificado';
    const telefono = perfil.telefono || 'No especificado';
    const partidos = perfil.partidos_jugados || 0;
    const aciertos = perfil.porcentaje_aciertos || 0;
    const categoria = perfil.categoria || 'F';
    const estadoClasif = perfil.estado_clasificacion || 'No clasificado';

    let fechaNacFormateada = 'No especificada';
    if (perfil.fecha_nacimiento) {
      const dateObj = new Date(perfil.fecha_nacimiento);
      fechaNacFormateada = dateObj.toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    let ultimosPartidos = 'Sin registros';
    if (perfil.ultimos_3_partidos && Array.isArray(perfil.ultimos_3_partidos)) {
      const filtrados = perfil.ultimos_3_partidos.filter(p => p).slice(0, 3);
      if (filtrados.length > 0) ultimosPartidos = filtrados.map(f => new Date(f).toLocaleDateString('es-VE')).join(', ');
    }

    // 3. Renderizar FICHA PRINCIPAL
    const avatarUrl = perfil.avatar_url || session.user.user_metadata?.avatar_url;
    const avatarImg = document.getElementById('profileAvatar');
    const avatarPlaceholder = document.getElementById('profileAvatarPlaceholder');
    if (avatarImg && avatarPlaceholder) {
      if (avatarUrl) {
        avatarImg.src = avatarUrl;
        avatarImg.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
      } else {
        avatarImg.style.display = 'none';
        avatarPlaceholder.style.display = 'flex';
        avatarPlaceholder.textContent = nombre.charAt(0).toUpperCase();
      }
    }

    // Ficha principal
    safeSetText('profileName', nombre);
    safeSetText('profileId', `ID: ${userId}`);
    safeSetText('profileEmail', email);
    safeSetText('flagIcon', flag);
    safeSetText('statNacionalidad', nacionalidad);
    safeSetText('fichaPartidos', partidos);
    safeSetText('fichaAciertos', aciertos + '%');
    safeSetText('fichaCategoria', categoria.toUpperCase());
    safeSetText('fichaEdad', edad || '--');
    safeSetText('fichaBadgeCat', categoria.toUpperCase());
    safeSetText('fichaBigNumber', partidos);

    // Barras de progreso (escaladas a valores máximos razonables)
    const maxPeso = 150, maxEstatura = 220, maxBrazo = 100;
    safeSetText('barPeso', peso ? `${peso} kg` : '-- kg');
    safeSetText('barEstatura', estatura ? `${estatura} cm` : '-- cm');
    safeSetText('barBrazo', brazo ? `${brazo} cm` : '-- cm');
    const setBar = (id, value, max) => {
      const el = document.getElementById(id);
      if (el && value && max) el.style.width = Math.min((value / max) * 100, 100) + '%';
    };
    setBar('barPesoFill', peso, maxPeso);
    setBar('barEstaturaFill', estatura, maxEstatura);
    setBar('barBrazoFill', brazo, maxBrazo);

    // Estrellas según aciertos
    const estrellasEl = document.getElementById('fichaStars');
    if (estrellasEl) {
      const stars = Math.min(5, Math.floor((aciertos / 20) + 1));
      estrellasEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    }

    // Descripción personalizada
    const descEl = document.getElementById('fichaDescripcion');
    if (descEl) {
      descEl.textContent = `Bochador ${estadoClasif.toLowerCase() === 'clasificado' ? 'clasificado' : 'en formación'} en categoría ${categoria.toUpperCase()}. ${partidos} partidos disputados con un ${aciertos}% de precisión. ${nacionalidad !== 'No especificada' ? `Representa a ${nacionalidad}.` : ''}`;
    }

    // Datos detallados (cards secundarias)
    safeSetHTML('statSexo', `${sexo} <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statFechaNac', `${fechaNacFormateada} <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statTelefono', `${telefono} <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statMano', `${manoHabil} <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statPeso', `${peso ? peso + ' kg' : 'No especificado'} <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statEstatura', `${estatura ? estatura + ' cm' : 'No especificada'} <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statBrazo', `${brazo ? brazo + ' cm' : 'No especificada'} <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statPartidos', `${partidos} <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statAciertos', `${aciertos}% <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statUltimosPartidos', `${ultimosPartidos} <i class="fas fa-lock locked-icon" style="margin-left: auto;"></i>`);
    safeSetText('statCategoria', categoria.toUpperCase());
    safeSetText('statEstadoClasif', estadoClasif);

    // 4. Cargar carrusel TOP 10
    await cargarCarruselBochadores();

    // 5. Mostrar contenido
    const loadingState = document.getElementById('loadingState');
    const profileContent = document.getElementById('profileContent');
    if (loadingState) loadingState.style.display = 'none';
    if (profileContent) profileContent.style.display = 'block';

  } catch (err) {
    console.error('Error al cargar el perfil:', err);
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
      loadingState.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="color: var(--rojo); font-size: 2rem;"></i>
        <p style="color: var(--rojo); margin-top: 15px;">Error al cargar el perfil. Por favor, intenta de nuevo.</p>
      `;
    }
  }

  // ==========================================
  // CARRUSEL TOP 10 BOCHADORES
  // ==========================================
  async function cargarCarruselBochadores() {
    try {
      const { data: bochadores, error } = await db
        .from('perfiles')
        .select('nombre, avatar_url, partidos_jugados, porcentaje_aciertos, user_id, estado_clasificacion, categoria')
        .eq('estado_kyc', 'verificado')
        .order('porcentaje_aciertos', { ascending: false })
        .limit(10);

      if (error) throw error;

      const track = document.getElementById('carouselTrack');
      if (!track) return;

      let htmlContent = '';
      bochadores.forEach((jugador, index) => {
        const nombre = jugador.nombre || 'Jugador Anónimo';
        const avatar = jugador.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=FFD700&color=000&size=128`;
        const partidos = jugador.partidos_jugados || 0;
        const aciertos = jugador.porcentaje_aciertos ? jugador.porcentaje_aciertos.toFixed(1) : '0.0';
        const categoria = jugador.categoria || 'F';
        const estado = jugador.estado_clasificacion || 'No clasificado';
        const esTop3 = index < 3;
        const borderColor = esTop3 ? 'var(--dorado)' : 'var(--azul-electrico)';
        const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

        htmlContent += `
          <div class="player-card" style="border-color: ${borderColor};">
            <div class="player-rank">${rankIcon} • Categoría ${categoria.toUpperCase()}</div>
            <img src="${avatar}" alt="${nombre}" class="player-avatar" style="border-color: ${borderColor};">
            <div class="player-name">${nombre}</div>
            <div style="font-size: 0.75rem; color: ${estado.toLowerCase() === 'clasificado' ? '#00ff00' : 'var(--gris-texto)'}; margin-bottom: 12px; font-weight: 600;">
              ${estado}
            </div>
            <div class="player-stats">
              <div class="stat-item">
                <span class="stat-value">${partidos}</span>
                <span class="stat-label">Partidos</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">${aciertos}%</span>
                <span class="stat-label">Precisión</span>
              </div>
            </div>
          </div>
        `;
      });

      // Duplicar para scroll infinito
      track.innerHTML = htmlContent + htmlContent;
    } catch (err) {
      console.error('Error al cargar bochadores:', err);
    }
  }

  // ==========================================
  // MODO EVENTO
  // ==========================================
  const btnModoEvento = document.getElementById('btnModoEvento');
  const btnSalirEvento = document.getElementById('btnSalirEvento');
  if (btnModoEvento) btnModoEvento.addEventListener('click', activarModoEvento);
  if (btnSalirEvento) btnSalirEvento.addEventListener('click', salirModoEvento);

  function activarModoEvento() {
    document.body.classList.add('event-mode');
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen();
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
  }
  function salirModoEvento() {
    document.body.classList.remove('event-mode');
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  }
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) document.body.classList.remove('event-mode');
  });
});
