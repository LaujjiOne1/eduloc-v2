// scripts/odoo-integration.js

/**
 * Mise à jour du statut de paiement dans Odoo CRM
 * SEC-02: Les secrets API sont stockés côté serveur uniquement
 */
async function updateOdooPaymentStatus(paymentData) {
    const response = await fetch('/api/odoo/update-payment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getServerToken()}` // SEC-02
        },
        body: JSON.stringify({
            // Données autorisées dans Odoo
            reservation_id: paymentData.transaction_id,
            payment_status: paymentData.status,
            payment_method: paymentData.payment_method,
            amount: paymentData.amount,
            currency: 'MGA',
            transaction_reference: paymentData.transaction_id,
            timestamp: paymentData.timestamp,
            
            // Restrictions:
            // - NO card_full_number
            // - NO cvv
            // - NO mobile_money_pin
            // - NO api_secrets
        })
    });
    
    if (!response.ok) {
        console.error('Failed to update Odoo CRM');
        // Log error but don't expose details to client
        await logSecurityEvent('ODOO_UPDATE_FAILED', {
            transaction_id: paymentData.transaction_id,
            timestamp: new Date().toISOString()
        });
    }
    
    return response.json();
}

/**
 * Journalisation sécurisée des événements
 * SEC-10: Journaliser sans données sensibles
 */
async function logSecurityEvent(eventType, data) {
    await fetch('/api/security/log', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            event_type: eventType,
            timestamp: new Date().toISOString(),
            // SEC-10: Never log sensitive data
            data: sanitizeForLogging(data)
        })
    });
}

function sanitizeForLogging(data) {
    const sanitized = { ...data };
    
    // Remove sensitive fields
    delete sanitized.cvv;
    delete sanitized.card_number;
    delete sanitized.pin;
    delete sanitized.secret_key;
    delete sanitized.api_key;
    
    // Mask phone numbers
    if (sanitized.phone_number) {
        sanitized.phone_number = sanitized.phone_number.replace(/(\d{2})\d{4}(\d{2})/, '$1****$2');
    }
    
    // Mask card numbers
    if (sanitized.card_last_four) {
        sanitized.card_number = `****-****-****-${sanitized.card_last_four}`;
    }
    
    return sanitized;
}

/**
 * CSRF Token Protection
 * SEC-04: Authentification des requêtes
 */
function getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || '';
}

function getServerToken() {
    // Token obtenu après authentification serveur
    return sessionStorage.getItem('server_auth_token');
}

/**
 * Gestion des erreurs de paiement
 */
function showError(message) {
    // Afficher une notification d'erreur
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.innerHTML = `
        <div class="error-content">
            <span class="error-icon">️</span>
            <span class="error-message">${escapeHtml(message)}</span>
        </div>
        <button onclick="this.parentElement.remove()" class="close-error">×</button>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}