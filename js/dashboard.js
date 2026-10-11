document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        return;
    }

    const loadingState = document.getElementById('loadingState');
    const contentState = document.getElementById('contentState');
    const errorState = document.getElementById('errorState');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userIdDisplay = document.getElementById('userIdDisplay');
    const avatarImage = document.getElementById('avatarImage');
    const avatarPlaceholder = document.getElementById('avatarDisplay');
    const navAvatarContainer = document.getElementById('navAvatarContainer');
    const kycBanner = document.getElementById('kycBanner');
    const kycTitle = document.getElementById('kycTitle');
    const kycMessage = document.getElementById('kycMessage');
    const kycBtn = document.getElementById('kycBtn');
    const cardBochador = document.getElementById('cardBochador');
    const cardPatrocinador = document.getElementById('cardPatrocinador');
    const balanceAmount = document.getElementById('balanceAmount');
    const dropdownUserName = document.getElementById('dropdownUserName');
    const dropdownUserEmail = document.getElementById('dropdownUserEmail');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const menuToggle = document.getElementById('menuToggle');

    let estadoKyc = null;
    let saldoBC = 0;
    let currentUser = null;
    let sessionCheckActive = false;

    // 🚨 CREAR MODAL DE ALERTA DE SESIÓN DUPLICADA
    function crearModalSesionDuplicada() {
        // Eliminar modal existente si hay
        const existing = document.getElementById('duplicateSessionModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'duplicateSessionModal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            z-index: 999999;
            justify-content: center;
            align-items: center;
            padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
                border: 2px solid #ff0000;
                border-radius: 16px;
                padding: 40px 30px;
                max-width: 450px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 60px rgba(255, 0, 0, 0.4);
                animation: modalAppear 0.4s ease;
            ">
                <style>
                    @keyframes modalAppear {
                        from { transform: scale(0.8); opacity: 0; }
                        to { transform: scale(1); opacity: 1; }
                    }
                    @keyframes pulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                    }
                </style>
                <div style="
                    width: 80px; height: 80px;
                    background: rgba(255, 0, 0, 0.15);
                    border: 2px solid #ff0000;
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto 20px;
                    font-size: 2.5rem;
                    animation: pulse 2s infinite;
                ">
                    <i class="fas fa-shield-alt" style="color: #ff0000;"></i>
                </div>
                <h2 style="color: #ff0000; font-size: 1.4rem; margin-bottom: 15px; font-weight: 800; font-family: 'Montserrat', sans-serif;">
                    ⚠️ Sesión Duplicada Detectada
                </h2>
                <p style="color: #cccccc; font-size: 0.95rem; line-height: 1.6; margin-bottom: 25px; font-family: 'Montserrat', sans-serif;">
                    Se ha iniciado sesión en otro dispositivo. Esta sesión se cerrará automáticamente por motivos de seguridad.
                </p>
                <button id="closeSessionBtn" style="
                    width: 100%;
                    padding: 14px;
                    background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%);
                    color: #fff;
                    border: none;
                    border-radius: 8px;
                    font-size: 1rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-family: 'Montserrat', sans-serif;
                ">
                    <i class="fas fa-sign-out-alt"></i> Cerrar Sesión Ahora
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('closeSessionBtn').addEventListener('click', async () => {
            await db.auth.signOut({ scope: 'global' });
            localStorage.removeItem('session_token');
            window.location.href = 'index.html';
        });
        
        return modal;
    }

    const duplicateModal = crearModalSesionDuplicada();

    // 🚨 FUNCIÓN PARA VERIFICAR SESIÓN Y MOSTRAR ALERTA
    async function verificarSesionActiva() {
        if (sessionCheckActive) return; // Evitar verificaciones simultáneas
        if (!currentUser) return;
        
        sessionCheckActive = true;
        
        try {
            const localToken = localStorage.getItem('session_token');
            if (!localToken) {
                mostrarAlertaSesionDuplicada();
                return;
            }

            const { data, error } = await db
                .from('active_sessions')
                .select('session_token')
                .eq('user_id', currentUser.id)
                .single();

            if (error || !data) {
                mostrarAlertaSesionDuplicada();
                return;
            }

            // Si el token en la BD no coincide con el local, hay una nueva sesión
            if (data.session_token !== localToken) {
                mostrarAlertaSesionDuplicada();
            } else {
                // Actualizar last_active
                await db
                    .from('active_sessions')
                    .update({ last_active: new Date().toISOString() })
                    .eq('user_id', currentUser.id);
            }
        } catch (err) {
            console.error('Error verificando sesión:', err);
        } finally {
            sessionCheckActive = false;
        }
    }

    function mostrarAlertaSesionDuplicada() {
        if (duplicateModal.style.display === 'flex') return;
        
        duplicateModal.style.display = 'flex';
        
        // Auto-cerrar después de 8 segundos
        setTimeout(() => {
            if (duplicateModal.style.display === 'flex') {
                db.auth.signOut({ scope: 'global' }).then(() => {
                    localStorage.removeItem('session_token');
                    window.location.href = 'index.html';
                });
            }
        }, 8000);
    }

    // ️ LISTENER DE INTERACCIONES (clic, scroll, touch)
    function setupInteractionListeners() {
        let lastCheck = 0;
        
        const checkOnInteraction = async () => {
            const now = Date.now();
            if (now - lastCheck < 2000) return; // Verificar cada 2 segundos máximo
            lastCheck = now;
            await verificarSesionActiva();
        };

        document.addEventListener('click', checkOnInteraction);
        document.addEventListener('touchstart', checkOnInteraction);
        document.addEventListener('scroll', checkOnInteraction);
        document.addEventListener('keypress', checkOnInteraction);
    }

    db.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
            localStorage.removeItem('session_token');
            sessionStorage.setItem('auth_message', 'Tu sesión ha sido cerrada porque iniciaste sesión en otro dispositivo.');
            sessionStorage.setItem('auth_type', 'info');
            window.location.href = 'index.html';
        }
    });

    async function asegurarSesionUnica() {
        const { data: { session } } = await db.auth.getSession();
        if (session) {
            await db.auth.signOut({ scope: 'others' });
        }
    }

    function generarIdUnico() {
        return 'BC-' + Math.floor(10000000 + Math.random() * 90000000).toString();
    }

    async function cargarOCrearPerfil(user) {
        try {
            const { data: perfil, error } = await db
                .from('perfiles')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (perfil) return perfil;
            
            if (error && error.code === 'PGRST116') {
                const nuevoPerfil = {
                    id: user.id,
                    user_id: generarIdUnico(),
                    nombre: user.user_metadata?.nombre || user.user_metadata?.full_name || 'Usuario',
                    email: user.email,
                    avatar_url: user.user_metadata?.avatar_url || null,
                    saldo_bc: 0,
                    estado_kyc: null
                };
                
                const { data: creado, error: insertError } = await db
                    .from('perfiles')
                    .insert(nuevoPerfil)
                    .select()
                    .single();
                
                if (insertError) {
                    console.error('Error al crear perfil:', insertError);
                    return null;
                }
                return creado;
            }
            return null;
        } catch (err) {
            console.error('Error en cargarOCrearPerfil:', err);
            return null;
        }
    }

    async function verificarSiEsAdmin(userId, userEmail) {
        try {
            const { data, error } = await db
                .from('admin_roles')
                .select('es_admin, activo')
                .eq('id', userId)
                .eq('es_admin', true)
                .eq('activo', true)
                .maybeSingle(); 

            if (error || !data) return false;
            return true;
        } catch (err) {
            console.error('Error verificando admin:', err);
            return false;
        }
    }

    function agregarBotonAdmin() {
        if (!dropdownMenu || document.getElementById('adminMenuItem')) return;
        const adminItem = document.createElement('button');
        adminItem.id = 'adminMenuItem';
        adminItem.className = 'dropdown-item';
        adminItem.onclick = function() { window.location.href = 'admin.html'; };
        adminItem.innerHTML = '<i class="fas fa-user-shield"></i><span>Panel Admin</span>';
        
        const divider = dropdownMenu.querySelector('.dropdown-divider');
        if (divider) {
            dropdownMenu.insertBefore(adminItem, divider);
        } else {
            dropdownMenu.appendChild(adminItem);
        }
    }

    // ✅ NUEVA LÓGICA DE MENÚS MÓVILES (Reemplaza la anterior)

