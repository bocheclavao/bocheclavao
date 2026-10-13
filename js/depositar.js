document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { window.location.href = 'index.html'; return; }

    const { data: { session } } = await db.auth.getSession();
    if (!session || !session.user) { window.location.href = 'index.html'; return; }

    // ==========================================
    // 1. VARIABLES GLOBALES
    // ==========================================
    let tasaBCV = 0; 
    let paqueteSeleccionado = null;
    let metodoSeleccionado = null;
    let userData = null;
    const COMISION_PORCENTAJE = 0.003; // 0.30% de comisión de la plataforma

    // ==========================================
    // 2. OBTENER TASA BCV REAL
    // ==========================================
    async function obtenerTasaBCV() {
        try {
            console.log('🔄 Consultando tasa oficial desde tu base de datos...');
            const { data, error } = await db
                .from('configuracion_sistema')
                .select('valor, fecha_actualizacion')
                .eq('clave', 'tasa_bcv_oficial')
                .single();
            
            if (error || !data) throw new Error('No se encontró la tasa en la base de datos.');
            
            tasaBCV = parseFloat(data.valor.replace(',', '.'));
            const fechaObj = new Date(data.fecha_actualizacion);
            const fechaStr = fechaObj.toLocaleDateString('es-VE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            
            document.getElementById('tasaBCVDisplay').textContent = tasaBCV.toFixed(4);
            document.getElementById('fechaBCVDisplay').textContent = `Fecha Valor: ${fechaStr}`;
            
            if (document.getElementById('customAmount').value) {
                document.getElementById('customAmount').dispatchEvent(new Event('input'));
            }
            console.log('✅ Tasa BCV oficial cargada:', tasaBCV);
        } catch (error) {
            console.error('❌ Error al leer la tasa:', error);
            tasaBCV = 876.7976; 
            document.getElementById('tasaBCVDisplay').textContent = tasaBCV.toFixed(4);
            document.getElementById('fechaBCVDisplay').textContent = 'Tasa de respaldo (Verificar con Admin)';
            if (document.getElementById('customAmount').value) {
                document.getElementById('customAmount').dispatchEvent(new Event('input'));
            }
        }
    }
    await obtenerTasaBCV();

    // ==========================================
    // 3. CONFIGURACIÓN DE PAQUETES (5% OFF)
    // ==========================================
    const paquetes = [
        { cantidad: 5, descuento: 0.05 }, { cantidad: 10, descuento: 0.05 },
        { cantidad: 15, descuento: 0.05 }, { cantidad: 20, descuento: 0.05 },
        { cantidad: 35, descuento: 0.05 }, { cantidad: 50, descuento: 0.05 },
        { cantidad: 60, descuento: 0.05 }, { cantidad: 100, descuento: 0.05 }
    ];

    // ==========================================
    // 4. CONFIGURACIÓN DE MÉTODOS DE PAGO
    // ==========================================
    const metodosPago = {
        'pagomovil': {
            nombre: 'Pago Móvil', logo: '../img/pg.png',
            datosEmpresa: [
                { label: 'Banco', value: 'Banesco' }, { label: 'Teléfono', value: '0414-1234567' },
                { label: 'Cédula', value: 'V-12.345.678' }, { label: 'Razón Social', value: 'Boche Clavao C.A.' }
            ],
            camposUsuario: [
                { id: 'bancoEmisor', label: 'Tu Banco Emisor', type: 'select', options: ['Banco de Venezuela', 'Banesco', 'Mercantil', 'Provincial (BBVA)', 'Bicentenario', 'Bancaribe', 'Banco Exterior', 'Bancrecer', 'Banplus', 'Banco del Tesoro', 'Banco Nacional de Crédito (BNC)', 'Banco Plaza', 'Banco Sofitasa', 'Banco Agrícola de Venezuela', 'Banco Fondo Común (BFC)', '100% Banco', 'Mi Banco', 'Banco Activo', 'Bancamiga', 'Bantrab', 'Banco de la Fuerza Armada (BANFANB)', 'Banco Caroní', 'Del Sur Banco Universal', 'Banco Internacional de Desarrollo'] },
                { id: 'telefonoEmisor', label: 'Tu Teléfono', type: 'tel', placeholder: '0414-1234567' },
                { id: 'cedulaEmisor', label: 'Tu Cédula', type: 'text', placeholder: 'V-12345678' },
                { id: 'referencia', label: 'Número de Referencia', type: 'text', placeholder: 'Ej: 123456' }
            ], requiereArchivo: true
        },
        'binance': {
            nombre: 'Binance (USDT)', logo: '../img/binance.png',
            datosEmpresa: [ { label: 'Red', value: 'TRC20 (Tron)' }, { label: 'Dirección Wallet', value: 'TXYZ1234567890abcdef...' }, { label: 'Monto Exacto', value: 'Enviar el monto exacto en USDT' } ],
            camposUsuario: [
                { id: 'txid', label: 'Hash de la Transacción (TXID)', type: 'text', placeholder: '0x1234...' },
                { id: 'montoEnviado', label: 'Monto exacto enviado (USDT)', type: 'number', step: '0.01', placeholder: '9.50' }
            ], requiereArchivo: true
        },
        'zelle': {
            nombre: 'Zelle', logo: '../img/zelle.png',
            datosEmpresa: [ { label: 'Nombre', value: 'Juan Perez' }, { label: 'Email / Teléfono', value: 'pagos@bocheclavao.com' } ],
            camposUsuario: [
                { id: 'nombreEmisor', label: 'Nombre del titular', type: 'text' },
                { id: 'referencia', label: 'Número de Confirmación', type: 'text' }
            ], requiereArchivo: true
        },
        'zinli': {
            nombre: 'Zinli', logo: '../img/zinli.png',
            datosEmpresa: [ { label: 'Correo Zinli', value: 'cobros@bocheclavao.com' } ],
            camposUsuario: [
                { id: 'correoEmisor', label: 'Tu correo Zinli', type: 'email' },
                { id: 'referencia', label: 'ID de la transacción', type: 'text' }
            ], requiereArchivo: true
        },
        'wally': {
            nombre: 'Wally', logo: '../img/wally.png',
            datosEmpresa: [ { label: 'Teléfono / Correo Wally', value: 'TU_DATO_AQUI' } ],
            camposUsuario: [
                { id: 'correoEmisor', label: 'correo o teléfono Wally', type: 'text' },
                { id: 'referencia', label: 'ID de la transacción', type: 'text' }
            ], requiereArchivo: true
        },
        'kontigo': {
            nombre: 'Kontigo', logo: '../img/kontigo.png',
            datosEmpresa: [ { label: 'Teléfono / Correo Kontigo', value: 'clavaoboche@gmail.com' } ],
            camposUsuario: [
                { id: 'cuentaEmisor', label: 'Tu teléfono o correo Kontigo', type: 'text', placeholder: '04141234567' },
                { id: 'referencia', label: 'ID de la transacción', type: 'text' }
            ], requiereArchivo: true
        },
        'paypal': {
            nombre: 'PayPal', logo: '../img/paypal.png',
            datosEmpresa: [ { label: 'Correo PayPal', value: 'clavaoboche@gmail.com' } ],
            camposUsuario: [
                { id: 'correoEmisor', label: 'Tu correo PayPal', type: 'email' },
                { id: 'referencia', label: 'Correo con el que enviaste', type: 'email' }
            ], requiereArchivo: true
        },
        'tarjeta': {
            nombre: 'Tarjeta Crédito/Débito', logo: '../img/tarjetas.png',
            datosEmpresa: [ { label: 'Procesamiento', value: 'Transacción segura encriptada' }, { label: 'Moneda', value: 'USD' } ],
            camposUsuario: [
                { id: 'numeroTarjeta', label: 'Número de Tarjeta', type: 'text', placeholder: '1234 5678 9012 3456', maxlength: 19 },
                { id: 'nombreTitular', label: 'Nombre del Titular', type: 'text', placeholder: 'JUAN PEREZ' },
                { id: 'fechaVencimiento', label: 'Fecha de Vencimiento', type: 'text', placeholder: 'MM/AA', maxlength: 5 },
                { id: 'cvv', label: 'CVV', type: 'text', placeholder: '123', maxlength: 4 }
            ], requiereArchivo: false
        }
    };

    // ==========================================
    // 5. CARGAR DATOS DEL USUARIO
    // ==========================================
    const { data: perfil } = await db.from('perfiles').select('*').eq('id', session.user.id).single();
    if (perfil) {
        userData = perfil;
        document.getElementById('userNameDisplay').textContent = perfil.nombre || session.user.email;
        document.getElementById('userIdDisplay').textContent = perfil.user_id || session.user.id.substring(0, 8);
        document.getElementById('currentBalance').textContent = (perfil.saldo_bc || 0).toFixed(2);
    }

    // ==========================================
    // 6. RENDERIZAR PAQUETES
    // ==========================================
    const packagesGrid = document.getElementById('packagesGrid');
    paquetes.forEach(pkg => {
        const precioFinal = pkg.cantidad * (1 - pkg.descuento);
        const card = document.createElement('div');
        card.className = 'package-card';
        card.innerHTML = `<div class="discount">-5%</div><span class="coins">${pkg.cantidad} BC</span><span class="price">$${precioFinal.toFixed(2)}</span>`;
        card.onclick = () => {
            paqueteSeleccionado = pkg;
            document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            document.getElementById('customAmount').value = pkg.cantidad;
            actualizarTotales(precioFinal);
        };
        packagesGrid.appendChild(card);
    });

    // ==========================================
    // 7. RENDERIZAR MÉTODOS DE PAGO
    // ==========================================
    const methodsGrid = document.getElementById('paymentMethodsGrid');
    Object.keys(metodosPago).forEach(key => {
        const metodo = metodosPago[key];
        const card = document.createElement('div');
        card.className = 'method-card';
        card.innerHTML = `<img src="${metodo.logo}" alt="${metodo.nombre}" onerror="this.src='../img/moneda.png'"><span>${metodo.nombre}</span>`;
        card.onclick = () => seleccionarMetodo(key, card);
        methodsGrid.appendChild(card);
    });

    function seleccionarMetodo(key, cardElement) {
        metodoSeleccionado = key;
        const datos = metodosPago[key];
        document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
        cardElement.classList.add('selected');

        document.getElementById('companyDataContent').innerHTML = datos.datosEmpresa.map(d => 
            `<div class="data-row"><span class="label">${d.label}:</span><span class="value">${d.value}</span></div>`
        ).join('');
        document.getElementById('companyDataBox').style.display = 'block';

        document.getElementById('userFormFields').innerHTML = datos.camposUsuario.map(campo => {
            if (campo.type === 'select') {
                return `<div class="form-group"><label>${campo.label}</label><select id="${campo.id}" required><option value="">Selecciona...</option>${campo.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}</select></div>`;
            }
            return `<div class="form-group"><label>${campo.label}</label><input type="${campo.type}" id="${campo.id}" required placeholder="${campo.placeholder || ''}"></div>`;
        }).join('');

        // Formateo automático para campos de tarjeta
        const inputNumero = document.getElementById('numeroTarjeta');
        if (inputNumero) {
            inputNumero.addEventListener('input', function(e) {
                let valor = e.target.value.replace(/\D/g, '').substring(0, 16);
                e.target.value = valor.replace(/(\d{4})(?=\d)/g, '$1 ');
            });
        }
        const inputFecha = document.getElementById('fechaVencimiento');
        if (inputFecha) {
            inputFecha.addEventListener('input', function(e) {
                let valor = e.target.value.replace(/\D/g, '').substring(0, 4);
                e.target.value = valor.length >= 2 ? valor.substring(0, 2) + '/' + valor.substring(2) : valor;
            });
        }
        const inputCVV = document.getElementById('cvv');
        if (inputCVV) {
            inputCVV.addEventListener('input', function(e) { e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4); });
        }

        document.getElementById('fileUploadGroup').style.display = datos.requiereArchivo ? 'block' : 'none';
        document.getElementById('dynamicForm').style.display = 'block';
        document.getElementById('dynamicForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ==========================================
    // 8. LÓGICA DE CÁLCULO EN TIEMPO REAL
    // ==========================================
    document.getElementById('customAmount').addEventListener('input', function() {
        const cantidad = parseFloat(this.value) || 0;
        const paqueteMatch = paquetes.find(p => p.cantidad === cantidad);
        let precioFinal = cantidad; 
        
        if (paqueteMatch) {
            precioFinal = cantidad * (1 - paqueteMatch.descuento);
            document.querySelectorAll('.package-card').forEach((c, index) => {
                c.classList.toggle('selected', paquetes[index].cantidad === cantidad);
            });
        } else {
            document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
        }
        actualizarTotales(precioFinal);
    });

    function actualizarTotales(precioBaseUSD) {
        if (tasaBCV > 0) {
            const totalConComisionUSD = precioBaseUSD * (1 + COMISION_PORCENTAJE);
            const totalConComisionVES = totalConComisionUSD * tasaBCV;
            document.getElementById('totalUSD').textContent = totalConComisionUSD.toFixed(2);
            document.getElementById('totalVES').textContent = totalConComisionVES.toFixed(2);
        }
    }

    // ==========================================
    // 9. MANEJO DE ARCHIVO CON VISTA PREVIA
    // ==========================================
    const fileInput = document.getElementById('comprobanteFile');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const archivo = e.target.files[0];
            if (!archivo) { resetearFileUpload(); return; }
            if (archivo.size > 5 * 1024 * 1024) { mostrarMensaje('❌ El archivo es demasiado grande. Máximo 5MB.', 'error'); resetearFileUpload(); return; }
            if (!archivo.type.startsWith('image/')) { mostrarMensaje('❌ Solo se permiten imágenes (JPG, PNG).', 'error'); resetearFileUpload(); return; }

            const reader = new FileReader();
            reader.onload = function(event) {
                document.getElementById('previewImage').src = event.target.result;
                document.getElementById('filePreview').style.display = 'block';
                document.getElementById('fileUploadContainer').classList.add('has-image');
                document.getElementById('fileName').textContent = archivo.name;
                document.getElementById('uploadIcon').style.display = 'none';
            };
            reader.readAsDataURL(archivo);
            const msg = document.getElementById('msgDeposito');
            if (msg && msg.className.includes('error')) { msg.className = 'message'; msg.textContent = ''; }
        });
    }

    document.getElementById('removeFile').addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation(); resetearFileUpload();
    });

    function resetearFileUpload() {
        if (fileInput) fileInput.value = '';
        document.getElementById('filePreview').style.display = 'none';
        document.getElementById('fileUploadContainer').classList.remove('has-image');
        document.getElementById('fileName').textContent = 'Haz clic o arrastra tu captura aquí';
        document.getElementById('uploadIcon').style.display = 'block';
        document.getElementById('previewImage').src = '';
    }

    // ==========================================
    // 10. ENVÍO DEL FORMULARIO (CON FACTURA Y CORREO)
    // ==========================================
    document.getElementById('formDeposito').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!paqueteSeleccionado && !document.getElementById('customAmount').value) {
            mostrarMensaje('❌ Debes seleccionar o ingresar una cantidad de monedas.', 'error'); return;
        }
        if (!metodoSeleccionado) { mostrarMensaje('❌ Debes seleccionar un método de pago.', 'error'); return; }

        const btn = document.getElementById('btnDepositar');
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando...';

        const cantidad = parseFloat(document.getElementById('customAmount').value);
        const paqueteMatch = paquetes.find(p => p.cantidad === cantidad);
        const precioBaseUSD = paqueteMatch ? cantidad * (1 - paqueteMatch.descuento) : cantidad;
        const totalUSD = precioBaseUSD * (1 + COMISION_PORCENTAJE);
        const totalVES = totalUSD * tasaBCV;
        
        const datosUsuario = {};
        metodosPago[metodoSeleccionado].camposUsuario.forEach(campo => {
            const elemento = document.getElementById(campo.id);
            if (elemento) datosUsuario[campo.id] = elemento.value.trim();
        });

        let datosPagoSeguros = { ...datosUsuario };
        if (metodoSeleccionado === 'tarjeta') {
            const soloNumeros = (datosPagoSeguros.numeroTarjeta || '').replace(/\s/g, '');
            datosPagoSeguros.numeroTarjeta = '**** **** **** ' + soloNumeros.slice(-4);
            datosPagoSeguros.cvv = '***';
        }

        try {
            let comprobanteUrl = null;
            if (fileInput && fileInput.files[0] && metodosPago[metodoSeleccionado].requiereArchivo) {
                const archivo = fileInput.files[0];
                const nombreArchivo = `${session.user.id}/${Date.now()}_${archivo.name.replace(/\s/g, '_')}`;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Subiendo comprobante...';
                
                const { error: uploadError } = await db.storage.from('comprobantes').upload(nombreArchivo, archivo, { cacheControl: '3600', upsert: false });
                if (uploadError) throw new Error('Error al subir comprobante: ' + uploadError.message);
                
                const { data: urlData } = db.storage.from('comprobantes').getPublicUrl(nombreArchivo);
                comprobanteUrl = urlData.publicUrl;
            }

            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Registrando depósito...';
            const { data: deposito, error: dbError } = await db.from('depositos').insert({
                user_id: session.user.id, cantidad_monedas: cantidad, monto_usd: totalUSD, monto_bs: totalVES,
                tasa_bcv_usada: tasaBCV, descuento_aplicado: paqueteSeleccionado ? paqueteSeleccionado.descuento * 100 : 0,
                metodo_pago: metodoSeleccionado, datos_pago: datosPagoSeguros, comprobante_url: comprobanteUrl, estado: 'pendiente'
            }).select().single();
            
            if (dbError) throw new Error('Error al guardar: ' + dbError.message);
            console.log('✅ Depósito registrado:', deposito);

            // --- ENVIAR CORREO (Edge Function) ---
            try {
                console.log('📧 Intentando enviar factura por correo...');
                await db.functions.invoke('enviar-factura', {
                    body: {
                        email: session.user.email, nombre: userData.nombre || 'Usuario',
                        montoBC: cantidad, montoUSD: totalUSD.toFixed(2), montoBS: totalVES.toFixed(2),
                        metodo: metodosPago[metodoSeleccionado].nombre, fecha: new Date().toLocaleString('es-VE'), idTransaccion: deposito.id
                    }
                });
                console.log('✅ Solicitud de correo enviada.');
            } catch (emailErr) {
                console.warn('⚠️ No se pudo enviar el correo (esto no afecta el depósito):', emailErr.message);
            }

            // --- GENERAR PDF ---
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            doc.setFillColor(255, 215, 0); doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(0, 0, 0); doc.setFontSize(22); doc.setFont("helvetica", "bold");
            doc.text("BOCHE CLAVA'O", 105, 20, null, null, "center");
            doc.setFontSize(12); doc.setFont("helvetica", "normal");
            doc.text("Comprobante de Transacción", 105, 30, null, null, "center");

            doc.setTextColor(50, 50, 50); doc.setFontSize(10);
            doc.text(`ID Transacción: ${deposito.id}`, 14, 55);
            doc.text(`Fecha: ${new Date().toLocaleString('es-VE')}`, 14, 62);
            doc.text(`Usuario: ${userData.nombre || session.user.email}`, 14, 69);

            doc.setDrawColor(200, 200, 200); doc.line(14, 75, 196, 75);
            doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Detalles del Depósito", 14, 90);
            doc.setFont("helvetica", "normal"); doc.setFontSize(10);
            
            let y = 105; const lineHeight = 10;
            const detalles = [
                { label: "Método de Pago:", value: metodosPago[metodoSeleccionado].nombre.toUpperCase() },
                { label: "Cantidad de Monedas:", value: `${cantidad} BC` },
                { label: "Tasa BCV Aplicada:", value: `${tasaBCV.toFixed(4)} Bs/USD` },
                { label: "Subtotal:", value: `$${precioBaseUSD.toFixed(2)}` },
                { label: "Comisión Plataforma (0.30%):", value: `$${(precioBaseUSD * 0.003).toFixed(2)}` },
                { label: "TOTAL PAGADO (USD):", value: `$${totalUSD.toFixed(2)}` },
                { label: "TOTAL PAGADO (VES):", value: `Bs. ${totalVES.toFixed(2)}` },
                { label: "Estado:", value: "PENDIENTE DE REVISIÓN" }
            ];

            detalles.forEach(item => {
                doc.setFont("helvetica", "bold"); doc.text(item.label, 14, y);
                doc.setFont("helvetica", "normal");
                const valorWidth = doc.getStringUnitWidth(item.value) * doc.internal.getFontSize() / doc.internal.scaleFactor;
                doc.text(item.value, 196 - valorWidth, y);
                y += lineHeight;
            });

            doc.setFontSize(8); doc.setTextColor(100, 100, 100);
            doc.text("Este documento es un comprobante generado automáticamente.", 105, 280, null, null, "center");
            doc.text("Soporte: soporte@bocheclavao.com", 105, 285, null, null, "center");

            window.facturaPDF = doc;

            // --- MOSTRAR VISTA DE ÉXITO ---
            document.getElementById('formDeposito').style.display = 'none';
            document.getElementById('successAmount').textContent = cantidad;
            
            const successActions = document.querySelector('.success-actions');
            if (successActions) {
                const btnExistente = document.getElementById('btnDescargarFactura');
                if (btnExistente) btnExistente.remove(); // Evitar duplicados

                const btnDescargar = document.createElement('button');
                btnDescargar.id = 'btnDescargarFactura';
                btnDescargar.className = 'btn-secondary';
                btnDescargar.style.marginTop = '10px';
                btnDescargar.innerHTML = '<i class="fas fa-file-pdf"></i> Descargar Factura';
                btnDescargar.onclick = () => {
                    if (window.facturaPDF) window.facturaPDF.save(`Factura_BocheClavao_${deposito.id.substring(0,8)}.pdf`);
                };
                successActions.insertBefore(btnDescargar, successActions.firstChild);
            }

            document.getElementById('successView').style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (err) {
            console.error('Error en depósito:', err);
            mostrarMensaje('❌ Error: ' + err.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
        }
    });

    function mostrarMensaje(texto, tipo) {
        const msg = document.getElementById('msgDeposito');
        if (msg) { msg.textContent = texto; msg.className = `message ${tipo}`; }
    }

    // ==========================================
    // 11. FUNCIÓN PARA REINICIAR
    // ==========================================
    window.nuevoDeposito = function() {
        document.getElementById('formDeposito').reset();
        resetearFileUpload();
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        document.getElementById('companyDataBox').style.display = 'none';
        document.getElementById('dynamicForm').style.display = 'none';
        paqueteSeleccionado = null; metodoSeleccionado = null;
        document.getElementById('customAmount').value = '';
        document.getElementById('totalUSD').textContent = '0.00';
        document.getElementById('totalVES').textContent = '0.00';
        
        document.getElementById('formDeposito').style.display = 'block';
        document.getElementById('successView').style.display = 'none';
        
        const btn = document.getElementById('btnDepositar');
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
});
