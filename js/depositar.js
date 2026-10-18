document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        window.location.href = 'index.html';
        return;
    }

    // Verificar sesión
    const { data: { session } } = await db.auth.getSession();
    if (!session || !session.user) {
        window.location.href = 'index.html';
        return;
    }

    // Referencias al DOM (con validación segura)
    const getEl = (id) => document.getElementById(id);
    const cantidadInput = getEl('cantidadInput');
    const totalUSDDisplay = getEl('totalUSDDisplay');
    const totalVESDisplay = getEl('totalVESDisplay');
    const metodoSeleccionadoInput = getEl('metodoSeleccionado');
    const comprobanteFile = getEl('comprobanteFile');
    const previewImage = getEl('previewImage');
    const filePreview = getEl('filePreview');
    const fileUploadContainer = getEl('fileUploadContainer');
    const btnDepositar = getEl('btnDepositar');
    const msgDeposito = getEl('msgDeposito');
    const formDeposito = getEl('formDeposito');
    const successView = getEl('successView');
    const successAmount = getEl('successAmount');

    let tasaBCV = 36.50; // Valor por defecto, se actualizará
    let userData = {};

    // ==========================================
    // 1. CARGAR DATOS DEL USUARIO Y TASA BCV
    // ==========================================
    async function cargarDatosIniciales() {
        try {
            // Obtener datos del perfil
            const { data: perfil } = await db.from('perfiles').select('*').eq('id', session.user.id).single();
            userData = perfil || { nombre: session.user.email, saldo_bc: 0 };

            // Obtener tasa BCV (puedes cambiar esta URL por tu API real)
            // const response = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar/page?page=bcv');
            // const data = await response.json();
            // tasaBCV = data.monitors.usd.price || 36.50;
            tasaBCV = 36.50; // Valor fijo de ejemplo

            actualizarTotales();
        } catch (err) {
            console.error('Error cargando datos:', err);
        }
    }

    // ==========================================
    // 2. LÓGICA DE CÁLCULO
    // ==========================================
    function actualizarTotales() {
        if (!cantidadInput || !totalUSDDisplay || !totalVESDisplay) return;
        
        const cantidad = parseFloat(cantidadInput.value) || 0;
        const precioBaseUSD = cantidad * 0.01; // Ejemplo: 1 BC = $0.01
        const comision = precioBaseUSD * 0.003; // 0.30%
        const totalUSD = precioBaseUSD + comision;
        const totalVES = totalUSD * tasaBCV;

        totalUSDDisplay.textContent = totalUSD.toFixed(2);
        totalVESDisplay.textContent = totalVES.toFixed(2);
    }

    if (cantidadInput) {
        cantidadInput.addEventListener('input', actualizarTotales);
    }

    // ==========================================
    // 3. VISTA PREVIA DE IMAGEN
    // ==========================================
    if (comprobanteFile && previewImage && filePreview && fileUploadContainer) {
        comprobanteFile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    showMessage('El archivo es demasiado grande. Máximo 5MB.', 'error');
                    this.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImage.src = e.target.result;
                    filePreview.style.display = 'flex';
                    fileUploadContainer.classList.add('has-image');
                };
                reader.readAsDataURL(file);
            }
        });

        getEl('removeFile')?.addEventListener('click', function() {
            comprobanteFile.value = '';
            previewImage.src = '';
            filePreview.style.display = 'none';
            fileUploadContainer.classList.remove('has-image');
        });
    }

    // ==========================================
    // 4. ENVÍO DEL FORMULARIO
    // ==========================================
    if (formDeposito) {
        formDeposito.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const cantidad = parseFloat(cantidadInput.value);
            const metodo = metodoSeleccionadoInput?.value || 'pago_movil';
            const file = comprobanteFile.files[0];

            if (!cantidad || cantidad <= 0) {
                showMessage('Por favor, ingresa una cantidad válida.', 'error');
                return;
            }
            if (!file) {
                showMessage('Debes adjuntar el comprobante de pago.', 'error');
                return;
            }

            btnDepositar.disabled = true;
            btnDepositar.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando...';
            showMessage('', '');

            try {
                // 1. Subir comprobante a Supabase Storage
                const fileExt = file.name.split('.').pop();
                const fileName = `${session.user.id}_${Date.now()}.${fileExt}`;
                const filePath = `comprobantes/${fileName}`;

                const { error: uploadError } = await db.storage
                    .from('depositos')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                // 2. Obtener URL pública
                const { data: { publicUrl } } = db.storage
                    .from('depositos')
                    .getPublicUrl(filePath);

                // 3. Calcular montos finales
                const precioBaseUSD = cantidad * 0.01;
                const totalUSD = precioBaseUSD + (precioBaseUSD * 0.003);
                const totalVES = totalUSD * tasaBCV;

                // 4. Guardar registro en la base de datos
                const { error: dbError } = await db.from('depositos').insert({
                    user_id: session.user.id,
                    cantidad_bc: cantidad,
                    metodo_pago: metodo,
                    monto_usd: totalUSD,
                    monto_ves: totalVES,
                    tasa_bcv: tasaBCV,
                    comprobante_url: publicUrl,
                    estado: 'pendiente',
                    fecha_solicitud: new Date().toISOString()
                });

                if (dbError) throw dbError;

                // 5. Éxito: Mostrar vista de éxito y generar PDF
                if (successView && successAmount) {
                    successAmount.textContent = cantidad;
                    formDeposito.style.display = 'none';
                    successView.style.display = 'block';
                    
                    // Generar PDF profesional
                    generarPDFProfesional(cantidad, metodo, totalUSD, totalVES, tasaBCV, precioBaseUSD);
                }

            } catch (err) {
                console.error('Error al procesar depósito:', err);
                showMessage('Error al procesar el depósito: ' + err.message, 'error');
                btnDepositar.disabled = false;
                btnDepositar.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
            }
        });
    }

    // ==========================================
    // 5. GENERAR PDF PROFESIONAL (Tu versión original corregida)
    // ==========================================
    function generarPDFProfesional(cantidad, metodo, totalUSD, totalVES, tasaBCV, precioBaseUSD) {
        try {
            console.log('📄 Generando PDF profesional...');
            if (window.jspdf) {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();

                // === HEADER CON LOGO ===
                // Reemplaza 'TU_BASE64_AQUI' con tu string base64 real del logo
                const logoBase64 = 'TU_BASE64_AQUI'; 
                if (logoBase64 && logoBase64.length > 50) {
                    try {
                        doc.addImage(logoBase64, 'PNG', 15, 8, 35, 12);
                    } catch (logoErr) {
                        console.warn('⚠️ Error al cargar logo:', logoErr);
                    }
                }

                // === TÍTULO DORADO ===
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
                
                doc.setDrawColor(200, 200, 200);
                doc.line(14, 40, 196, 40);
                
                let yPos = 45;
                const lineHeight = 6;

                doc.setFont("helvetica", "bold");
                doc.text("ID Transacción:", 14, yPos);
                doc.setFont("helvetica", "normal");
                const txId = 'TX-' + Date.now().toString().substring(5);
                doc.text(txId, 90, yPos);
                yPos += lineHeight;

                doc.setFont("helvetica", "bold");
                doc.text("Fecha:", 14, yPos);
                doc.setFont("helvetica", "normal");
                doc.text(new Date().toLocaleDateString('es-VE'), 90, yPos);
                yPos += lineHeight;

                const userName = userData.nombre || session.user.email;
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
                doc.setFontSize(11);
                doc.text("DETALLES DEL DEPÓSITO", 105, yPos + 4.5, null, null, "center");
                yPos += 11;

                doc.setFontSize(9);
                doc.setTextColor(50, 50, 50);

                const detalles = [
                    { label: "Método de Pago:", value: metodo.toUpperCase().replace('_', ' ') },
                    { label: "Cantidad:", value: `${cantidad} BC` },
                    { label: "Tasa BCV:", value: `${tasaBCV.toFixed(2)} Bs/USD` },
                    { label: "Subtotal:", value: `$${precioBaseUSD.toFixed(2)}` },
                    { label: "Comisión (0.30%):", value: `$${(precioBaseUSD * 0.003).toFixed(2)}` },
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

                // Guardar referencia global y descargar
                window.facturaPDF = doc;
                doc.save(`Comprobante_Deposito_${txId}.pdf`);
                console.log('✅ PDF profesional generado y descargado');
            } else {
                console.warn('⚠️ jsPDF no está cargado');
            }
        } catch (pdfErr) {
            console.error('❌ Error generando PDF:', pdfErr);
        }
    }

    // ==========================================
    // 6. UTILIDADES
    // ==========================================
    function showMessage(text, type) {
        if (msgDeposito) {
            msgDeposito.textContent = text;
            msgDeposito.className = 'message ' + (type || '');
            msgDeposito.style.display = text ? 'block' : 'none';
        }
    }

    window.nuevoDeposito = function() {
        if (formDeposito) formDeposito.style.display = 'block';
        if (successView) successView.style.display = 'none';
        if (formDeposito) formDeposito.reset();
        if (filePreview) filePreview.style.display = 'none';
        if (fileUploadContainer) fileUploadContainer.classList.remove('has-image');
        if (btnDepositar) {
            btnDepositar.disabled = false;
            btnDepositar.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
        }
        showMessage('', '');
    };

    // Inicializar
    cargarDatosIniciales();
});
