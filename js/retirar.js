document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { window.location.href = 'index.html'; return; }

    const { data: { session } } = await db.auth.getSession();
    if (!session || !session.user) { window.location.href = 'index.html'; return; }

    let tasaBCV = 0;
    let saldoActual = 0;
    let metodoSeleccionado = null;

    // ==========================================
    // 1. OBTENER TASA BCV Y DATOS DEL USUARIO
    // ==========================================
    async function cargarDatosIniciales() {
        try {
            // Tasa BCV
            const { data: configData } = await db
                .from('configuracion_sistema')
                .select('valor')
                .eq('clave', 'tasa_bcv_oficial')
                .single();
            
            if (configData) {
                tasaBCV = parseFloat(configData.valor.replace(',', '.'));
            } else {
                tasaBCV = 876.7976;
            }

            // Perfil del usuario
            const { data: perfil } = await db
                .from('perfiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (!perfil) {
                alert('No se encontró tu perfil.');
                window.location.href = 'dashboard.html';
                return;
            }

            saldoActual = perfil.saldo_bc || 0;
            document.getElementById('saldoDisponible').textContent = saldoActual.toFixed(2);

            // Verificar KYC
            if (perfil.estado_kyc !== 'verificado') {
                document.getElementById('kycBloqueo').style.display = 'block';
                document.getElementById('contenidoRetiro').style.display = 'none';
            } else {
                document.getElementById('kycBloqueo').style.display = 'none';
                document.getElementById('contenidoRetiro').style.display = 'block';
                renderizarMetodosPago();
            }

        } catch (error) {
            console.error('Error cargando datos:', error);
            alert('Error al cargar los datos. Recarga la página.');
        }
    }

    await cargarDatosIniciales();

    // ==========================================
    // 2. MÉTODOS DE PAGO DISPONIBLES PARA RETIRO
    // ==========================================
    const metodosRetiro = {
        'pagomovil': {
            nombre: 'Pago Móvil',
            logo: '../img/pg.png',
            camposUsuario: [
                { id: 'banco', label: 'Banco', type: 'select', options: [
                    'Banco de Venezuela', 'Banesco', 'Mercantil', 'Provincial (BBVA)', 
                    'Bicentenario', 'Bancaribe', 'Banco Exterior', 'Bancrecer', 'Banplus', 
                    'Banco del Tesoro', 'Banco Nacional de Crédito (BNC)',
                    'Banco Plaza', 'Banco Sofitasa', 'Banco Agrícola de Venezuela', 
                    'Banco Fondo Común (BFC)', '100% Banco', 'Mi Banco', 'Banco Activo', 
                    'Bancamiga', 'Bantrab', 'Banco de la Fuerza Armada (BANFANB)', 
                    'Banco Caroní', 'Del Sur Banco Universal', 'Banco Internacional de Desarrollo'
                ]},
                { id: 'telefono', label: 'Teléfono', type: 'tel', placeholder: '0414-1234567' },
                { id: 'cedula', label: 'Cédula', type: 'text', placeholder: 'V-12345678' }
            ]
        },
        'zelle': {
            nombre: 'Zelle',
            logo: '../img/zelle.png',
            camposUsuario: [
                { id: 'nombre', label: 'Nombre del titular', type: 'text', placeholder: 'Como aparece en Zelle' },
                { id: 'email', label: 'Correo o teléfono Zelle', type: 'text', placeholder: 'correo@ejemplo.com' }
            ]
        },
        'binance': {
            nombre: 'Binance (USDT)',
            logo: '../img/binance.png',
            camposUsuario: [
                { id: 'red', label: 'Red', type: 'select', options: ['TRC20 (Tron)', 'BEP20 (BSC)', 'ERC20 (Ethereum)'] },
                { id: 'direccion', label: 'Dirección de tu wallet', type: 'text', placeholder: 'TXYZ...' }
            ]
        },
        'paypal': {
            nombre: 'PayPal',
            logo: '../img/paypal.png',
            camposUsuario: [
                { id: 'email', label: 'Correo PayPal', type: 'email', placeholder: 'correo@ejemplo.com' }
            ]
        }
    };

    function renderizarMetodosPago() {
        const grid = document.getElementById('paymentMethodsGrid');
        Object.keys(metodosRetiro).forEach(key => {
            const metodo = metodosRetiro[key];
            const card = document.createElement('div');
            card.className = 'method-card';
            card.innerHTML = `
                <img src="${metodo.logo}" alt="${metodo.nombre}" onerror="this.src='../img/moneda.png'">
                <span>${metodo.nombre}</span>
            `;
            card.onclick = () => seleccionarMetodo(key, card);
            grid.appendChild(card);
        });
    }

    function seleccionarMetodo(key, cardElement) {
        metodoSeleccionado = key;
        const datos = metodosRetiro[key];
        
        document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
        cardElement.classList.add('selected');

        const formFields = document.getElementById('userFormFields');
        formFields.innerHTML = datos.camposUsuario.map(campo => {
            if (campo.type === 'select') {
                return `
                    <div class="form-group">
                        <label>${campo.label}</label>
                        <select id="${campo.id}" required>
                            <option value="">Selecciona...</option>
                            ${campo.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                        </select>
                    </div>
                `;
            }
            return `
                <div class="form-group">
                    <label>${campo.label}</label>
                    <input type="${campo.type}" id="${campo.id}" required placeholder="${campo.placeholder || ''}">
                </div>
            `;
        }).join('');

        document.getElementById('dynamicForm').style.display = 'block';
        document.getElementById('dynamicForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ==========================================
    // 3. CÁLCULO EN TIEMPO REAL
    // ==========================================
    const retMontoInput = document.getElementById('retMonto');
    const conversionPreview = document.getElementById('conversionPreview');
    
    retMontoInput.addEventListener('input', function() {
        const monto = parseFloat(this.value) || 0;
        
        if (monto > 0 && tasaBCV > 0) {
            const montoBs = monto * tasaBCV;
            document.getElementById('retMontoBs').textContent = montoBs.toFixed(2) + ' Bs';
            document.getElementById('retTasaBCV').textContent = tasaBCV.toFixed(4);
            conversionPreview.style.display = 'flex';
        } else {
            conversionPreview.style.display = 'none';
        }
    });

    // ==========================================
    // 4. ENVÍO DEL FORMULARIO
    // ==========================================
    const formRetiro = document.getElementById('formRetiro');
    formRetiro.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!metodoSeleccionado) {
            mostrarMensaje('❌ Debes seleccionar un método de recepción.', 'error');
            return;
        }

        const monto = parseFloat(retMontoInput.value);
        
        // Validaciones
        if (monto < 10) {
            mostrarMensaje('❌ El monto mínimo de retiro es 10 BC.', 'error');
            return;
        }
        if (monto > saldoActual) {
            mostrarMensaje('❌ No tienes suficiente saldo disponible.', 'error');
            return;
        }

        const btn = document.getElementById('btnRetirar');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando...';

        const montoUSD = monto; // 1 BC = 1 USD
        const montoBS = monto * tasaBCV;

        // Recopilar datos del usuario
        const datosUsuario = {};
        metodosRetiro[metodoSeleccionado].camposUsuario.forEach(campo => {
            const elemento = document.getElementById(campo.id);
            if (elemento) datosUsuario[campo.id] = elemento.value.trim();
        });

        try {
            // Guardar retiro en la base de datos
            const { data: retiro, error: dbError } = await db
                .from('retiros')
                .insert({
                    user_id: session.user.id,
                    monto_bc: monto,
                    monto_usd: montoUSD,
                    monto_bs: montoBS,
                    tasa_bcv_usada: tasaBCV,
                    metodo_pago: metodoSeleccionado,
                    datos_pago: datosUsuario,
                    estado: 'pendiente'
                })
                .select()
                .single();
            
            if (dbError) throw new Error('Error al guardar: ' + dbError.message);

            // Descontar el saldo del usuario (congelar fondos)
            const nuevoSaldo = saldoActual - monto;
            const { error: updateError } = await db
                .from('perfiles')
                .update({ saldo_bc: nuevoSaldo })
                .eq('id', session.user.id);
            
            if (updateError) throw new Error('Error al actualizar saldo: ' + updateError.message);

            console.log('✅ Retiro registrado:', retiro);

            // Mostrar vista de éxito
            document.getElementById('formRetiro').style.display = 'none';
            document.getElementById('saldoDisponible').textContent = nuevoSaldo.toFixed(2);
            document.getElementById('successAmount').textContent = monto;
            document.getElementById('successView').style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
        } catch (err) {
            console.error('Error en retiro:', err);
            mostrarMensaje('❌ Error: ' + err.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Solicitar Retiro';
        }
    });

    function mostrarMensaje(texto, tipo) {
        const msg = document.getElementById('msgRetiro');
        if (msg) {
            msg.textContent = texto;
            msg.className = `message ${tipo}`;
        }
    }

    // ==========================================
    // 5. FUNCIÓN PARA NUEVO RETIRO
    // ==========================================
    window.nuevoRetiro = function() {
        formRetiro.reset();
        document.querySelectorAll('.method-card').forEach(el => el.classList.remove('selected'));
        document.getElementById('dynamicForm').style.display = 'none';
        document.getElementById('conversionPreview').style.display = 'none';
        metodoSeleccionado = null;
        
        document.getElementById('formRetiro').style.display = 'block';
        document.getElementById('successView').style.display = 'none';
        
        const btn = document.getElementById('btnRetirar');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Solicitar Retiro';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
});
