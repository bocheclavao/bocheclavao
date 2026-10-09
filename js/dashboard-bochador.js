document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        return;
    }

    const loadingState = document.getElementById('loadingState');
    const contentState = document.getElementById('contentState');
    const balanceAmount = document.getElementById('balanceAmount');
    const dropdownUserName = document.getElementById('dropdownUserName');
    const dropdownUserEmail = document.getElementById('dropdownUserEmail');
    const navAvatarContainer = document.getElementById('navAvatarContainer');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const menuToggle = document.getElementById('menuToggle');
    const profileName = document.getElementById('profileName');
    const rankingNumber = document.getElementById('rankingNumber');
    const statPrecision = document.getElementById('statPrecision');
    const statLanzamientos = document.getElementById('statLanzamientos');
    const statBoches = document.getElementById('statBoches');
    const statEventos = document.getElementById('statEventos');
    const profileAvatarContainer = document.getElementById('profileAvatarContainer');
    const eventsContainer = document.getElementById('eventsContainer');

    let saldoBC = 0;

    db.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
            window.location.href = 'login.html';
        }
    });

    async function asegurarSesionUnica() {
        const { data: { session } } = await db.auth.getSession();
        if (session) {
            await db.auth.signOut({ scope: 'others' });
        }
    }

    async function cargarPerfil(user) {
        try {
            const { data: perfil, error } = await db
                .from('perfiles')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (error || !perfil) {
                console.error('Error al cargar perfil:', error);
                return null;
            }
            
            return perfil;
        } catch (err) {
            console.error('Error en cargarPerfil:', err);
            return null;
        }
    }

    function mostrarAvatarNavbar(nombre, avatarUrl) {
        if (avatarUrl) {
            navAvatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Avatar" class="user-avatar-small" onclick="toggleMenu()">`;
        } else {
            const inicial = (nombre || 'U').charAt(0).toUpperCase();
            navAvatarContainer.innerHTML = `<div class="avatar-placeholder-small" onclick="toggleMenu()">${inicial}</div>`;
        }
    }

    function mostrarAvatarPerfil(nombre, avatarUrl) {
        if (avatarUrl) {
            profileAvatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Avatar" class="profile-avatar-large">`;
        } else {
            const inicial = (nombre || 'U').charAt(0).toUpperCase();
            profileAvatarContainer.innerHTML = `<div class="profile-avatar-placeholder">${inicial}</div>`;
        }
    }

    window.toggleMenu = function() {
        dropdownMenu.classList.toggle('show');
        menuToggle.classList.toggle('active');
    };

    document.addEventListener('click', function(event) {
        const menuContainer = document.querySelector('.user-menu-container');
        if (!menuContainer.contains(event.target)) {
            dropdownMenu.classList.remove('show');
            menuToggle.classList.remove('active');
        }
    });

    async function cargarEventos() {
        try {
            // Eventos de ejemplo (luego los conectaremos a la base de datos)
            const eventos = [
                {
                    id: 1,
                    titulo: 'Torneo Nacional de Bochas 2024',
                    fecha: '15 de Diciembre, 2024',
                    descripcion: 'El torneo más importante del año. Compite contra los mejores bochadores del país.',
                    costo: 50
                },
                {
                    id: 2,
                    titulo: 'Desafío Regional - Zona Norte',
                    fecha: '22 de Diciembre, 2024',
                    descripcion: 'Torneo regional para clasificar al nacional. ¡Demuestra tu talento!',
                    costo: 25
                },
                {
                    id: 3,
                    titulo: 'Copa Amistad - Edición Especial',
                    fecha: '28 de Diciembre, 2024',
                    descripcion: 'Evento amistoso con premios especiales. Ideal para practicar.',
                    costo: 15
                }
            ];

            eventsContainer.innerHTML = '';

            eventos.forEach(evento => {
                const card = document.createElement('div');
                card.className = 'event-card';
                card.innerHTML = `
                    <div class="event-header">
                        <div class="event-title">${evento.titulo}</div>
                        <div class="event-date"><i class="fas fa-calendar"></i> ${evento.fecha}</div>
                    </div>
                    <div class="event-description">${evento.descripcion}</div>
                    <div class="event-footer">
                        <div class="event-cost"><i class="fas fa-coins"></i> ${evento.costo} BC</div>
                        <button class="btn-inscribir" onclick="inscribirseEvento(${evento.id}, ${evento.costo})">
                            <i class="fas fa-check"></i> Inscribirse
                        </button>
                    </div>
                `;
                eventsContainer.appendChild(card);
            });

        } catch (err) {
            console.error('Error cargando eventos:', err);
            eventsContainer.innerHTML = '<p style="color: #ff4444; text-align: center;">Error al cargar eventos</p>';
        }
    }

    window.inscribirseEvento = async function(eventoId, costo) {
        if (saldoBC < costo) {
            alert(`No tienes suficientes monedas BC. Necesitas ${costo} BC y tienes ${saldoBC.toFixed(2)} BC.`);
            return;
        }

        if (!confirm(`¿Inscribirte en este evento por ${costo} BC?`)) {
            return;
        }

        try {
            const { data: { user } } = await db.auth.getUser();
            const nuevoSaldo = saldoBC - costo;

            const { error } = await db
                .from('perfiles')
                .update({ 
                    saldo_bc: nuevoSaldo,
                    ultima_actualizacion: new Date().toISOString()
                })
                .eq('id', user.id);

            if (error) {
                alert('Error al inscribirse: ' + error.message);
            } else {
                saldoBC = nuevoSaldo;
                balanceAmount.textContent = `${saldoBC.toFixed(2)} BC`;
                alert(`✅ ¡Inscripción exitosa! Se descontaron ${costo} BC de tu saldo.`);
            }
        } catch (err) {
            console.error('Error:', err);
            alert('Error inesperado al inscribirse.');
        }
    };

    async function protegerRuta() {
        const { data: { session }, error } = await db.auth.getSession();
        
        if (!session || error) {
            window.location.href = 'login.html';
            return;
        }

        try {
            await asegurarSesionUnica();

            const { data: { user }, error: userError } = await db.auth.getUser();
            
            if (userError || !user) {
                throw new Error('No se pudo obtener la información del usuario');
            }

            // Verificar que el usuario tenga KYC verificado
            const perfil = await cargarPerfil(user);
            
            if (!perfil || perfil.estado_kyc !== 'verificado') {
                alert('Debes tener tu KYC verificado para acceder al Dashboard del Bochador.');
                window.location.href = 'perfil.html';
                return;
            }

            // Mostrar datos del usuario
            const nombre = perfil.nombre || user.user_metadata?.nombre || user.user_metadata?.full_name || 'Usuario';
            const email = user.email;
            saldoBC = perfil.saldo_bc || 0;

            profileName.textContent = nombre;
            dropdownUserName.textContent = nombre;
            dropdownUserEmail.textContent = email;
            balanceAmount.textContent = `${saldoBC.toFixed(2)} BC`;

            // Mostrar avatar
            const avatarUrl = perfil.avatar_url || user.user_metadata?.avatar_url;
            mostrarAvatarNavbar(nombre, avatarUrl);
            mostrarAvatarPerfil(nombre, avatarUrl);

            // Estadísticas (por ahora con valores de ejemplo, luego los conectaremos a la BD)
            rankingNumber.textContent = '#5';
            statPrecision.textContent = '1.13%';
            statLanzamientos.textContent = '1,248';
            statBoches.textContent = '14';
            statEventos.textContent = '32';

            // Cargar eventos
            await cargarEventos();

            loadingState.style.display = 'none';
            contentState.style.display = 'block';

        } catch (err) {
            console.error('Error al obtener usuario:', err);
            loadingState.style.display = 'none';
            alert('Error al cargar el dashboard. Intenta de nuevo.');
            window.location.href = 'dashboard.html';
        }
    }

    protegerRuta();
});

async function cerrarSesion() {
    const db = window.supabaseClient;
    if (!db) return;

    try {
        const { error } = await db.auth.signOut({ scope: 'global' });
        if (error) throw error;
        window.location.href = 'login.html';
    } catch (err) {
        console.error('Error al cerrar sesión:', err);
        alert('Hubo un error al cerrar sesión.');
    }
}
