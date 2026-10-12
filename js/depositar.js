document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    
    if (!db) { window.location.href = 'index.html'; return; }

    const { data: { session } } = await db.auth.getSession();
    if (!session || !session.user) { window.location.href = 'index.html'; return; }

    const formDeposito = document.getElementById('formDeposito');
    if (!formDeposito) return;

    formDeposito.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnDepositar');
        const msg = document.getElementById('msgDeposito');
        
        const monto = parseFloat(document.getElementById('depMonto').value);
        const banco = document.getElementById('depBanco').value;
        const telefono = document.getElementById('depTelefono').value;
        const cedula = document.getElementById('depCedula').value;
        const referencia = document.getElementById('depReferencia').value;

        if (!monto || monto < 1) {
            msg.textContent = '❌ El monto mínimo es 1 BC.';
            msg.className = 'message error';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando...';
        msg.className = 'message';

        try {
            // AQUÍ irá el INSERT real a la tabla 'transacciones' cuando la creemos
            // Por ahora simulamos el éxito
            await new Promise(resolve => setTimeout(resolve, 1500));

            msg.textContent = '✅ Depósito reportado exitosamente. Estamos validando tu pago.';
            msg.className = 'message success';
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
            formDeposito.reset();
        } catch (err) {
            msg.textContent = '❌ Error al reportar: ' + err.message;
            msg.className = 'message error';
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
        }
    });
});
