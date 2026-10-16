document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) return;

    const messageDiv = document.getElementById('message');
    const loginForm = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');

    // 1. Verificar si viene redirigido por estar bloqueado desde otro módulo
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('blocked') === 'true') {
        await db.auth.signOut(); // Asegurar cierre de sesión
        mostrarModalBloqueo('Violar las políticas, normas y condiciones de la plataforma.');
    }

    // 2. Si ya hay sesión activa y NO está bloqueado, redirigir al hub (evita que vean el login)
    const { data: { session } } = await db.auth.getSession();
    if (session && session.user) {
        const { data: perfil } = await db.from('perfiles').select('bloqueado').eq('id', session.user.id).single();
        if (perfil && !perfil.bloqueado) {
            window.location.href = 'hub-juegos.html';
            return;
        } else {
            await db.auth.signOut(); // Si hay sesión pero está bloqueado, la cerramos
        }
    }

    // Función para mostrar el modal personalizado
    function mostrarModalBloqueo(motivo) {
        const modal = document.getElementById('modalBloqueo');
        const motivoText = document.getElementById('motivoBloqueoText');
        if (modal && motivoText) {
            motivoText.textContent = motivo || 'Violar las políticas, normas y condiciones de la plataforma.';
            modal.style.display = 'flex';
        }
    }

    // Hacer la función global para que el botón del HTML funcione
    window.cerrarModalBloqueo = function() {
        const modal = document.getElementById('modalBloqueo');
        if (modal) modal.style.display = 'none';
    };

    // 3. Manejar Login con Correo/Contraseña
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;
            
            if (!email || !password) {
                showMessage('Por favor, completa todos los campos.', 'error');
                return;
            }
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Verificando...';
            
            try {
                // Intentar login primero
                const { data, error: authError } = await db.auth.signInWithPassword({ email, password });
                
                if (authError) {
                    showMessage('❌ Correo o contraseña incorrectos.', 'error');
                    resetButton();
                    return;
                }
                
                // Si el login fue exitoso, verificar inmediatamente si está bloqueado
                const { data: perfil, error: perfilError } = await db.from('perfiles')
                    .select('bloqueado, motivo_bloqueo')
                    .eq('id', data.user.id)
                    .single();
                
                if (perfil && perfil.bloqueado === true) {
                    // ESTÁ BLOQUEADO: Cerrar sesión y mostrar modal (NO redirigir)
                    await db.auth.signOut();
                    mostrarModalBloqueo(perfil.motivo_bloqueo || 'Violar las políticas, normas y condiciones de la plataforma.');
                    resetButton();
                    return; 
                }
                
                // Login exitoso y NO bloqueado: Redirigir al hub
                window.location.href = 'hub-juegos.html';
                
            } catch (err) {
                console.error('Error inesperado:', err);
                showMessage('Error inesperado: ' + err.message, 'error');
                resetButton();
            }
        });
    }

    // 4. Manejar Login con Google
    window.loginWithGoogle = async function() {
        // Redirigir de vuelta a hub-juegos.html, donde el auth-guard verificará el bloqueo
        const redirectURL = window.location.origin + window.location.pathname.replace('index.html', '') + 'hub-juegos.html';
        const { error } = await db.auth.signInWithOAuth({
            provider: 'google',
            options: { 
                redirectTo: redirectURL,
                queryParams: { access_type: 'offline', prompt: 'consent' } 
            }
        });
        if (error) {
            showMessage('Error: ' + error.message, 'error');
        }
    };

    function resetButton() {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Ingresar';
        }
    }

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
            messageDiv.style.display = 'block';
        }
    }
});
