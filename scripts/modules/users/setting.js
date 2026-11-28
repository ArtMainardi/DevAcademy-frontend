import { httpClient } from '../../core/http.js';
import { getAuthenticatedUserId } from '../../core/auth.js';

const elements = {
    loading: document.getElementById('settings-loading'),
    content: document.getElementById('settings-content'),
    messageBox: document.getElementById('settings-message'),
    messageText: document.getElementById('settings-message-text'),
    form: document.getElementById('settings-form'),
    notificationPreferenceInput: document.getElementById('notification-preference'),
    saveButton: document.getElementById('save-settings-btn'),
    saveSpinner: document.getElementById('save-settings-spinner'),
    saveLabel: document.getElementById('save-settings-label')
};

let authenticatedUserId = null;
let isSubmitting = false;

function hideMessage() {
    if (!elements.messageBox || !elements.messageText) return;
    elements.messageBox.hidden = true;
    elements.messageText.textContent = '';
    elements.messageBox.classList.remove('alert-success', 'alert-warning', 'alert-error');
}

function showMessage(message, type = 'error') {
    if (!elements.messageBox || !elements.messageText) return;

    elements.messageBox.classList.remove('alert-success', 'alert-warning', 'alert-error');

    if (type === 'success') {
        elements.messageBox.classList.add('alert-success');
        elements.messageBox.setAttribute('role', 'status');
        elements.messageBox.setAttribute('aria-live', 'polite');
    } else if (type === 'warning') {
        elements.messageBox.classList.add('alert-warning');
        elements.messageBox.setAttribute('role', 'alert');
        elements.messageBox.setAttribute('aria-live', 'assertive');
    } else {
        elements.messageBox.classList.add('alert-error');
        elements.messageBox.setAttribute('role', 'alert');
        elements.messageBox.setAttribute('aria-live', 'assertive');
    }

    elements.messageText.textContent = message;
    elements.messageBox.hidden = false;
}

function showLoading() {
    if (elements.loading) elements.loading.hidden = false;
    if (elements.content) elements.content.hidden = true;
    hideMessage();
}

function showContent() {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.content) elements.content.hidden = false;
}

function setSubmittingState(submitting) {
    isSubmitting = submitting;

    if (elements.saveButton) {
        elements.saveButton.disabled = submitting;
        elements.saveButton.classList.toggle('is-loading', submitting);
    }

    if (elements.saveSpinner) {
        elements.saveSpinner.hidden = !submitting;
    }

    if (elements.saveLabel) {
        elements.saveLabel.textContent = submitting ? 'Salvando...' : 'Salvar configurações';
    }
}

function populateSettings(settings) {
    if (!elements.notificationPreferenceInput) return;

    const value =
        typeof settings?.notificationPreferences === 'string'
            ? settings.notificationPreferences
            : '';

    elements.notificationPreferenceInput.value = value;
}

async function loadSettings() {
    showLoading();

    const userId = getAuthenticatedUserId();

    if (userId === null || userId === undefined || String(userId).trim() === '') {
        if (elements.loading) elements.loading.hidden = true;
        showMessage(
            'Configuração pendente: não foi possível identificar o usuário autenticado. Faça login novamente ou verifique a configuração de sessão.',
            'warning'
        );
        return;
    }

    authenticatedUserId = String(userId).trim();

    try {
        const encodedId = encodeURIComponent(authenticatedUserId);
        const settings = await httpClient.get(`/api/users/${encodedId}/settings`);

        if (!settings || typeof settings !== 'object') {
            throw new Error('Resposta inválida ao carregar as configurações do usuário.');
        }

        populateSettings(settings);
        showContent();
    } catch (error) {
        if (elements.loading) elements.loading.hidden = true;
        const message =
            error instanceof Error && error.message
                ? error.message
                : 'Não foi possível carregar as configurações. Tente novamente mais tarde.';
        showMessage(message, 'error');
    }
}

async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
        return;
    }

    hideMessage();

    if (!authenticatedUserId) {
        showMessage(
            'Sessão inválida: não foi possível identificar o usuário autenticado.',
            'warning'
        );
        return;
    }

    const notificationPreferences = elements.notificationPreferenceInput
        ? elements.notificationPreferenceInput.value.trim()
        : '';

    if (!notificationPreferences) {
        showMessage('Informe a preferência de notificações.', 'error');
        if (elements.notificationPreferenceInput) {
            elements.notificationPreferenceInput.focus();
        }
        return;
    }

    const payload = {
        notificationPreferences
    };

    setSubmittingState(true);

    try {
        const encodedId = encodeURIComponent(authenticatedUserId);
        const updated = await httpClient.patch(`/api/users/${encodedId}/settings`, payload);

        if (updated && typeof updated === 'object' && 'notificationPreferences' in updated) {
            populateSettings(updated);
        }

        showMessage('Configurações atualizadas com sucesso.', 'success');
    } catch (error) {
        const message =
            error instanceof Error && error.message
                ? error.message
                : 'Não foi possível salvar as configurações. Tente novamente.';
        showMessage(message, 'error');
    } finally {
        setSubmittingState(false);
    }
}

function bindEvents() {
    if (elements.form) {
        elements.form.addEventListener('submit', handleSubmit);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadSettings();
});