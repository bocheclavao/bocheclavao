document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { window.location.href = 'index.html'; return; }

    const { data: { session } } = await db.auth.getSession();
    if (!session || !session.user) { window.location.href = 'index.html'; return; }

    // ==========================================
    // 1. CONFIGURACIÓN Y DATOS
    // ==========================================
    
    // Paquetes con 5% de descuento fijo (1 BC = 1 USD)
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

    // Métodos de pago con LOGOS de la carpeta img/
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
                { id: 'bancoEmisor', label: 'Tu Banco Emisor', type: 'select', options: ['Banesco', 'Mercantil', 'Provincial', 'Venezuela', 'Otro'] },
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
                { label: 'Monto', value: 'Enviar el monto exacto en USDT' }
            ],
            camposUsuario: [
                { id: 'txid', label: 'Hash de la Transacción (TXID)', type: 'text', placeholder: 'Pega el ID de la transacción aquí' }
            ],
            requiereArchivo: false // La blockchain lo verifica, pero puedes cambiarlo a true si quieres captura
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
                { id: 'correoEmisor', label: 'Tu correo o teléfono Wally', type: 'text' },
                { id: 'referencia', label: 'ID de la transacción', type: 'text' }
            ],
            requiereArchivo: true
        },
        'reserve': {
            nombre: 'Reserve',
            logo: '../img/reserve.png', // Si tu archivo se llama reserver.png, cámbialo aquí
            datosEmpresa: [ { label: 'Correo Reserve', value: 'TU_DATO_AQUI' } ],
            camposUsuario: [
                { id: 'correoEmisor', label: 'Tu correo Reserve', type: 'email' },
                { id: 'referencia', label: 'ID de la transacción', type: 'text' }
            ],
            requiereArchivo: true
        },
        'paypal': {
            nombre: 'PayPal',
            logo: '../img/paypal.png',
            datosEmpresa: [ { label: 'Correo PayPal', value: 'TU_DATO_AQUI' } ],
            camposUsuario: [
                { id: 'correoEmisor', label: 'Tu correo PayPal', type: 'email' },
                { id: 'referencia', label: 'Correo con el que enviaste', type: 'email' }
            ],
            requiereArchivo: true
        },
        'tarjeta': {
            nombre: 'Tarjeta Crédito/Débito',
            logo: '../img/tarjetas.png', // Descarga un logo PNG de Visa/Mastercard y guárdalo así
            datosEmpresa: [ { label: 'Nota', value: 'Procesado de forma segura. (Requiere configuración de pasarela)' } ],
            camposUsuario: [
                { id: 'nombreTitular', label: 'Nombre del titular', type: 'text' },
                { id: 'referencia', label: 'Últimos 4 dígitos de la tarjeta', type: 'text' }
            ],
            requiereArchivo: true
        }
    };

    let paqueteSeleccionado = null;
    let metodoSeleccionado = null;
    let userData = null;

    // ==========================================
    // 2. CARGAR DATOS DEL USUARIO
    // ==========================================
    const { data: perfil } = await db.from('perfiles').select('*').eq('id', session.user.id).single();
    if (perfil) {
        userData = perfil;
        document.getElementById('userNameDisplay').textContent = perfil.nombre || session.user.email;
        document.getElementById('userIdDisplay').textContent = perfil.user_id || session.user.id.substring(0, 8);
        document.getElementById('currentBalance').textContent = (perfil.saldo_bc || 0).toFixed(2);
    }

    // ==========================================
    // 3. RENDERIZAR PAQUETES (5% OFF)
    // ==========================================
    const packagesGrid = document.getElementById('packagesGrid');
    paquetes.forEach(pkg => {
        const precioOriginal = pkg.cantidad; // 1 BC = 1 USD
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
    // 4. RENDERIZAR MÉTODOS DE PAGO CON LOGOS
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

        // Mostrar datos de la empresa
        const companyBox = document.getElementById('companyDataBox');
        const companyContent = document.getElementById('companyDataContent');
        companyContent.innerHTML = datos.datosEmpresa.map(d => `
            <div class="data-row">
                <span class="label">${d.label}:</span>
                <span class="value">${d.value}</span>
            </div>
        `).join('');
        companyBox.style.display = 'block';

        // Generar campos del usuario
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

        // Mostrar/Ocultar subida de archivo
        document.getElementById('fileUploadGroup').style.display = datos.requiereArchivo ? 'block' : 'none';
        document.getElementById('dynamicForm').style.display = 'block';
        
        // Scroll suave hacia el formulario
        document.getElementById('dynamicForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ==========================================
    // 5. LÓGICA DE CÁLCULO MANUAL
    // ==========================================
    const customAmountInput = document.getElementById('customAmount');
    customAmountInput.addEventListener('input', function() {
        const cantidad = parseFloat(this.value) || 0;
        
        // Si coincide con un paquete, aplicar 5% descuento
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
        // Como no tenemos la tasa en JS (está en la imagen), usamos un placeholder o un valor por defecto para el cálculo
        // Si quieres que el cálculo en Bs sea exacto, debes poner la tasa numérica aquí:
        const TASA_ESTIMADA = 36.50; // ⚠️ ACTUALIZA ESTO MANUALMENTE O VÍA ADMIN
        
        document.getElementById('totalUSD').textContent = precioUSD.toFixed(2);
        document.getElementById('totalVES').textContent = (precioUSD * TASA_ESTIMADA).toFixed(2);
    }

    // ==========================================
    // 6. MANEJO DE ARCHIVO (NOMBRE)
    // ==========================================
    document.getElementById('comprobanteFile').addEventListener('change', function() {
        const fileName = this.files[0] ? this.files[0].name : 'Haz clic o arrastra tu captura aquí';
        document.getElementById('fileName').textContent = fileName;
    });

    // ==========================================
    // 7. ENVÍO DEL FORMULARIO
    // ==========================================
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
        
        const datosUsuario = {};
        metodosPago[metodoSeleccionado].camposUsuario.forEach(campo => {
            datosUsuario[campo.id] = document.getElementById(campo.id).value;
        });

        try {
            // SIMULACIÓN DE GUARDADO EN SUPABASE
            await new Promise(resolve => setTimeout(resolve, 1500));

            mostrarMensaje('✅ ¡Depósito reportado con éxito! Tu saldo se acreditará tras la validación.', 'success');
            formDeposito.reset();
            document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            document.getElementById('companyDataBox').style.display = 'none';
            document.getElementById('dynamicForm').style.display = 'none';
            document.getElementById('fileName').textContent = 'Haz clic o arrastra tu captura aquí';
            
        } catch (err) {
            mostrarMensaje('❌ Error al reportar: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Reportar Depósito';
        }
    });

    function mostrarMensaje(texto, tipo) {
        const msg = document.getElementById('msgDeposito');
        msg.textContent = texto;
        msg.className = `message ${tipo}`;
    }
});
