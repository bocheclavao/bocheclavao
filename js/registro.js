document.addEventListener('DOMContentLoaded', function() {
    const messageDiv = document.getElementById('message');
    const registroForm = document.getElementById('registroForm');
    const otpForm = document.getElementById('otpForm');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const emailDisplay = document.getElementById('emailDisplay');
    const otpInput = document.getElementById('otpCode');
    const passwordInput = document.getElementById('password');
    
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

    // 1. Función para mostrar/ocultar contraseña (Global para el HTML)
    window.togglePassword = function(inputId, icon) {
        const input = document.getElementById(inputId);
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    };

    // 2. Validación en tiempo real de los requisitos de la contraseña
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            const val = this.value;
            updateRequirement('req-length', val.length >= 8);
            updateRequirement('req-letter', /[a-zA-Z]/.test(val));
            updateRequirement('req-number', /[0-9]/.test(val));
            updateRequirement('req-special', /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val));
        });
    }

    function updateRequirement(id, isValid) {
        const li = document.getElementById(id);
        if (!li) return;
        const icon = li.querySelector('i');
        if (isValid) {
            li.classList.remove('req-invalid');
            li.classList.add('req-valid');
            icon.className = 'fas fa-check-circle';
        } else {
            li.classList.remove('req-valid');
            li.classList.add('req-invalid');
            icon.className = 'fas fa-circle';
        }
    }

    // Solo permitir números en el input del código OTP
    if (otpInput) {
        otpInput.addEventListener('input', function(e) {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

    // 3. PASO 1: Registrar usuario y enviar código
    if (registroForm) {
        registroForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nombre = document.getElementById('nombre').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (password !== confirmPassword) {
                showMessage('Las contraseñas no coinciden', 'error');
                return;
            }
            
            // Validación estricta de contraseña
            if (password.length < 8) {
                showMessage('La contraseña debe tener al menos 8 caracteres', 'error');
                return;
            }
            if (!/[a-zA-Z]/.test(password)) {
                showMessage('La contraseña debe tener al menos una letra', 'error');
                return;
            }
            if (!/[0-9]/.test(password)) {
                showMessage('La contraseña debe tener al menos un número', 'error');
                return;
            }
            if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
                showMessage('La contraseña debe tener al menos un carácter especial (!@#$%...)', 'error');
                return;
            }
            
            showMessage('Enviando código de verificación...', 'info');
            
            try {
                // Usamos signUp estándar. Si OTP está activado en Supabase, enviará el código.
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
                showMessage('Código de 6 dígitos enviado. Revisa tu correo (y la carpeta de Spam).', 'success');
                
                setTimeout(() => otpInput.focus(), 100);
                
            } catch (err) {
                showMessage('Error inesperado: ' + err.message, 'error');
            }
        });
    }

    // 4. PASO 2: Verificar el código OTP
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
                // Verificar el código OTP tipo 'signup'
                const { data, error } = await db.auth.verifyOtp({
                    email: emailRegistrado,
                    token: code,
                    type: 'signup'
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
        if (otpInput) otpInput.value = '';
        showMessage('', 'info'); // Limpiar mensajes
    };
});