// 1. Función maestra para cerrar TODO
window.cerrarPanelesMovil = function() {
    const dropdownMenu = document.getElementById('dropdownMenu');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const menuToggle = document.getElementById('menuToggle');
    const notificationBtn = document.getElementById('notificationBtn');

    if (dropdownMenu) dropdownMenu.classList.remove('show');
    if (notificationDropdown) notificationDropdown.classList.remove('show');
    if (mobileOverlay) mobileOverlay.classList.remove('active');
    if (menuToggle) menuToggle.classList.remove('active');
    if (notificationBtn) notificationBtn.classList.remove('active');

    // Restaurar el scroll del fondo
    document.body.classList.remove('menu-open');
};

// 2. Toggle del Menú de Usuario
window.toggleMenu = function(event) {
    if (event) event.stopPropagation(); // Evita que el clic cierre el menú inmediatamente

    const dropdownMenu = document.getElementById('dropdownMenu');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const menuToggle = document.getElementById('menuToggle');

    // Si abrimos este, cerramos el de notificaciones por si acaso
    if (notificationDropdown && notificationDropdown.classList.contains('show')) {
        notificationDropdown.classList.remove('show');
    }

    const isShowing = dropdownMenu.classList.contains('show');
    
    if (isShowing) {
        cerrarPanelesMovil();
    } else {
        dropdownMenu.classList.add('show');
        if (menuToggle) menuToggle.classList.add('active');
        if (mobileOverlay) mobileOverlay.classList.add('active');
        document.body.classList.add('menu-open'); // 🔒 Bloquea scroll de fondo
    }
};

