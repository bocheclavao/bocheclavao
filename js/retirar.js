document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { window.location.href = 'index.html'; return; }

    const { data: { session } } = await db.auth.getSession();
    if (!session || !session.user) { window.location.href = 'index.html'; return; }

    // ==========================================
    // 1. VARIABLES GLOBALES
    // ==========================================
    let tasaBCV = 0;
    let saldoActual = 0;
    let metodoSeleccionado = null;
    let perfilUsuario = null;

    // ==========================================
    // 2. MÉTODOS DE PAGO DISPONIBLES PARA RETIRO
    // ==========================================
    const metodosRetiro = {
        'pagomovil': {
            nombre: 'Pago Móvil',
            logo: '../img/pg.png',
            campoPerfil: 'datos_pago_pagomovil',
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
            campoPerfil: 'datos_pago_zelle',
            camposUsuario: [
                { id: 'nombre', label: 'Nombre del titular', type: 'text', placeholder: 'Como aparece en Zelle' },
                { id: 'email', label: 'Correo o teléfono Zelle', type: 'text', placeholder: 'correo@ejemplo.com' }
            ]
        },
        'binance': {
            nombre: 'Binance (USDT)',
            logo: '../img/binance.png',
            campoPerfil: 'datos_pago_binance',
            camposUsuario: [
                { id: 'red', label: 'Red', type: 'select', options: ['TRC20 (Tron)', 'BEP20 (BSC)', 'ERC20 (Ethereum)'] },
                { id: 'direccion', label: 'Dirección de tu wallet', type: 'text', placeholder: 'TXYZ...' }
            ]
        },
        'paypal': {
            nombre: 'PayPal',
            logo: '../img/paypal.png',
            campoPerfil: 'datos_pago_paypal',
            camposUsuario: [
                { id: 'email', label: 'Correo PayPal', type: 'email', placeholder: 'correo@ejemplo.com' }
            ]
        }
    };

    // ==========================================
    // 3. FUNCIÓN PARA RENDERIZAR MÉTODOS DE PAGO
    // ==========================================
    function renderizarMetodosPago() {
        const grid = document.getElementById('paymentMethodsGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
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

        // Verificar si ya hay datos guardados para este método
        const datosGuardados = perfilUsuario[datos.campoPerfil] || {};
        const tieneDatosGuardados = Object.keys(datosGuardados).length > 0;

        const formFields = document.getElementById('userFormFields');
        const securityWarning = document.getElementById('securityWarning');
        const lockedDataMessage = document.getElementById('lockedDataMessage');

        if (tieneDatosGuardados) {
            // ✅ DATOS BLOQUEADOS: Mostrar campos en solo lectura
            if (securityWarning) securityWarning.style.display = 'none';
            if (lockedDataMessage) lockedDataMessage.style.display = 'flex';

            formFields.innerHTML = datos.camposUsuario.map(campo => {
                const valorGuardado = datosGuardados[campo.id] || '';
                
                if (campo.type === 'select') {
                    return `
                        <div class="form-group">
                            <label>${campo.label} <i class="fas fa-lock" style="color: #6464ff; font-size: 0.75rem; margin-left: 5px;"></i></label>
                            <select id="${campo.id}" disabled>
                                <option value="${valorGuardado}">${valorGuardado}</option>
                            </select>
                        </div>
                    `;
                }
                return `
                    <div class="form-group">
                        <label>${campo.label} <i class="fas fa-lock" style="color: #6464ff; font-size: 0.75rem; margin-left: 5px;"></i></label>
                        <input type="${campo.type}" id="${campo.id}" value="${valorGuardado}" disabled>
                    </div>
                `;
            }).join('');

        } else {
            // ✅ PRIMERA VEZ: Mostrar formulario con advertencia de seguridad
            if (securityWarning) securityWarning.style.display = 'flex';
            if (lockedDataMessage) lockedDataMessage.style.display = 'none';

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
        }

        document.getElementById('dynamicForm').style.display = 'block';
        document.getElementById('dynamicForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ==========================================
    // 4. CARGAR TASA BCV Y DATOS DEL USUARIO
    // ==========================================
    async function cargarDatosIniciales() {
        try {
            // Tasa BCV desde tu base de datos
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

            // Perfil del usuario (incluyendo datos bancarios guardados)
            const { data: perfil, error } = await db
                .from('perfiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (error || !perfil) {
                alert('No se encontró tu perfil.');
                window.location.href = 'dashboard.html';
                return;
            }

            perfilUsuario = perfil;
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
    // 5. CÁLCULO EN TIEMPO REAL
    // ==========================================
    const retMontoInput = document.getElementById('retMonto');
    const conversionPreview = document.getElementById('conversionPreview');
    
    if (retMontoInput) {
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
    }

     // ==========================================
    // 6. ENVÍO DEL FORMULARIO (CON GUARDADO DE DATOS BANCARIOS)
    // ==========================================
    const formRetiro = document.getElementById('formRetiro');
    if (formRetiro) {
        formRetiro.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('🚀 Iniciando proceso de retiro...');
            
            if (!metodoSeleccionado) {
                mostrarMensaje('❌ Debes seleccionar un método de recepción.', 'error');
                return;
            }

            const monto = parseFloat(retMontoInput.value);
            
            // Validaciones (MÍNIMO 50 BC)
            if (monto < 50) {
                mostrarMensaje('❌ El monto mínimo de retiro es 50 BC.', 'error');
                return;
            }
            if (monto > saldoActual) {
                mostrarMensaje('❌ No tienes suficiente saldo disponible.', 'error');
                return;
            }

            const btn = document.getElementById('btnRetirar');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando...';

            const montoUSD = monto;
            const montoBS = monto * tasaBCV;

            // Recopilar datos del usuario
            const datosUsuario = {};
            metodosRetiro[metodoSeleccionado].camposUsuario.forEach(campo => {
                const elemento = document.getElementById(campo.id);
                if (elemento) datosUsuario[campo.id] = elemento.value.trim();
            });

            try {
                console.log('💾 Guardando datos bancarios en perfil...');
                // ✅ GUARDAR DATOS BANCARIOS SOLO SI ES LA PRIMERA VEZ
                const campoPerfil = metodosRetiro[metodoSeleccionado].campoPerfil;
                const datosActuales = perfilUsuario[campoPerfil] || {};
                
                if (Object.keys(datosActuales).length === 0) {
                    const { error: updatePerfilError } = await db
                        .from('perfiles')
                        .update({ [campoPerfil]: datosUsuario })
                        .eq('id', session.user.id);
                    
                    if (updatePerfilError) {
                        console.warn('⚠️ No se pudieron guardar los datos bancarios:', updatePerfilError);
                    } else {
                        console.log('✅ Datos bancarios guardados y bloqueados permanentemente');
                        perfilUsuario[campoPerfil] = datosUsuario;
                    }
                } else {
                    console.log('ℹ️ Datos bancarios ya estaban guardados, usando los existentes');
                }

                console.log('💾 Registrando retiro en base de datos...');
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
                
                if (dbError) throw new Error('Error al guardar retiro: ' + dbError.message);

                console.log('💰 Actualizando saldo del usuario...');
                // Descontar el saldo del usuario (congelar fondos)
                const nuevoSaldo = saldoActual - monto;
                const { error: updateSaldoError } = await db
                    .from('perfiles')
                    .update({ saldo_bc: nuevoSaldo })
                    .eq('id', session.user.id);
                
                if (updateSaldoError) throw new Error('Error al actualizar saldo: ' + updateSaldoError.message);

                saldoActual = nuevoSaldo;
                console.log('✅ Retiro registrado exitosamente:', retiro);

                // ==========================================
                // MOSTRAR VISTA DE ÉXITO
                // ==========================================
                console.log('🎉 Mostrando pantalla de éxito...');
                
                const formRetiroEl = document.getElementById('formRetiro');
                const successViewEl = document.getElementById('successView');
                const successAmountEl = document.getElementById('successAmount');
                
                if (formRetiroEl) formRetiroEl.style.display = 'none';
                if (successAmountEl) successAmountEl.textContent = monto;
                
                if (successViewEl) {
                    successViewEl.style.display = 'block';
                    console.log('✅ successView mostrado correctamente');
                } else {
                    console.error('❌ ERROR: No se encontró el elemento #successView en el HTML. Revisa retirar.html');
                    alert('Retiro exitoso, pero hubo un error visual. Revisa la consola (F12).');
                }
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
                
            } catch (err) {
                console.error('❌ Error en retiro:', err);
                mostrarMensaje('❌ Error: ' + err.message, 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Solicitar Retiro';
            }
        });
    }
    function mostrarMensaje(texto, tipo) {
        const msg = document.getElementById('msgRetiro');
        if (msg) {
            msg.textContent = texto;
            msg.className = `message ${tipo}`;
        }
    }

    // ==========================================
    // 7. FUNCIÓN PARA NUEVO RETIRO
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
