document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        window.location.href = 'index.html';
        return;
    }

    const { data: { session } } = await db.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    // ==========================================
    // VARIABLES DE ESTADO
    // ==========================================
    let paqueteSeleccionado = null;
    let metodoSeleccionado = null;
    let tasaBCV = 36.50; // Valor por defecto, idealmente fetchearlo de tu BD o API
    let userData = {};

    // ==========================================
    // ELEMENTOS DEL DOM
    // ==========================================
    const fileInput = document.getElementById('comprobanteFile');
    const companyDataBox = document.getElementById('companyDataBox');
    const dynamicForm = document.getElementById('dynamicForm');

    // ==========================================
    // CONFIGURACIÓN DE MÉTODOS DE PAGO
    // ==========================================
    const metodosPago = {
        pagomovil: { nombre: 'Pago Móvil', requiereArchivo: true },
        zelle: { nombre: 'Zelle', requiereArchivo: true },
        binance: { nombre: 'Binance', requiereArchivo: true },
        paypal: { nombre: 'PayPal', requiereArchivo: true }
    };

    // ==========================================
    // FUNCIONES AUXILIARES
    // ==========================================
    async function cargarDatosIniciales() {
        try {
            const { data: perfil } = await db.from('perfiles').select('*').eq('id', session.user.id).single();
            userData = perfil || { nombre: session.user.email };
            
            if (perfil && perfil.tasa_bcv) {
                tasaBCV = parseFloat(perfil.tasa_bcv);
            }
            
            document.getElementById('totalUSD').textContent = '0.00';
            document.getElementById('totalVES').textContent = '0.00';
        } catch (err) {
            console.error('Error cargando datos:', err);
        }
    }

    function calcularTotales() {
        const customAmountVal = document.getElementById('customAmount').value;
        let cantidad = 0;
        let descuento = 0;

        if (paqueteSeleccionado) {
            cantidad = paqueteSeleccionado.cantidad;
            descuento = paqueteSeleccionado.descuento || 0;
            document.getElementById('customAmount').value = cantidad;
        } else if (customAmountVal) {
            cantidad = parseFloat(customAmountVal);
        }

        if (cantidad > 0) {
            const precioBaseUSD = cantidad * 1.0; // Ajusta el 1.0 si el precio por BC es diferente
            const precioConDescuento = precioBaseUSD * (1 - descuento);
            const comision = precioConDescuento * 0.003; // 0.30%
            const totalUSD = precioConDescuento + comision;
            const totalVES = totalUSD * tasaBCV;

            document.getElementById('totalUSD').textContent = totalUSD.toFixed(2);
            document.getElementById('totalVES').textContent = totalVES.toFixed(2);
            
            return { cantidad, precioBaseUSD: precioConDescuento, totalUSD, totalVES };
        }
        return { cantidad: 0, precioBaseUSD: 0, totalUSD: 0, totalVES: 0 };
    }

    window.seleccionarPaquete = function(cantidad, descuento, element) {
        document.querySelectorAll('.package-card').forEach(el => el.classList.remove('selected'));
        if (element) element.classList.add('selected');
        
        paqueteSeleccionado = { cantidad, descuento };
        calcularTotales();
    };

    window.seleccionarMetodo = function(metodo, element) {
        document.querySelectorAll('.method-card').forEach(el => el.classList.remove('selected'));
        if (element) element.classList.add('selected');
        
        metodoSeleccionado = metodo;
        companyDataBox.style.display = 'block';
        dynamicForm.style.display = 'block';
    };

    document.getElementById('customAmount')?.addEventListener('input', function() {
        paqueteSeleccionado = null;
        document.querySelectorAll('.package-card').forEach(el => el.classList.remove('selected'));
        calcularTotales();
    });

    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    // Aquí puedes agregar lógica para mostrar vista previa de la imagen si lo deseas
                };
                reader.readAsDataURL(file);
            }
        });
    }

    await cargarDatosIniciales();

    // ==========================================
    // ENVÍO DEL FORMULARIO (BLINDADO)
    // ==========================================
    document.getElementById('formDeposito').addEventListener('submit', async function(e) {
        e.preventDefault();

        const btn = document.getElementById('btnDepositar');
        const customAmountVal = document.getElementById('customAmount').value;
        
        if (!paqueteSeleccionado && !customAmountVal) { 
            mostrarMensaje('❌ Ingresa una cantidad de monedas.', 'error'); 
            return; 
        }
        if (!metodoSeleccionado) { 
            mostrarMensaje('❌ Selecciona un método de pago.', 'error'); 
            return; 
        }
        
        const { cantidad, precioBaseUSD, totalUSD, totalVES } = calcularTotales();

        // Recopilar datos seguros del formulario dinámico
        const datosPagoSeguros = {};
        const inputs = dynamicForm.querySelectorAll('input, select');
        inputs.forEach(input => {
            if (input.name) {
                datosPagoSeguros[input.name] = input.value;
            }
        });

        if (metodosPago[metodoSeleccionado].requiereArchivo) {
            if (!fileInput || !fileInput.files[0]) {
                mostrarMensaje('❌ Debes subir el comprobante de pago.', 'error');
                document.getElementById('fileUploadGroup').scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando...';

        try {
            // 1. SUBIR ARCHIVO
            let comprobanteUrl = null;
            if (fileInput && fileInput.files[0]) {
                const archivo = fileInput.files[0];
                const nombreArchivo = `${session.user.id}/${Date.now()}_${archivo.name.replace(/\s/g, '_')}`;
                btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Subiendo comprobante...';

                const { error: uploadError } = await db.storage.from('comprobantes').upload(nombreArchivo, archivo, { cacheControl: '3600', upsert: false });
                if (uploadError) throw new Error('Error al subir: ' + uploadError.message);

                const { data: urlData } = db.storage.from('comprobantes').getPublicUrl(nombreArchivo);
                comprobanteUrl = urlData.publicUrl;
            }

            // 2. GUARDAR EN BD
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Registrando...';
            const { data: deposito, error: dbError } = await db.from('depositos').insert({
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
            }).select().single();

            if (dbError) throw new Error('Error al guardar: ' + dbError.message);
            console.log('✅ Depósito registrado:', deposito);

            // 3. ENVIAR CORREO (No detiene el proceso si falla)
            try {
                console.log('📧 Enviando correo...');
                await db.functions.invoke('enviar-factura', {
                    body: { 
                        email: session.user.email, 
                        nombre: userData.nombre || 'Usuario', 
                        montoBC: cantidad, 
                        montoUSD: totalUSD.toFixed(2), 
                        montoBS: totalVES.toFixed(2), 
                        metodo: metodosPago[metodoSeleccionado].nombre, 
                        fecha: new Date().toLocaleString('es-VE'), 
                        idTransaccion: deposito.id 
                    }
                });
                console.log('✅ Correo enviado');
            } catch (emailErr) { 
                console.warn('⚠️ Error al enviar correo:', emailErr); 
            }

            // 4. GENERAR PDF (No detiene el proceso si falla)
            try {
                console.log('📄 Generando PDF...');
                if (window.jspdf) {
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF();
                    
                    doc.setFillColor(255, 215, 0); doc.rect(0, 0, 210, 35, 'F');
                    doc.setTextColor(0, 0, 0); doc.setFontSize(24); doc.setFont("helvetica", "bold");
                    doc.text("BOCHE CLAVA'O", 105, 22, null, null, "center");
                    
                    doc.setFontSize(11); doc.setFont("helvetica", "normal"); doc.text("Comprobante de Depósito", 105, 30, null, null, "center");
                    doc.setTextColor(50, 50, 50); doc.setFontSize(10);
                    doc.text(`ID: ${deposito.id}`, 14, 50);
                    doc.text(`Fecha: ${new Date().toLocaleString('es-VE')}`, 14, 57);
                    doc.text(`Usuario: ${userData.nombre || session.user.email}`, 14, 64);
                    
                    doc.setDrawColor(200, 200, 200); doc.line(14, 70, 196, 70);
                    doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.text("Detalles", 14, 85);
                    doc.setFont("helvetica", "normal"); doc.setFontSize(10);

                    let y = 100;
                    [
                        { label: "Método:", value: metodosPago[metodoSeleccionado].nombre.toUpperCase() },
                        { label: "Monedas:", value: `${cantidad} BC` },
                        { label: "Tasa BCV:", value: `${tasaBCV.toFixed(4)} Bs/USD` },
                        { label: "Subtotal:", value: `$${precioBaseUSD.toFixed(2)}` },
                        { label: "Comisión (0.30%):", value: `$${(precioBaseUSD * 0.003).toFixed(2)}` },
                        { label: "TOTAL USD:", value: `$${totalUSD.toFixed(2)}` },
                        { label: "TOTAL VES:", value: `Bs. ${totalVES.toFixed(2)}` },
                        { label: "Estado:", value: "PENDIENTE" }
                    ].forEach(item => {
                        doc.setFont("helvetica", "bold"); doc.text(item.label, 14, y);
                        doc.setFont("helvetica", "normal");
                        const w = doc.getStringUnitWidth(item.value) * doc.internal.getFontSize() / doc.internal.scaleFactor;
                        doc.text(item.value, 196 - w, y);
                        y += 9;
                    });

                    doc.setFontSize(8); doc.setTextColor(100, 100, 100);
                    doc.text("Comprobante automático. Soporte: soporte@bocheclavao.com", 105, 280, null, null, "center");
                    window.facturaPDF = doc;
                    console.log('✅ PDF generado');
                } else {
                    console.warn('⚠️ jsPDF no está cargado');
                }
            } catch (pdfErr) { 
                console.warn('⚠️ Error PDF:', pdfErr); 
            }

            // 5. MOSTRAR VISTA DE ÉXITO (A PRUEBA DE FALLAS)
            console.log('🎉 [PASO 5] Mostrando vista de éxito...');
            try {
                const formEl = document.getElementById('formDeposito');
                if (formEl) formEl.style.display = 'none';
                
                const amountEl = document.getElementById('successAmount');
                if (amountEl) amountEl.textContent = cantidad;
                
                const successActions = document.querySelector('.success-actions');
                if (successActions) {
                    const btnExistente = document.getElementById('btnDescargarFactura');
                    if (btnExistente) btnExistente.remove();
                    
                    const btnDescargar = document.createElement('button');
                    btnDescargar.id = 'btnDescargarFactura';
                    btnDescargar.className = 'btn-secondary';
                    btnDescargar.style.marginTop = '10px';
                    btnDescargar.innerHTML = '<i class="fas fa-file-pdf"></i> Descargar Factura';
                    btnDescargar.onclick = () => {
                        if (window.facturaPDF) window.facturaPDF.save(`Factura_${deposito.id.substring(0,8)}.pdf`);
                        else alert('No se pudo generar la factura.');
                    };
                    successActions.insertBefore(btnDescargar, successActions.firstChild);
                    console.log('✅ Botón de descarga insertado');
                } else {
                    console.error('❌ ERROR: No se encontró .success-actions en el HTML');
                }

                const successViewEl = document.getElementById('successView');
                if (successViewEl) {
                    successViewEl.style.display = 'block';
                    console.log('✅ Vista de éxito mostrada');
                } else {
                    console.error('❌ ERROR: No se encontró #successView en el HTML');
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });

            } catch (uiError) {
                console.error('❌ ERROR CRÍTICO al mostrar la vista:', uiError);
                const formEl = document.getElementById('formDeposito');
                if (formEl) formEl.style.display = 'block';
                throw uiError;
            }

        } catch (err) {
            console.error('❌ [ERROR GLOBAL] en el depósito:', err);
            
            const formEl = document.getElementById('formDeposito');
            if (formEl) formEl.style.display = 'block';
            
            mostrarMensaje('❌ Error: ' + err.message, 'error');
            
            const btnReset = document.getElementById('btnDepositar');
            if (btnReset) {
                btnReset.disabled = false;
                btnReset.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
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

    window.nuevoDeposito = function() {
        document.getElementById('formDeposito').reset();
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        document.getElementById('companyDataBox').style.display = 'none';
        document.getElementById('dynamicForm').style.display = 'none';
        paqueteSeleccionado = null; 
        metodoSeleccionado = null;
        document.getElementById('customAmount').value = '';
        document.getElementById('totalUSD').textContent = '0.00';
        document.getElementById('totalVES').textContent = '0.00';
        document.getElementById('formDeposito').style.display = 'block';
        document.getElementById('successView').style.display = 'none';
        
        const btn = document.getElementById('btnDepositar');
        if (btn) {
            btn.disabled = false; 
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
});
