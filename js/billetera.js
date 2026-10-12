document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    
    if (!db) { window.location.href = 'index.html'; return; }

    // 1. Verificar sesión
    const { data: { session } } = await db.auth.getSession();
    if (!session || !session.user) { window.location.href = 'index.html'; return; }

    // 2. Cargar perfil
    const { data: perfil, error } = await db.from('perfiles').select('*').eq('id', session.user.id).single();
    
    if (error || !perfil) {
        console.error('Error cargando perfil:', error);
        return;
    }

    // 3. Actualizar UI
    document.getElementById('walletBalance').textContent = `${(perfil.saldo_bc || 0).toFixed(2)} BC`;
    document.getElementById('walletUserName').textContent = perfil.nombre || session.user.email;

    // 4. Verificar KYC para la tarjeta de Retirar
    const cardRetirar = document.getElementById('cardRetirar');
    const kycWarning = document.getElementById('kycWarning');

    if (perfil.estado_kyc !== 'verificado') {
        cardRetirar.classList.add('locked');
        cardRetirar.href = '#'; // Desactivar enlace
        cardRetirar.onclick = (e) => {
            e.preventDefault();
            alert('⚠️ Debes completar la verificación KYC antes de poder retirar fondos.');
            window.location.href = 'perfil.html';
        };
        kycWarning.style.display = 'block';
    }
});
