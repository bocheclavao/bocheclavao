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
    // 2. OBTENER TASA BCV REAL (Automático)
    // ==========================================
    async function obtenerTasaBCV() {
        try {
            const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
            if (!response.ok) throw new Error('Error en la red');
            
            const data = await response.json();
            tasaBCV = data.promedio; 
            
            const fecha = new Date(data.fechaActualizacion).toLocaleDateString('es-VE', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            });
            
            document.getElementById('tasaBCVDisplay').textContent = tasaBCV.toFixed(2);
            document.getElementById('fechaBCVDisplay').textContent = `Actualizado: ${fecha}`;
            
            if (document.getElementById('customAmount').value) {
                document.getElementById('customAmount').dispatchEvent(new Event('input'));
            }
            
        } catch (error) {
            console.error('Error obteniendo tasa BCV:', error);
            document.getElementById('tasaBCVDisplay').textContent = 'No disp.';
            document.getElementById('fechaBCVDisplay').textContent = 'Verifica tu conexión';
            tasaBCV = 36.50; // Valor de respaldo
        }
    }

    await obtenerTasaBCV();

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
                { label: 'Monto', value: 'Enviar el monto exacto en USDT' }
            ],
            camposUsuario: [
                { id: 'txid', label: 'Hash de la Transacción (TXID)', type: 'text', placeholder: 'Pega el ID de la transacción aquí' }
            ],
            requiereArchivo: false 
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
           'kontigo': {
            nombre: 'Kontigo',
            logo: '../img/kontigo.png',
            datosEmpresa: [ { label: 'Teléfono / Correo Kontigo', value: 'TU_DATO_AQUI' } ],
            camposUsuario: [
                { id: 'cuentaEmisor', label: 'Tu teléfono o correo Kontigo', type: 'text', placeholder: 'Ej: 04141234567 o correo@ejemplo.com' },
                { id: 'referencia', label: 'ID de la transacción / Referencia', type: 'text', placeholder: 'Código de la operación' }
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
            logo: '../img/tarjetas.png',
            datosEmpresa: [ { label: 'Nota', value: 'Procesado de forma segura.' } ],
            camposUsuario: [
                { id: 'nombreTitular', label: 'Nombre del titular', type: 'text' },
                { id: 'referencia', label: 'Últimos 4 dígitos de la tarjeta', type: 'text' }
            ],
            requiereArchivo: true
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

    // ==========================================
    // 9. MANEJO DE ARCHIVO Y ENVÍO
    // ==========================================
    document.getElementById('comprobanteFile').addEventListener('change', function() {
        const fileName = this.files[0] ? this.files[0].name : 'Haz clic o arrastra tu captura aquí';
        document.getElementById('fileName').textContent = fileName;
    });

    const formDeposito = document.getElementById('formDeposito');
    formDeposito.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!paqueteSeleccionado && !customAmountInput.value) {
            mostrarMensaje('❌ Debes seleccionar o ingresar una cantidad de monedas.', 'error');
            return;
        }
        if (!metodoSeleccionado) {
            mostrarMensaje(' Debes seleccionar un método de pago.', 'error');
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
            datosUsuario[campo.id] = document.getElementById(campo.id).value;
        });

        try {
            // AQUÍ IRÁ EL CÓDIGO REAL PARA GUARDAR EN SUPABASE
            // await db.from('depositos').insert({ ... })
            
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulación

            mostrarMensaje(`✅ ¡Depósito de ${cantidad} BC reportado! Se acreditarán tras validar los ${totalVES.toFixed(2)} Bs.`, 'success');
            
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
