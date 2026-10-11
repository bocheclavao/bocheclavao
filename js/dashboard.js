document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        return;
    }

    // 📌 REFERENCIAS AL DOM
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
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationBtn = document.getElementById('notificationBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');

    let estadoKyc = null;
    let saldoBC = 0;
    let currentUser = null;
    let sessionCheckActive = false;

    // ============================================
    // 🚀 1. MENÚS MÓVILES
    // ============================================
    function sacarMenusDelNavbar() {
        if (window.innerWidth <= 768) {
            if (dropdownMenu && dropdownMenu.parentElement !== document.body) {
                document.body.appendChild(dropdownMenu);
            }
            if (notificationDropdown && notificationDropdown.parentElement !== document.body) {
                document.body.appendChild(notificationDropdown);
            }
        }
    }
    sacarMenusDelNavbar();
    window.addEventListener('resize', sacarMenusDelNavbar);

    // ============================================
    // 🚨 2. MODAL DE SESIÓN DUPLICADA
    // ============================================
    function crearModalSesionDuplicada() {
        const existing = document.getElementById('duplicateSessionModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'duplicateSessionModal';
        modal.style.cssText = `
            display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.95); z-index: 999999;
            justify-content: center; align-items: center; padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border: 2px solid #ff0000; border-radius: 16px; padding: 40px 30px; max-width: 450px; width: 100%; text-align: center; box-shadow: 0 20px 60px rgba(255, 0, 0, 0.4); animation: modalAppear 0.4s ease;">
                <style>
                    @keyframes modalAppear { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                    @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
                </style>
                <div style="width: 80px; height: 80px; background: rgba(255, 0, 0, 0.15); border: 2px solid #ff0000; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 2.5rem; animation: pulse 2s infinite;">
                    <i class="fas fa-shield-alt" style="color: #ff0000;"></i>
                </div>
                <h2 style="color: #ff0000; font-size: 1.4rem; margin-bottom: 15px; font-weight: 800; font-family: 'Montserrat', sans-serif;">⚠️ Sesión Duplicada Detectada</h2>
                <p style="color: #cccccc; font-size: 0.95rem; line-height: 1.6; margin-bottom: 25px; font-family: 'Montserrat', sans-serif;">Se ha iniciado sesión en otro dispositivo. Esta sesión se cerrará automáticamente por motivos de seguridad.</p>
                <button id="closeSessionBtn" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #ff0000 0%, #cc0000 100%); color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: all 0.3s ease; font-family: 'Montserrat', sans-serif;">
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

    function mostrarAlertaSesionDuplicada() {
        if (duplicateModal.style.display === 'flex') return;
        duplicateModal.style.display = 'flex';
        
        setTimeout(() => {
            if (duplicateModal.style.display === 'flex') {
                db.auth.signOut({ scope: 'global' }).then(() => {
                    localStorage.removeItem('session_token');
                    window.location.href = 'index.html';
                });
            }
        }, 8000);
    }

    // ============================================
    // 🔐 3. GESTIÓN DE SESIONES
    // ============================================
    async function registrarMiSesion() {
        try {
            const { data: { session } } = await db.auth.getSession();
            if (!session || !session.access_token) return;
            
            const token = session.access_token;
            localStorage.setItem('session_token', token);
            
            await db.rpc('registrar_mi_sesion', { p_token: token });
            console.log('✅ Mi sesión registrada en BD');
        } catch (e) {
            console.warn('No se pudo registrar sesión:', e.message);
        }
    }

    async function verificarSesionActiva() {
        if (sessionCheckActive || !currentUser) return;
        sessionCheckActive = true;
        
        try {
            const miToken = localStorage.getItem('session_token');
            if (!miToken) {
                await registrarMiSesion();
                return;
            }

            const { data, error } = await db
                .from('active_sessions')
                .select('session_token')
                .eq('user_id', currentUser.id)
                .maybeSingle();
            
            if (error || !data) {
                await registrarMiSesion();
                return;
            }

            if (data.session_token !== miToken) {
                console.warn('⚠️ Sesión duplicada detectada');
                mostrarAlertaSesionDuplicada();
            } else {
                try {
                    await db.from('active_sessions')
                        .update({ last_active: new Date().toISOString() })
                        .eq('user_id', currentUser.id);
                } catch (e) { /* silencioso */ }
            }
        } catch (err) {
            console.error('Error verificando sesión:', err);
        } finally {
            sessionCheckActive = false;
        }
    }

    function setupInteractionListeners() {
        let lastCheck = 0;
        const checkOnInteraction = async () => {
            const now = Date.now();
            if (now - lastCheck < 2000) return;
            lastCheck = now;
            await verificarSesionActiva();
        };
        document.addEventListener('click', checkOnInteraction);
        document.addEventListener('touchstart', checkOnInteraction);
        document.addEventListener('scroll', checkOnInteraction);
        document.addEventListener('keypress', checkOnInteraction);
    }

    db.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            registrarMiSesion();
        } else if (event === 'SIGNED_OUT' || !session) {
            localStorage.removeItem('session_token');
            if (!window.location.pathname.includes('index.html')) {
                sessionStorage.setItem('auth_message', 'Tu sesión ha sido cerrada porque iniciaste sesión en otro dispositivo.');
                sessionStorage.setItem('auth_type', 'info');
                window.location.href = 'index.html';
            }
        }
    });

    // ============================================
    // 👤 4. FUNCIONES DE PERFIL
    // ============================================
    function generarIdUnico() { 
        return 'BC-' + Math.floor(10000000 + Math.random() * 90000000).toString(); 
    }

    async function cargarOCrearPerfil(user) {
        try {
            const { data: perfil, error } = await db.from('perfiles').select('*').eq('id', user.id).single();
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
                const { data: creado, error: insertError } = await db.from('perfiles').insert(nuevoPerfil).select().single();
                if (insertError) { console.error('Error al crear perfil:', insertError); return null; }
                return creado;
            }
            return null;
        } catch (err) { console.error('Error en cargarOCrearPerfil:', err); return null; }
    }

    async function verificarSiEsAdmin(userId) {
        try {
            const { data, error } = await db.from('admin_roles')
                .select('es_admin, activo')
                .eq('id', userId)
                .eq('es_admin', true)
                .eq('activo', true)
                .maybeSingle();
            if (error || !data) return false;
            return true;
        } catch (err) { return false; }
    }

    function agregarBotonAdmin() {
        if (!dropdownMenu || document.getElementById('adminMenuItem')) return;
        const adminItem = document.createElement('button');
        adminItem.id = 'adminMenuItem';
        adminItem.className = 'dropdown-item';
        adminItem.onclick = function() { window.location.href = 'admin.html'; };
        adminItem.innerHTML = '<i class="fas fa-user-shield"></i><span>Panel Admin</span>';
        const divider = dropdownMenu.querySelector('.dropdown-divider');
        if (divider) dropdownMenu.insertBefore(adminItem, divider);
        else dropdownMenu.appendChild(adminItem);
    }

    // ============================================
    // 📱 5. MENÚS MÓVILES
    // ============================================
    window.cerrarPanelesMovil = function() {
        if (dropdownMenu) {
            dropdownMenu.classList.remove('show');
            dropdownMenu.style.transform = '';
            dropdownMenu.style.opacity = '';
            dropdownMenu.style.visibility = '';
        }
        if (notificationDropdown) {
            notificationDropdown.classList.remove('show');
            notificationDropdown.style.transform = '';
            notificationDropdown.style.opacity = '';
            notificationDropdown.style.visibility = '';
        }
        if (mobileOverlay) mobileOverlay.classList.remove('active');
        if (menuToggle) menuToggle.classList.remove('active');
        if (notificationBtn) notificationBtn.classList.remove('active');

        document.body.classList.remove('menu-open');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        
        const scrollY = parseInt(document.body.dataset.scrollPos || '0');
        window.scrollTo(0, scrollY);
    };

    function bloquearScrollFondo() {
        const scrollY = window.scrollY;
        document.body.classList.add('menu-open');
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
        document.body.dataset.scrollPos = scrollY;
    }

    function forzarVisibilidadMenu(elemento) {
        if (!elemento) return;
        elemento.style.transform = '';
        elemento.style.opacity = '';
        elemento.style.visibility = '';
        elemento.style.display = '';
        void elemento.offsetHeight;
        elemento.classList.add('show');
        setTimeout(() => {
            elemento.style.transform = 'translateY(0) translateZ(0)';
            elemento.style.opacity = '1';
            elemento.style.visibility = 'visible';
            elemento.style.pointerEvents = 'auto';
        }, 10);
    }

    window.toggleMenu = function(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        if (notificationDropdown && notificationDropdown.classList.contains('show')) {
            notificationDropdown.classList.remove('show');
        }
        const isShowing = dropdownMenu.classList.contains('show');
        if (isShowing) { cerrarPanelesMovil(); } 
        else {
            bloquearScrollFondo();
            forzarVisibilidadMenu(dropdownMenu);
            if (menuToggle) menuToggle.classList.add('active');
            if (mobileOverlay) mobileOverlay.classList.add('active');
        }
    };

    window.toggleNotifications = function(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        if (dropdownMenu && dropdownMenu.classList.contains('show')) {
            dropdownMenu.classList.remove('show');
        }
        const isShowing = notificationDropdown.classList.contains('show');
        if (isShowing) { cerrarPanelesMovil(); } 
        else {
            bloquearScrollFondo();
            forzarVisibilidadMenu(notificationDropdown);
            if (notificationBtn) notificationBtn.classList.add('active');
            if (mobileOverlay) mobileOverlay.classList.add('active');
        }
    };

    if (notificationBtn) {
        notificationBtn.onclick = null;
        notificationBtn.addEventListener('click', toggleNotifications);
    }
    if (menuToggle) {
        menuToggle.onclick = null;
        menuToggle.addEventListener('click', toggleMenu);
    }
    
    document.querySelectorAll('.panel-close-btn').forEach(btn => {
        btn.addEventListener('click', window.cerrarPanelesMovil);
    });
    
    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', window.cerrarPanelesMovil);
        mobileOverlay.addEventListener('touchstart', window.cerrarPanelesMovil);
    }

    document.addEventListener('click', function(event) {
        if (window.innerWidth > 768) {
            const menuContainer = document.querySelector('.user-menu-container');
            if (menuContainer && !menuContainer.contains(event.target) && dropdownMenu) {
                dropdownMenu.classList.remove('show');
                if (menuToggle) menuToggle.classList.remove('active');
            }
            const notifContainer = notificationBtn?.parentElement;
            if (notifContainer && !notifContainer.contains(event.target) && notificationDropdown) {
                notificationDropdown.classList.remove('show');
                if (notificationBtn) notificationBtn.classList.remove('active');
            }
        }
    });

    // ============================================
    // 🔗 6. NAVEGACIÓN
    // ============================================
    window.irAPerfil = function() { window.location.href = 'perfil.html'; };
    window.irABilletera = function() { window.location.href = 'billetera.html'; };
    window.irAApuestas = function() { alert('Mis apuestas estará disponible próximamente'); };
    window.irASoporte = function() { alert('Soporte estará disponible próximamente'); };
    window.irAConfiguracion = function() { alert('Configuración estará disponible próximamente'); };

    // ============================================
    // 📺 7. STREAM EN VIVO
    // ============================================
    async function cargarStreamEnVivo() {
        try {
            const { data: streamConfig, error } = await db.from('config_stream_vivo').select('*').eq('activo', true).single();
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
            liveBadgeContainer.innerHTML = `<div class="live-badge"><div class="live-dot"></div> EN VIVO</div>${streamConfig.espectadores ? `<div class="live-viewers"><i class="fas fa-eye"></i> ${streamConfig.espectadores} espectadores</div>` : ''}`;
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
            } else {
                liveIframe.style.display = 'block'; 
                liveIframe.src = streamConfig.url_stream;
            }
        } catch (err) { console.error('Error cargando stream en vivo:', err); }
    }

    // ============================================
    // 🛡️ 8. KYC Y AVATAR
    // ============================================
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
            kycMessage.textContent = 'Para participar como Bochador o Patrocinador, debes completar tu verificación de identidad (KYC).';
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
            kycMessage.textContent = 'Tus documentos están siendo revisados.';
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
            kycMessage.textContent = 'Tus documentos no fueron aprobados. Vuelve a enviarla.';
            kycBtn.innerHTML = '<i class="fas fa-redo"></i> Reintentar'; 
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
            navAvatarContainer.innerHTML = `<img src="${avatarUrl}" alt="Avatar" class="user-avatar-small">`;
        } else {
            const inicial = (nombre || 'U').charAt(0).toUpperCase();
            navAvatarContainer.innerHTML = `<div class="avatar-placeholder-small">${inicial}</div>`;
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
            avatarPlaceholder.textContent = nombre.charAt(0).toUpperCase(); 
            avatarPlaceholder.style.display = 'flex'; 
            avatarImage.style.display = 'none'; 
        }

        mostrarAvatarNavbar(nombre, avatarUrl);
        actualizarBannerKYC(estado);

        verificarSiEsAdmin(user.id).then(esAdmin => { 
            if (esAdmin) agregarBotonAdmin(); 
        });
    }

    window.seleccionarRol = function(rol) {
        if (estadoKyc !== 'verificado') {
            alert('Debes completar y ser aprobado en la verificación KYC antes de poder participar.');
            window.location.href = 'perfil.html'; 
            return;
        }
        if (rol === 'bochador') window.location.href = 'dashboard-bochador.html';
        else if (rol === 'patrocinador') window.location.href = 'dashboard-patrocinador.html';
    };

    // ============================================
    // 🔒 9. PROTEGER RUTA (🛡️ CORREGIDO Y BLINDADO)
    // ============================================
    async function protegerRuta() {
        const { data: { session }, error } = await db.auth.getSession();
        
        // 1. Verificar si hay sesión válida
        if (!session || error || !session.user) { 
            window.location.href = 'index.html'; 
            return; 
        }

        try {
            // 🛡️ NUEVO: VERIFICAR SUSPENSIÓN DE CUENTA (Anti-bypass de Google)
            // Esto se ejecuta DESPUÉS de que Google devuelve el email, pero ANTES de cargar el dashboard
            const userEmail = session.user.email;
            const { data: checkData, error: checkError } = await db.rpc('check_login_attempt', {
                p_email: userEmail,
                p_success: true // Usamos true porque ya está autenticado, pero queremos saber si está bloqueado
            });

            // 2. Si la cuenta está bloqueada, expulsar inmediatamente
            if (checkData && checkData.allowed === false) {
                console.warn(`🚫 Acceso denegado en Dashboard: Cuenta suspendida (${userEmail})`);
                
                // Cerrar sesión forzosamente en todos los dispositivos
                await db.auth.signOut({ scope: 'global' });
                localStorage.removeItem('session_token');
                
                // Calcular mensaje de tiempo restante
                const hasta = checkData.blocked_until 
                    ? new Date(checkData.blocked_until).toLocaleString('es-ES', { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                      }) 
                    : 'varias horas';
                
                // Guardar mensaje para que index.html lo muestre
                sessionStorage.setItem('auth_message', `🚫 Tu cuenta está suspendida por seguridad hasta: ${hasta}.`);
                sessionStorage.setItem('auth_type', 'error');
                
                // Redirigir al login y DETENER la ejecución
                window.location.href = 'index.html';
                return; 
            }

            // ✅ SI LLEGA AQUÍ, el usuario NO está suspendido. Continuar carga normal.
            await registrarMiSesion();
            
            const { data: { user }, error: userError } = await db.auth.getUser();
            if (userError || !user) throw new Error('No se pudo obtener la información del usuario');

            currentUser = user;
            const perfil = await cargarOCrearPerfil(user);
            estadoKyc = perfil?.estado_kyc || null;
            
            mostrarDatos(user, perfil);
            await cargarStreamEnVivo();
            setupInteractionListeners();
            
            loadingState.style.display = 'none';
            contentState.style.display = 'block';
            
        } catch (err) {
            console.error('Error crítico en la guardia de seguridad:', err);
            loadingState.style.display = 'none';
            errorState.style.display = 'block';
            setTimeout(() => { window.location.href = 'index.html'; }, 3000);
        }
    }

    protegerRuta();
});

// ============================================
// 🚪 CERRAR SESIÓN
// ============================================
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
// ============================================
// ⚡ 10. SUSCRIPCIÓN EN TIEMPO REAL (SUPABASE)
// ============================================
function iniciarRealtime() {
    if (!currentUser) return;

    // 1. Escuchar cambios en el saldo del usuario
    const channelSaldo = db.channel('saldo_updates')
        .on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'perfiles', filter: `id=eq.${currentUser.id}` }, 
            (payload) => {
                const nuevoSaldo = payload.new.saldo_bc;
                // Animación suave de actualización del saldo
                document.getElementById('balanceAmount').textContent = `${nuevoSaldo.toFixed(2)} BC`;
                
                // Opcional: Mostrar notificación toast de "Saldo actualizado"
                console.log('💰 Saldo actualizado en tiempo real:', nuevoSaldo);
            }
        )
        .subscribe();

    // 2. Escuchar nuevas notificaciones
    const channelNotif = db.channel('notificaciones_updates')
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `user_id=eq.${currentUser.id}` },
            (payload) => {
                console.log('🔔 Nueva notificación recibida:', payload.new);
                // Aquí llamarías a tu función para actualizar el badge y la lista
                // ej: agregarNotificacionAlDOM(payload.new);
            }
        )
        .subscribe();
}

// Llama a esta función después de que el usuario se cargue exitosamente
// (Justo después de `contentState.style.display = 'block';` en protegerRuta)
