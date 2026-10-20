document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        return;
    }

    // ==========================================
    // 1. REFERENCIAS AL DOM
    // ==========================================
    const formDeposito = document.getElementById('formDeposito');
    const msgDeposito = document.getElementById('msgDeposito');
    const successView = document.getElementById('successView');
    const successAmount = document.getElementById('successAmount');
    const paymentMethodsGrid = document.getElementById('paymentMethodsGrid');
    const packagesGrid = document.getElementById('packagesGrid');
    const companyDataBox = document.getElementById('companyDataBox');
    const companyDataContent = document.getElementById('companyDataContent');
    const fileUploadContainer = document.getElementById('fileUploadContainer');
    const comprobanteFile = document.getElementById('comprobanteFile');
    const filePreview = document.getElementById('filePreview');
    const previewImage = document.getElementById('previewImage');
    const removeFileBtn = document.getElementById('removeFile');
    const userFormFields = document.getElementById('userFormFields');
    const customAmount = document.getElementById('customAmount');
    const totalUSDEl = document.getElementById('totalUSD');
    const totalVESEl = document.getElementById('totalVES');
    const tasaBCVDisplay = document.getElementById('tasaBCVDisplay');
    const fechaBCVDisplay = document.getElementById('fechaBCVDisplay');
    const currentBalance = document.getElementById('currentBalance');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userIdDisplay = document.getElementById('userIdDisplay');

    let metodoSeleccionado = null;
    let archivoComprobante = null;
    let cantidadSeleccionada = 0;
    let tasaBCV = 0;
    let fechaTasaBCV = null;
    let session = null;

    // ==========================================
    // 2. PAQUETES CON 5% DE DESCUENTO
    // ==========================================
    const paquetes = [
        { cantidad: 5, precioBase: 0.05 },
        { cantidad: 10, precioBase: 0.10 },
        { cantidad: 20, precioBase: 0.20 },
        { cantidad: 40, precioBase: 0.40 },
        { cantidad: 50, precioBase: 0.50 },
        { cantidad: 70, precioBase: 0.70 },
        { cantidad: 90, precioBase: 0.90 },
        { cantidad: 100, precioBase: 1.00 }
    ];

    // ==========================================
    // 3. MÉTODOS DE PAGO (8 métodos)
    // ==========================================
    const metodosPago = {
        pagomovil: {
            nombre: "Pago Móvil",
            imagen: "../img/pg.pnb.png",
            campos: [
                { nombre: "banco_emisor", etiqueta: "Tu Banco", tipo: "select", opciones: ["Banco de Venezuela", "Banesco", "Mercantil", "Provincial", "Bancaribe", "100% Banco", "Otro"] },
                { nombre: "telefono_emisor", etiqueta: "Tu Teléfono", tipo: "text", placeholder: "0412-1234567" },
                { nombre: "cedula_emisor", etiqueta: "Tu Cédula", tipo: "text", placeholder: "V-12345678" },
                { nombre: "referencia", etiqueta: "N° de Referencia", tipo: "text", placeholder: "Últimos 6 dígitos" }
            ],
            datosEmpresa: { "Banco": "Banco de Venezuela (0102)", "Teléfono": "0412-1234567", "Cédula": "V-12.345.678" }
        },
        binance: {
            nombre: "Binance Pay / USDT",
            imagen: "../img/binance.png",
            campos: [
                { nombre: "txid", etiqueta: "ID de Transacción (TxID / Pay ID)", tipo: "text", placeholder: "Pega el ID de la transacción" },
                { nombre: "red_binance", etiqueta: "Red utilizada", tipo: "select", opciones: ["TRC20 (Tron)", "BEP20 (BSC)", "Binance Pay"] }
            ],
            datosEmpresa: { "Red": "TRC20 (Tron)", "Dirección": "TXYZ123456789abcdef123456789" }
        },
        kontigo: {
            nombre: "Kontigo",
            imagen: "../img/kontigo.png",
            campos: [
                { nombre: "telefono_kontigo", etiqueta: "Tu Teléfono Kontigo", tipo: "text", placeholder: "0412-1234567" },
                { nombre: "referencia", etiqueta: "N° de Referencia", tipo: "text", placeholder: "Referencia de la transacción" }
            ],
            datosEmpresa: { "Teléfono": "0412-1234567", "Nombre": "Boche Clava'o" }
        },
        paypal: {
            nombre: "PayPal",
            imagen: "../img/paypla.png",
            campos: [
                { nombre: "correo_emisor", etiqueta: "Tu Correo PayPal", tipo: "email", placeholder: "tu@email.com" },
                { nombre: "referencia", etiqueta: "ID de Transacción PayPal", tipo: "text", placeholder: "ID de la transacción" }
            ],
            datosEmpresa: { "Correo": "pagos@bocheclavao.com", "Tipo": "Amigos y Familiares" }
        },
        wally: {
            nombre: "Wally",
            imagen: "../img/wally.png",
            campos: [
                { nombre: "telefono_wally", etiqueta: "Tu Teléfono Wally", tipo: "text", placeholder: "0412-1234567" },
                { nombre: "referencia", etiqueta: "N° de Referencia", tipo: "text", placeholder: "Referencia de la transacción" }
            ],
            datosEmpresa: { "Teléfono": "0412-1234567", "Nombre": "Boche Clava'o" }
        },
        zelle: {
            nombre: "Zelle",
            imagen: "../img/zelle.png",
            campos: [
                { nombre: "nombre_emisor", etiqueta: "Nombre del Titular", tipo: "text", placeholder: "Nombre completo" },
                { nombre: "correo_emisor", etiqueta: "Correo Zelle", tipo: "email", placeholder: "tu@email.com" }
            ],
            datosEmpresa: { "Nombre": "Boche Clavao LLC", "Correo": "pagos@bocheclavao.com" }
        },
        zinli: {
            nombre: "Zinli",
            imagen: "../img/zinli.png",
            campos: [
                { nombre: "correo_zinli", etiqueta: "Tu Correo Zinli", tipo: "email", placeholder: "tu@email.com" },
                { nombre: "referencia", etiqueta: "N° de Referencia", tipo: "text", placeholder: "Referencia de la transacción" }
            ],
            datosEmpresa: { "Correo": "pagos@bocheclavao.com", "Nombre": "Boche Clava'o" }
        },
        tarjetas: {
            nombre: "Tarjetas de Crédito",
            imagen: "../img/tarjetas.png",
            campos: [
                { nombre: "numero_tarjeta", etiqueta: "Últimos 4 dígitos de la tarjeta", tipo: "text", placeholder: "1234", maxlength: "4" },
                { nombre: "referencia", etiqueta: "N° de Aprobación / Referencia", tipo: "text", placeholder: "Referencia del banco" }
            ],
            datosEmpresa: { "Nota": "Procesado a través de nuestra pasarela segura", "Soporte": "soporte@bocheclavao.com" }
        }
    };

    // ==========================================
    // 4. INICIALIZACIÓN
    // ==========================================
    async function init() {
        const sessionData = await db.auth.getSession();
        session = sessionData.data.session;
        if (!session) {
            window.location.href = 'index.html';
            return;
        }

        try {
            const { data: perfil } = await db.from('perfiles').select('nombre, user_id, saldo_bc').eq('id', session.user.id).single();
            if (perfil) {
                if (userNameDisplay) userNameDisplay.textContent = perfil.nombre || 'Usuario';
                if (userIdDisplay) userIdDisplay.textContent = perfil.user_id || '---';
                if (currentBalance) currentBalance.textContent = (parseFloat(perfil.saldo_bc) || 0).toFixed(2);
            }
        } catch (err) {
            console.error('Error cargando perfil:', err);
        }

        await cargarTasaBCV();
        renderPaquetes();
        renderPaymentMethods();
    }

    // ==========================================
    // 5. CARGAR TASA BCV DESDE SUPABASE
    // ==========================================
    async function cargarTasaBCV() {
        try {
            const { data, error } = await db
                .from('configuracion_sistema')
                .select('valor, fecha_actualizacion')
                .eq('clave', 'tasa_bcv_oficial')
                .single();

            if (error) {
                console.warn('No se pudo cargar la tasa BCV:', error.message);
                mostrarTasaBCVError();
                return;
            }

            if (data && data.valor) {
                tasaBCV = parseFloat(data.valor);
                fechaTasaBCV = data.fecha_actualizacion ? new Date(data.fecha_actualizacion) : new Date();

                if (tasaBCV > 0 && tasaBCV < 2000) {
                    mostrarTasaBCV(tasaBCV, fechaTasaBCV);
                    console.log('✅ Tasa BCV cargada:', tasaBCV);
                } else {
                    console.warn('Tasa BCV fuera de rango:', tasaBCV);
                    mostrarTasaBCVError();
                }
            } else {
                mostrarTasaBCVError();
            }
        } catch (err) {
            console.error('Error cargando tasa BCV:', err);
            mostrarTasaBCVError();
        }
    }

    function mostrarTasaBCV(tasa, fecha) {
        if (tasaBCVDisplay) {
            tasaBCVDisplay.textContent = tasa.toFixed(2);
            tasaBCVDisplay.style.color = '#00ff00';
        }
        if (fechaBCVDisplay) {
            const fechaStr = fecha.toLocaleDateString('es-VE', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
            const horaStr = fecha.toLocaleTimeString('es-VE', {
                hour: '2-digit', minute: '2-digit'
            });
            fechaBCVDisplay.textContent = `Actualizada: ${fechaStr} a las ${horaStr}`;
            fechaBCVDisplay.style.color = '#888';
        }
    }

    function mostrarTasaBCVError() {
        if (tasaBCVDisplay) {
            tasaBCVDisplay.textContent = 'No disponible';
            tasaBCVDisplay.style.color = '#ff6b6b';
        }
        if (fechaBCVDisplay) {
            fechaBCVDisplay.textContent = '⚠️ La tasa no está disponible. Contacta a soporte.';
            fechaBCVDisplay.style.color = '#ff6b6b';
        }
    }

    // ==========================================
    // 6. RENDERIZAR PAQUETES
    // ==========================================
    function renderPaquetes() {
        if (!packagesGrid) return;
        packagesGrid.innerHTML = '';

        paquetes.forEach(pkg => {
            const precioConDescuento = (pkg.precioBase * 0.95).toFixed(2);
            const card = document.createElement('div');
            card.className = 'package-card';
            card.dataset.cantidad = pkg.cantidad;
            card.innerHTML = `
                <span class="discount">-5%</span>
                <span class="coins">${pkg.cantidad} BC</span>
                <span class="price">$${precioConDescuento}</span>
            `;
            card.addEventListener('click', () => seleccionarPaquete(pkg.cantidad, card));
            packagesGrid.appendChild(card);
        });
    }

    function seleccionarPaquete(cantidad, cardElement) {
        document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
        cardElement.classList.add('selected');
        cantidadSeleccionada = cantidad;
        if (customAmount) customAmount.value = cantidad;
        actualizarTotales(cantidad);
    }

    // ==========================================
    // 7. RENDERIZAR MÉTODOS DE PAGO
    // ==========================================
    function renderPaymentMethods() {
        if (!paymentMethodsGrid) return;
        paymentMethodsGrid.innerHTML = '';

        for (const [key, metodo] of Object.entries(metodosPago)) {
            const card = document.createElement('div');
            card.className = 'method-card';
            card.dataset.metodo = key;
            card.innerHTML = `
                <img src="${metodo.imagen}" alt="${metodo.nombre}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                <i class="fas fa-credit-card" style="display: none; font-size: 2rem; color: #FFD700;"></i>
                <span>${metodo.nombre}</span>
            `;
            card.addEventListener('click', () => seleccionarMetodo(key, card));
            paymentMethodsGrid.appendChild(card);
        }
    }

    function seleccionarMetodo(key, cardElement) {
        document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
        cardElement.classList.add('selected');
        metodoSeleccionado = key;

        const metodo = metodosPago[key];

        if (companyDataBox) companyDataBox.style.display = 'block';
        if (companyDataContent) {
            companyDataContent.innerHTML = `
                <h4 style="color: #FFD700; font-size: 0.95rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-building"></i> Datos para la transferencia (${metodo.nombre})
                </h4>
                ${Object.entries(metodo.datosEmpresa).map(([label, value]) => `
                    <div class="data-row">
                        <span class="label">${label}:</span>
                        <span class="value" onclick="navigator.clipboard.writeText('${value}'); mostrarMensaje('¡Copiado!', 'success')" title="Copiar">
                            ${value} <i class="fas fa-copy" style="font-size: 0.8rem; margin-left: 5px; color: #888;"></i>
                        </span>
                    </div>
                `).join('')}
            `;
        }

        const dynamicForm = document.getElementById('dynamicForm');
        if (dynamicForm) dynamicForm.style.display = 'block';

        if (userFormFields) {
            userFormFields.innerHTML = metodo.campos.map(campo => {
                if (campo.tipo === 'select') {
                    const opciones = campo.opciones.map(op => `<option value="${op}">${op}</option>`).join('');
                    return `
                        <div class="form-group">
                            <label>${campo.etiqueta}</label>
                            <select name="${campo.nombre}" required>${opciones}</select>
                        </div>
                    `;
                }
                return `
                    <div class="form-group">
                        <label>${campo.etiqueta}</label>
                        <input type="${campo.tipo}" name="${campo.nombre}" placeholder="${campo.placeholder || ''}" required ${campo.maxlength ? `maxlength="${campo.maxlength}"` : ''}>
                    </div>
                `;
            }).join('');
        }
    }

    // ==========================================
    // 8. ACTUALIZAR TOTALES
    // ==========================================
    function actualizarTotales(cantidad) {
        if (!cantidad || cantidad <= 0 || tasaBCV <= 0) {
            if (totalUSDEl) totalUSDEl.textContent = '0.00';
            if (totalVESEl) totalVESEl.textContent = '0.00';
            return;
        }

        const precioBaseUSD = cantidad * 0.01;
        const subtotalConDescuento = precioBaseUSD * 0.95; // 5% OFF
        const comision = subtotalConDescuento * 0.003; // 0.30%
        const totalUSD = subtotalConDescuento + comision;
        const totalVES = totalUSD * tasaBCV;

        if (totalUSDEl) totalUSDEl.textContent = totalUSD.toFixed(2);
        if (totalVESEl) totalVESEl.textContent = totalVES.toFixed(2);
    }

    // ==========================================
    // 9. EVENTO: CAMBIO EN INPUT PERSONALIZADO
    // ==========================================
    if (customAmount) {
        customAmount.addEventListener('input', function() {
            const valor = parseFloat(this.value) || 0;
            cantidadSeleccionada = valor;
            document.querySelectorAll('.package-card').forEach(c => {
                c.classList.toggle('selected', parseInt(c.dataset.cantidad) === valor);
            });
            actualizarTotales(valor);
        });
    }

    // ==========================================
    // 10. MANEJO DE ARCHIVOS
    // ==========================================
    if (comprobanteFile) {
        comprobanteFile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    mostrarMensaje('El archivo es demasiado grande. Máximo 5MB.', 'error');
                    this.value = '';
                    return;
                }
                archivoComprobante = file;
                const reader = new FileReader();
                reader.onload = function(e) {
                    if (previewImage) previewImage.src = e.target.result;
                    if (filePreview) filePreview.style.display = 'flex';
                    if (fileUploadContainer) fileUploadContainer.classList.add('has-image');
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (comprobanteFile) comprobanteFile.value = '';
            archivoComprobante = null;
            if (filePreview) filePreview.style.display = 'none';
            if (fileUploadContainer) fileUploadContainer.classList.remove('has-image');
        });
    }

    // ==========================================
    // 11. ENVÍO DEL FORMULARIO (✅ CORREGIDO)
    // ==========================================
    if (formDeposito) {
        formDeposito.addEventListener('submit', async function(e) {
            e.preventDefault();

            const cantidad = cantidadSeleccionada || parseFloat(customAmount?.value) || 0;

            if (!metodoSeleccionado) {
                mostrarMensaje('Por favor, selecciona un método de pago.', 'error');
                return;
            }
            if (!cantidad || cantidad <= 0) {
                mostrarMensaje('Por favor, ingresa una cantidad válida de monedas.', 'error');
                return;
            }
            if (!archivoComprobante) {
                mostrarMensaje('Debes adjuntar el comprobante de pago.', 'error');
                return;
            }
            if (tasaBCV <= 0) {
                mostrarMensaje('La tasa BCV no está disponible. Intenta más tarde.', 'error');
                return;
            }

            const btnDepositar = document.getElementById('btnDepositar');
            if (btnDepositar) {
                btnDepositar.disabled = true;
                btnDepositar.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando...';
            }
            mostrarMensaje('', '');

            try {
                // 1. Subir comprobante a Supabase Storage
                const fileExt = archivoComprobante.name.split('.').pop();
                const fileName = `${session.user.id}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
                const { error: uploadError } = await db.storage
                    .from('comprobantes')
                    .upload(fileName, archivoComprobante);

                if (uploadError) throw new Error('Error al subir comprobante: ' + uploadError.message);

                const { data: urlData } = db.storage.from('comprobantes').getPublicUrl(fileName);
                const comprobanteUrl = urlData.publicUrl;

                // 2. Calcular montos
                const precioBaseUSD = cantidad * 0.01;
                const descuento = precioBaseUSD * 0.05; // 5% de descuento
                const subtotalConDescuento = precioBaseUSD - descuento;
                const comision = subtotalConDescuento * 0.003; // 0.30%
                const totalUSD = subtotalConDescuento + comision;
                const totalBS = totalUSD * tasaBCV;

                // 3. Recopilar datos del formulario dinámico
                const formData = new FormData(formDeposito);
                const datosPago = {};
                for (let [key, value] of formData.entries()) {
                    datosPago[key] = value;
                }

                // 4. ✅ GUARDAR EN LA BASE DE DATOS (con nombres de columnas correctos)
                const { data: deposito, error: dbError } = await db.from('depositos').insert({
                    user_id: session.user.id,
                    cantidad_monedas: cantidad,
                    metodo_pago: metodoSeleccionado,
                    datos_pago: datosPago,
                    monto_usd: totalUSD,
                    monto_bs: totalBS,                    // ✅ CORREGIDO (antes era monto_ves)
                    tasa_bcv_usada: tasaBCV,              // ✅ CORREGIDO (antes era tasa_bcv)
                    descuento_aplicado: descuento,        // ✅ NUEVO (5% de descuento)
                    comprobante_url: comprobanteUrl,
                    estado: 'pendiente',
                    creado_en: new Date().toISOString(),
                    actualizado_en: new Date().toISOString()
                }).select().single();

                if (dbError) throw new Error('Error al guardar el depósito: ' + dbError.message);

                // 5. Enviar correo de confirmación (Edge Function)
                try {
                    await db.functions.invoke('enviar-factura', {
                        body: {
                            email: session.user.email,
                            nombre: session.user.user_metadata?.nombre || 'Usuario',
                            montoBC: cantidad,
                            montoUSD: totalUSD.toFixed(2),
                            montoBS: totalBS.toFixed(2),
                            metodo: metodosPago[metodoSeleccionado].nombre,
                            fecha: new Date().toLocaleString('es-VE'),
                            idTransaccion: deposito.id,
                            tipo: 'Deposito'
                        }
                    });
                } catch (emailErr) {
                    console.warn('⚠️ Error al enviar correo:', emailErr);
                }

                // 6. Mostrar vista de éxito
                mostrarExito(cantidad, totalUSD, totalBS, deposito);

            } catch (err) {
                console.error('❌ Error en el depósito:', err);
                mostrarMensaje('Error: ' + err.message, 'error');
                const btnDepositar = document.getElementById('btnDepositar');
                if (btnDepositar) {
                    btnDepositar.disabled = false;
                    btnDepositar.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
                }
            }
        });
    }

    // ==========================================
    // 12. VISTA DE ÉXITO
    // ==========================================
    function mostrarExito(cantidad, totalUSD, totalBS, deposito) {
        if (formDeposito) formDeposito.style.display = 'none';
        if (successView) {
            if (successAmount) successAmount.textContent = cantidad;
            successView.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    // ==========================================
    // 13. UTILIDADES
    // ==========================================
    window.mostrarMensaje = function(texto, tipo) {
        if (msgDeposito) {
            msgDeposito.textContent = texto;
            msgDeposito.className = `message ${tipo}`;
            msgDeposito.style.display = texto ? 'block' : 'none';
            if (tipo === 'success') {
                setTimeout(() => { msgDeposito.style.display = 'none'; }, 4000);
            }
        }
    };

    window.nuevoDeposito = function() {
        if (formDeposito) {
            formDeposito.reset();
            formDeposito.style.display = 'block';
        }
        if (successView) successView.style.display = 'none';
        if (comprobanteFile) comprobanteFile.value = '';
        if (filePreview) filePreview.style.display = 'none';
        if (fileUploadContainer) fileUploadContainer.classList.remove('has-image');
        const btnDepositar = document.getElementById('btnDepositar');
        if (btnDepositar) {
            btnDepositar.disabled = false;
            btnDepositar.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
        }
        archivoComprobante = null;
        metodoSeleccionado = null;
        cantidadSeleccionada = 0;
        document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
        document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
        if (companyDataBox) companyDataBox.style.display = 'none';
        if (userFormFields) userFormFields.innerHTML = '';
        const dynamicForm = document.getElementById('dynamicForm');
        if (dynamicForm) dynamicForm.style.display = 'none';
        if (totalUSDEl) totalUSDEl.textContent = '0.00';
        if (totalVESEl) totalVESEl.textContent = '0.00';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Iniciar
    init();
});
