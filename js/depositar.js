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
    const companyDataBox = document.getElementById('companyDataBox');
    const companyDataContent = document.getElementById('companyDataContent');
    const fileUploadContainer = document.getElementById('fileUploadContainer');
    const comprobanteFile = document.getElementById('comprobanteFile');
    const filePreview = document.getElementById('filePreview');
    const previewImage = document.getElementById('previewImage');
    const removeFileBtn = document.getElementById('removeFile');
    const userFormFields = document.getElementById('userFormFields');

    let metodoSeleccionado = null;
    let archivoComprobante = null;
    let tasaBCV = 36.50; // Valor por defecto, se puede actualizar desde la BD

    // ==========================================
    // 2. CONFIGURACIÓN DE MÉTODOS DE PAGO
    // ==========================================
    const metodosPago = {
        pagomovil: {
            nombre: "Pago Móvil",
            imagen: "../img/pagomovil.png",
            campos: [
                { nombre: "banco_emisor", etiqueta: "Tu Banco", tipo: "select", opciones: ["Banco de Venezuela", "Banesco", "Mercantil", "Provincial", "Bancaribe", "Otro"] },
                { nombre: "telefono_emisor", etiqueta: "Tu Teléfono", tipo: "text", placeholder: "0412-1234567" },
                { nombre: "cedula_emisor", etiqueta: "Tu Cédula", tipo: "text", placeholder: "V-12345678" }
            ],
            datosEmpresa: { "Banco": "Banco de Venezuela (0102)", "Teléfono": "0412-1234567", "Cédula": "V-12.345.678" }
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
        binance: {
            nombre: "Binance Pay / USDT",
            imagen: "../img/binance.png",
            campos: [
                { nombre: "txid", etiqueta: "ID de Transacción (TxID / Pay ID)", tipo: "text", placeholder: "Pega el ID de la transacción" },
                { nombre: "red_binance", etiqueta: "Red utilizada", tipo: "select", opciones: ["TRC20 (Tron)", "BEP20 (BSC)", "Binance Pay"] }
            ],
            datosEmpresa: { "Red": "TRC20 (Tron)", "Dirección": "TXYZ123456789abcdef123456789" }
        },
        paypal: {
            nombre: "PayPal",
            imagen: "../img/paypal.png",
            campos: [
                { nombre: "correo_emisor", etiqueta: "Tu Correo PayPal", tipo: "email", placeholder: "tu@email.com" }
            ],
            datosEmpresa: { "Correo": "pagos@bocheclavao.com", "Tipo": "Amigos y Familiares" }
        }
    };

    // ==========================================
    // 3. INICIALIZACIÓN
    // ==========================================
    async function init() {
        // Obtener tasa BCV de la base de datos si existe
        try {
            const { data: config } = await db.from('config_tasas').select('tasa_bcv').single();
            if (config && config.tasa_bcv) {
                tasaBCV = parseFloat(config.tasa_bcv);
            }
        } catch (err) {
            console.log('Usando tasa BCV por defecto:', tasaBCV);
        }

        renderPaymentMethods();
    }

    function renderPaymentMethods() {
        if (!paymentMethodsGrid) return;
        paymentMethodsGrid.innerHTML = '';
        
        for (const [key, metodo] of Object.entries(metodosPago)) {
            const card = document.createElement('div');
            card.className = 'method-card';
            card.dataset.metodo = key;
            
            // Intentar cargar la imagen, si falla mostrar ícono
            const imgHTML = `<img src="${metodo.imagen}" alt="${metodo.nombre}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                             <i class="fas fa-credit-card" style="display: none; font-size: 2rem; color: #FFD700;"></i>`;
            
            card.innerHTML = `${imgHTML}<span>${metodo.nombre}</span>`;
            
            card.addEventListener('click', () => seleccionarMetodo(key, card));
            paymentMethodsGrid.appendChild(card);
        }
    }

    function seleccionarMetodo(key, cardElement) {
        document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
        cardElement.classList.add('selected');
        metodoSeleccionado = key;
        
        const metodo = metodosPago[key];
        
        // Mostrar datos de la empresa
        companyDataBox.style.display = 'block';
        companyDataContent.innerHTML = `
            <h4><i class="fas fa-building"></i> Datos para la transferencia (${metodo.nombre})</h4>
            ${Object.entries(metodo.datosEmpresa).map(([label, value]) => `
                <div class="data-row">
                    <span class="label">${label}:</span>
                    <span class="value" style="cursor: pointer;" onclick="navigator.clipboard.writeText('${value}'); mostrarMensaje('¡Copiado al portapapeles!', 'success')" title="Copiar">
                        ${value} <i class="fas fa-copy" style="font-size: 0.8rem; margin-left: 5px; color: #888;"></i>
                    </span>
                </div>
            `).join('')}
        `;
        
        // Generar campos dinámicos del formulario
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
                    <input type="${campo.tipo}" name="${campo.nombre}" placeholder="${campo.placeholder || ''}" required>
                </div>
            `;
        }).join('');
    }

    // ==========================================
    // 4. MANEJO DE ARCHIVOS
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
                    previewImage.src = e.target.result;
                    filePreview.style.display = 'flex';
                    fileUploadContainer.classList.add('has-image');
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            comprobanteFile.value = '';
            archivoComprobante = null;
            filePreview.style.display = 'none';
            fileUploadContainer.classList.remove('has-image');
        });
    }

    // ==========================================
    // 5. ENVÍO DEL FORMULARIO
    // ==========================================
    if (formDeposito) {
        formDeposito.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const cantidadInput = document.getElementById('cantidadInput');
            const cantidad = parseFloat(cantidadInput ? cantidadInput.value : 0);
            
            if (!metodoSeleccionado) {
                mostrarMensaje('Por favor, selecciona un método de pago.', 'error');
                return;
            }
            if (!cantidad || cantidad <= 0) {
                mostrarMensaje('Por favor, ingresa una cantidad válida de monedas.', 'error');
                return;
            }
            if (!archivoComprobante) {
                mostrarMensaje('Debes adjuntar el comprobante de pago (captura de pantalla).', 'error');
                return;
            }

            const btnDepositar = document.getElementById('btnDepositar');
            btnDepositar.disabled = true;
            btnDepositar.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando...';
            mostrarMensaje('', '');

            try {
                const session = (await db.auth.getSession()).data.session;
                if (!session) throw new Error('No hay sesión activa');

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
                const precioBaseUSD = cantidad * 0.01; // Ajusta según tu precio real por BC
                const subtotalConDescuento = precioBaseUSD * 0.95; // 5% OFF
                const comision = subtotalConDescuento * 0.003; // 0.30%
                const totalUSD = subtotalConDescuento + comision;
                const totalVES = totalUSD * tasaBCV;

                // 3. Recopilar datos del formulario dinámico
                const formData = new FormData(formDeposito);
                const datosPago = {};
                for (let [key, value] of formData.entries()) {
                    datosPago[key] = value;
                }

                // 4. Guardar en la base de datos
                const { data: deposito, error: dbError } = await db.from('depositos').insert({
                    user_id: session.user.id,
                    cantidad_monedas: cantidad,
                    metodo_pago: metodoSeleccionado,
                    datos_pago: datosPago,
                    monto_usd: totalUSD,
                    monto_ves: totalVES,
                    tasa_bcv: tasaBCV,
                    comprobante_url: comprobanteUrl,
                    estado: 'pendiente'
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
                            montoBS: totalVES.toFixed(2), 
                            metodo: metodosPago[metodoSeleccionado].nombre, 
                            fecha: new Date().toLocaleString('es-VE'), 
                            idTransaccion: deposito.id 
                        }
                    });
                } catch (emailErr) {
                    console.warn('⚠️ Error al enviar correo:', emailErr);
                    // No interrumpimos el flujo si falla el correo
                }

                // 6. Mostrar vista de éxito y generar PDF
                mostrarExito(cantidad, totalUSD, totalVES, deposito);

            } catch (err) {
                console.error('❌ Error en el depósito:', err);
                mostrarMensaje('Error: ' + err.message, 'error');
                const btnDepositar = document.getElementById('btnDepositar');
                btnDepositar.disabled = false;
                btnDepositar.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
            }
        });
    }

    // ==========================================
    // 6. VISTA DE ÉXITO Y PDF
    // ==========================================
    function mostrarExito(cantidad, totalUSD, totalVES, deposito) {
        if (formDeposito) formDeposito.style.display = 'none';
        if (successView) {
            if (successAmount) successAmount.textContent = cantidad;
            successView.style.display = 'block';
            
            // Agregar botón de descarga de factura dinámicamente
            const successActions = document.querySelector('.success-actions');
            if (successActions) {
                const btnExistente = document.getElementById('btnDescargarFactura');
                if (btnExistente) btnExistente.remove();
                
                const btnDescargar = document.createElement('button');
                btnDescargar.id = 'btnDescargarFactura';
                btnDescargar.className = 'btn-secondary';
                btnDescargar.innerHTML = '<i class="fas fa-file-pdf"></i> Descargar Factura';
                btnDescargar.onclick = () => generarPDF(cantidad, totalUSD, totalVES, deposito);
                
                // Insertar al principio de las acciones
                successActions.insertBefore(btnDescargar, successActions.firstChild);
            }
            
            // Scroll suave hacia arriba
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    function generarPDF(cantidad, totalUSD, totalVES, deposito) {
        if (typeof window.jspdf === 'undefined') {
            console.warn('⚠️ jsPDF no está cargado');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // === HEADER CON LOGO ===
            // NOTA: Reemplaza esta cadena con tu logo real en base64 si lo tienes
            const logoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; 
            
            if (logoBase64 && logoBase64.length > 50) {
                try {
                    doc.addImage(logoBase64, 'PNG', 15, 8, 35, 12);
                } catch (logoErr) {
                    console.warn('⚠️ Error al cargar logo:', logoErr);
                }
            }

            // Título principal
            doc.setFillColor(255, 215, 0); // Color #FFD700
            doc.rect(0, 0, 210, 35, 'F');
            
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(24);
            doc.setFont("helvetica", "bold");
            doc.text("BOCHE CLAVA'O", 105, 18, null, null, "center");
            
            doc.setFontSize(11);
            doc.setFont("helvetica", "normal");
            doc.text("COMPROBANTE OFICIAL DE DEPÓSITO", 105, 26, null, null, "center");

            // === INFORMACIÓN BÁSICA ===
            doc.setTextColor(50, 50, 50);
            doc.setFontSize(9);
            
            let yPos = 45;
            const lineHeight = 6;
            
            doc.setFont("helvetica", "bold");
            doc.text("ID Transacción:", 14, yPos);
            doc.setFont("helvetica", "normal");
            doc.text(deposito.id.substring(0, 8) + '...', 90, yPos);
            yPos += lineHeight;
            
            doc.setFont("helvetica", "bold");
            doc.text("Fecha:", 14, yPos);
            doc.setFont("helvetica", "normal");
            doc.text(new Date().toLocaleDateString('es-VE'), 90, yPos);
            yPos += lineHeight;
            
            const session = (await db.auth.getSession()).data.session;
            const userName = session?.user?.user_metadata?.nombre || session?.user?.email || 'Usuario';
            doc.setFont("helvetica", "bold");
            doc.text("Usuario:", 14, yPos);
            doc.setFont("helvetica", "normal");
            doc.text(userName.length > 35 ? userName.substring(0, 35) + '...' : userName, 90, yPos);
            yPos += lineHeight + 3;

            // === DETALLES DEL DEPÓSITO ===
            doc.setFillColor(255, 215, 0);
            doc.rect(14, yPos, 182, 7, 'F');
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "bold");
            doc.text("DETALLES DEL DEPÓSITO", 105, yPos + 4.5, null, null, "center");
            yPos += 11;
            
            doc.setFontSize(9);
            doc.setTextColor(50, 50, 50);
            
            const detalles = [
                { label: "Método de Pago:", value: metodosPago[metodoSeleccionado].nombre.toUpperCase() },
                { label: "Cantidad:", value: `${cantidad} BC` },
                { label: "Tasa BCV:", value: `${tasaBCV.toFixed(2)} Bs/USD` },
                { label: "Subtotal:", value: `$${(cantidad * 0.01 * 0.95).toFixed(2)}` },
                { label: "Comisión (0.30%):", value: `$${((cantidad * 0.01 * 0.95) * 0.003).toFixed(2)}` },
                { label: "", value: "" }, // Espacio
                { label: "TOTAL USD:", value: `$${totalUSD.toFixed(2)}`, highlight: true },
                { label: "TOTAL Bs:", value: `Bs. ${totalVES.toFixed(2)}`, highlight: true },
                { label: "", value: "" }, // Espacio
                { label: "Estado:", value: "PENDIENTE", bold: true, color: [133, 100, 4] }
            ];
            
            detalles.forEach(item => {
                if (item.label === "" && item.value === "") {
                    yPos += 2;
                    return;
                }
                if (item.highlight) {
                    doc.setFillColor(255, 248, 220); // Fondo crema
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

            // === FOOTER ===
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
            doc.save(`Factura_BocheClavao_${deposito.id.substring(0, 8)}.pdf`);
            console.log('✅ PDF profesional generado');
        } catch (pdfErr) {
            console.error('❌ Error al generar PDF:', pdfErr);
            mostrarMensaje('Error al generar la factura. Contacta a soporte.', 'error');
        }
    }

    // ==========================================
    // 7. UTILIDADES
    // ==========================================
    window.mostrarMensaje = function(texto, tipo) {
        if (msgDeposito) {
            msgDeposito.textContent = texto;
            msgDeposito.className = `message ${tipo}`;
            msgDeposito.style.display = texto ? 'block' : 'none';
            
            if (tipo === 'success') {
                setTimeout(() => {
                    msgDeposito.style.display = 'none';
                }, 4000);
            }
        }
    };

    window.nuevoDeposito = function() {
        if (formDeposito) {
            formDeposito.reset();
            formDeposito.style.display = 'block';
        }
        if (successView) {
            successView.style.display = 'none';
        }
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
        document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
        if (companyDataBox) companyDataBox.style.display = 'none';
        if (userFormFields) userFormFields.innerHTML = '';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Iniciar
    init();
});