// 3. Toggle del Menú de Notificaciones
window.toggleNotifications = function(event) {
    if (event) event.stopPropagation();

    const dropdownMenu = document.getElementById('dropdownMenu');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const notificationBtn = document.getElementById('notificationBtn');

    // Si abrimos este, cerramos el de usuario por si acaso
    if (dropdownMenu && dropdownMenu.classList.contains('show')) {
        dropdownMenu.classList.remove('show');
    }

    const isShowing = notificationDropdown.classList.contains('show');

    if (isShowing) {
        cerrarPanelesMovil();
    } else {
        notificationDropdown.classList.add('show');
        if (notificationBtn) notificationBtn.classList.add('active');
        if (mobileOverlay) mobileOverlay.classList.add('active');
        document.body.classList.add('menu-open'); // 🔒 Bloquea scroll de fondo
        
        // Aquí puedes llamar a tu función de cargar notificaciones si es necesario
        // if (typeof cargarNotificaciones === 'function') cargarNotificaciones();
    }
};

// 4. Evento para cerrar al hacer clic en el fondo oscuro (Overlay)
document.addEventListener('DOMContentLoaded', function() {
    const mobileOverlay = document.getElementById('mobileOverlay');
    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', window.cerrarPanelesMovil);
    }
});

    window.irAPerfil = function() { window.location.href = 'perfil.html'; };
    window.irABilletera = function() { window.location.href = 'billetera.html'; };
    window.irAApuestas = function() { alert('Mis apuestas estará disponible próximamente'); };
    window.irASoporte = function() { alert('Soporte estará disponible próximamente'); };
    window.irAConfiguracion = function() { alert('Configuración estará disponible próximamente'); };

    async function cargarStreamEnVivo() {
        console.log('🔄 Cargando stream en vivo...');
        try {
            const { data: streamConfig, error } = await db
                .from('config_stream_vivo')
                .select('*')
                .eq('activo', true)
                .single();

            const liveSection = document.getElementById('liveStreamSection');
            const liveBadgeContainer = document.getElementById('liveBadgeContainer');
            const videoPlaceholder = document.getElementById('videoPlaceholder');
            const liveVideo = document.getElementById('liveVideo');
            const liveIframe = document.getElementById('liveIframe');
            const liveInfo = document.getElementById('liveInfo');
            const liveTitle = document.getElementById('liveTitle');
            const liveDescription = document.getElementById('liveDescription');

            if (error || !streamConfig || !streamConfig.activo) {
                liveSection.classList.remove('active');
                videoPlaceholder.style.display = 'flex';
                liveVideo.style.display = 'none';
                liveIframe.style.display = 'none';
                liveInfo.style.display = 'none';
                liveBadgeContainer.innerHTML = '';
                return;
            }

            liveSection.classList.add('active');
            videoPlaceholder.style.display = 'none';
            liveInfo.style.display = 'block';
            liveTitle.textContent = streamConfig.titulo || 'Transmisión en Vivo';
            liveDescription.textContent = streamConfig.descripcion || 'Evento en vivo';

            liveBadgeContainer.innerHTML = `
                <div class="live-badge">
                    <div class="live-dot"></div> EN VIVO
                </div>
                ${streamConfig.espectadores ? `<div class="live-viewers"><i class="fas fa-eye"></i> ${streamConfig.espectadores} espectadores</div>` : ''}
            `;

            liveVideo.style.display = 'none';
            liveIframe.style.display = 'none';

            if (streamConfig.url_stream.includes('youtube.com') || streamConfig.url_stream.includes('youtu.be')) {
                liveIframe.style.display = 'block';
                let embedUrl = streamConfig.url_stream;
                if (embedUrl.includes('/live/') || embedUrl.includes('/watch?v=')) {
                    const videoId = embedUrl.split('/live/')[1]?.split('?')[0] || embedUrl.split('v=')[1]?.split('&')[0];
                    if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
                }
                liveIframe.src = embedUrl;
            } else if (streamConfig.tipo_stream === 'youtube' && streamConfig.url_stream) {
                liveIframe.style.display = 'block';
                liveIframe.src = streamConfig.url_stream;
            } else if (streamConfig.tipo_stream === 'twitch' && streamConfig.url_stream) {
                liveIframe.style.display = 'block';
                liveIframe.src = streamConfig.url_stream;
            } else if (streamConfig.tipo_stream === 'hls' && streamConfig.url_stream) {
                liveVideo.style.display = 'block';
                if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                    const hls = new Hls();
                    hls.loadSource(streamConfig.url_stream);
                    hls.attachMedia(liveVideo);
                    hls.on(Hls.Events.MANIFEST_PARSED, function() {
                        liveVideo.play().catch(e => console.log('Autoplay bloqueado:', e));
                    });
                } else if (liveVideo.canPlayType('application/vnd.apple.mpegurl')) {
                    liveVideo.src = streamConfig.url_stream;
                    liveVideo.addEventListener('loadedmetadata', function() {
                        liveVideo.play().catch(e => console.log('Autoplay bloqueado:', e));
                    });
                }
            }
        } catch (err) {
            console.error('❌ Error cargando stream en vivo:', err);
        }
    }

    function actualizarBannerKYC(estado) {
        if (estado === 'verificado') {
            kycBanner.style.display = 'none';
            cardBochador.classList.remove('disabled');
            cardPatrocinador.classList.remove('disabled');
            return;
        }
        
        kycBanner.style.display = 'flex';
        
        if (estado === null || estado === undefined || estado === '') {
            kycBanner.classList.remove('verified', 'rejected');
            kycBanner.style.borderColor = '#FFD700';
            kycTitle.textContent = '⚠️ Verificación KYC Pendiente';
            kycMessage.textContent = 'Para participar como Bochador o Patrocinador, debes completar tu verificación de identidad (KYC). Es rápido y seguro.';
            kycBtn.innerHTML = '<i class="fas fa-user-check"></i> Completar KYC ahora';
            kycBtn.style.pointerEvents = 'auto';
            kycBtn.style.opacity = '1';
            kycBtn.style.background = '';
            kycBtn.onclick = function() { window.location.href = 'perfil.html'; };
            cardBochador.classList.add('disabled');
            cardPatrocinador.classList.add('disabled');
        } else if (estado === 'pendiente' || estado === 'revision') {
            kycBanner.classList.remove('verified', 'rejected');
            kycBanner.style.borderColor = '#FFA500';
            kycTitle.textContent = '⏳ Verificación KYC en Revisión';
            kycMessage.textContent = 'Tus documentos han sido enviados y están siendo revisados. Recibirás una notificación cuando sean aprobados.';
            kycBtn.innerHTML = '<i class="fas fa-hourglass-half"></i> En Revisión';
            kycBtn.style.pointerEvents = 'none';
            kycBtn.style.opacity = '0.6';
            kycBtn.style.background = '#666';
            kycBtn.onclick = null;
            cardBochador.classList.add('disabled');
            cardPatrocinador.classList.add('disabled');
        } else if (estado === 'rechazado') {
            kycBanner.classList.add('rejected');
            kycBanner.classList.remove('verified');
            kycTitle.textContent = '❌ Verificación KYC Rechazada';
            kycMessage.textContent = 'Tus documentos no fueron aprobados. Por favor, revisa la información y vuelve a enviarla.';
            kycBtn.innerHTML = '<i class="fas fa-redo"></i> Reintentar Verificación';
            kycBtn.style.pointerEvents = 'auto';
            kycBtn.style.opacity = '1';
            kycBtn.style.background = '';
            kycBtn.onclick = function() { window.location.href = 'perfil.html'; };
            cardBochador.classList.add('disabled');
            cardPatrocinador.classList.add('disabled');
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

    function mostrarDatos(user, perfil) {
        const nombre = perfil?.nombre || user.user_metadata?.nombre || user.user_metadata?.full_name || 'Usuario';
        const email = user.email;
        const userId = perfil?.user_id || generarIdUnico();
        const avatarUrl = perfil?.avatar_url || user.user_metadata?.avatar_url;
        const estado = perfil?.estado_kyc || null;
        saldoBC = perfil?.saldo_bc || 0;

        userNameDisplay.textContent = nombre;
        userEmailDisplay.textContent = email;
        
        if (estado === 'verificado') {
            userIdDisplay.innerHTML = `ID: ${userId} <i class="fas fa-check-circle" style="color: #00ff00; margin-left: 8px; font-size: 0.9rem;"></i> <span style="color: #00ff00; font-size: 0.75rem; font-weight: 700; margin-left: 5px;">Verificado</span>`;
        } else {
            userIdDisplay.textContent = `ID: ${userId}`;
        }
        
        dropdownUserName.textContent = nombre;
        dropdownUserEmail.textContent = email;
        balanceAmount.textContent = `${saldoBC.toFixed(2)} BC`;

        if (avatarUrl) {
            avatarImage.src = avatarUrl;
            avatarImage.style.display = 'block';
            avatarPlaceholder.style.display = 'none';
        } else {
            const inicial = nombre.charAt(0).toUpperCase();
            avatarPlaceholder.textContent = inicial;
            avatarPlaceholder.style.display = 'flex';
            avatarImage.style.display = 'none';
        }

        mostrarAvatarNavbar(nombre, avatarUrl);
        actualizarBannerKYC(estado);

        verificarSiEsAdmin(user.id, email).then(esAdmin => {
            if (esAdmin) agregarBotonAdmin();
        });
    }

    window.seleccionarRol = function(rol) {
        if (estadoKyc !== 'verificado') {
            alert('Debes completar y ser aprobado en la verificación KYC antes de poder participar.');
            window.location.href = 'perfil.html';
            return;
        }
        if (rol === 'bochador') {
            window.location.href = 'dashboard-bochador.html';
        } else if (rol === 'patrocinador') {
            window.location.href = 'dashboard-patrocinador.html';
        }
    };

    async function protegerRuta() {
        const { data: { session }, error } = await db.auth.getSession();
        if (!session || error) {
            window.location.href = 'index.html';
            return;
        }

        try {
            await asegurarSesionUnica();
            const { data: { user }, error: userError } = await db.auth.getUser();
            if (userError || !user) throw new Error('No se pudo obtener la información del usuario');

            currentUser = user;
            const perfil = await cargarOCrearPerfil(user);
            estadoKyc = perfil?.estado_kyc || null;
            mostrarDatos(user, perfil);
            await cargarStreamEnVivo();
            
            // 🚨 ACTIVAR DETECCIÓN DE SESIÓN DUPLICADA
            setupInteractionListeners();
            
            loadingState.style.display = 'none';
            contentState.style.display = 'block';
        } catch (err) {
            console.error('Error al obtener usuario:', err);
            loadingState.style.display = 'none';
            errorState.style.display = 'block';
            setTimeout(() => { window.location.href = 'index.html'; }, 3000);
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
        localStorage.removeItem('session_token');
        window.location.href = 'index.html';
    } catch (err) {
        console.error('Error al cerrar sesión:', err);
        alert('Hubo un error al cerrar sesión.');
    }
}
