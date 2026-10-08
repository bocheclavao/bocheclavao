document.addEventListener('DOMContentLoaded', function() {
    const messageDiv = document.getElementById('message');
    const registroForm = document.getElementById('registroForm');
    const otpForm = document.getElementById('otpForm');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const emailDisplay = document.getElementById('emailDisplay');
    const otpInput = document.getElementById('otpCode');
    
    const db = window.supabaseClient;
    let emailRegistrado = '';
    let nombreRegistrado = '';

    if (!db) {
        console.error('❌ No se pudo obtener el cliente de Supabase');
        if (messageDiv) {
            messageDiv.textContent = 'Error: No se pudo conectar con el servidor';
            messageDiv.className = 'message error';
        }
        return;
    }

    function showMessage(text, type) {
        if (messageDiv) {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
        }
    }

    // Solo permitir números en el input del código
    if (otpInput) {
        otpInput.addEventListener('input', function(e) {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

    // PASO 1: Registrar usuario y enviar código OTP
    if (registroForm) {
        registroForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            nombreRegistrado = document.getElementById('nombre').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (password !== confirmPassword) {
                showMessage('Las contraseñas no coinciden', 'error');
                return;
            }
            
            if (password.length < 6) {
                showMessage('La contraseña debe tener al menos 6 caracteres', 'error');
                return;
            }
            
            showMessage('Enviando código de verificación...', 'info');
            
            try {
                // Usar signInWithOtp con shouldCreateUser para crear usuario y enviar código
                const { data, error } = await db.auth.signInWithOtp({
                    email: email,
                    options: {
                        shouldCreateUser: true,
                        data: {
                            nombre: nombreRegistrado,
                            password: password // Guardamos la contraseña en metadata temporalmente
                        }
                    }
                });
                
                if (error) {
                    showMessage('Error: ' + error.message, 'error');
                    return;
                }
                
                // Si llega aquí, pasamos al paso 2
                emailRegistrado = email;
                emailDisplay.textContent = email;
                
                step1.style.display = 'none';
                step2.style.display = 'block';
                showMessage('Código de 6 dígitos enviado. Revisa tu correo.', 'success');
                
                // Auto-focus en el input del código
                setTimeout(() => otpInput.focus(), 100);
                
            } catch (err) {
                showMessage('Error inesperado: ' + err.message, 'error');
            }
        });
    }

    // PASO 2: Verificar el código OTP y crear usuario con contraseña
    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const code = otpInput.value.trim();
            
            if (code.length !== 6) {
                showMessage('El código debe tener 6 dígitos', 'error');
                return;
            }
            
            showMessage('Verificando código...', 'info');
            
            try {
                // Verificar el código OTP
                const { data, error } = await db.auth.verifyOtp({
                    email: emailRegistrado,
                    token: code,
                    type: 'email'
                });
                
                if (error) {
                    showMessage('Código inválido o expirado: ' + error.message, 'error');
                    return;
                }
                
                // El usuario ya está creado y verificado
                // Ahora actualizamos la contraseña (porque signInWithOtp no la guarda)
                const { error: updateError } = await db.auth.updateUser({
                    password: document.getElementById('password').value
                });
                
                if (updateError) {
                    console.warn('No se pudo actualizar la contraseña:', updateError.message);
                }
                
                showMessage('✅ ¡Cuenta verificada exitosamente! Redirigiendo...', 'success');
                
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
                
            } catch (err) {
                showMessage('Error inesperado: ' + err.message, 'error');
            }
        });
    }

    // Función para volver al paso 1 si se equivocó de correo
    window.volverAlPaso1 = function() {
        step2.style.display = 'none';
        step1.style.display = 'block';
        otpInput.value = '';
        showMessage('', 'info');
    };
});
