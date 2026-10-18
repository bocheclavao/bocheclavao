document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) {
        console.error('No se pudo obtener el cliente de Supabase');
        window.location.href = 'index.html';
        return;
    }

    // 1. Verificar Sesión
    const { data: { session } } = await db.auth.getSession();
    if (!session || !session.user) {
        window.location.href = 'index.html';
        return;
    }

    // Referencias al DOM
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userIdDisplay = document.getElementById('userIdDisplay');
    const currentBalance = document.getElementById('currentBalance');
    const tasaBCVDisplay = document.getElementById('tasaBCVDisplay');
    const fechaBCVDisplay = document.getElementById('fechaBCVDisplay');
    const packagesGrid = document.getElementById('packagesGrid');
    const customAmount = document.getElementById('customAmount');
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
    const removeFile = document.getElementById('removeFile');
    const formDeposito = document.getElementById('formDeposito');
    const msgDeposito = document.getElementById('msgDeposito');
    const btnDepositar = document.getElementById('btnDepositar');
    const successView = document.getElementById('successView');
    const successAmount = document.getElementById('successAmount');

    let userProfile = null;
    let tasaBCV = 36.50; // Valor por defecto
    let selectedPackage = null;
    let selectedMethod = null;
    let uploadedFile = null;

    // ==========================================
    // DATOS DE LA EMPRESA (¡EDITA ESTO CON TUS DATOS REALES!)
    // ==========================================
    const companyAccounts = {
        'pago_movil': {
            titulo: 'Pago Móvil',
            datos: [
                { label: 'Banco', value: 'Banco de Venezuela (0102)' },
                { label: 'Teléfono', value: '0412-1234567' },
                { label: 'Cédula', value: 'V-12.345.678' }
            ]
        },
        'zelle': {
            titulo: 'Zelle',
            datos: [
                { label: 'Nombre', value: 'Boche Clavao LLC' },
                { label: 'Correo', value: 'pagos@bocheclavao.com' }
            ]
        },
        'binance': {
            titulo: 'Binance Pay / USDT',
            datos: [
                { label: 'Red', value: 'TRC20 (Tron)' },
                { label: 'Dirección', value: 'TXYZ123456789abcdef123456789' }
            ]
        },
        'paypal': {
            titulo: 'PayPal',
            datos: [
                { label: 'Correo', value: 'pagos@bocheclavao.com' },
                { label: 'Tipo', value: 'Amigos y Familiares' }
            ]
        }
    };

    // 2. Cargar Datos del Usuario
    async function loadUserData() {
        try {
            const { data, error } = await db.from('perfiles').select('*').eq('id', session.user.id).single();
            if (error) throw error;
            userProfile = data;
            
            userNameDisplay.textContent = userProfile.nombre || session.user.email;
            userIdDisplay.textContent = userProfile.user_id || 'N/A';
            currentBalance.textContent = parseFloat(userProfile.saldo_bc || 0).toFixed(2);
        } catch (err) {
            console.error('Error cargando perfil:', err);
            userNameDisplay.textContent = session.user.email;
        }
    }

    // 3. Obtener Tasa BCV (API Pública)
    async function loadBCVRate() {
        try {
            const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
            if (!response.ok) throw new Error('Error en la respuesta de la API');
            const data = await response.json();
            tasaBCV = data.promedio || data.venta || 36.50;
            
            tasaBCVDisplay.textContent = tasaBCV.toFixed(2);
            const fecha = new Date(data.fechaActualizacion || Date.now());
            fechaBCVDisplay.textContent = `Actualizado: ${fecha.toLocaleDateString('es-VE')}`;
        } catch (err) {
            console.warn('No se pudo obtener la tasa BCV, usando valor por defecto:', err);
            tasaBCVDisplay.textContent = tasaBCV.toFixed(2);
            fechaBCVDisplay.textContent = 'Tasa estimada (API no disponible)';
        }
    }

    // 4. Renderizar Paquetes
    function renderPackages() {
        const packages = [
            { bc: 100, desc: 'Básico' },
            { bc: 500, desc: 'Popular', discount: true },
            { bc: 1000, desc: 'Pro', discount: true },
            { bc: 5000, desc: 'VIP', discount: true }
        ];

        packagesGrid.innerHTML = '';
        packages.forEach(pkg => {
            const card = document.createElement('div');
            card.className = 'package-card';
            card.dataset.amount = pkg.bc;
            card.innerHTML = `
                ${pkg.discount ? '<div class="discount">-5%</div>' : ''}
                <span class="coins">${pkg.bc} BC</span>
                <span class="price">${pkg.desc}</span>
            `;
            card.addEventListener('click', () => selectPackage(pkg.bc, card));
            packagesGrid.appendChild(card);
        });
    }

    function selectPackage(amount, cardElement) {
        document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
        cardElement.classList.add('selected');
        selectedPackage = amount;
        customAmount.value = amount;
        calculateTotals();
    }

    // 5. Calcular Totales
    function calculateTotals() {
        const amount = parseFloat(customAmount.value) || 0;
        if (amount <= 0) {
            totalUSDDisplay.textContent = '0.00';
            totalVESDisplay.textContent = '0.00';
            customAmount.dataset.rawUsd = 0;
            customAmount.dataset.rawVes = 0;
            return;
        }

        const usdAmount = amount / tasaBCV;
        const commission = usdAmount * 0.003; // 0.30% de comisión
        const totalUSD = usdAmount + commission;
        const totalVES = totalUSD * tasaBCV;

        totalUSDDisplay.textContent = totalUSD.toFixed(2);
        totalVESDisplay.textContent = totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        // Guardar valores crudos para la base de datos
        customAmount.dataset.rawUsd = totalUSD;
        customAmount.dataset.rawVes = totalVES;
    }

    customAmount.addEventListener('input', () => {
        selectedPackage = null;
        document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
        calculateTotals();
    });

    // 6. Renderizar Métodos de Pago
    function renderPaymentMethods() {
        const methods = [
            { id: 'pago_movil', name: 'Pago Móvil', icon: 'fas fa-mobile-alt' },
            { id: 'zelle', name: 'Zelle', icon: 'fas fa-building-columns' },
            { id: 'binance', name: 'Binance', icon: 'fab fa-bitcoin' },
            { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal' }
        ];

        paymentMethodsGrid.innerHTML = '';
        methods.forEach(method => {
            const card = document.createElement('div');
            card.className = 'method-card';
            card.dataset.method = method.id;
            card.innerHTML = `
                <i class="${method.icon}" style="font-size: 1.8rem; color: #FFD700; margin-bottom: 5px;"></i>
                <span>${method.name}</span>
            `;
            card.addEventListener('click', () => selectMethod(method.id, card));
            paymentMethodsGrid.appendChild(card);
        });
    }

    function selectMethod(methodId, cardElement) {
        document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
        cardElement.classList.add('selected');
        selectedMethod = methodId;
        showCompanyData(methodId);
        renderDynamicForm(methodId);
    }

    function showCompanyData(methodId) {
        const data = companyAccounts[methodId];
        if (!data) return;

        companyDataBox.style.display = 'block';
        companyDataContent.innerHTML = `
            <h4 style="margin-bottom: 15px; color: #FFD700;"><i class="fas fa-building"></i> ${data.titulo}</h4>
            ${data.datos.map(d => `
                <div class="data-row">
                    <span class="label">${d.label}:</span>
                    <span class="value" style="cursor: pointer;" onclick="navigator.clipboard.writeText('${d.value}')" title="Copiar al portapapeles">
                        ${d.value} <i class="fas fa-copy" style="font-size: 0.8rem; margin-left: 5px; color: #888;"></i>
                    </span>
                </div>
            `).join('')}
        `;
    }

    function renderDynamicForm(methodId) {
        dynamicForm.style.display = 'block';
        let fields = '';

        if (methodId === 'pago_movil') {
            fields = `
                <div class="form-group">
                    <label>Banco Emisor</label>
                    <select name="banco_emisor" required>
                        <option value="">Selecciona tu banco</option>
                        <option value="Venezuela">Banco de Venezuela</option>
                        <option value="Banesco">Banesco</option>
                        <option value="Mercantil">Mercantil</option>
                        <option value="Provincial">BBVA Provincial</option>
                        <option value="Otro">Otro</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Teléfono Emisor</label>
                    <input type="text" name="telefono_emisor" placeholder="0412-1234567" required>
                </div>
                <div class="form-group">
                    <label>Cédula del Titular</label>
                    <input type="text" name="cedula_emisor" placeholder="V-12345678" required>
                </div>
            `;
        } else if (methodId === 'zelle') {
            fields = `
                <div class="form-group">
                    <label>Nombre del Titular de la cuenta</label>
                    <input type="text" name="nombre_emisor" placeholder="Nombre completo" required>
                </div>
                <div class="form-group">
                    <label>Correo Zelle Emisor</label>
                    <input type="email" name="correo_emisor" placeholder="tu@email.com" required>
                </div>
            `;
        } else if (methodId === 'binance') {
            fields = `
                <div class="form-group">
                    <label>ID de Transacción (TxID / Hash)</label>
                    <input type="text" name="txid" placeholder="Pega el ID de la transacción" required>
                    <small>Lo encuentras en los detalles de tu retiro en Binance.</small>
                </div>
                <div class="form-group">
                    <label>Red utilizada</label>
                    <select name="red_binance" required>
                        <option value="TRC20">TRC20 (Tron)</option>
                        <option value="BEP20">BEP20 (BSC)</option>
                    </select>
                </div>
            `;
        } else if (methodId === 'paypal') {
            fields = `
                <div class="form-group">
                    <label>Correo PayPal Emisor</label>
                    <input type="email" name="correo_emisor" placeholder="tu@email.com" required>
                </div>
            `;
        }

        fields += `
            <div class="form-group">
                <label>Número de Referencia</label>
                <input type="text" name="referencia" placeholder="Últimos 6 dígitos o código completo" required>
            </div>
        `;

        userFormFields.innerHTML = fields;
    }

    // 7. Manejo de Archivos (Comprobante)
    comprobanteFile.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                showMessage('El archivo es demasiado grande. Máximo 5MB.', 'error');
                this.value = '';
                return;
            }
            uploadedFile = file;
            const reader = new FileReader();
            reader.onload = function(e) {
                previewImage.src = e.target.result;
                filePreview.style.display = 'flex';
                fileUploadContainer.classList.add('has-image');
            };
            reader.readAsDataURL(file);
        }
    });

    removeFile.addEventListener('click', function() {
        comprobanteFile.value = '';
        uploadedFile = null;
        filePreview.style.display = 'none';
        fileUploadContainer.classList.remove('has-image');
    });

    // 8. Envío del Formulario
    formDeposito.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const amount = parseFloat(customAmount.value);
        if (!amount || amount <= 0) {
            showMessage('Por favor, ingresa una cantidad válida de BC.', 'error');
            return;
        }
        if (!selectedMethod) {
            showMessage('Por favor, selecciona un método de pago.', 'error');
            return;
        }
        if (!uploadedFile) {
            showMessage('Debes adjuntar el comprobante de pago.', 'error');
            return;
        }

        btnDepositar.disabled = true;
        btnDepositar.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando...';
        showMessage('', '');

        try {
            // 1. Subir imagen a Supabase Storage
            const fileExt = uploadedFile.name.split('.').pop();
            const fileName = `${session.user.id}_${Date.now()}.${fileExt}`;
            const filePath = `comprobantes/${fileName}`;

            const { error: uploadError } = await db.storage
                .from('depositos') // Asegúrate de crear este bucket en Supabase
                .upload(filePath, uploadedFile);

            if (uploadError) throw uploadError;

            // Obtener URL pública
            const { data: { publicUrl } } = db.storage.from('depositos').getPublicUrl(filePath);

            // 2. Recopilar datos del formulario dinámico
            const formData = new FormData(formDeposito);
            const datosPago = {};
            for (let [key, value] of formData.entries()) {
                datosPago[key] = value;
            }

            const usdAmount = parseFloat(customAmount.dataset.rawUsd || 0);
            const vesAmount = parseFloat(customAmount.dataset.rawVes || 0);

            // 3. Insertar registro en la base de datos
            const { error: dbError } = await db.from('depositos').insert({
                user_id: session.user.id,
                monto_bc: amount,
                monto_usd: usdAmount,
                monto_ves: vesAmount,
                metodo_pago: selectedMethod,
                datos_pago: datosPago,
                comprobante_url: publicUrl,
                estado: 'pendiente',
                fecha_solicitud: new Date().toISOString()
            });

            if (dbError) throw dbError;

            // 4. Éxito
            showSuccessView(amount);

        } catch (err) {
            console.error('Error al procesar el depósito:', err);
            showMessage('Error al procesar el depósito: ' + err.message, 'error');
            btnDepositar.disabled = false;
            btnDepositar.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
        }
    });

    function showMessage(text, type) {
        msgDeposito.textContent = text;
        msgDeposito.className = 'message ' + (type || '');
        msgDeposito.style.display = text ? 'block' : 'none';
    }

    function showSuccessView(amount) {
        formDeposito.style.display = 'none';
        document.querySelector('.user-balance-bar').style.display = 'none';
        document.querySelector('.bcv-banner').style.display = 'none';
        document.querySelectorAll('.section-title').forEach(el => el.style.display = 'none');
        document.querySelector('.warning-notice').style.display = 'none';
        
        successAmount.textContent = amount;
        successView.style.display = 'block';
        
        // Generar PDF
        generatePDF(amount);
    }

    window.nuevoDeposito = function() {
        formDeposito.reset();
        formDeposito.style.display = 'block';
        document.querySelector('.user-balance-bar').style.display = 'flex';
        document.querySelector('.bcv-banner').style.display = 'flex';
        document.querySelectorAll('.section-title').forEach(el => el.style.display = 'flex');
        document.querySelector('.warning-notice').style.display = 'flex';
        
        successView.style.display = 'none';
        selectedPackage = null;
        selectedMethod = null;
        uploadedFile = null;
        
        document.querySelectorAll('.package-card, .method-card').forEach(c => c.classList.remove('selected'));
        companyDataBox.style.display = 'none';
        dynamicForm.style.display = 'none';
        filePreview.style.display = 'none';
        fileUploadContainer.classList.remove('has-image');
        btnDepositar.disabled = false;
        btnDepositar.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
        showMessage('', '');
        calculateTotals();
    };

    function generatePDF(amount) {
        if (typeof window.jspdf !== 'undefined') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            doc.setFontSize(20);
            doc.text('Boche Clavao - Comprobante de Solicitud', 20, 30);
            
            doc.setFontSize(12);
            doc.text(`Fecha: ${new Date().toLocaleString('es-VE')}`, 20, 50);
            doc.text(`Usuario: ${userProfile?.nombre || session.user.email}`, 20, 60);
            doc.text(`ID de Usuario: ${userProfile?.user_id || 'N/A'}`, 20, 70);
            
            doc.setFontSize(16);
            doc.setTextColor(0, 128, 0);
            doc.text(`Monto Solicitado: ${amount} BC`, 20, 90);
            
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text('Este documento es una constancia de solicitud. Las monedas se acreditarán tras la validación manual.', 20, 110);
            doc.text('Tiempo estimado de revisión: 15 a 30 minutos.', 20, 120);
            
            doc.save(`solicitud_deposito_${Date.now()}.pdf`);
        }
    }

    // Inicialización
    loadUserData();
    loadBCVRate();
    renderPackages();
    renderPaymentMethods();
});
