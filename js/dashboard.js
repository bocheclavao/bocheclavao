document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) {
        console.error('No se pudo cargar Supabase');
        return;
    }

    const { data: { session } } = await db.auth.getSession();
    if (!session || !session.user) {
        window.location.href = 'index.html';
        return;
    }

    // Diccionario de banderas
    const banderas = {
        'Venezuela': '🇪', 'Colombia': '🇴', 'México': '🇽',
        'Argentina': '🇦🇷', 'España': '🇸', 'Estados Unidos': '🇺🇸',
        'Perú': '🇵🇪', 'Chile': '🇨🇱', 'Ecuador': '🇪🇨', 'Panamá': '🇵🇦'
    };

    let allBochadores = [];

    try {
        // Obtener todos los bochadores verificados
        const { data: bochadores, error } = await db
            .from('perfiles')
            .select('*')
            .eq('estado_kyc', 'verificado')
            .order('partidos_jugados', { ascending: false })
            .limit(30);

        if (error) throw error;

        allBochadores = bochadores;

        const track = document.getElementById('carouselTrack');
        let htmlContent = '';

        bochadores.forEach((jugador, index) => {
            const nombre = jugador.nombre || 'Jugador Anónimo';
            const avatar = jugador.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=0057FF&color=fff&size=128`;
            const partidos = jugador.partidos_jugados || 0;
            const aciertos = jugador.porcentaje_aciertos ? jugador.porcentaje_aciertos.toFixed(1) : '0.0';
            const categoria = jugador.categoria || 'F';
            const estado = jugador.estado_clasificacion || 'No clasificado';

            htmlContent += `
                <div class="player-card" data-index="${index}">
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

        // Agregar event listeners a las tarjetas
        document.querySelectorAll('.player-card').forEach(card => {
            card.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                abrirModalJugador(allBochadores[index]);
            });
        });

        // Mostrar el carrusel y ocultar el loading
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('carouselContainer').style.display = 'block';

    } catch (err) {
        console.error('Error al cargar bochadores:', err);
        document.getElementById('loadingState').innerHTML = `
            <i class="fas fa-exclamation-triangle" style="color: var(--rojo);"></i>
            <p style="color: var(--gris-texto);">No se pudieron cargar los datos. Inténtalo de nuevo.</p>
        `;
    }

    // Función para abrir el modal con la información del jugador
    function abrirModalJugador(jugador) {
        const nombre = jugador.nombre || 'Jugador Anónimo';
        const avatar = jugador.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=0057FF&color=fff&size=256`;
        const userId = jugador.user_id || 'N/A';
        const nacionalidad = jugador.nacionalidad || 'No especificada';
        const flag = banderas[nacionalidad] || '🏳️';
        const sexo = jugador.sexo || 'No especificado';
        const manoHabil = jugador.mano_habil ? jugador.mano_habil.charAt(0).toUpperCase() + jugador.mano_habil.slice(1) : 'No especificada';
        const peso = jugador.peso ? `${jugador.peso} kg` : 'No especificado';
        const estatura = jugador.estatura ? `${jugador.estatura} cm` : 'No especificada';
        const brazo = jugador.longitud_brazo ? `${jugador.longitud_brazo} cm` : 'No especificada';
        const telefono = jugador.telefono || 'No especificado';
        const partidos = jugador.partidos_jugados || 0;
        const aciertos = jugador.porcentaje_aciertos ? `${jugador.porcentaje_aciertos}%` : '0%';
        const categoria = jugador.categoria || 'F';
        const estado = jugador.estado_clasificacion || 'No clasificado';

        // Calcular edad
        let edad = 'No especificada';
        if (jugador.fecha_nacimiento) {
            const hoy = new Date();
            const nacimiento = new Date(jugador.fecha_nacimiento);
            let edadCalc = hoy.getFullYear() - nacimiento.getFullYear();
            const mes = hoy.getMonth() - nacimiento.getMonth();
            if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
                edadCalc--;
            }
            edad = `${edadCalc} años`;
        }

        // Formatear fecha de nacimiento
        let fechaNac = 'No especificada';
        if (jugador.fecha_nacimiento) {
            const dateObj = new Date(jugador.fecha_nacimiento);
            fechaNac = dateObj.toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' });
        }

        // Llenar el modal
        document.getElementById('modalAvatar').src = avatar;
        document.getElementById('modalName').textContent = nombre;
        document.getElementById('modalId').textContent = `ID: ${userId}`;
        
        const statusBadge = document.getElementById('modalStatus');
        statusBadge.textContent = estado;
        statusBadge.className = `modal-badge ${estado.toLowerCase() === 'clasificado' ? 'clasificado' : ''}`;

        document.getElementById('modalNacionalidad').textContent = `${flag} ${nacionalidad}`;
        document.getElementById('modalSexo').textContent = sexo;
        document.getElementById('modalEdad').textContent = edad;
        document.getElementById('modalFechaNac').textContent = fechaNac;
        document.getElementById('modalTelefono').textContent = telefono;
        document.getElementById('modalMano').textContent = manoHabil;
        document.getElementById('modalPeso').textContent = peso;
        document.getElementById('modalEstatura').textContent = estatura;
        document.getElementById('modalBrazo').textContent = brazo;
        document.getElementById('modalPartidos').textContent = partidos;
        document.getElementById('modalAciertos').textContent = aciertos;
        document.getElementById('modalCategoria').textContent = categoria.toUpperCase();

        // Historial de partidos
        const historialList = document.getElementById('modalHistorial');
        historialList.innerHTML = '';

        let ultimosPartidos = [];
        if (jugador.ultimos_3_partidos && Array.isArray(jugador.ultimos_3_partidos)) {
            ultimosPartidos = jugador.ultimos_3_partidos.filter(p => p).slice(0, 3);
        }

        if (ultimosPartidos.length > 0) {
            ultimosPartidos.forEach((fecha, index) => {
                const dateObj = new Date(fecha);
                const fechaStr = dateObj.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
                
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.innerHTML = `
                    <span class="date"><i class="fas fa-calendar-alt" style="margin-right: 8px; color: var(--azul-electrico);"></i> ${fechaStr}</span>
                    <span class="result win">Partido #${index + 1}</span>
                `;
                historialList.appendChild(historyItem);
            });
        } else {
            historialList.innerHTML = `
                <div class="history-item">
                    <span class="date">Sin registros</span>
                    <span class="result">Aún no ha participado en partidos</span>
                </div>
            `;
        }

        // Mostrar el modal
        document.getElementById('playerModal').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // Cerrar modal
    function cerrarModal() {
        document.getElementById('playerModal').classList.remove('active');
        document.body.style.overflow = '';
    }

    document.getElementById('modalClose').addEventListener('click', cerrarModal);
    document.getElementById('playerModal').addEventListener('click', function(e) {
        if (e.target === this) {
            cerrarModal();
        }
    });

    // Cerrar modal con tecla ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            cerrarModal();
        }
    });

    // Modo Evento
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
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        }
    }

    function salirModoEvento() {
        document.body.classList.remove('event-mode');
        
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    // Detectar salida de pantalla completa con ESC
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.body.classList.remove('event-mode');
        }
    });
});
