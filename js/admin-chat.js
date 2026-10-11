document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { 
        console.error('No se pudo obtener el cliente de Supabase'); 
        return; 
    }

    // ========== REFERENCIAS AL DOM ==========
    const statsBar = document.getElementById('statsBar');
    const conversationsList = document.getElementById('conversationsList');
    const chatMain = document.getElementById('chatMain');
    const chatSearch = document.getElementById('chatSearch');
    const btnMarkAllRead = document.getElementById('btnMarkAllRead');
    const btnRefreshChat = document.getElementById('btnRefreshChat');

    // ========== ESTADO GLOBAL ==========
    let adminUid = null;
    let currentPartnerId = null;
    let conversations = [];       // Lista de conversaciones
    let perfilesMap = {};         // Mapa id -> perfil
    let searchFilter = '';
    let pollTimer = null;

    // ========== UTILIDADES ==========
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

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // ========== OBTENER ADMIN UID ==========
    async function initAdmin() {
        const { data: { user } } = await db.auth.getUser();
        if (user) adminUid = user.id;
    }

    // ========== CARGAR CONVERSACIONES ==========
    async function cargarConversaciones(silent = false) {
        try {
            const { data: mensajes, error } = await db
                .from('chat_messages')
                .select('id, sender_id, receiver_id, message, read, created_at')
                .order('created_at', { ascending: false })
                .limit(500);
            
            if (error) throw error;
            
            // Agrupar por compañero de conversación
            const map = {};
            (mensajes || []).forEach(msg => {
                const partner = (msg.sender_id === adminUid) ? msg.receiver_id : msg.sender_id;
                if (!partner) return;
                if (!map[partner]) {
                    map[partner] = { partnerId: partner, lastMessage: msg.message, lastTime: msg.created_at, unread: 0, isUserSender: msg.sender_id !== adminUid };
                }
                if (msg.sender_id !== adminUid && !msg.read) {
                    map[partner].unread++;
                }
            });
            
            conversations = Object.values(map).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
            
            // Cargar perfiles de los compañeros
            const ids = conversations.map(c => c.partnerId);
            if (ids.length > 0) {
                const { data: perfiles } = await db
                    .from('perfiles')
                    .select('id, nombre, email, user_id, avatar_url, estado_kyc')
                    .in('id', ids);
                perfilesMap = {};
                (perfiles || []).forEach(p => { perfilesMap[p.id] = p; });
            }
            
            renderStats();
            renderConversations();
            
        } catch (err) {
            console.error('Error cargando conversaciones:', err);
            if (!silent) {
                conversationsList.innerHTML = '<div class="loading-mini" style="color: #ff4444;">Error al cargar conversaciones</div>';
            }
        }
    }

    // ========== RENDERIZAR ESTADÍSTICAS ==========
    function renderStats() {
        const totalConvers = conversations.length;
        const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        
        statsBar.innerHTML = `
            <div class="stat-box">
                <div class="number">${totalConvers}</div>
                <div class="label">Conversaciones</div>
            </div>
            <div class="stat-box ${totalUnread > 0 ? 'unread' : ''}">
                <div class="number">${totalUnread}</div>
                <div class="label">Sin Leer</div>
            </div>
            <div class="stat-box">
                <div class="number" style="color: #00ff00;">${totalUnread === 0 ? 'AL DÍA' : 'PENDIENTE'}</div>
                <div class="label">Estado de Atención</div>
            </div>
        `;
    }

    // ========== RENDERIZAR LISTA DE CONVERSACIONES ==========
    function renderConversations() {
        const filtro = searchFilter.toLowerCase();
        const filtradas = conversations.filter(c => {
            if (!filtro) return true;
            const p = perfilesMap[c.partnerId];
            const nombre = (p?.nombre || '').toLowerCase();
            const email = (p?.email || '').toLowerCase();
            const uid = (p?.user_id || '').toLowerCase();
            return nombre.includes(filtro) || email.includes(filtro) || uid.includes(filtro);
        });
        
        if (filtradas.length === 0) {
            conversationsList.innerHTML = `
                <div class="empty-chat" style="padding: 40px 20px;">
                    <i class="fas fa-inbox" style="font-size: 2.5rem;"></i>
                    <p style="font-size: 0.9rem;">${filtro ? 'Sin resultados para tu búsqueda' : 'No hay conversaciones aún'}</p>
                </div>
            `;
            return;
        }
        
        conversationsList.innerHTML = '';
        filtradas.forEach(c => {
            const p = perfilesMap[c.partnerId];
            const nombre = p?.nombre || 'Usuario';
            const inicial = nombre.charAt(0).toUpperCase();
            const item = document.createElement('div');
            item.className = 'chat-user-item' + (c.partnerId === currentPartnerId ? ' active' : '');
            item.innerHTML = `
                <div class="chat-user-avatar">
                    ${p?.avatar_url ? `<img src="${p.avatar_url}" alt="">` : inicial}
                </div>
                <div class="chat-user-info">
                    <div class="chat-user-name">${escapeHtml(nombre)}</div>
                    <div class="chat-user-last">${c.isUserSender ? '' : '<i class="fas fa-reply" style="color: #FFD700;"></i> '}${escapeHtml(c.lastMessage).substring(0, 40)}</div>
                    <div class="chat-user-meta">
                        <span class="chat-user-time">${tiempoRelativo(c.lastTime)}</span>
                    </div>
                </div>
                ${c.unread > 0 ? `<div class="chat-user-badge">${c.unread}</div>` : ''}
            `;
            item.addEventListener('click', () => seleccionarConversacion(c.partnerId));
            conversationsList.appendChild(item);
        });
    }

    // ========== SELECCIONAR CONVERSACIÓN ==========
    async function seleccionarConversacion(partnerId) {
        currentPartnerId = partnerId;
        const p = perfilesMap[partnerId];
        const nombre = p?.nombre || 'Usuario';
        
        let kycClass = 'none', kycText = 'Sin KYC';
        if (p?.estado_kyc === 'verificado') { kycClass = 'verified'; kycText = 'Verificado'; }
        else if (p?.estado_kyc === 'pendiente') { kycClass = 'pending'; kycText = 'Pendiente'; }
        else if (p?.estado_kyc === 'rechazado') { kycClass = 'rejected'; kycText = 'Rechazado'; }
        
        chatMain.innerHTML = `
            <div class="chat-header-main">
                <div class="chat-user-avatar" style="width: 45px; height: 45px;">
                    ${p?.avatar_url ? `<img src="${p.avatar_url}" alt="">` : nombre.charAt(0).toUpperCase()}
                </div>
                <div class="chat-header-info">
                    <div class="chat-header-name">${escapeHtml(nombre)}</div>
                    <div class="chat-header-sub">
                        <span>${escapeHtml(p?.email || '')}</span>
                        <span style="color: #FFD700;">${escapeHtml(p?.user_id || '')}</span>
                        <span class="kyc-mini ${kycClass}">${kycText}</span>
                    </div>
                </div>
            </div>
            <div class="chat-messages-main" id="chatMessagesMain">
                <div class="loading-mini"><i class="fas fa-circle-notch fa-spin"></i> Cargando mensajes...</div>
            </div>
            <div class="chat-input-area">
                <div class="quick-reply-row">
                    <select id="quickReply">
                        <option value="">⚡ Respuestas rápidas...</option>
                        <option value="¡Hola! ¿En qué puedo ayudarte hoy?">¡Hola! ¿En qué puedo ayudarte?</option>
                        <option value="Tu verificación KYC está en revisión. Pronto recibirás una respuesta.">KYC en revisión</option>
                        <option value="Tu depósito fue acreditado correctamente en tu billetera.">Depósito acreditado</option>
                        <option value="Gracias por contactar a Soporte Boche Clava'o. ¡Que tengas un excelente día!">Despedida</option>
                    </select>
                </div>
                <div class="chat-input-row">
                    <input type="text" id="chatInput" placeholder="Escribe tu respuesta..." autocomplete="off">
                    <button class="btn btn-send" id="btnSendChat"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        `;
        
        // Eventos del panel
        document.getElementById('btnSendChat').addEventListener('click', enviarMensaje);
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') enviarMensaje();
        });
        document.getElementById('quickReply').addEventListener('change', function() {
            if (this.value) {
                document.getElementById('chatInput').value = this.value;
                document.getElementById('chatInput').focus();
                this.value = '';
            }
        });
        
        renderConversations(); // Para actualizar el item activo
        await cargarMensajes();
        await marcarLeidos(partnerId);
    }

    // ========== CARGAR MENSAJES DEL HILO ==========
    async function cargarMensajes() {
        if (!currentPartnerId) return;
        const container = document.getElementById('chatMessagesMain');
        if (!container) return;
        
        // Preservar scroll
        const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
        
        try {
            const { data: mensajes, error } = await db
                .from('chat_messages')
                .select('*')
                .or(`sender_id.eq.${currentPartnerId},receiver_id.eq.${currentPartnerId}`)
                .order('created_at', { ascending: true })
                .limit(200);
            
            if (error) throw error;
            
            if (!mensajes || mensajes.length === 0) {
                container.innerHTML = '<div class="empty-chat"><i class="fas fa-comment-slash"></i><p>Sin mensajes aún</p></div>';
                return;
            }
            
            container.innerHTML = mensajes.map(msg => {
                const esAdmin = msg.sender_id === adminUid;
                return `
                    <div class="msg ${esAdmin ? 'admin' : 'user'}">
                        ${escapeHtml(msg.message)}
                        <div class="msg-time">
                            ${horaMensaje(msg.created_at)}
                            ${esAdmin ? (msg.read ? '<i class="fas fa-check-double"></i>' : '<i class="fas fa-check"></i>') : ''}
                        </div>
                    </div>
                `;
            }).join('');
            
            if (nearBottom || container.scrollTop === 0) {
                container.scrollTop = container.scrollHeight;
            }
            
        } catch (err) {
            console.error('Error cargando mensajes:', err);
        }
    }

    // ========== MARCAR COMO LEÍDOS ==========
    async function marcarLeidos(partnerId) {
        try {
            await db.from('chat_messages')
                .update({ read: true })
                .eq('sender_id', partnerId)
                .eq('read', false);
            await cargarConversaciones(true);
        } catch (err) {
            console.error('Error marcando leídos:', err);
        }
    }

    // ========== ENVIAR MENSAJE ==========
    async function enviarMensaje() {
        const input = document.getElementById('chatInput');
        const texto = input.value.trim();
        if (!texto || !currentPartnerId) return;
        
        input.value = '';
        input.disabled = true;
        
        try {
            const { error } = await db.from('chat_messages').insert({
                sender_id: adminUid,
                receiver_id: currentPartnerId,
                message: texto,
                read: false
            });
            if (error) throw error;
            
            await cargarMensajes();
            await cargarConversaciones(true);
        } catch (err) {
            console.error('Error enviando mensaje:', err);
            alert('❌ Error al enviar el mensaje: ' + err.message);
        } finally {
            input.disabled = false;
            input.focus();
        }
    }

    // ========== MARCAR TODO COMO LEÍDO ==========
    btnMarkAllRead.addEventListener('click', async () => {
        if (!confirm('¿Marcar todos los mensajes como leídos?')) return;
        try {
            const { error } = await db.from('chat_messages')
                .update({ read: true })
                .eq('read', false)
                .neq('sender_id', adminUid);
            if (error) throw error;
            await cargarConversaciones();
        } catch (err) {
            console.error('Error:', err);
            alert('❌ Error: ' + err.message);
        }
    });

    // ========== ACTUALIZAR MANUAL ==========
    btnRefreshChat.addEventListener('click', async () => {
        await cargarConversaciones();
        if (currentPartnerId) await cargarMensajes();
    });

    // ========== BÚSQUEDA EN VIVO ==========
    chatSearch.addEventListener('input', function() {
        searchFilter = this.value.trim();
        renderConversations();
    });

    // ========== AUTO-ACTUALIZACIÓN (TIEMPO REAL) ==========
    function iniciarPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(async () => {
            await cargarConversaciones(true);
            if (currentPartnerId) await cargarMensajes();
        }, 8000); // Cada 8 segundos
    }

    // ========== INICIALIZAR ==========
    await initAdmin();
    await cargarConversaciones();
    iniciarPolling();
});
