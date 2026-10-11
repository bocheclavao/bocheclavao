document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) return;

    const { data: { user } } = await db.auth.getUser();
    if (!user) return;

    // ⚠️ REEMPLAZA ESTO CON EL UUID DE TU CUENTA DE ADMINISTRADOR EN SUPABASE
    const ADMIN_ID = 'AQUÍ_PEGA_EL_UUID_DE_TU_ADMIN'; 
    
    const chatWidget = document.getElementById('chatWidget');
    const chatWindow = document.getElementById('chatWindow');
    const chatMessages = document.getElementById('chatMessages');
    const chatBadge = document.getElementById('chatBadge');
    
    let isChatOpen = false;
    let unreadCount = 0;

    if (user) chatWidget.style.display = 'block';

    async function loadChatHistory() {
        chatMessages.innerHTML = '<div class="chat-loading">Cargando...</div>';
        
        const { data, error } = await db
            .from('chat_messages')
            .select('*')
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .order('created_at', { ascending: true })
            .limit(50);

        if (error) {
            chatMessages.innerHTML = '<div class="chat-loading">Error al cargar</div>';
            return;
        }

        chatMessages.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(msg => appendMessage(msg));
        } else {
            chatMessages.innerHTML = '<div class="chat-loading" style="color:#666; margin-top:50px;">👋 ¡Hola! ¿En qué podemos ayudarte?</div>';
        }
        scrollToBottom();
    }

    function appendMessage(msg) {
        const isUser = msg.sender_id === user.id;
        const div = document.createElement('div');
        div.className = `msg ${isUser ? 'user' : 'admin'}`;
        
        const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const check = isUser && msg.is_read ? '<i class="fas fa-check-double" style="font-size:0.6rem;"></i>' : '';
        
        div.innerHTML = `${msg.message}<div class="msg-time">${time} ${check}</div>`;
        chatMessages.appendChild(div);
    }

    function scrollToBottom() {
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    }

    window.sendMessage = async function() {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (!text) return;

        input.disabled = true;
        const tempId = Date.now(); // ID temporal para UI instantánea

        // Mostrar mensaje localmente de inmediato
        appendMessage({ sender_id: user.id, message: text, created_at: new Date().toISOString(), is_read: false });
        scrollToBottom();
        input.value = '';

        const { error } = await db.from('chat_messages').insert({
            sender_id: user.id,
            receiver_id: ADMIN_ID,
            message: text,
            is_read: false
        });

        if (error) console.error('Error enviando mensaje:', error);
        input.disabled = false;
        input.focus();
    };

    window.handleChatEnter = function(e) {
        if (e.key === 'Enter') sendMessage();
    };

    window.toggleChat = function() {
        isChatOpen = !isChatOpen;
        chatWindow.style.display = isChatOpen ? 'flex' : 'none';
        if (isChatOpen) {
            unreadCount = 0;
            chatBadge.style.display = 'none';
            scrollToBottom();
        }
    };

    // 🔥 REALTIME: Escuchar mensajes nuevos del Admin
    const channel = db.channel(`chat_user_${user.id}`)
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'chat_messages',
                filter: `receiver_id=eq.${user.id}` 
            }, 
            (payload) => {
                appendMessage(payload.new);
                scrollToBottom();
                
                if (!isChatOpen) {
                    unreadCount++;
                    chatBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                    chatBadge.style.display = 'flex';
                }
            }
        )
        .subscribe();

    loadChatHistory();
});
