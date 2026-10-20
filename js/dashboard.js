document.addEventListener('DOMContentLoaded', async function () {
    const db = window.supabaseClient;
    if (!db) {
        console.error('❌ No se pudo obtener el cliente de Supabase');
        window.location.href = 'index.html';
        return;
    }

    // ========== VERIFICAR SESIÓN ==========
    const { data: { session } } = await db.auth.getSession();
    if (!session || !session.user) {
        window.location.href = 'index.html';
        return;
    }

    // ========== ESTADO GLOBAL ==========
    let currentUserId = session.user.id;
    let currentPerfil = null;
    let hlsInstance = null;
    let chatPollTimer = null;
    let notifPollTimer = null;
    let lastChatMessageId = null;

    // ========== REFERENCIAS AL DOM ==========
    const loadingState = document.getElementById('loadingState');
    const contentState = document.getElementById('contentState');
    const errorState = document.getElementById('errorState');
    const balanceAmount = document.getElementById('balanceAmount');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userIdDisplay = document.getElementById('userIdDisplay');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const kycBadge = document.getElementById('kycBadge');
    const avatarDisplay = document.getElementById('avatarDisplay');
    const avatarImage = document.getElementById('avatarImage');
    const avatarContainer = document.getElementById('avatarContainer');
    const avatarInput = document.getElementById('avatarInput');
    const navAvatarContainer = document.getElementById('navAvatarContainer');
    const dropdownUserName = document.getElementById('dropdownUserName');
    const dropdownUserEmail = document.getElementById('dropdownUserEmail');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const menuToggle = document.getElementById('menuToggle');
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationList = document.getElementById('notificationList');
    const notificationBadge = document.getElementById('notificationBadge');
    const adminMenuSection = document.getElementById('adminMenuSection');
    const liveStreamSection = document.getElementById('liveStreamSection');
    const liveBadgeContainer = document.getElementById('liveBadgeContainer');
    const videoContainer = document.getElementById('videoContainer');
    const videoPlaceholder = document.getElementById('videoPlaceholder');
    const liveVideo = document.getElementById('liveVideo');
    const liveIframe = document.getElementById('liveIframe');
    const liveInfo = document.getElementById('liveInfo');
    const liveTitle = document.getElementById('liveTitle');
    const liveDescription = document.getElementById('liveDescription');
    const chatWindow = document.getElementById('chatWindow');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const chatBadge = document.getElementById('chatBadge');

    // ========== UTILIDADES ==========
    const safeSetText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    function formatBalance(amount) {
        const num = parseFloat(amount) || 0;
        return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' BC';
    }

    function tiempoRelativo(iso) {
        if (!iso) return '';
        const diff = Date.now() - new Date(iso).getTime();
        const min = Math.floor(diff / 60000);
        if (min < 1) return 'ahora';
        if (min < 60) return `hace ${min}m`;
        const hrs = Math.floor(min / 60);
        if (hrs < 24) return `hace ${hrs}h`;
        const dias = Math.floor(hrs / 24);
        if (dias < 7) return `hace ${dias}d`;
        return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    }

    function horaMensaje(iso) {
        return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }

    function showToast(mensaje, tipo = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${tipo}`;
        toast.innerHTML = `<i class="fas ${tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><span>${mensaje}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function esAdmin(user) {
        const meta = user?.user_metadata || {};
        return meta.role === 'admin' || meta.isAdmin === true || meta.is_admin === true;
    }

    // ========== CARGAR PERFIL COMPLETO ==========
    async function cargarPerfil() {
        try {
            const { data: perfil, error } = await db
                .from('perfiles')
                .select('*')
                .eq('id', currentUserId)
                .single();

            if (error || !perfil) throw new Error('No se pudo cargar el perfil');

            currentPerfil = perfil;
            const nombre = perfil.nombre || 'Usuario';
            const userId = perfil.user_id || currentUserId.substring(0, 8).toUpperCase();
            const email = session.user.email;

            // Saldo
            const saldo = perfil.saldo || 0;
            if (balanceAmount) balanceAmount.textContent = formatBalance(saldo);

            // Info usuario
            if (userNameDisplay) userNameDisplay.textContent = nombre;
            if (userIdDisplay) userIdDisplay.textContent = `ID: ${userId}`;
            if (userEmailDisplay) userEmailDisplay.textContent = email;
            if (dropdownUserName) dropdownUserName.textContent = nombre;
            if (dropdownUserEmail) dropdownUserEmail.textContent = email;

            // KYC Badge (al lado del ID)
            if (kycBadge) {
                const estado = (perfil.estado_kyc || 'none').toLowerCase();
                const config = {
                    verificado: { class: 'verificado', text: 'Verificado', icon: 'fa-check-circle' },
                    pendiente: { class: 'pendiente', text: 'Pendiente', icon: 'fa-hourglass-half' },
                    rechazado: { class: 'rechazado', text: 'Rechazado', icon: 'fa-times-circle' }
                };
                const c = config[estado] || { class: 'none', text: 'Sin verificar', icon: 'fa-shield-alt' };
                kycBadge.className = `kyc-badge ${c.class}`;
                kycBadge.innerHTML = `<i class="fas ${c.icon}"></i> ${c.text}`;
            }

            // Avatar (welcome card)
            const avatarUrl = perfil.avatar_url || session.user.user_metadata?.avatar_url;
            renderAvatar(avatarUrl, nombre);

            // Avatar navbar
            renderNavAvatar(avatarUrl, nombre);

            // Admin button
            if (esAdmin(session.user) && adminMenuSection) {
                adminMenuSection.style.display = 'block';
            }

            // Mostrar contenido
            if (loadingState) loadingState.style.display = 'none';
            if (contentState) contentState.style.display = 'block';

        } catch (err) {
            console.error('Error cargando perfil:', err);
            if (loadingState) loadingState.style.display = 'none';
            if (errorState) errorState.style.display = 'flex';
        }
    }

    function renderAvatar(url, nombre) {
        if (!avatarImage || !avatarDisplay) return;
        if (url) {
            avatarImage.src = url;
            avatarImage.style.display = 'block';
            avatarDisplay.style.display = 'none';
        } else {
            avatarImage.style.display = 'none';
            avatarDisplay.style.display = 'flex';
            avatarDisplay.textContent = (nombre || '?').charAt(0).toUpperCase();
        }
    }

    function renderNavAvatar(url, nombre) {
        if (!navAvatarContainer) return;
        if (url) {
            navAvatarContainer.innerHTML = `<img src="${url}" alt="Avatar" class="user-avatar-small">`;
        } else {
            navAvatarContainer.innerHTML = `<div class="avatar-placeholder-small">${(nombre || '?').charAt(0).toUpperCase()}</div>`;
        }
    }

    // ========== CAMBIAR AVATAR ==========
    if (avatarContainer && avatarInput) {
        avatarContainer.addEventListener('click', () => avatarInput.click());
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validar tamaño (máx 2MB)
            if (file.size > 2 * 1024 * 1024) {
                showToast('La imagen no debe superar 2MB', 'error');
                return;
            }

            // Validar tipo
            if (!file.type.startsWith('image/')) {
                showToast('Solo se permiten imágenes', 'error');
                return;
            }

            try {
                showToast('Subiendo imagen...', 'success');

                // Subir a Supabase Storage
                const fileExt = file.name.split('.').pop();
                const fileName = `${currentUserId}-${Date.now()}.${fileExt}`;
                const filePath = `avatars/${fileName}`;

                const { error: uploadError } = await db.storage
                    .from('avatars')
                    .upload(filePath, file, { upsert: true });

                if (uploadError) throw uploadError;

                // Obtener URL pública
                const { data: urlData } = db.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                const publicUrl = urlData.publicUrl;

                // Actualizar perfil
                const { error: updateError } = await db
                    .from('perfiles')
                    .update({ avatar_url: publicUrl })
                    .eq('id', currentUserId);

                if (updateError) throw updateError;

                // Actualizar UI
                renderAvatar(publicUrl, currentPerfil.nombre);
                renderNavAvatar(publicUrl, currentPerfil.nombre);
                currentPerfil.avatar_url = publicUrl;

                showToast('¡Foto actualizada correctamente!', 'success');
            } catch (err) {
                console.error('Error subiendo avatar:', err);
                showToast('Error al subir la imagen: ' + err.message, 'error');
            } finally {
                avatarInput.value = '';
            }
        });
    }

    // ========== STREAM EN VIVO ==========
    function destruirHls() {
        if (hlsInstance) {
            try { hlsInstance.destroy(); } catch (e) { }
            hlsInstance = null;
        }
    }

    function buildEmbedUrl(url, tipo) {
        if (tipo === 'youtube') {
            if (url.includes('/live/')) {
                const videoId = url.split('/live/')[1]?.split('?')[0];
                if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
            } else if (url.includes('/watch?v=')) {
                const videoId = url.split('v=')[1]?.split('&')[0];
                if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
            } else if (url.includes('youtu.be/')) {
                const videoId = url.split('youtu.be/')[1]?.split('?')[0];
                if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
            }
            return url;
        }
        if (tipo === 'twitch') {
            let channel = url.replace('https://', '').replace('http://', '').replace('www.', '');
            channel = channel.split('twitch.tv/')[1] || channel;
            channel = channel.split('?')[0].split('/')[0];
            const parent = window.location.hostname || 'localhost';
            return `https://player.twitch.tv/?channel=${channel}&parent=${parent}&muted=true`;
        }
        return url;
    }

    async function cargarStream() {
        try {
            const { data: config, error } = await db
                .from('config_stream_vivo')
                .select('*')
                .eq('id', 1)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error cargando stream:', error);
                return;
            }

            destruirHls();
            liveVideo.style.display = 'none';
            liveIframe.style.display = 'none';
            liveIframe.src = '';
            liveVideo.src = '';

            if (!config || !config.activo || !config.url_stream) {
                // Offline
                videoPlaceholder.style.display = 'flex';
                videoPlaceholder.querySelector('p').textContent = 'No hay transmisión activa';
                videoPlaceholder.querySelector('span').textContent = 'Pronto habrá eventos en vivo';
                videoContainer.classList.remove('live-active');
                if (liveStreamSection) liveStreamSection.classList.remove('active');
                if (liveBadgeContainer) {
                    liveBadgeContainer.innerHTML = '<span class="offline-badge"><i class="fas fa-circle" style="font-size: 0.5rem;"></i> OFFLINE</span>';
                }
                if (liveInfo) liveInfo.style.display = 'none';
                return;
            }

            // EN VIVO
            videoPlaceholder.style.display = 'none';
            videoContainer.classList.add('live-active');
            if (liveStreamSection) liveStreamSection.classList.add('active');
            if (liveBadgeContainer) {
                liveBadgeContainer.innerHTML = '<span class="live-badge"><span class="live-dot"></span> EN VIVO</span>';
            }

            // Título y descripción
            if (liveInfo) liveInfo.style.display = 'block';
            if (liveTitle) liveTitle.textContent = config.titulo || 'Evento en vivo';
            if (liveDescription) liveDescription.textContent = config.descripcion || '';

            const tipo = config.tipo_stream || 'youtube';
            const url = config.url_stream;

            if (tipo === 'youtube' || tipo === 'twitch') {
                liveIframe.style.display = 'block';
                liveIframe.src = buildEmbedUrl(url, tipo);
            } else if (tipo === 'hls') {
                liveVideo.style.display = 'block';
                if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                    hlsInstance = new Hls();
                    hlsInstance.loadSource(url);
                    hlsInstance.attachMedia(liveVideo);
                    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                        liveVideo.play().catch(e => console.log('Autoplay bloqueado:', e));
                    });
                    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                        if (data.fatal) {
                            console.error('Error HLS:', data);
                            liveVideo.style.display = 'none';
                            videoPlaceholder.style.display = 'flex';
                        }
                    });
                } else if (liveVideo.canPlayType('application/vnd.apple.mpegurl')) {
                    liveVideo.src = url;
                    liveVideo.addEventListener('loadedmetadata', () => {
                        liveVideo.play().catch(e => console.log('Autoplay bloqueado:', e));
                    });
                }
            }
        } catch (err) {
            console.error('Error en cargarStream:', err);
        }
    }

    // ========== DROPDOWN MENU ==========
    if (menuToggle && dropdownMenu) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
            notificationDropdown.classList.remove('show');
            document.body.classList.toggle('menu-open', dropdownMenu.classList.contains('show'));
        });
    }

    // ========== NOTIFICACIONES ==========
    if (notificationBtn && notificationDropdown) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationDropdown.classList.toggle('show');
            dropdownMenu.classList.remove('show');
            document.body.classList.toggle('menu-open', notificationDropdown.classList.contains('show'));
            if (notificationDropdown.classList.contains('show')) {
                cargarNotificaciones();
            }
        });
    }

    async function cargarNotificaciones() {
        try {
            const { data: notifs, error } = await db
                .from('notificaciones')
                .select('*')
                .eq('user_id', currentUserId)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;

            const noLeidas = (notifs || []).filter(n => !n.leida).length;
            if (notificationBadge) {
                notificationBadge.textContent = noLeidas;
                notificationBadge.classList.toggle('hidden', noLeidas === 0);
            }

            if (notificationList) {
                if (!notifs || notifs.length === 0) {
                    notificationList.innerHTML = '<div style="padding: 30px; text-align: center; color: #666; font-size: 0.85rem;"><i class="fas fa-bell-slash" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>Sin notificaciones</div>';
                    return;
                }
                notificationList.innerHTML = notifs.map(n => {
                    const tipo = n.tipo || 'info';
                    const icono = tipo === 'win' ? 'fa-trophy' : tipo === 'lose' ? 'fa-times-circle' : 'fa-info-circle';
                    return `
                        <div class="notification-item ${!n.leida ? 'unread' : ''}" data-id="${n.id}">
                            <div class="notification-icon ${tipo}"><i class="fas ${icono}"></i></div>
                            <div class="notification-content">
                                <div class="notification-title">${escapeHtml(n.titulo || 'Notificación')}</div>
                                <div class="notification-message">${escapeHtml(n.mensaje || '')}</div>
                                <div class="notification-time">${tiempoRelativo(n.created_at)}</div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (err) {
            console.error('Error cargando notificaciones:', err);
        }
    }

    // ========== CHAT ==========
    window.toggleChat = function () {
        if (!chatWindow) return;
        const isOpen = chatWindow.classList.toggle('show');
        if (isOpen) {
            cargarMensajesChat();
            iniciarChatPolling();
            if (chatInput) chatInput.focus();
        } else {
            detenerChatPolling();
        }
    };

    window.handleChatEnter = function (e) {
        if (e.key === 'Enter') sendMessage();
    };

    window.sendMessage = async function () {
        if (!chatInput) return;
        const texto = chatInput.value.trim();
        if (!texto) return;

        chatInput.value = '';
        chatInput.disabled = true;

        try {
            const { error } = await db.from('chat_messages').insert({
                sender_id: currentUserId,
                receiver_id: 'admin', // ID del admin (ajusta si tienes un ID específico)
                message: texto,
                read: false
            });
            if (error) throw error;
            await cargarMensajesChat();
        } catch (err) {
            console.error('Error enviando mensaje:', err);
            showToast('Error al enviar mensaje', 'error');
        } finally {
            chatInput.disabled = false;
            chatInput.focus();
        }
    };

    async function cargarMensajesChat() {
        if (!chatMessages) return;
        try {
            const { data: mensajes, error } = await db
                .from('chat_messages')
                .select('*')
                .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
                .order('created_at', { ascending: true })
                .limit(100);

            if (error) throw error;

            if (!mensajes || mensajes.length === 0) {
                chatMessages.innerHTML = '<div class="msg admin">¡Hola! ¿En qué podemos ayudarte hoy?<div class="msg-time">Ahora</div></div>';
                return;
            }

            chatMessages.innerHTML = mensajes.map(msg => {
                const esUsuario = msg.sender_id === currentUserId;
                return `
                    <div class="msg ${esUsuario ? 'user' : 'admin'}">
                        ${escapeHtml(msg.message)}
                        <div class="msg-time">${horaMensaje(msg.created_at)}</div>
                    </div>
                `;
            }).join('');

            chatMessages.scrollTop = chatMessages.scrollHeight;

            // Marcar como leídos los recibidos
            await db.from('chat_messages')
                .update({ read: true })
                .eq('receiver_id', currentUserId)
                .eq('read', false);

            // Actualizar badge
            if (chatBadge) chatBadge.style.display = 'none';

            lastChatMessageId = mensajes[mensajes.length - 1]?.id || null;
        } catch (err) {
            console.error('Error cargando chat:', err);
        }
    }

    function iniciarChatPolling() {
        detenerChatPolling();
        chatPollTimer = setInterval(async () => {
            try {
                const { data: mensajes } = await db
                    .from('chat_messages')
                    .select('id')
                    .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (mensajes && mensajes[0] && mensajes[0].id !== lastChatMessageId) {
                    await cargarMensajesChat();
                }

                // Contar no leídos para el badge si el chat está cerrado
                if (!chatWindow.classList.contains('show')) {
                    const { data: noLeidos } = await db
                        .from('chat_messages')
                        .select('id')
                        .eq('receiver_id', currentUserId)
                        .eq('read', false);
                    const count = noLeidos?.length || 0;
                    if (chatBadge) {
                        chatBadge.textContent = count;
                        chatBadge.style.display = count > 0 ? 'flex' : 'none';
                    }
                }
            } catch (err) {
                console.error('Error polling chat:', err);
            }
        }, 6000);
    }

    function detenerChatPolling() {
        if (chatPollTimer) {
            clearInterval(chatPollTimer);
            chatPollTimer = null;
        }
    }

    // ========== FUNCIONES GLOBALES ==========
    window.cerrarSesion = async function () {
        if (!confirm('¿Cerrar sesión?')) return;
        await db.auth.signOut();
        window.location.href = 'index.html';
    };

    window.seleccionarRol = function (rol) {
        if (!currentPerfil) return;
        if (currentPerfil.estado_kyc !== 'verificado') {
            showToast('Debes completar tu verificación KYC primero', 'error');
            window.location.href = 'perfil.html';
            return;
        }
        if (rol === 'bochador') window.location.href = 'bochador.html';
        else if (rol === 'patrocinador') window.location.href = 'patrocinador.html';
    };

    window.marcarTodasLeidas = async function (e) {
        if (e) e.stopPropagation();
        try {
            await db.from('notificaciones')
                .update({ leida: true })
                .eq('user_id', currentUserId)
                .eq('leida', false);
            showToast('Notificaciones marcadas como leídas', 'success');
            await cargarNotificaciones();
        } catch (err) {
            console.error('Error:', err);
        }
    };

    window.verMasNotificaciones = function () {
        window.location.href = 'mis-apuestas.html';
    };

    // ========== CERRAR DROPDOWNS AL CLICK FUERA ==========
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-menu-container') && !e.target.closest('.dropdown-menu')) {
            dropdownMenu?.classList.remove('show');
            document.body.classList.remove('menu-open');
        }
        if (!e.target.closest('.notification-btn') && !e.target.closest('.notification-dropdown')) {
            notificationDropdown?.classList.remove('show');
        }
    });

    // ========== INICIALIZAR ==========
    await cargarPerfil();
    await cargarStream();
    await cargarNotificaciones();

    // Polling de stream cada 30s
    setInterval(cargarStream, 30000);
    // Polling de notificaciones cada 60s
    notifPollTimer = setInterval(cargarNotificaciones, 60000);
    // Iniciar polling de chat para badge
    iniciarChatPolling();
});
