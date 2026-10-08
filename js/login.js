// ⚠️ IMPORTANTE: Reemplaza con tus credenciales de Supabase
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'tu-anon-key-aqui';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginForm = document.getElementById('loginForm');
const messageDiv = document.getElementById('message');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    showMessage('Iniciando sesión...', 'info');
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            showMessage('Error: ' + error.message, 'error');
            return;
        }
        
        showMessage('¡Inicio de sesión exitoso! Redirigiendo...', 'success');
        
        setTimeout(() => {
            // window.location.href = '../dashboard.html';
            alert('¡Bienvenido a Boche Clava\'o!');
        }, 1500);
        
    } catch (err) {
        showMessage('Error inesperado: ' + err.message, 'error');
    }
});

function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = 'message ' + type;
}

async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        // window.location.href = '../dashboard.html';
    }
}

checkSession();
