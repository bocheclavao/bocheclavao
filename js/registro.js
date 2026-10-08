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

    // PASO 1: Registrar usuario y enviar código
    if (registroForm) {
        registroForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nombre = document.getElementById('nombre').value;
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
                // signUp crea el usuario y envía el código si el OTP está configurado
                const { data, error } = await db.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            nombre: nombre
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
                showMessage('Código enviado. Revisa tu bandeja de entrada.', 'success');
                
                // Auto-focus en el input del código
                setTimeout(() => otpInput.focus(), 100);
                
            } catch (err) {
                showMessage('Error inesperado: ' + err.message, 'error');
            }
        });
    }

    // PASO 2: Verificar el código OTP
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
                // verifyOtp confirma la cuenta con el código
                const { data, error } = await db.auth.verifyOtp({
                    email: emailRegistrado,
                    token: code,
                    type: 'email_signup'
                });
                
                if (error) {
                    showMessage('Código inválido o expirado: ' + error.message, 'error');
                    return;
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
