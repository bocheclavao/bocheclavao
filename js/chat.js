document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        return;
    }

    // ========== REFERENCIAS AL DOM ==========
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const chatBadge = document.getElementById('chatBadge');
    const chatWindow = document.getElementById('chatWindow');
    const chatWidget = document.getElementById('chatWidget');

    let currentUserId = null;
    let pollTimer = null;
    let chatAbierto = false;

    // ========== UTILIDADES ==========
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function horaMensaje(iso) {
        return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }

    // ========== OBTENER USUARIO ACTUAL ==========
    async function initChat() {
        try {
            const { data: { user } } = await db.auth.getUser();
            if (!user) {
                if (chatWidget) chatWidget.style.display = 'none';
                return;
            }
            currentUserId = user.id;
            if (chatWidget) chatWidget.style.display = 'block';
            await cargarMensajes();
            iniciarPolling();
        } catch (err) {
            console.error('Error inicializando chat:', err);
        }
    }

    // ========== CARGAR MENSAJES ==========
    async function cargarMensajes() {
        if (!currentUserId || !chatMessages) return;

        try {
            const { data: mensajes, error } = await db
                .from('chat_messages')
                .select('*')
                .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
                .order('created_at', { ascending: true })
                .limit(100);

            if (error) throw error;

            // Renderizar mensajes
            if (!mensajes || mensajes.length === 0) {
                chatMessages.innerHTML = `
                    <div class="msg admin">
                        ¡Hola! 👋 Bienvenido al soporte de Boche Clava'o. 
                        ¿En qué podemos ayudarte hoy?
                        <div class="msg-time">${horaMensaje(new Date().toISOString())}</div>
                    </div>
                `;
            } else {
                chatMessages.innerHTML = mensajes.map(msg => {
                    const esUsuario = msg.sender_id === currentUserId;
                    return `
                        <div class="msg ${esUsuario ? 'user' : 'admin'}">
                            ${escapeHtml(msg.message)}
                            <div class="msg-time">${horaMensaje(msg.created_at)}</div>
                        </div>
                    `;
                }).join('');
            }

            // Auto-scroll al final
            chatMessages.scrollTop = chatMessages.scrollHeight;

            // Contar mensajes sin leer (enviados por admin, no leídos por usuario)
            const sinLeer = mensajes.filter(m => 
                m.receiver_id === currentUserId && !m.read
            ).length;

            if (chatBadge) {
                if (sinLeer > 0 && !chatAbierto) {
                    chatBadge.textContent = sinLeer;
                    chatBadge.style.display = 'flex';
                } else {
                    chatBadge.style.display = 'none';
                }
            }

            // Marcar mensajes del admin como leídos si el chat está abierto
            if (chatAbierto && sinLeer > 0) {
                await marcarLeidos();
            }

        } catch (err) {
            console.error('Error cargando mensajes:', err);
        }
    }

    // ========== MARCAR MENSAJES COMO LEÍDOS ==========
    async function marcarLeidos() {
        if (!currentUserId) return;
        try {
            await db.from('chat_messages')
                .update({ read: true })
                .eq('receiver_id', currentUserId)
                .eq('read', false);
        } catch (err) {
            console.error('Error marcando leídos:', err);
        }
    }

    // ========== ENVIAR MENSAJE ==========
    window.sendMessage = async function() {
        if (!chatInput) return;
        const texto = chatInput.value.trim();
        if (!texto || !currentUserId) return;

        chatInput.value = '';
        chatInput.disabled = true;

        try {
            const { error } = await db.from('chat_messages').insert({
                sender_id: currentUserId,
                receiver_id: null, // Null = soporte general (lo reciben todos los admins)
                message: texto,
                read: false
            });

            if (error) throw error;

            await cargarMensajes();
        } catch (err) {
            console.error('Error enviando mensaje:', err);
            alert('❌ Error al enviar el mensaje: ' + err.message);
        } finally {
            chatInput.disabled = false;
            chatInput.focus();
        }
    };

    // ========== ENTER PARA ENVIAR ==========
    window.handleChatEnter = function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            window.sendMessage();
        }
    };

    // ========== TOGGLE CHAT ==========
    window.toggleChat = function() {
        if (!chatWindow) return;
        const estaVisible = chatWindow.style.display === 'flex';
        
        if (estaVisible) {
            chatWindow.style.display = 'none';
            chatAbierto = false;
        } else {
            chatWindow.style.display = 'flex';
            chatAbierto = true;
            cargarMensajes();
            setTimeout(() => {
                if (chatInput) chatInput.focus();
            }, 100);
        }
    };

    // ========== POLLING (tiempo real) ==========
    function iniciarPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(async () => {
            await cargarMensajes();
        }, 5000); // Cada 5 segundos
    }

    // ========== INICIALIZAR ==========
    await initChat();
});
