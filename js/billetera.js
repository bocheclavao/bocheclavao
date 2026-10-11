document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        window.location.href = 'index.html';
        return;
    }

    let currentUser = null;
    let userPerfil = null;

    // ============================================
    // 1. PROTEGER RUTA Y CARGAR DATOS
    // ============================================
    async function iniciarBilletera() {
        const { data: { session } } = await db.auth.getSession();
        
        if (!session || !session.user) {
            window.location.href = 'index.html';
            return;
        }

        currentUser = session.user;

        // Cargar perfil para obtener saldo y estado KYC
        const { data: perfil, error } = await db.from('perfiles').select('*').eq('id', currentUser.id).single();
        
        if (error || !perfil) {
            console.error('Error cargando perfil:', error);
            return;
        }

        userPerfil = perfil;
        actualizarUI(perfil);
        verificarPermisosKYC(perfil.estado_kyc);
        cargarHistorialMock(); // Aquí luego conectarás con la tabla real de transacciones

        // 🎯 TRUCO PRO: Si viene del dashboard con ?tab=depositar, abrir esa pestaña
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('tab') === 'depositar') {
            cambiarPestana('depositar');
        }
    }

    // ============================================
    // 2. ACTUALIZAR INTERFAZ
    // ============================================
    function actualizarUI(perfil) {
        document.getElementById('walletBalance').textContent = `${(perfil.saldo_bc || 0).toFixed(2)} BC`;
        document.getElementById('saldoDisponibleRetiro').textContent = (perfil.saldo_bc || 0).toFixed(2);
        document.getElementById('walletUserName').textContent = perfil.nombre || currentUser.email;
    }

    // ============================================
    // 3. LÓGICA DE PESTAÑAS (TABS)
    // ============================================
    window.cambiarPestana = function(tabName) {
        // Desactivar todos los botones y contenidos
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Activar el seleccionado
        const btnActivo = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
        const contentActivo = document.getElementById(`tab-${tabName}`);

        if (btnActivo && contentActivo) {
            // Si intenta ir a retirar pero está bloqueado, no hacer nada
            if (tabName === 'retirar' && btnActivo.classList.contains('disabled')) {
                return;
            }
            btnActivo.classList.add('active');
            contentActivo.classList.add('active');
        }
    };

    // ============================================
    // 4. VERIFICAR PERMISOS DE RETIRO (KYC)
    // ============================================
    function verificarPermisosKYC(estadoKyc) {
        const tabRetirarBtn = document.getElementById('tabRetirar');
        const formRetiro = document.getElementById('formRetiro');
        const kycBloqueo = document.getElementById('kycBloqueoRetiro');

        if (estadoKyc !== 'verificado') {
            // Bloquear pestaña
            tabRetirarBtn.classList.add('disabled');
            tabRetirarBtn.title = "Debes verificar tu identidad para retirar";
            
            // Mostrar advertencia dentro del contenido
            kycBloqueo.style.display = 'block';
            formRetiro.style.display = 'none';
        } else {
            // Permitir retiro
            tabRetirarBtn.classList.remove('disabled');
            kycBloqueo.style.display = 'none';
            formRetiro.style.display = 'block';
        }
    }

    // ============================================
    // 5. MANEJO DE FORMULARIOS (MOCKUP POR AHORA)
    // ============================================
    
    // Formulario de Depósito
    const formDeposito = document.getElementById('formDeposito');
    if (formDeposito) {
        formDeposito.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnDepositar');
            const msg = document.getElementById('msgDeposito');
            
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando...';
            msg.className = 'message';

            // AQUÍ IRÁ LA LÓGICA PARA GUARDAR EN SUPABASE (tabla 'transacciones')
            // Simulamos una espera de red
            setTimeout(() => {
                msg.textContent = '✅ Depósito reportado exitosamente. Estamos validando tu pago.';
                msg.className = 'message success';
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
                formDeposito.reset();
            }, 2000);
        });
    }

    // Formulario de Retiro
    const formRetiro = document.getElementById('formRetiro');
    if (formRetiro) {
        formRetiro.addEventListener('submit', async (e) => {
            e.preventDefault();
            const monto = parseFloat(document.getElementById('retMonto').value);
            const saldoActual = userPerfil.saldo_bc || 0;
            const msg = document.getElementById('msgRetiro');
            const btn = document.getElementById('btnRetirar');

            if (monto > saldoActual) {
                msg.textContent = '❌ El monto a retirar supera tu saldo disponible.';
                msg.className = 'message error';
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Enviando solicitud...';
            msg.className = 'message';

            // AQUÍ IRÁ LA LÓGICA PARA CREAR LA SOLICITUD DE RETIRO EN SUPABASE
            setTimeout(() => {
                msg.textContent = '✅ Solicitud de retiro enviada. Recibirás los fondos en 24-48h.';
                msg.className = 'message success';
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-money-bill-wave"></i> Solicitar Retiro';
                formRetiro.reset();
            }, 2000);
        });
    }

    // ============================================
    // 6. CARGAR HISTORIAL (MOCKUP)
    // ============================================
    function cargarHistorialMock() {
        const tbody = document.getElementById('historialBody');
        // Aquí harás: const { data } = await db.from('transacciones').select('*').eq('user_id', currentUser.id).order('fecha', {ascending: false});
        
        // Datos de ejemplo para que veas cómo queda el diseño
        const transaccionesEjemplo = [
            { fecha: '2026-10-10 14:30', tipo: 'Depósito', monto: 50.00, estado: 'completado' },
            { fecha: '2026-10-11 09:15', tipo: 'Apuesta', monto: -10.00, estado: 'completado' },
            { fecha: '2026-10-11 09:20', tipo: 'Ganancia', monto: 15.00, estado: 'completado' },
            { fecha: '2026-10-12 10:00', tipo: 'Retiro', monto: -20.00, estado: 'pendiente' }
        ];

        if (transaccionesEjemplo.length === 0) return;

        tbody.innerHTML = transaccionesEjemplo.map(t => {
            const montoClass = t.monto >= 0 ? 'amount-positive' : 'amount-negative';
            const signo = t.monto >= 0 ? '+' : '';
            const estadoClass = t.estado;
            
            return `
                <tr>
                    <td>${t.fecha}</td>
                    <td>${t.tipo}</td>
                    <td class="${montoClass}">${signo}${t.monto.toFixed(2)} BC</td>
                    <td><span class="status-badge ${estadoClass}">${t.estado}</span></td>
                </tr>
            `;
        }).join('');
    }

    // Iniciar todo
    iniciarBilletera();
});
