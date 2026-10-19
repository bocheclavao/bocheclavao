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

    // Diccionario de banderas
    const banderas = {
        'Venezuela': '🇻🇪', 'Colombia': '🇨🇴', 'México': '🇲🇽',
        'Argentina': '🇦🇷', 'España': '🇪🇸', 'Estados Unidos': '🇺🇸',
        'Perú': '🇵🇪', 'Chile': '🇨🇱', 'Ecuador': '🇪🇨', 'Panamá': '🇵🇦',
        'Brasil': '🇧🇷', 'República Dominicana': '🇩🇴'
    };

    // Funciones auxiliares seguras para evitar errores si falta un ID en el HTML
    const safeSetText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
        else console.warn(`⚠️ Elemento no encontrado: #${id}`);
    };
    const safeSetHTML = (id, html) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
        else console.warn(`⚠️ Elemento no encontrado: #${id}`);
    };

    try {
        // 1. Obtener datos del perfil del usuario actual
        const { data: perfil, error } = await db
            .from('perfiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (error || !perfil) {
            throw new Error('No se pudo cargar el perfil del bochador.');
        }

        // 2. Procesar datos
        const nombre = perfil.nombre || 'Bochador';
        const userId = perfil.user_id || 'N/A';
        const email = session.user.email;
        const nacionalidad = perfil.nacionalidad || 'No especificada';
        const flag = banderas[nacionalidad] || '🏳️';
        
        // Calcular edad
        let edad = 'No especificada';
        if (perfil.fecha_nacimiento) {
            const hoy = new Date();
            const nacimiento = new Date(perfil.fecha_nacimiento);
            let edadCalc = hoy.getFullYear() - nacimiento.getFullYear();
            const mes = hoy.getMonth() - nacimiento.getMonth();
            if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
                edadCalc--;
            }
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
        const estadoClasif = (perfil.estado_clasificacion || 'No clasificado');
        
        // Formatear fecha de nacimiento
        let fechaNacFormateada = 'No especificada';
        if (perfil.fecha_nacimiento) {
            const dateObj = new Date(perfil.fecha_nacimiento);
            fechaNacFormateada = dateObj.toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' });
        }

        // Formatear últimos 3 partidos
        let ultimosPartidos = 'Sin registros';
        if (perfil.ultimos_3_partidos && Array.isArray(perfil.ultimos_3_partidos)) {
            const partidosFiltrados = perfil.ultimos_3_partidos.filter(p => p).slice(0, 3);
            if (partidosFiltrados.length > 0) {
                ultimosPartidos = partidosFiltrados.map(f => new Date(f).toLocaleDateString('es-VE')).join(', ');
            }
        }

        // 3. Renderizar perfil (AHORA SEGURO)
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
        } else {
            console.warn('⚠️ No se encontraron los elementos del avatar en el HTML. Verifica los IDs.');
        }

        safeSetText('profileName', nombre);
        safeSetText('profileId', `ID: ${userId}`);
        safeSetText('profileEmail', email);
        safeSetText('flagIcon', flag);
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

        // Badge de estado
        const statusBadge = document.getElementById('statusBadge');
        if (statusBadge) {
            if (estadoClasif.toLowerCase() === 'clasificado') {
                statusBadge.className = 'status-badge status-cls';
                statusBadge.innerHTML = `<i class="fas fa-check-circle"></i> Clasificado - Categoría ${categoria.toUpperCase()}`;
            } else {
                statusBadge.className = 'status-badge status-no-cls';
                statusBadge.innerHTML = `<i class="fas fa-hourglass-half"></i> No Clasificado`;
            }
        }

        // 4. Cargar carrusel de bochadores
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
    // CARRUSEL DE BOCHADORES
    // ==========================================
    async function cargarCarruselBochadores() {
        try {
            const { data: bochadores, error } = await db
                .from('perfiles')
                .select('nombre, avatar_url, partidos_jugados, porcentaje_aciertos, user_id, estado_clasificacion, categoria')
                .eq('estado_kyc', 'verificado')
                .order('partidos_jugados', { ascending: false })
                .limit(20);

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

                htmlContent += `
                    <div class="player-card">
                        <div class="player-rank">#${index + 1} • Categoría ${categoria.toUpperCase()}</div>
                        <img src="${avatar}" alt="${nombre}" class="player-avatar">
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

            // Duplicar contenido para scroll infinito
            track.innerHTML = htmlContent + htmlContent;

        } catch (err) {
            console.error('Error al cargar bochadores:', err);
        }
    }

    // ==========================================
    // MODO EVENTO (PANTALLA COMPLETA)
    // ==========================================
    const btnModoEvento = document.getElementById('btnModoEvento');
    const btnSalirEvento = document.getElementById('btnSalirEvento');

    if (btnModoEvento) {
        btnModoEvento.addEventListener('click', activarModoEvento);
    }
    if (btnSalirEvento) {
        btnSalirEvento.addEventListener('click', salirModoEvento);
    }

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
        if (!document.fullscreenElement) {
            document.body.classList.remove('event-mode');
        }
    });
});
