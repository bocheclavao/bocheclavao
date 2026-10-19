document.addEventListener('DOMContentLoaded', async function() {
  const db = window.supabaseClient;
  if (!db) { window.location.href = 'index.html'; return; }
  
  const { data: { session } } = await db.auth.getSession();
  if (!session || !session.user) { window.location.href = 'index.html'; return; }

  // ==========================================
  // DICCIONARIO EXHAUSTIVO DE PAÍSES (Códigos ISO 3166-1 alpha-2)
  // ==========================================
  const paisesAISO = {
    'Afganistán': 'af', 'Albania': 'al', 'Alemania': 'de', 'Andorra': 'ad', 'Angola': 'ao',
    'Antigua y Barbuda': 'ag', 'Arabia Saudita': 'sa', 'Argelia': 'dz', 'Argentina': 'ar',
    'Armenia': 'am', 'Australia': 'au', 'Austria': 'at', 'Azerbaiyán': 'az', 'Bahamas': 'bs',
    'Bangladés': 'bd', 'Barbados': 'bb', 'Baréin': 'bh', 'Bélgica': 'be', 'Belice': 'bz',
    'Benín': 'bj', 'Bielorrusia': 'by', 'Birmania': 'mm', 'Bolivia': 'bo', 'Bosnia y Herzegovina': 'ba',
    'Botsuana': 'bw', 'Brasil': 'br', 'Brunéi': 'bn', 'Bulgaria': 'bg', 'Burkina Faso': 'bf',
    'Burundi': 'bi', 'Bután': 'bt', 'Cabo Verde': 'cv', 'Camboya': 'kh', 'Camerún': 'cm',
    'Canadá': 'ca', 'Catar': 'qa', 'Chad': 'td', 'Chile': 'cl', 'China': 'cn',
    'Chipre': 'cy', 'Ciudad del Vaticano': 'va', 'Colombia': 'co', 'Comoras': 'km', 'Congo': 'cg',
    'Corea del Norte': 'kp', 'Corea del Sur': 'kr', 'Costa de Marfil': 'ci', 'Costa Rica': 'cr',
    'Croacia': 'hr', 'Cuba': 'cu', 'Dinamarca': 'dk', 'Dominica': 'dm', 'Ecuador': 'ec',
    'Egipto': 'eg', 'El Salvador': 'sv', 'Emiratos Árabes Unidos': 'ae', 'Eritrea': 'er', 'Eslovaquia': 'sk',
    'Eslovenia': 'si', 'España': 'es', 'Estados Unidos': 'us', 'Estonia': 'ee', 'Etiopía': 'et',
    'Filipinas': 'ph', 'Finlandia': 'fi', 'Fiyi': 'fj', 'Francia': 'fr', 'Gabón': 'ga',
    'Gambia': 'gm', 'Georgia': 'ge', 'Ghana': 'gh', 'Granada': 'gd', 'Grecia': 'gr',
    'Guatemala': 'gt', 'Guinea': 'gn', 'Guinea Ecuatorial': 'gq', 'Guinea-Bisáu': 'gw', 'Guyana': 'gy',
    'Haití': 'ht', 'Honduras': 'hn', 'Hungría': 'hu', 'India': 'in', 'Indonesia': 'id',
    'Irak': 'iq', 'Irán': 'ir', 'Irlanda': 'ie', 'Islandia': 'is', 'Islas Marshall': 'mh',
    'Islas Salomón': 'sb', 'Israel': 'il', 'Italia': 'it', 'Jamaica': 'jm', 'Japón': 'jp',
    'Jordania': 'jo', 'Kazajistán': 'kz', 'Kenia': 'ke', 'Kirguistán': 'kg', 'Kiribati': 'ki',
    'Kuwait': 'kw', 'Laos': 'la', 'Lesoto': 'ls', 'Letonia': 'lv', 'Líbano': 'lb',
    'Liberia': 'lr', 'Libia': 'ly', 'Liechtenstein': 'li', 'Lituania': 'lt', 'Luxemburgo': 'lu',
    'Macedonia del Norte': 'mk', 'Madagascar': 'mg', 'Malasia': 'my', 'Malaui': 'mw', 'Maldivas': 'mv',
    'Malí': 'ml', 'Malta': 'mt', 'Marruecos': 'ma', 'Mauricio': 'mu', 'Mauritania': 'mr',
    'México': 'mx', 'Micronesia': 'fm', 'Moldavia': 'md', 'Mónaco': 'mc', 'Mongolia': 'mn',
    'Montenegro': 'me', 'Mozambique': 'mz', 'Namibia': 'na', 'Nauru': 'nr', 'Nepal': 'np',
    'Nicaragua': 'ni', 'Níger': 'ne', 'Nigeria': 'ng', 'Noruega': 'no', 'Nueva Zelanda': 'nz',
    'Omán': 'om', 'Países Bajos': 'nl', 'Pakistán': 'pk', 'Palaos': 'pw', 'Panamá': 'pa',
    'Papúa Nueva Guinea': 'pg', 'Paraguay': 'py', 'Perú': 'pe', 'Polonia': 'pl', 'Portugal': 'pt',
    'Reino Unido': 'gb', 'República Centroafricana': 'cf', 'República Checa': 'cz', 'República del Congo': 'cd',
    'República Dominicana': 'do', 'Ruanda': 'rw', 'Rumania': 'ro', 'Rusia': 'ru', 'Samoa': 'ws',
    'San Cristóbal y Nieves': 'kn', 'San Marino': 'sm', 'San Vicente y las Granadinas': 'vc',
    'Santa Lucía': 'lc', 'Santo Tomé y Príncipe': 'st', 'Senegal': 'sn', 'Serbia': 'rs', 'Seychelles': 'sc',
    'Sierra Leona': 'sl', 'Singapur': 'sg', 'Siria': 'sy', 'Somalia': 'so', 'Sri Lanka': 'lk',
    'Sudáfrica': 'za', 'Sudán': 'sd', 'Sudán del Sur': 'ss', 'Suecia': 'se', 'Suiza': 'ch',
    'Surinam': 'sr', 'Tailandia': 'th', 'Tanzania': 'tz', 'Tayikistán': 'tj', 'Timor Oriental': 'tl',
    'Togo': 'tg', 'Tonga': 'to', 'Trinidad y Tobago': 'tt', 'Túnez': 'tn', 'Turkmenistán': 'tm',
    'Turquía': 'tr', 'Tuvalu': 'tv', 'Ucrania': 'ua', 'Uganda': 'ug', 'Uruguay': 'uy',
    'Uzbekistán': 'uz', 'Vanuatu': 'vu', 'Venezuela': 've', 'Vietnam': 'vn', 'Yemen': 'ye',
    'Yibuti': 'dj', 'Zambia': 'zm', 'Zimbabue': 'zw'
  };

  const normalizarTexto = (texto) => {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  };

  const obtenerCodigoPais = (nombrePais) => {
    if (!nombrePais) return null;
    const nombreNormalizado = normalizarTexto(nombrePais);
    for (const [pais, codigo] of Object.entries(paisesAISO)) {
      if (normalizarTexto(pais) === nombreNormalizado) return codigo;
    }
    return null;
  };

  const getBanderaUrl = (pais, tamaño = 80) => {
    const codigo = obtenerCodigoPais(pais);
    if (!codigo) return null;
    return `https://flagcdn.com/w${tamaño}/${codigo}.png`;
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
    const { data: perfil, error } = await db.from('perfiles').select('*').eq('id', session.user.id).single();
    if (error || !perfil) throw new Error('No se pudo cargar el perfil del bochador.');

    const nombre = perfil.nombre || 'Bochador';
    const userId = perfil.user_id || 'N/A';
    const email = session.user.email;
    const nacionalidad = perfil.nacionalidad || 'No especificada';
    const banderaUrl = getBanderaUrl(nacionalidad, 160);

    let edad = 'No especificada';
    if (perfil.fecha_nacimiento) {
      const hoy = new Date();
      const nacimiento = new Date(perfil.fecha_nacimiento);
      let edadCalc = hoy.getFullYear() - nacimiento.getFullYear();
      const mes = hoy.getMonth() - nacimiento.getMonth();
      if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edadCalc--;
      edad = edadCalc + ' años';
    }

    const manoHabil = perfil.mano_habil ? perfil.mano_habil.charAt(0).toUpperCase() + perfil.mano_habil.slice(1) : 'No especificada';
    const peso = perfil.peso ? `${perfil.peso} kg` : 'No especificado';
    const estatura = perfil.estatura ? `${perfil.estatura} cm` : 'No especificada';
    const brazo = perfil.longitud_brazo ? `${perfil.longitud_brazo} cm` : 'No especificada';
    const sexo = perfil.sexo || 'No especificado';
    const telefono = perfil.telefono || 'No especificado';
    const partidos = perfil.partidos_jugados || 0;
    const aciertos = perfil.porcentaje_aciertos ? `${perfil.porcentaje_aciertos}%` : '0%';
    const categoria = perfil.categoria || 'F';
    const estadoClasif = perfil.estado_clasificacion || 'No clasificado';

    let fechaNacFormateada = 'No especificada';
    if (perfil.fecha_nacimiento) {
      const dateObj = new Date(perfil.fecha_nacimiento);
      fechaNacFormateada = dateObj.toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    let ultimosPartidos = 'Sin registros';
    if (perfil.ultimos_3_partidos && Array.isArray(perfil.ultimos_3_partidos)) {
      const partidosFiltrados = perfil.ultimos_3_partidos.filter(p => p).slice(0, 3);
      if (partidosFiltrados.length > 0) {
        ultimosPartidos = partidosFiltrados.map(f => new Date(f).toLocaleDateString('es-VE')).join(', ');
      }
    }

    // Renderizar Avatar
    const avatarUrl = perfil.avatar_url || session.user.user_metadata?.avatar_url;
    const avatarImg = document.getElementById('profileAvatar');
    const avatarPlaceholder = document.getElementById('profileAvatarPlaceholder');
    if (avatarImg && avatarPlaceholder) {
      if (avatarUrl) {
        avatarImg.src = avatarUrl; avatarImg.style.display = 'block'; avatarPlaceholder.style.display = 'none';
      } else {
        avatarImg.style.display = 'none'; avatarPlaceholder.style.display = 'flex';
        avatarPlaceholder.textContent = nombre.charAt(0).toUpperCase();
      }
    }

    // Renderizar Bandera Profesional
    const flagImg = document.getElementById('flagIcon');
    const flagFallback = document.getElementById('flagFallback');
    if (flagImg && banderaUrl) {
      flagImg.src = banderaUrl;
      flagImg.alt = `Bandera de ${nacionalidad}`;
      flagImg.style.display = 'block';
      if (flagFallback) flagFallback.style.display = 'none';
    } else {
      if (flagImg) flagImg.style.display = 'none';
      if (flagFallback) flagFallback.style.display = 'block';
    }

    safeSetText('profileName', nombre);
    safeSetText('profileId', `ID: ${userId}`);
    safeSetText('profileEmail', email);
    safeSetText('statNacionalidad', nacionalidad);
    
    safeSetHTML('statSexo', `${sexo} <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statFechaNac', `${fechaNacFormateada} <i class="fas fa-lock locked-icon"></i>`);
    safeSetText('statEdad', edad);
    safeSetHTML('statTelefono', `${telefono} <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statMano', `${manoHabil} <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statPeso', `${peso} <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statEstatura', `${estatura} <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statBrazo', `${brazo} <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statPartidos', `${partidos} <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statAciertos', `${aciertos} <i class="fas fa-lock locked-icon"></i>`);
    safeSetHTML('statUltimosPartidos', `${ultimosPartidos} <i class="fas fa-lock locked-icon" style="margin-left: auto;"></i>`);
    safeSetText('statCategoria', categoria.toUpperCase());
    safeSetText('statEstadoClasif', estadoClasif);

    // ==========================================
    // BADGE DE CLASIFICACIÓN (debajo del nombre)
    // ==========================================
    const statusBadge = document.getElementById('playerStatusBadge');
    if (statusBadge) {
      if (estadoClasif.toLowerCase() === 'clasificado') {
        statusBadge.className = 'player-status-badge clasificado';
        statusBadge.innerHTML = '<i class="fas fa-check-circle"></i> Clasificado';
      } else {
        statusBadge.className = 'player-status-badge no-clasificado';
        statusBadge.innerHTML = '<i class="fas fa-hourglass-half"></i> No Clasificado';
      }
    }

    // Ficha principal
    safeSetText('fichaPartidos', partidos);
    safeSetText('fichaAciertos', aciertos);
    safeSetText('fichaCategoria', categoria.toUpperCase());
    safeSetText('fichaEdad', edad === 'No especificada' ? '--' : edad.replace(' años', ''));
    safeSetText('fichaBadgeCat', categoria.toUpperCase());
    safeSetText('fichaBigNumber', partidos);

    // Barras de progreso
    const maxPeso = 150, maxEstatura = 220, maxBrazo = 100;
    const pesoNum = perfil.peso || 0;
    const estaturaNum = perfil.estatura || 0;
    const brazoNum = perfil.longitud_brazo || 0;
    
    safeSetText('barPeso', pesoNum ? `${pesoNum} kg` : '-- kg');
    safeSetText('barEstatura', estaturaNum ? `${estaturaNum} cm` : '-- cm');
    safeSetText('barBrazo', brazoNum ? `${brazoNum} cm` : '-- cm');
    
    const setBar = (id, value, max) => {
      const el = document.getElementById(id);
      if (el && value && max) el.style.width = Math.min((value / max) * 100, 100) + '%';
    };
    setBar('barPesoFill', pesoNum, maxPeso);
    setBar('barEstaturaFill', estaturaNum, maxEstatura);
    setBar('barBrazoFill', brazoNum, maxBrazo);

    // Estrellas
    const estrellasEl = document.getElementById('fichaStars');
    if (estrellasEl) {
      const aciertosNum = perfil.porcentaje_aciertos || 0;
      const stars = Math.min(5, Math.floor((aciertosNum / 20) + 1));
      estrellasEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    }

    // Descripción
    const descEl = document.getElementById('fichaDescripcion');
    if (descEl) {
      descEl.textContent = `Bochador ${estadoClasif.toLowerCase() === 'clasificado' ? 'clasificado' : 'en formación'} en categoría ${categoria.toUpperCase()}. ${partidos} partidos disputados con un ${perfil.porcentaje_aciertos || 0}% de precisión.`;
    }

    await cargarCarruselBochadores();

    const loadingState = document.getElementById('loadingState');
    const profileContent = document.getElementById('profileContent');
    if (loadingState) loadingState.style.display = 'none';
    if (profileContent) profileContent.style.display = 'block';

  } catch (err) {
    console.error('Error al cargar el perfil:', err);
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
      loadingState.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: var(--rojo); font-size: 2rem;"></i><p style="color: var(--rojo); margin-top: 15px;">Error al cargar el perfil. Por favor, intenta de nuevo.</p>`;
    }
  }

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
        const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '' : `#${index + 1}`;

        htmlContent += `
          <div class="player-card" style="border-color: ${borderColor};">
            <div class="player-rank">${rankIcon} • Categoría ${categoria.toUpperCase()}</div>
            <img src="${avatar}" alt="${nombre}" class="player-avatar" style="border-color: ${borderColor};">
            <div class="player-name">${nombre}</div>
            <div style="font-size: 0.75rem; color: ${estado.toLowerCase() === 'clasificado' ? '#00ff00' : 'var(--gris-texto)'}; margin-bottom: 12px; font-weight: 600;">${estado}</div>
            <div class="player-stats">
              <div class="stat-item"><span class="stat-value">${partidos}</span><span class="stat-label">Partidos</span></div>
              <div class="stat-item"><span class="stat-value">${aciertos}%</span><span class="stat-label">Precisión</span></div>
            </div>
          </div>
        `;
      });
      // Duplicamos para el efecto infinito en desktop
      track.innerHTML = htmlContent + htmlContent;
    } catch (err) {
      console.error('Error al cargar bochadores:', err);
    }
  }

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
