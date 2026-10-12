document.addEventListener('DOMContentLoaded', async function() {
    const db = window.supabaseClient;
    if (!db) { window.location.href = 'index.html'; return; }

    const { data: { session } } = await db.auth.getSession();
    if (!session || !session.user) { window.location.href = 'index.html'; return; }

    // ==========================================
    // 1. CONFIGURACIÓN Y DATOS
    // ==========================================
    
    // Tasa BCV (En producción, esto debería venir de tu base de datos o una API proxy)
    // Por ahora, usamos un valor de ejemplo. Puedes actualizarlo manualmente o vía admin.
    const TASA_BCV = 36.50; // ⚠️ CAMBIA ESTE VALOR SEGÚN EL DÍA
    
    document.getElementById('tasaBCVDisplay').textContent = `${TASA_BCV.toFixed(2)} Bs`;

    // Paquetes con descuento (1 BC = 1 USD)
    const paquetes = [
        { cantidad: 5, descuento: 0.15 },   // 15% off
        { cantidad: 10, descuento: 0.10 },  // 10% off
        { cantidad: 15, descuento: 0.12 },  // 12% off
        { cantidad: 20, descuento: 0.15 },  // 15% off
        { cantidad: 35, descuento: 0.18 },  // 18% off
        { cantidad: 50, descuento: 0.20 },  // 20% off
        { cantidad: 60, descuento: 0.22 },  // 22% off
        { cantidad: 100, descuento: 0.25 }  // 25% off
    ];

    // Métodos de pago y sus datos de la empresa + campos requeridos al usuario
    const metodosPago = {
        'pagomovil': {
            nombre: 'Pago Móvil',
            icono: 'fas fa-mobile-alt',
            color: '#0064ff',
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
        'usdt': {
            nombre: 'USDT (Binance/Tron)',
            icono: 'fab fa-bitcoin',
            color: '#f0b90b',
            datosEmpresa: [
                { label: 'Red', value: 'TRC20 (Tron)' },
                { label: 'Dirección Wallet', value: 'TXYZ1234567890abcdef...' },
                { label: 'Monto Exacto', value: 'Enviar el monto exacto en USD' }
            ],
            camposUsuario: [
                { id: 'txid', label: 'Hash de la Transacción (TXID)', type: 'text', placeholder: 'Pega el ID de la transacción aquí' }
            ],
            requiereArchivo: false // La blockchain lo verifica, pero puedes dejarlo en true si quieres captura
        },
        'zelle': {
            nombre: 'Zelle',
            icono: 'fas fa-university',
            color: '#6d1ed4',
            datosEmpresa: [
                { label: 'Nombre', value: 'Juan Perez' },
                { label: 'Email / Teléfono', value: 'pagos@bocheclavao.com' }
            ],
            camposUsuario: [
                { id: 'nombreEmisor', label: 'Nombre del titular de la cuenta Zelle', type: 'text' },
                { id: 'referencia', label: 'Número de Confirmación / Referencia', type: 'text' }
            ],
            requiereArchivo: true
        },
        'zinli': {
            nombre: 'Zinli',
            icono: 'fas fa-wallet',
            color: '#00d084',
            datosEmpresa: [{ label: 'Correo Zinli', value: 'cobros@bocheclavao.com' }],
            camposUsuario: [
                { id: 'correoEmisor', label: 'Tu correo Zinli', type: 'email' },
                { id: 'referencia', label: 'ID de la transacción', type: 'text' }
            ],
            requiereArchivo: true
        },
        // Puedes agregar 'wally', 'kontigo', 'reserve', 'tarjeta' siguiendo la misma estructura...
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
    // 3. RENDERIZAR PAQUETES
    // ==========================================
    const packagesGrid = document.getElementById('packagesGrid');
    paquetes.forEach(pkg => {
        const precioOriginal = pkg.cantidad; // 1 BC = 1 USD
        const precioFinal = precioOriginal * (1 - pkg.descuento);
        const ahorro = precioOriginal - precioFinal;

        const card = document.createElement('div');
        card.className = 'package-card';
        card.innerHTML = `
            ${pkg.descuento > 0 ? `<div class="discount">-${(pkg.descuento * 100).toFixed(0)}%</div>` : ''}
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
    // 4. RENDERIZAR MÉTODOS DE PAGO
    // ==========================================
    const methodsGrid = document.getElementById('paymentMethodsGrid');
    Object.keys(metodosPago).forEach(key => {
        const metodo = metodosPago[key];
        const card = document.createElement('div');
        card.className = 'method-card';
        card.innerHTML = `
            <i class="${metodo.icono}" style="color: ${metodo.color}"></i>
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
    }

    // ==========================================
    // 5. LÓGICA DE CÁLCULO MANUAL
    // ==========================================
    const customAmountInput = document.getElementById('customAmount');
    customAmountInput.addEventListener('input', function() {
        const cantidad = parseFloat(this.value) || 0;
        
        // Buscar si coincide con un paquete para aplicar descuento
        const paqueteMatch = paquetes.find(p => p.cantidad === cantidad);
        let precioFinal = cantidad; // Sin descuento por defecto
        
        if (paqueteMatch) {
            precioFinal = cantidad * (1 - paqueteMatch.descuento);
            // Resaltar visualmente el paquete
            document.querySelectorAll('.package-card').forEach((c, index) => {
                c.classList.toggle('selected', paquetes[index].cantidad === cantidad);
            });
        } else {
            document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
        }
        
        actualizarTotales(precioFinal);
    });

    function actualizarTotales(precioUSD) {
        document.getElementById('totalUSD').textContent = precioUSD.toFixed(2);
        document.getElementById('totalVES').textContent = (precioUSD * TASA_BCV).toFixed(2);
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
        
        // Recopilar datos dinámicos del usuario
        const datosUsuario = {};
        metodosPago[metodoSeleccionado].camposUsuario.forEach(campo => {
            datosUsuario[campo.id] = document.getElementById(campo.id).value;
        });

        // Aquí iría la lógica de subida de imagen a Supabase Storage (si requiereArchivo es true)
        // let urlComprobante = null;
        // if (metodosPago[metodoSeleccionado].requiereArchivo) { ... }

        try {
            // SIMULACIÓN DE GUARDADO EN SUPABASE
            // const { data, error } = await db.from('solicitudes_deposito').insert({
            //     user_id: session.user.id,
            //     cantidad_monedas: cantidad,
            //     monto_usd: totalUSD,
            //     monto_bs: totalUSD * TASA_BCV,
            //     metodo_pago: metodoSeleccionado,
            //     datos_pago: datosUsuario,
            //     estado: 'pendiente',
            //     creado_en: new Date().toISOString()
            // });

            await new Promise(resolve => setTimeout(resolve, 2000)); // Simular red

            mostrarMensaje('✅ ¡Depósito reportado con éxito! Tu saldo se acreditará tras la validación (15-30 min).', 'success');
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
