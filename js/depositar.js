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

    // ==========================================
    // 2. OBTENER TASA BCV REAL (CON PROTECCIÓN ANTI-COLGUE)
    // ==========================================
    async function obtenerTasaBCV() {
        try {
            // 1. Intentamos obtener el dato directamente de la web del BCV
            // Agregamos un AbortController para cancelar la petición si tarda más de 3 segundos
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos máximo
            
            const urlBCV = 'https://www.bcv.org.ve/';
            const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(urlBCV);
            
            const response = await fetch(proxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId); // Si tuvo éxito, cancelamos el temporizador
            
            if (!response.ok) throw new Error('Error al conectar con el proxy');
            
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const dolarContainer = doc.querySelector('#dolar');
            
            if (dolarContainer) {
                let textoTasa = dolarContainer.textContent.trim();
                // Limpiamos el texto: "USD876,79760000" -> "876.79760000"
                textoTasa = textoTasa.replace(/[^0-9,\.]/g, '').replace(',', '.');
                const tasa = parseFloat(textoTasa);
                
                if (!isNaN(tasa) && tasa > 10) {
                    tasaBCV = tasa;
                    
                    // Formateamos la fecha exactamente como la pide: "Fecha Valor: martes, 13 de octubre de 2026"
                    const hoy = new Date();
                    const opcionesFecha = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                    const fechaStr = hoy.toLocaleDateString('es-VE', opcionesFecha);
                    
                    document.getElementById('tasaBCVDisplay').textContent = tasaBCV.toFixed(4);
                    document.getElementById('fechaBCVDisplay').textContent = `Fecha Valor: ${fechaStr}`;
                    
                    if (document.getElementById('customAmount').value) {
                        document.getElementById('customAmount').dispatchEvent(new Event('input'));
                    }
                    console.log('✅ Tasa BCV obtenida directamente del sitio web:', tasaBCV);
                    return; // ¡Éxito! Salimos de la función
                }
            }
            throw new Error('No se pudo extraer el número de la página del BCV');
            
        } catch (error) {
            console.warn('⚠️ El método directo falló o tardó mucho. Usando fuente alternativa oficial (DolarApi)...', error);
            
            // 2. FALLBACK (PLAN B): Si el BCV falla, usamos DolarApi (que extrae el mismo dato del BCV pero sin bloqueos)
            try {
                const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
                const data = await response.json();
                tasaBCV = data.promedio;
                
                const fecha = new Date(data.fechaActualizacion).toLocaleDateString('es-VE', { 
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                });
                
                document.getElementById('tasaBCVDisplay').textContent = tasaBCV.toFixed(4);
                document.getElementById('fechaBCVDisplay').textContent = `Fecha Valor: ${fecha} (Fuente: BCV)`;
                
                if (document.getElementById('customAmount').value) {
                    document.getElementById('customAmount').dispatchEvent(new Event('input'));
                }
                console.log('✅ Tasa BCV obtenida vía API alternativa:', tasaBCV);
                
            } catch (fallbackError) {
                console.error('❌ Todos los métodos de obtención de tasa fallaron:', fallbackError);
                document.getElementById('tasaBCVDisplay').textContent = 'No disp.';
                document.getElementById('fechaBCVDisplay').textContent = 'Verifica tu conexión';
                tasaBCV = 36.50; // Valor de respaldo de emergencia para que la app no se rompa
            }
        }
    }

    // ==========================================
    // 3. CONFIGURACIÓN DE PAQUETES (5% OFF)
    // ==========================================
    const paquetes = [
        { cantidad: 5, descuento: 0.05 },
        { cantidad: 10, descuento: 0.05 },
        { cantidad: 15, descuento: 0.05 },
        { cantidad: 20, descuento: 0.05 },
        { cantidad: 35, descuento: 0.05 },
        { cantidad: 50, descuento: 0.05 },
        { cantidad: 60, descuento: 0.05 },
        { cantidad: 100, descuento: 0.05 }
    ];

    // ==========================================
    // 4. CONFIGURACIÓN DE MÉTODOS DE PAGO
    // ==========================================
    const metodosPago = {
        'pagomovil': {
            nombre: 'Pago Móvil',
            logo: '../img/pg.png',
            datosEmpresa: [
                { label: 'Banco', value: 'Banesco' },
                { label: 'Teléfono', value: '0414-1234567' },
                { label: 'Cédula', value: 'V-12.345.678' },
                { label: 'Razón Social', value: 'Boche Clavao C.A.' }
            ],
            camposUsuario: [
                { 
                    id: 'bancoEmisor', 
                    label: 'Tu Banco Emisor', 
                    type: 'select', 
                    options: [
                        'Banco de Venezuela', 'Banesco', 'Mercantil', 'Provincial (BBVA)', 
                        'Bicentenario', 'Bancaribe', 'Banco Exterior', 'Bancrecer', 'Banplus', 
                        'Banco del Tesoro', 'Banco Nacional de Crédito (BNC)',
                        'Banco Plaza', 'Banco Sofitasa', 'Banco Agrícola de Venezuela', 
                        'Banco Fondo Común (BFC)', '100% Banco', 'Mi Banco', 'Banco Activo', 
                        'Bancamiga', 'Bantrab', 'Banco de la Fuerza Armada (BANFANB)', 
                        'Banco Caroní', 'Del Sur Banco Universal', 'Banco Internacional de Desarrollo'
                    ] 
                },
                { id: 'telefonoEmisor', label: 'Tu Teléfono (Pago Móvil)', type: 'tel', placeholder: '0414-1234567' },
                { id: 'cedulaEmisor', label: 'Tu Cédula', type: 'text', placeholder: 'V-12345678' },
                { id: 'referencia', label: 'Número de Referencia (4-6 dígitos)', type: 'text', placeholder: 'Ej: 123456' }
            ],
            requiereArchivo: true
        },
        'binance': {
            nombre: 'Binance (USDT)',
            logo: '../img/binance.png',
            datosEmpresa: [
                { label: 'Red', value: 'TRC20 (Tron)' },
                { label: 'Dirección Wallet', value: 'TXYZ1234567890abcdef...' },
                { label: 'Monto Exacto', value: 'Enviar el monto exacto en USDT' },
                { label: 'Memo/Tag', value: 'No requerido para TRC20' }
            ],
            camposUsuario: [
                { id: 'txid', label: 'Hash de la Transacción (TXID)', type: 'text', placeholder: 'Pega el ID de la transacción aquí (ej: 0x1234...)' },
                { id: 'montoEnviado', label: 'Monto exacto enviado (USDT)', type: 'number', step: '0.01', placeholder: 'Ej: 9.50' }
            ],
            requiereArchivo: true
        },
        'zelle': {
            nombre: 'Zelle',
            logo: '../img/zelle.png',
            datosEmpresa: [
                { label: 'Nombre', value: 'Juan Perez' },
                { label: 'Email / Teléfono', value: 'pagos@bocheclavao.com' }
            ],
            camposUsuario: [
                { id: 'nombreEmisor', label: 'Nombre del titular de la cuenta Zelle', type: 'text' },
                { id: 'referencia', label: 'Número de Confirmación', type: 'text' }
            ],
            requiereArchivo: true
        },
        'zinli': {
            nombre: 'Zinli',
            logo: '../img/zinli.png',
            datosEmpresa: [ { label: 'Correo Zinli', value: 'cobros@bocheclavao.com' } ],
            camposUsuario: [
                { id: 'correoEmisor', label: 'Tu correo Zinli', type: 'email' },
                { id: 'referencia', label: 'ID de la transacción', type: 'text' }
            ],
            requiereArchivo: true
        },
        'wally': {
            nombre: 'Wally',
            logo: '../img/wally.png',
            datosEmpresa: [ { label: 'Teléfono / Correo Wally', value: 'TU_DATO_AQUI' } ],
            camposUsuario: [
                { id: 'correoEmisor', label: 'correo o teléfono Wally', type: 'text' },
                { id: 'referencia', label: 'ID de la transacción', type: 'text' }
            ],
            requiereArchivo: true
        },
        'kontigo': {
            nombre: 'Kontigo',
            logo: '../img/kontigo.png',
            datosEmpresa: [ { label: 'Teléfono / Correo Kontigo', value: 'clavaoboche@gmail.com' } ],
            camposUsuario: [
                { id: 'cuentaEmisor', label: 'Tu teléfono o correo Kontigo', type: 'text', placeholder: 'Ej: 04141234567 o correo@ejemplo.com' },
                { id: 'referencia', label: 'ID de la transacción / Referencia', type: 'text', placeholder: 'Código de la operación' }
            ],
            requiereArchivo: true
        },
        'paypal': {
            nombre: 'PayPal',
            logo: '../img/paypal.png',
            datosEmpresa: [ { label: 'Correo PayPal', value: 'clavaoboche@gmail.com' } ],
            camposUsuario: [
                { id: 'correoEmisor', label: 'Tu correo PayPal', type: 'email' },
                { id: 'referencia', label: 'Correo con el que enviaste', type: 'email' }
            ],
            requiereArchivo: true
        },
        'tarjeta': {
            nombre: 'Tarjeta Crédito/Débito',
            logo: '../img/tarjetas.png',
            datosEmpresa: [ 
                { label: 'Procesamiento', value: 'Transacción segura encriptada' },
                { label: 'Moneda', value: 'USD (Dólares Americanos)' }
            ],
            camposUsuario: [
                { 
                    id: 'numeroTarjeta', 
                    label: 'Número de Tarjeta', 
                    type: 'text', 
                    placeholder: '1234 5678 9012 3456',
                    maxlength: 19
                },
                { 
                    id: 'nombreTitular', 
                    label: 'Nombre del Titular (como aparece en la tarjeta)', 
                    type: 'text', 
                    placeholder: 'JUAN PEREZ' 
                },
                { 
                    id: 'fechaVencimiento', 
                    label: 'Fecha de Vencimiento', 
                    type: 'text', 
                    placeholder: 'MM/AA',
                    maxlength: 5
                },
                { 
                    id: 'cvv', 
                    label: 'CVV (3 dígitos detrás de la tarjeta)', 
                    type: 'text', 
                    placeholder: '123',
                    maxlength: 4
                }
            ],
            requiereArchivo: false
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
        const precioOriginal = pkg.cantidad; 
        const precioFinal = precioOriginal * (1 - pkg.descuento);
        
        const card = document.createElement('div');
        card.className = 'package-card';
        card.innerHTML = `
            <div class="discount">-5%</div>
            <span class="coins">${pkg.cantidad} BC</span>
            <span class="price">$${precioFinal.toFixed(2)}</span>
        `;
        card.onclick = () => seleccionarPaquete(pkg, precioFinal, card);
        packagesGrid.appendChild(card);
    });

    function seleccionarPaquete(pkg, precioFinal, cardElement) {
        paqueteSeleccionado = pkg;
        document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
        cardElement.classList.add('selected');
        document.getElementById('customAmount').value = pkg.cantidad;
        actualizarTotales(precioFinal);
    }

    // ==========================================
    // 7. RENDERIZAR MÉTODOS DE PAGO
    // ==========================================
    const methodsGrid = document.getElementById('paymentMethodsGrid');
    Object.keys(metodosPago).forEach(key => {
        const metodo = metodosPago[key];
        const card = document.createElement('div');
        card.className = 'method-card';
        card.innerHTML = `
            <img src="${metodo.logo}" alt="${metodo.nombre}" onerror="this.src='../img/moneda.png'">
            <span>${metodo.nombre}</span>
        `;
        card.onclick = () => seleccionarMetodo(key, card);
        methodsGrid.appendChild(card);
    });

    function seleccionarMetodo(key, cardElement) {
        metodoSeleccionado = key;
        const datos = metodosPago[key];
        
        document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
        cardElement.classList.add('selected');

        const companyBox = document.getElementById('companyDataBox');
        const companyContent = document.getElementById('companyDataContent');
        companyContent.innerHTML = datos.datosEmpresa.map(d => `
            <div class="data-row">
                <span class="label">${d.label}:</span>
                <span class="value">${d.value}</span>
            </div>
        `).join('');
        companyBox.style.display = 'block';

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

        // Formateo automático para campos de tarjeta
        const inputNumero = document.getElementById('numeroTarjeta');
        if (inputNumero) {
            inputNumero.addEventListener('input', function(e) {
                let valor = e.target.value.replace(/\D/g, '').substring(0, 16);
                valor = valor.replace(/(\d{4})(?=\d)/g, '$1 ');
                e.target.value = valor;
            });
        }
        
        const inputFecha = document.getElementById('fechaVencimiento');
        if (inputFecha) {
            inputFecha.addEventListener('input', function(e) {
                let valor = e.target.value.replace(/\D/g, '').substring(0, 4);
                if (valor.length >= 2) {
                    valor = valor.substring(0, 2) + '/' + valor.substring(2);
                }
                e.target.value = valor;
            });
        }
        
        const inputCVV = document.getElementById('cvv');
        if (inputCVV) {
            inputCVV.addEventListener('input', function(e) {
                e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
            });
        }

        document.getElementById('fileUploadGroup').style.display = datos.requiereArchivo ? 'block' : 'none';
        document.getElementById('dynamicForm').style.display = 'block';
        document.getElementById('dynamicForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ==========================================
    // 8. LÓGICA DE CÁLCULO EN TIEMPO REAL
    // ==========================================
    const customAmountInput = document.getElementById('customAmount');
    customAmountInput.addEventListener('input', function() {
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

    function actualizarTotales(precioUSD) {
        if (tasaBCV > 0) {
            document.getElementById('totalUSD').textContent = precioUSD.toFixed(2);
            document.getElementById('totalVES').textContent = (precioUSD * tasaBCV).toFixed(2);
        }
    }

    // ============================================
    // 9. MANEJO DE ARCHIVO CON VISTA PREVIA
    // ============================================
    const fileInput = document.getElementById('comprobanteFile');
    const fileUploadContainer = document.getElementById('fileUploadContainer');
    const filePreview = document.getElementById('filePreview');
    const previewImage = document.getElementById('previewImage');
    const removeFileBtn = document.getElementById('removeFile');
    const uploadIcon = document.getElementById('uploadIcon');
    const fileNameDisplay = document.getElementById('fileName');

    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const archivo = e.target.files[0];
            
            if (!archivo) {
                resetearFileUpload();
                return;
            }

            if (archivo.size > 5 * 1024 * 1024) {
                mostrarMensaje('❌ El archivo es demasiado grande. Máximo 5MB.', 'error');
                resetearFileUpload();
                return;
            }

            if (!archivo.type.startsWith('image/')) {
                mostrarMensaje('❌ Solo se permiten imágenes (JPG, PNG).', 'error');
                resetearFileUpload();
                return;
            }

            const reader = new FileReader();
            reader.onload = function(event) {
                previewImage.src = event.target.result;
                filePreview.style.display = 'block';
                fileUploadContainer.classList.add('has-image');
                fileNameDisplay.textContent = archivo.name;
                if (uploadIcon) uploadIcon.style.display = 'none';
            };
            reader.readAsDataURL(archivo);

            const msg = document.getElementById('msgDeposito');
            if (msg && msg.className.includes('error')) {
                msg.className = 'message';
                msg.textContent = '';
            }
        });
    }

    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            resetearFileUpload();
        });
    }

    function resetearFileUpload() {
        if (fileInput) fileInput.value = '';
        if (filePreview) filePreview.style.display = 'none';
        if (fileUploadContainer) fileUploadContainer.classList.remove('has-image');
        if (fileNameDisplay) fileNameDisplay.textContent = 'Haz clic o arrastra tu captura aquí';
        if (uploadIcon) uploadIcon.style.display = 'block';
        if (previewImage) previewImage.src = '';
    }

    // ============================================
    // 10. ENVÍO DEL FORMULARIO (CON GUARDADO REAL)
    // ============================================
    const formDeposito = document.getElementById('formDeposito');
    formDeposito.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!paqueteSeleccionado && !customAmountInput.value) {
            mostrarMensaje('❌ Debes seleccionar o ingresar una cantidad de monedas.', 'error');
            return;
        }
        if (!metodoSeleccionado) {
            mostrarMensaje('❌ Debes seleccionar un método de pago.', 'error');
            return;
        }

        const btn = document.getElementById('btnDepositar');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando...';

        const cantidad = parseFloat(customAmountInput.value);
        const totalUSD = parseFloat(document.getElementById('totalUSD').textContent);
        const totalVES = parseFloat(document.getElementById('totalVES').textContent);
        
        const datosUsuario = {};
        metodosPago[metodoSeleccionado].camposUsuario.forEach(campo => {
            const elemento = document.getElementById(campo.id);
            if (elemento) datosUsuario[campo.id] = elemento.value.trim();
        });

        let datosPagoSeguros = { ...datosUsuario };
        if (metodoSeleccionado === 'tarjeta') {
            const numTarjeta = datosPagoSeguros.numeroTarjeta || '';
            const soloNumeros = numTarjeta.replace(/\s/g, '');
            datosPagoSeguros.numeroTarjeta = '**** **** **** ' + soloNumeros.slice(-4);
            datosPagoSeguros.cvv = '***';
        }

        try {
            // A. SUBIR COMPROBANTE A SUPABASE STORAGE
            let comprobanteUrl = null;
            
            if (fileInput && fileInput.files[0] && metodosPago[metodoSeleccionado].requiereArchivo) {
                const archivo = fileInput.files[0];
                
                if (archivo.size > 5 * 1024 * 1024) {
                    throw new Error('El comprobante no debe superar los 5MB');
                }
                
                if (!archivo.type.startsWith('image/')) {
                    throw new Error('Solo se permiten imágenes (JPG, PNG)');
                }
                
                const nombreArchivo = `${session.user.id}/${Date.now()}_${archivo.name.replace(/\s/g, '_')}`;
                
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Subiendo comprobante...';
                
                const { data: uploadData, error: uploadError } = await db.storage
                    .from('comprobantes')
                    .upload(nombreArchivo, archivo, {
                        cacheControl: '3600',
                        upsert: false
                    });
                
                if (uploadError) throw new Error('Error al subir comprobante: ' + uploadError.message);
                
                const { data: urlData } = db.storage
                    .from('comprobantes')
                    .getPublicUrl(nombreArchivo);
                
                comprobanteUrl = urlData.publicUrl;
                console.log('✅ Comprobante subido:', comprobanteUrl);
            }

            // B. GUARDAR DEPÓSITO EN LA BASE DE DATOS
            const { data: deposito, error: dbError } = await db
                .from('depositos')
                .insert({
                    user_id: session.user.id,
                    cantidad_monedas: cantidad,
                    monto_usd: totalUSD,
                    monto_bs: totalVES,
                    tasa_bcv_usada: tasaBCV,
                    descuento_aplicado: paqueteSeleccionado ? paqueteSeleccionado.descuento * 100 : 0,
                    metodo_pago: metodoSeleccionado,
                    datos_pago: datosPagoSeguros,
                    comprobante_url: comprobanteUrl,
                    estado: 'pendiente'
                })
                .select()
                .single();
            
            if (dbError) throw new Error('Error al guardar: ' + dbError.message);
            console.log('✅ Depósito registrado:', deposito);

            // ==========================================
            // C. MOSTRAR VISTA DE ÉXITO PROFESIONAL
            // ==========================================
            
            // 1. Ocultar el formulario completo
            document.getElementById('formDeposito').style.display = 'none';
            
            // 2. Actualizar el monto en la vista de éxito
            document.getElementById('successAmount').textContent = cantidad;
            
            // 3. Mostrar la vista de éxito
            document.getElementById('successView').style.display = 'block';
            
            // 4. Hacer scroll suave hacia arriba para que el usuario lo vea
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
        } catch (err) {
            console.error('Error en depósito:', err);
            mostrarMensaje('❌ Error: ' + err.message, 'error');
        } finally {
            // Solo restauramos el botón si hubo un error, porque si fue éxito, el formulario se oculta
            if (document.getElementById('formDeposito').style.display !== 'none') {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
            }
        }
    });

    function mostrarMensaje(texto, tipo) {
        const msg = document.getElementById('msgDeposito');
        if (msg) {
            msg.textContent = texto;
            msg.className = `message ${tipo}`;
        }
    }

    // ============================================
    // 11. FUNCIÓN PARA REINICIAR Y HACER OTRO DEPÓSITO
    // ============================================
    window.nuevoDeposito = function() {
        // Resetear formulario y variables
        formDeposito.reset();
        resetearFileUpload();
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        document.getElementById('companyDataBox').style.display = 'none';
        document.getElementById('dynamicForm').style.display = 'none';
        paqueteSeleccionado = null;
        metodoSeleccionado = null;
        document.getElementById('customAmount').value = '';
        document.getElementById('totalUSD').textContent = '0.00';
        document.getElementById('totalVES').textContent = '0.00';
        
        // Mostrar formulario de nuevo y ocultar vista de éxito
        document.getElementById('formDeposito').style.display = 'block';
        document.getElementById('successView').style.display = 'none';
        
        // Restaurar botón por si acaso
        const btn = document.getElementById('btnDepositar');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
        
        // Scroll al inicio
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
});
