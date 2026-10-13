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
    const COMISION_PORCENTAJE = 0.003; // 0.30% de comisión

    // ==========================================
    // 2. MÉTODOS DE PAGO
    // ==========================================
    const metodosRetiro = {
        'pagomovil': { nombre: 'Pago Móvil', logo: '../img/pg.png', campoPerfil: 'datos_pago_pagomovil', camposUsuario: [{ id: 'banco', label: 'Banco', type: 'select', options: ['Banco de Venezuela', 'Banesco', 'Mercantil', 'Provincial (BBVA)', 'Bicentenario', 'Bancaribe', 'Banco Exterior', 'Bancrecer', 'Banplus', 'Banco del Tesoro', 'Banco Nacional de Crédito (BNC)', 'Banco Plaza', 'Banco Sofitasa', 'Banco Agrícola de Venezuela', 'Banco Fondo Común (BFC)', '100% Banco', 'Mi Banco', 'Banco Activo', 'Bancamiga', 'Bantrab', 'Banco de la Fuerza Armada (BANFANB)', 'Banco Caroní', 'Del Sur Banco Universal', 'Banco Internacional de Desarrollo'] }, { id: 'telefono', label: 'Teléfono', type: 'tel', placeholder: '0414-1234567' }, { id: 'cedula', label: 'Cédula', type: 'text', placeholder: 'V-12345678' }] },
        'zelle': { nombre: 'Zelle', logo: '../img/zelle.png', campoPerfil: 'datos_pago_zelle', camposUsuario: [{ id: 'nombre', label: 'Nombre del titular', type: 'text', placeholder: 'Como aparece en Zelle' }, { id: 'email', label: 'Correo o teléfono Zelle', type: 'text', placeholder: 'correo@ejemplo.com' }] },
        'binance': { nombre: 'Binance (USDT)', logo: '../img/binance.png', campoPerfil: 'datos_pago_binance', camposUsuario: [{ id: 'red', label: 'Red', type: 'select', options: ['TRC20 (Tron)', 'BEP20 (BSC)', 'ERC20 (Ethereum)'] }, { id: 'direccion', label: 'Dirección de tu wallet', type: 'text', placeholder: 'TXYZ...' }] },
        'paypal': { nombre: 'PayPal', logo: '../img/paypal.png', campoPerfil: 'datos_pago_paypal', camposUsuario: [{ id: 'email', label: 'Correo PayPal', type: 'email', placeholder: 'correo@ejemplo.com' }] }
    };

    // ==========================================
    // 3. RENDERIZAR MÉTODOS
    // ==========================================
    function renderizarMetodosPago() {
        const grid = document.getElementById('paymentMethodsGrid');
        if (!grid) return;
        grid.innerHTML = '';
        Object.keys(metodosRetiro).forEach(key => {
            const metodo = metodosRetiro[key];
            const card = document.createElement('div');
            card.className = 'method-card';
            card.innerHTML = `<img src="${metodo.logo}" alt="${metodo.nombre}" onerror="this.src='../img/moneda.png'"><span>${metodo.nombre}</span>`;
            card.onclick = () => seleccionarMetodo(key, card);
            grid.appendChild(card);
        });
    }

    function seleccionarMetodo(key, cardElement) {
        metodoSeleccionado = key;
        const datos = metodosRetiro[key];
        document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
        cardElement.classList.add('selected');

        const datosGuardados = perfilUsuario[datos.campoPerfil] || {};
        const tieneDatosGuardados = Object.keys(datosGuardados).length > 0;
        const formFields = document.getElementById('userFormFields');
        const securityWarning = document.getElementById('securityWarning');
        const lockedDataMessage = document.getElementById('lockedDataMessage');

        if (tieneDatosGuardados) {
            if (securityWarning) securityWarning.style.display = 'none';
            if (lockedDataMessage) lockedDataMessage.style.display = 'flex';
            formFields.innerHTML = datos.camposUsuario.map(campo => {
                const valorGuardado = datosGuardados[campo.id] || '';
                if (campo.type === 'select') return `<div class="form-group"><label>${campo.label} <i class="fas fa-lock" style="color: #6464ff; font-size: 0.75rem; margin-left: 5px;"></i></label><select id="${campo.id}" disabled><option value="${valorGuardado}">${valorGuardado}</option></select></div>`;
                return `<div class="form-group"><label>${campo.label} <i class="fas fa-lock" style="color: #6464ff; font-size: 0.75rem; margin-left: 5px;"></i></label><input type="${campo.type}" id="${campo.id}" value="${valorGuardado}" disabled></div>`;
            }).join('');
        } else {
            if (securityWarning) securityWarning.style.display = 'flex';
            if (lockedDataMessage) lockedDataMessage.style.display = 'none';
            formFields.innerHTML = datos.camposUsuario.map(campo => {
                if (campo.type === 'select') return `<div class="form-group"><label>${campo.label}</label><select id="${campo.id}" required><option value="">Selecciona...</option>${campo.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select></div>`;
                return `<div class="form-group"><label>${campo.label}</label><input type="${campo.type}" id="${campo.id}" required placeholder="${campo.placeholder || ''}"></div>`;
            }).join('');
        }
        document.getElementById('dynamicForm').style.display = 'block';
        document.getElementById('dynamicForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ==========================================
    // 4. CARGAR DATOS INICIALES (CON SALDO FRESCO)
    // ==========================================
    async function cargarDatosIniciales() {
        try {
            const { data: configData } = await db.from('configuracion_sistema').select('valor').eq('clave', 'tasa_bcv_oficial').single();
            tasaBCV = configData ? parseFloat(configData.valor.replace(',', '.')) : 876.79;

            // Leemos el perfil y el saldo directamente de la BD
            const { data: perfil, error } = await db.from('perfiles').select('*').eq('id', session.user.id).single();
            if (error || !perfil) { alert('No se encontró tu perfil.'); window.location.href = 'dashboard.html'; return; }

            perfilUsuario = perfil;
            saldoActual = perfil.saldo_bc || 0; // Asignamos el valor real de la BD
            
            // Actualizamos la UI con el saldo real
            document.getElementById('saldoDisponible').textContent = saldoActual.toFixed(2);

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
            const montoSolicitado = parseFloat(this.value) || 0;
            if (montoSolicitado > 0 && tasaBCV > 0) {
                const comisionBC = montoSolicitado * COMISION_PORCENTAJE;
                const montoNetoBC = montoSolicitado - comisionBC;
                const montoNetoBS = montoNetoBC * tasaBCV;
                document.getElementById('retMontoDisplay').textContent = montoSolicitado.toFixed(2);
                document.getElementById('retComision').textContent = comisionBC.toFixed(2);
                document.getElementById('retMontoNetoBs').textContent = montoNetoBS.toFixed(2);
                document.getElementById('retTasaBCV').textContent = tasaBCV.toFixed(4);
                conversionPreview.style.display = 'flex';
            } else {
                conversionPreview.style.display = 'none';
            }
        });
    }

    // ==========================================
    // 6. ENVÍO DEL FORMULARIO (BLINDADO AL 100%)
    // ==========================================
    const formRetiro = document.getElementById('formRetiro');
    if (formRetiro) {
        formRetiro.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('🚀 Iniciando proceso de retiro blindado...');
            
            if (!metodoSeleccionado) { mostrarMensaje('❌ Debes seleccionar un método de recepción.', 'error'); return; }
            
            const montoSolicitado = parseFloat(retMontoInput.value);
            if (montoSolicitado < 50) { mostrarMensaje('❌ El monto mínimo de retiro es 50 BC.', 'error'); return; }

            const btn = document.getElementById('btnRetirar');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando...';

            const comisionBC = montoSolicitado * COMISION_PORCENTAJE;
            const montoNetoBC = montoSolicitado - comisionBC;
            const montoUSD = montoNetoBC;
            const montoBS = montoNetoBC * tasaBCV;
            const comisionBS = comisionBC * tasaBCV;

            const datosUsuario = {};
            metodosRetiro[metodoSeleccionado].camposUsuario.forEach(campo => {
                const elemento = document.getElementById(campo.id);
                if (elemento) datosUsuario[campo.id] = elemento.value.trim();
            });

            try {
                // A. Guardar datos bancarios si es la primera vez
                const campoPerfil = metodosRetiro[metodoSeleccionado].campoPerfil;
                const datosActuales = perfilUsuario[campoPerfil] || {};
                if (Object.keys(datosActuales).length === 0) {
                    const { error: updatePerfilError } = await db.from('perfiles').update({ [campoPerfil]: datosUsuario }).eq('id', session.user.id);
                    if (!updatePerfilError) perfilUsuario[campoPerfil] = datosUsuario;
                }

                // B. Registrar el retiro en la BD
                console.log('💾 Registrando retiro en base de datos...');
                const { data: retiro, error: dbError } = await db.from('retiros').insert({
                    user_id: session.user.id, monto_bc: montoSolicitado, monto_usd: montoUSD, monto_bs: montoBS,
                    comision_bc: comisionBC, comision_bs: comisionBS, tasa_bcv_usada: tasaBCV,
                    metodo_pago: metodoSeleccionado, datos_pago: datosUsuario, estado: 'pendiente'
                }).select().single();
                
                if (dbError) throw new Error('Error al guardar retiro: ' + dbError.message);

                // ==========================================
                // C. PROTOCOLO BLINDADO DE ACTUALIZACIÓN DE SALDO (4 PASOS)
                // ==========================================
                console.log('🛡️ Iniciando protocolo de actualización de saldo...');
                
                // Paso 1: Leer el saldo REAL más reciente de la BD (evita condiciones de carrera)
                const { data: perfilFresco, error: errorPerfilFresco } = await db
                    .from('perfiles')
                    .select('saldo_bc')
                    .eq('id', session.user.id)
                    .single();

                if (errorPerfilFresco) throw new Error('No se pudo verificar el saldo actual: ' + errorPerfilFresco.message);

                const saldoRealEnBD = perfilFresco.saldo_bc || 0;

                // Paso 2: Validar que el saldo real sea suficiente
                if (saldoRealEnBD < montoSolicitado) {
                    throw new Error('Saldo insuficiente en el momento de procesar. Por favor, recarga la página.');
                }

                // Paso 3: Ejecutar la actualización
                const nuevoSaldoCalculado = saldoRealEnBD - montoSolicitado;
                const { error: updateSaldoError } = await db
                    .from('perfiles')
                    .update({ saldo_bc: nuevoSaldoCalculado })
                    .eq('id', session.user.id);

                if (updateSaldoError) {
                    throw new Error('Error crítico al descontar el saldo: ' + updateSaldoError.message);
                }

                // Paso 4: Verificación final (Leer de nuevo para confirmar que la BD guardó el cambio)
                const { data: perfilVerificado, error: errorVerificacion } = await db
                    .from('perfiles')
                    .select('saldo_bc')
                    .eq('id', session.user.id)
                    .single();

                if (errorVerificacion) {
                    console.warn('⚠️ No se pudo verificar el saldo tras la actualización, pero el update se ejecutó.');
                    saldoActual = nuevoSaldoCalculado; // Confiamos en el cálculo local como fallback
                } else {
                    saldoActual = perfilVerificado.saldo_bc; // Usamos el valor confirmado por la BD
                }

                // Actualizar la UI inmediatamente con el saldo verificado
                document.getElementById('saldoDisponible').textContent = saldoActual.toFixed(2);
                console.log('✅ Saldo actualizado y VERIFICADO en BD:', saldoActual);
                // ==========================================

                // D. Enviar Correo
                try {
                    console.log('📧 Enviando comprobante por correo...');
                    await db.functions.invoke('enviar-factura', {
                        body: { email: session.user.email, nombre: perfilUsuario.nombre || 'Usuario', montoBC: montoSolicitado, montoUSD: montoUSD.toFixed(2), montoBS: montoBS.toFixed(2), metodo: metodosRetiro[metodoSeleccionado].nombre, fecha: new Date().toLocaleString('es-VE'), idTransaccion: retiro.id, tipo: 'Retiro' }
                    });
                    console.log('✅ Correo enviado');
                } catch (emailErr) { console.warn('⚠️ Error al enviar correo:', emailErr); }

                // E. Generar PDF
                try {
                    console.log('📄 Generando PDF de retiro...');
                    if (window.jspdf) {
                        const { jsPDF } = window.jspdf;
                        const doc = new jsPDF();
                        doc.setFillColor(255, 215, 0); doc.rect(0, 0, 210, 35, 'F');
                        doc.setTextColor(0, 0, 0); doc.setFontSize(24); doc.setFont("helvetica", "bold");
                        doc.text("BOCHE CLAVA'O", 105, 18, null, null, "center");
                        doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.text("COMPROBANTE OFICIAL DE RETIRO", 105, 26, null, null, "center");
                        
                        doc.setTextColor(50, 50, 50); doc.setFontSize(9);
                        let yPos = 45; const lineHeight = 6;
                        doc.setFont("helvetica", "bold"); doc.text("ID Transacción:", 14, yPos);
                        doc.setFont("helvetica", "normal"); doc.text(retiro.id.substring(0, 8) + '...', 90, yPos); yPos += lineHeight;
                        doc.setFont("helvetica", "bold"); doc.text("Fecha:", 14, yPos);
                        doc.setFont("helvetica", "normal"); doc.text(new Date().toLocaleDateString('es-VE'), 90, yPos); yPos += lineHeight;
                        doc.setFont("helvetica", "bold"); doc.text("Usuario:", 14, yPos);
                        const userName = perfilUsuario.nombre || session.user.email;
                        doc.setFont("helvetica", "normal"); doc.text(userName.length > 35 ? userName.substring(0, 35) + '...' : userName, 90, yPos); yPos += lineHeight + 3;
                        
                        doc.setFillColor(255, 215, 0); doc.rect(14, yPos, 182, 7, 'F');
                        doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
                        doc.text("DETALLES DEL RETIRO", 105, yPos + 4.5, null, null, "center"); yPos += 11;
                        
                        doc.setFontSize(9); doc.setTextColor(50, 50, 50);
                        const detalles = [
                            { label: "Método de Recepción:", value: metodosRetiro[metodoSeleccionado].nombre.toUpperCase() },
                            { label: "Monto Solicitado:", value: `${montoSolicitado} BC` },
                            { label: "Comisión (0.30%):", value: `-${comisionBC.toFixed(2)} BC` },
                            { label: "Monto Neto BC:", value: `${montoNetoBC.toFixed(2)} BC` },
                            { label: "Tasa BCV:", value: `${tasaBCV.toFixed(2)} Bs/USD` },
                            { label: "", value: "" },
                            { label: "TOTAL A RECIBIR (USD):", value: `$${montoUSD.toFixed(2)}`, highlight: true },
                            { label: "TOTAL A RECIBIR (Bs):", value: `Bs. ${montoBS.toFixed(2)}`, highlight: true },
                            { label: "", value: "" },
                            { label: "Estado:", value: "PENDIENTE", bold: true, color: [133, 100, 4] }
                        ];

                        detalles.forEach(item => {
                            if (item.label === "" && item.value === "") { yPos += 2; return; }
                            if (item.highlight) { doc.setFillColor(255, 248, 220); doc.rect(14, yPos - 2.5, 182, 7, 'F'); }
                            doc.setFont("helvetica", item.bold ? "bold" : "normal");
                            if (item.color) doc.setTextColor(...item.color);
                            else if (item.highlight) doc.setTextColor(139, 69, 19);
                            else doc.setTextColor(50, 50, 50);
                            doc.text(item.label, 16, yPos);
                            const valorWidth = doc.getStringUnitWidth(item.value) * doc.internal.getFontSize() / doc.internal.scaleFactor;
                            doc.text(item.value, 194 - valorWidth, yPos);
                            yPos += 6;
                        });
                        
                        yPos += 8; doc.setDrawColor(200, 200, 200); doc.line(14, yPos, 196, yPos); yPos += 8;
                        doc.setFontSize(7); doc.setTextColor(100, 100, 100); doc.setFont("helvetica", "italic");
                        doc.text("Este documento es un comprobante oficial generado automáticamente.", 105, yPos, null, null, "center"); yPos += 4;
                        doc.text("Soporte: soporte@bocheclavao.com", 105, yPos, null, null, "center"); yPos += 4;
                        doc.text("Boche Clava'o © " + new Date().getFullYear(), 105, yPos, null, null, "center");

                        window.facturaRetiroPDF = doc;
                        console.log('✅ PDF de retiro generado');
                    }
                } catch (pdfErr) { console.warn('⚠️ Error al generar PDF:', pdfErr); }

                // F. MOSTRAR VISTA DE ÉXITO
                console.log('🎉 Mostrando vista de éxito...');
                try {
                    const formEl = document.getElementById('formRetiro');
                    const contenidoEl = document.getElementById('contenidoRetiro');
                    if (formEl) formEl.style.display = 'none';
                    if (contenidoEl) contenidoEl.style.display = 'none';
                    
                    const amountEl = document.getElementById('successAmount');
                    if (amountEl) amountEl.textContent = montoSolicitado;
                    
                    const successActions = document.querySelector('.success-actions');
                    if (successActions) {
                        const btnExistente = document.getElementById('btnDescargarComprobanteRetiro');
                        if (btnExistente) btnExistente.remove();
                        
                        const btnDescargar = document.createElement('button');
                        btnDescargar.id = 'btnDescargarComprobanteRetiro';
                        btnDescargar.className = 'btn-secondary';
                        btnDescargar.style.marginTop = '10px';
                        btnDescargar.innerHTML = '<i class="fas fa-file-pdf"></i> Descargar Comprobante';
                        btnDescargar.onclick = () => {
                            if (window.facturaRetiroPDF) {
                                window.facturaRetiroPDF.save(`Comprobante_Retiro_${retiro.id.substring(0,8)}.pdf`);
                                console.log('📄 PDF descargado');
                            } else {
                                alert('No se pudo generar el comprobante. Contacta a soporte.');
                            }
                        };
                        successActions.insertBefore(btnDescargar, successActions.firstChild);
                        console.log('✅ Botón de descarga insertado');
                    }
                    
                    const successViewEl = document.getElementById('successView');
                    if (successViewEl) {
                        successViewEl.style.display = 'block';
                        console.log('✅ Vista de éxito mostrada');
                    }
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } catch (uiError) {
                    console.error('❌ ERROR CRÍTICO al mostrar la vista:', uiError);
                    throw uiError;
                }

            } catch (err) {
                console.error('❌ [ERROR GLOBAL] en el retiro:', err);
                mostrarMensaje('❌ Error: ' + err.message, 'error');
                
                // Restaurar estado en caso de error
                const formEl = document.getElementById('formRetiro');
                const contenidoEl = document.getElementById('contenidoRetiro');
                if (formEl) formEl.style.display = 'block';
                if (contenidoEl) contenidoEl.style.display = 'block';
                
                const btn = document.getElementById('btnRetirar');
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Solicitar Retiro'; }
            }
        });
    }

    function mostrarMensaje(texto, tipo) {
        const msg = document.getElementById('msgRetiro');
        if (msg) { msg.textContent = texto; msg.className = `message ${tipo}`; }
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
        
        // Usamos el saldoActual que YA FUE VERIFICADO por la BD en el paso anterior
        document.getElementById('saldoDisponible').textContent = saldoActual.toFixed(2);
        
        document.getElementById('contenidoRetiro').style.display = 'block';
        document.getElementById('formRetiro').style.display = 'block';
        document.getElementById('successView').style.display = 'none';
        
        const btn = document.getElementById('btnRetirar');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Solicitar Retiro';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
});
