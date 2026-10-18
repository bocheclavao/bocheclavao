document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        return;
    }

    // ==========================================
    // 1. CONFIGURACIÓN DE PRECIOS Y MÉTODOS
    // ==========================================
    const PRECIO_POR_BC_USD = 1.0; // 1 BC = 1 USD (AJUSTA ESTE VALOR SI TU PRECIO ES DIFERENTE)
    const COMISION_PORCENTAJE = 0.003; // 0.30%
    const DESCUENTO_PAQUETE = 0.05; // 5%

    const metodosPago = {
        pagomovil: {
            nombre: "Pago Móvil",
            imagen: "../img/pagomovil.png",
            icono: "fas fa-mobile-alt",
            datos: { "Banco": "Banco de Venezuela (0102)", "Teléfono": "0412-1234567", "Cédula": "V-12.345.678" },
            campos: [
                { nombre: "banco_emisor", etiqueta: "Tu Banco", tipo: "select", opciones: ["Banco de Venezuela", "Banesco", "Mercantil", "Provincial", "Otro"] },
                { nombre: "telefono_emisor", etiqueta: "Tu Teléfono", tipo: "text", placeholder: "0412-1234567" },
                { nombre: "cedula_emisor", etiqueta: "Tu Cédula", tipo: "text", placeholder: "V-12345678" },
                { nombre: "referencia", etiqueta: "Número de Referencia", tipo: "text", placeholder: "Últimos 6 dígitos o código completo" }
            ]
        },
        zelle: {
            nombre: "Zelle",
            imagen: "../img/zelle.png",
            icono: "fas fa-building-columns",
            datos: { "Nombre": "Boche Clavao LLC", "Correo": "pagos@bocheclavao.com" },
            campos: [
                { nombre: "nombre_emisor", etiqueta: "Nombre del Titular", tipo: "text", placeholder: "Nombre completo" },
                { nombre: "correo_emisor", etiqueta: "Correo Zelle Emisor", tipo: "email", placeholder: "tu@email.com" },
                { nombre: "referencia", etiqueta: "ID de Transacción", tipo: "text", placeholder: "ID de la transacción" }
            ]
        },
        binance: {
            nombre: "Binance Pay",
            imagen: "../img/binance.png",
            icono: "fab fa-bitcoin",
            datos: { "Red": "TRC20 (Tron) / Binance Pay", "Pay ID": "TU_PAY_ID_AQUI" },
            campos: [
                { nombre: "txid", etiqueta: "ID de Transacción (TxID / Pay ID)", tipo: "text", placeholder: "Pega el ID de la transacción" },
                { nombre: "red_binance", etiqueta: "Red utilizada", tipo: "select", opciones: ["TRC20", "BEP20", "Binance Pay"] },
                { nombre: "referencia", etiqueta: "Número de Referencia", tipo: "text", placeholder: "Opcional" }
            ]
        },
        paypal: {
            nombre: "PayPal",
            imagen: "../img/paypal.png",
            icono: "fab fa-paypal",
            datos: { "Correo": "pagos@bocheclavao.com", "Tipo": "Amigos y Familiares" },
            campos: [
                { nombre: "correo_emisor", etiqueta: "Tu Correo PayPal", tipo: "email", placeholder: "tu@email.com" },
                { nombre: "referencia", etiqueta: "ID de Transacción", tipo: "text", placeholder: "ID de la transacción" }
            ]
        }
    };

    let userData = {};
    let tasaBCV = 36.50; // Valor por defecto
    let cantidadSeleccionada = 0;
    let esPaquete = false;
    let metodoSeleccionado = null;
    let archivoComprobante = null;

    // ==========================================
    // 2. ELEMENTOS DEL DOM
    // ==========================================
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userIdDisplay = document.getElementById('userIdDisplay');
    const currentBalance = document.getElementById('currentBalance');
    const tasaBCVDisplay = document.getElementById('tasaBCVDisplay');
    const fechaBCVDisplay = document.getElementById('fechaBCVDisplay');
    const packagesGrid = document.getElementById('packagesGrid');
    const customAmountInput = document.getElementById('customAmount');
    const totalUSDDisplay = document.getElementById('totalUSD');
    const totalVESDisplay = document.getElementById('totalVES');
    const paymentMethodsGrid = document.getElementById('paymentMethodsGrid');
    const companyDataBox = document.getElementById('companyDataBox');
    const companyDataContent = document.getElementById('companyDataContent');
    const dynamicForm = document.getElementById('dynamicForm');
    const userFormFields = document.getElementById('userFormFields');
    const fileUploadContainer = document.getElementById('fileUploadContainer');
    const comprobanteFile = document.getElementById('comprobanteFile');
    const filePreview = document.getElementById('filePreview');
    const previewImage = document.getElementById('previewImage');
    const removeFileBtn = document.getElementById('removeFile');
    const formDeposito = document.getElementById('formDeposito');
    const msgDeposito = document.getElementById('msgDeposito');
    const successView = document.getElementById('successView');
    const successAmount = document.getElementById('successAmount');

    // ==========================================
    // 3. FUNCIONES DE INICIALIZACIÓN
    // ==========================================
    async function init() {
        const { data: { session } } = await db.auth.getSession();
        if (!session) {
            window.location.href = 'index.html';
            return;
        }

        await loadUserData(session.user);
        await fetchBCVRate();
        renderPackages();
        renderPaymentMethods();
        setupEventListeners();
    }

    async function loadUserData(user) {
        try {
            const { data: perfil, error } = await db.from('perfiles').select('*').eq('id', user.id).single();
            if (error) throw error;
            userData = perfil || { nombre: user.email, user_id: 'N/A', saldo_bc: 0 };
            
            userNameDisplay.textContent = userData.nombre || user.email;
            userIdDisplay.textContent = userData.user_id || 'N/A';
            currentBalance.textContent = parseFloat(userData.saldo_bc || 0).toFixed(2);
        } catch (err) {
            console.error('Error cargando usuario:', err);
            userNameDisplay.textContent = user.email;
        }
    }

    async function fetchBCVRate() {
        try {
            const response = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar/page?page=bcv');
            if (response.ok) {
                const data = await response.json();
                tasaBCV = data.monitors?.usd?.price || tasaBCV;
                fechaBCVDisplay.textContent = `Actualizado: ${new Date().toLocaleDateString('es-VE')}`;
            }
        } catch (err) {
            console.warn('No se pudo obtener la tasa BCV, usando valor por defecto:', err);
        }
        tasaBCVDisplay.textContent = tasaBCV.toFixed(2);
        actualizarVistaPrevia();
    }

    // ==========================================
    // 4. RENDERIZADO
    // ==========================================
    function renderPackages() {
        const paquetes = [
            { cantidad: 100, descuento: true },
            { cantidad: 500, descuento: true },
            { cantidad: 1000, descuento: true },
            { cantidad: 5000, descuento: true }
        ];

        packagesGrid.innerHTML = '';
        paquetes.forEach(pkg => {
            const card = document.createElement('div');
            card.className = 'package-card';
            card.dataset.cantidad = pkg.cantidad;
            
            const precioOriginal = pkg.cantidad * PRECIO_POR_BC_USD;
            const precioConDescuento = precioOriginal * (1 - DESCUENTO_PAQUETE);
            
            card.innerHTML = `
                ${pkg.descuento ? '<div class="discount">-5%</div>' : ''}
                <span class="coins">${pkg.cantidad} BC</span>
                <span class="price">$${precioConDescuento.toFixed(2)}</span>
            `;
            
            card.addEventListener('click', () => seleccionarPaquete(pkg.cantidad, card));
            packagesGrid.appendChild(card);
        });
    }

    function renderPaymentMethods() {
        paymentMethodsGrid.innerHTML = '';
        for (const [key, metodo] of Object.entries(metodosPago)) {
            const card = document.createElement('div');
            card.className = 'method-card';
            card.dataset.metodo = key;
            
            // Si la imagen falla, se oculta y muestra el ícono de FontAwesome
            card.innerHTML = `
                <img src="${metodo.imagen}" alt="${metodo.nombre}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                <i class="${metodo.icono}" style="font-size: 2rem; color: #FFD700; display: none;"></i>
                <span>${metodo.nombre}</span>
            `;
            
            card.addEventListener('click', () => seleccionarMetodo(key, card));
            paymentMethodsGrid.appendChild(card);
        }
    }

    // ==========================================
    // 5. LÓGICA DE SELECCIÓN Y CÁLCULOS
    // ==========================================
    function seleccionarPaquete(cantidad, cardElement) {
        document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
        cardElement.classList.add('selected');
        
        cantidadSeleccionada = cantidad;
        esPaquete = true;
        customAmountInput.value = cantidad;
        
        actualizarVistaPrevia();
    }

    function seleccionarMetodo(key, cardElement) {
        document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
        cardElement.classList.add('selected');
        
        metodoSeleccionado = key;
        const metodo = metodosPago[key];
        
        // Mostrar datos de la empresa
        companyDataContent.innerHTML = '';
        for (const [label, value] of Object.entries(metodo.datos)) {
            companyDataContent.innerHTML += `
                <div class="data-row">
                    <span class="label">${label}:</span>
                    <span class="value" style="cursor: pointer;" onclick="navigator.clipboard.writeText('${value}')" title="Copiar">${value} <i class="fas fa-copy" style="font-size: 0.8rem; margin-left: 5px; color: #888;"></i></span>
                </div>
            `;
        }
        companyDataBox.style.display = 'block';
        
        // Generar campos dinámicos del formulario
        userFormFields.innerHTML = '';
        metodo.campos.forEach(campo => {
            let inputHTML = '';
            if (campo.tipo === 'select') {
                const opciones = campo.opciones.map(op => `<option value="${op}">${op}</option>`).join('');
                inputHTML = `<select name="${campo.nombre}" required>${opciones}</select>`;
            } else {
                inputHTML = `<input type="${campo.tipo}" name="${campo.nombre}" placeholder="${campo.placeholder || ''}" required>`;
            }
            
            userFormFields.innerHTML += `
                <div class="form-group">
                    <label>${campo.etiqueta}</label>
                    ${inputHTML}
                </div>
            `;
        });
        
        dynamicForm.style.display = 'block';
    }

    function actualizarVistaPrevia() {
        const cantidad = parseFloat(customAmountInput.value) || 0;
        cantidadSeleccionada = cantidad;
        
        let precioBase = cantidad * PRECIO_POR_BC_USD;
        if (esPaquete && cantidad > 0) {
            precioBase = precioBase * (1 - DESCUENTO_PAQUETE);
        }
        
        const comision = precioBase * COMISION_PORCENTAJE;
        const totalUSD = precioBase + comision;
        const totalVES = totalUSD * tasaBCV;
        
        totalUSDDisplay.textContent = totalUSD.toFixed(2);
        totalVESDisplay.textContent = totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // ==========================================
    // 6. EVENT LISTENERS
    // ==========================================
    function setupEventListeners() {
        customAmountInput.addEventListener('input', () => {
            esPaquete = false;
            document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
            actualizarVistaPrevia();
        });

        comprobanteFile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    showMessage('El archivo es demasiado grande. Máximo 5MB.', 'error');
                    this.value = '';
                    return;
                }
                archivoComprobante = file;
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImage.src = e.target.result;
                    filePreview.style.display = 'flex';
                    fileUploadContainer.classList.add('has-image');
                };
                reader.readAsDataURL(file);
            }
        });

        removeFileBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            comprobanteFile.value = '';
            archivoComprobante = null;
            filePreview.style.display = 'none';
            fileUploadContainer.classList.remove('has-image');
        });

        formDeposito.addEventListener('submit', handleSubmit);
    }

    function showMessage(text, type) {
        msgDeposito.textContent = text;
        msgDeposito.className = 'message ' + type;
        msgDeposito.style.display = 'block';
        setTimeout(() => {
            msgDeposito.style.display = 'none';
        }, 5000);
    }

    // ==========================================
    // 7. ENVÍO DEL FORMULARIO
    // ==========================================
    async function handleSubmit(e) {
        e.preventDefault();
        
        if (cantidadSeleccionada <= 0) {
            showMessage('Por favor, ingresa una cantidad válida de monedas.', 'error');
            return;
        }
        if (!metodoSeleccionado) {
            showMessage('Por favor, selecciona un método de pago.', 'error');
            return;
        }
        if (!archivoComprobante) {
            showMessage('Debes adjuntar el comprobante de pago.', 'error');
            return;
        }

        const btnDepositar = document.getElementById('btnDepositar');
        btnDepositar.disabled = true;
        btnDepositar.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando...';

        try {
            const { data: { session } } = await db.auth.getSession();
            const userId = session.user.id;
            
            // 1. Subir comprobante a Storage
            const fileExt = archivoComprobante.name.split('.').pop();
            const fileName = `${userId}_${Date.now()}.${fileExt}`;
            const filePath = `comprobantes/${fileName}`;
            
            const { error: uploadError } = await db.storage
                .from('depositos') // Asegúrate de que este bucket exista en Supabase
                .upload(filePath, archivoComprobante);
                
            if (uploadError) throw uploadError;
            
            // Obtener URL pública
            const { data: { publicUrl } } = db.storage.from('depositos').getPublicUrl(filePath);
            
            // 2. Recopilar datos del formulario dinámico
            const formData = new FormData(formDeposito);
            const datosPago = {};
            for (let [key, value] of formData.entries()) {
                datosPago[key] = value;
            }
            
            // 3. Calcular montos finales (misma lógica que la vista previa)
            let precioBase = cantidadSeleccionada * PRECIO_POR_BC_USD;
            if (esPaquete) precioBase = precioBase * (1 - DESCUENTO_PAQUETE);
            const comision = precioBase * COMISION_PORCENTAJE;
            const totalUSD = precioBase + comision;
            const totalVES = totalUSD * tasaBCV;
            
            // 4. Guardar en la base de datos
            const { error: dbError } = await db.from('depositos').insert({
                user_id: userId,
                cantidad_bc: cantidadSeleccionada,
                metodo_pago: metodoSeleccionado,
                datos_pago: datosPago,
                monto_usd: totalUSD,
                monto_ves: totalVES,
                tasa_bcv: tasaBCV,
                comprobante_url: publicUrl,
                estado: 'pendiente',
                fecha_solicitud: new Date().toISOString()
            });
            
            if (dbError) throw dbError;
            
            // 5. Éxito
            mostrarExito(cantidadSeleccionada, totalUSD, totalVES, datosPago.referencia || 'N/A');
            
        } catch (err) {
            console.error('Error al procesar el depósito:', err);
            showMessage('Error al procesar el depósito: ' + err.message, 'error');
            btnDepositar.disabled = false;
            btnDepositar.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
        }
    }

    function mostrarExito(cantidad, totalUSD, totalVES, referencia) {
        formDeposito.style.display = 'none';
        document.querySelector('.bcv-banner').style.display = 'none';
        document.querySelectorAll('.section-title').forEach(el => el.style.display = 'none');
        document.querySelector('.packages-grid').style.display = 'none';
        document.querySelector('.manual-input-group').style.display = 'none';
        document.querySelector('.payment-methods-grid').style.display = 'none';
        document.querySelector('.warning-notice').style.display = 'none';
        companyDataBox.style.display = 'none';
        
        successAmount.textContent = cantidad;
        successView.style.display = 'block';
        
        // Generar PDF
        generarPDF(cantidad, totalUSD, totalVES, referencia);
    }

    window.nuevoDeposito = function() {
        window.location.reload();
    };

    // ==========================================
    // 8. GENERACIÓN DE PDF
    // ==========================================
    function generarPDF(cantidad, totalUSD, totalVES, referencia) {
        if (typeof window.jspdf === 'undefined') {
            console.warn('jsPDF no está cargado');
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Header
        doc.setFillColor(255, 215, 0);
        doc.rect(0, 0, 210, 35, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text("BOCHE CLAVA'O", 105, 18, null, null, "center");
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text("COMPROBANTE OFICIAL DE DEPÓSITO", 105, 26, null, null, "center");
        
        // Info básica
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(9);
        let yPos = 45;
        const lineHeight = 6;
        
        doc.setFont("helvetica", "bold");
        doc.text("ID Transacción:", 14, yPos);
        doc.setFont("helvetica", "normal");
        doc.text("DEP-" + Date.now().toString().slice(-6), 90, yPos);
        yPos += lineHeight;
        
        doc.setFont("helvetica", "bold");
        doc.text("Fecha:", 14, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(new Date().toLocaleDateString('es-VE'), 90, yPos);
        yPos += lineHeight;
        
        const userName = userData.nombre || 'Usuario';
        doc.setFont("helvetica", "bold");
        doc.text("Usuario:", 14, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(userName.length > 35 ? userName.substring(0, 35) + '...' : userName, 90, yPos);
        yPos += lineHeight + 3;
        
        // Detalles
        doc.setFillColor(255, 215, 0);
        doc.rect(14, yPos, 182, 7, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text("DETALLES DEL DEPÓSITO", 105, yPos + 4.5, null, null, "center");
        yPos += 11;
        
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        
        const detalles = [
            { label: "Método de Pago:", value: metodosPago[metodoSeleccionado]?.nombre.toUpperCase() || metodoSeleccionado },
            { label: "Cantidad:", value: `${cantidad} BC` },
            { label: "Tasa BCV:", value: `${tasaBCV.toFixed(2)} Bs/USD` },
            { label: "Subtotal:", value: `$${(cantidad * PRECIO_POR_BC_USD * (esPaquete ? 0.95 : 1)).toFixed(2)}` },
            { label: "Comisión (0.30%):", value: `$${(cantidad * PRECIO_POR_BC_USD * (esPaquete ? 0.95 : 1) * 0.003).toFixed(2)}` },
            { label: "", value: "" },
            { label: "TOTAL USD:", value: `$${totalUSD.toFixed(2)}`, highlight: true },
            { label: "TOTAL Bs:", value: `Bs. ${totalVES.toFixed(2)}`, highlight: true },
            { label: "", value: "" },
            { label: "Referencia:", value: referencia },
            { label: "Estado:", value: "PENDIENTE", bold: true, color: [133, 100, 4] }
        ];
        
        detalles.forEach(item => {
            if (item.label === "" && item.value === "") {
                yPos += 2;
                return;
            }
            if (item.highlight) {
                doc.setFillColor(255, 248, 220);
                doc.rect(14, yPos - 2.5, 182, 7, 'F');
            }
            doc.setFont("helvetica", item.bold ? "bold" : "normal");
            if (item.color) {
                doc.setTextColor(item.color[0], item.color[1], item.color[2]);
            } else {
                doc.setTextColor(50, 50, 50);
            }
            doc.text(item.label, 16, yPos);
            const valorWidth = doc.getStringUnitWidth(item.value) * doc.internal.getFontSize() / doc.internal.scaleFactor;
            doc.text(item.value, 194 - valorWidth, yPos);
            yPos += 6;
        });
        
        // Footer
        yPos += 8;
        doc.setDrawColor(200, 200, 200);
        doc.line(14, yPos, 196, yPos);
        yPos += 8;
        
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.setFont("helvetica", "italic");
        doc.text("Este documento es un comprobante oficial generado automáticamente.", 105, yPos, null, null, "center");
        yPos += 4;
        doc.text("Soporte: soporte@bocheclavao.com", 105, yPos, null, null, "center");
        yPos += 4;
        doc.text("Boche Clava'o © " + new Date().getFullYear(), 105, yPos, null, null, "center");
        
        // Guardar PDF
        doc.save(`Comprobante_Deposito_${cantidad}BC.pdf`);
    }

    // Iniciar aplicación
    init();
});
