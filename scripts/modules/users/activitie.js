import { httpClient } from '../../core/http.js';
import { getAuthenticatedUserId } from '../../core/auth.js';

const elements = {
    loading: document.getElementById('activities-loading'),
    empty: document.getElementById('activities-empty'),
    content: document.getElementById('activities-content'),
    list: document.getElementById('activities-list'),
    messageBox: document.getElementById('activities-message'),
    messageText: document.getElementById('activities-message-text')
};

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short'
});

function hideMessage() {
    if (!elements.messageBox || !elements.messageText) return;
    elements.messageBox.hidden = true;
    elements.messageText.textContent = '';
    elements.messageBox.classList.remove('alert-success', 'alert-warning', 'alert-error');
}

function showMessage(message, type = 'error') {
    if (!elements.messageBox || !elements.messageText) return;

    elements.messageBox.classList.remove('alert-success', 'alert-warning', 'alert-error');

    if (type === 'warning') {
        elements.messageBox.classList.add('alert-warning');
    } else {
        elements.messageBox.classList.add('alert-error');
    }

    elements.messageText.textContent = message;
    elements.messageBox.hidden = false;
}

function showLoading() {
    if (elements.loading) elements.loading.hidden = false;
    if (elements.empty) elements.empty.hidden = true;
    if (elements.content) elements.content.hidden = true;
    hideMessage();
}

function showEmpty() {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.empty) elements.empty.hidden = false;
    if (elements.content) elements.content.hidden = true;
}

function showContent() {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.empty) elements.empty.hidden = true;
    if (elements.content) elements.content.hidden = false;
}

function hideAllSections() {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.empty) elements.empty.hidden = true;
    if (elements.content) elements.content.hidden = true;
}

function formatDate(value) {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return typeof value === 'string' ? value : '';
    }

    return dateFormatter.format(date);
}

function createActivityItem(activity) {
    const item = document.createElement('li');
    item.className = 'user-activity-item';

    const header = document.createElement('div');
    header.className = 'user-activity-header';

    const typeElement = document.createElement('span');
    typeElement.className = 'user-activity-type';
    typeElement.textContent =
        typeof activity?.activityType === 'string' ? activity.activityType : '';

    const dateElement = document.createElement('time');
    dateElement.className = 'user-activity-date';
    if (typeof activity?.createdAt === 'string' && activity.createdAt.trim() !== '') {
        dateElement.dateTime = activity.createdAt;
    }
    dateElement.textContent = formatDate(activity?.createdAt);

    header.append(typeElement, dateElement);

    const descriptionElement = document.createElement('p');
    descriptionElement.className = 'user-activity-description';
    descriptionElement.textContent =
        typeof activity?.description === 'string' ? activity.description : '';

    item.append(header, descriptionElement);

    return item;
}

function renderActivities(activities) {
    if (!elements.list) return;

    elements.list.replaceChildren();

    if (activities.length === 0) {
        showEmpty();
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const activity of activities) {
        fragment.appendChild(createActivityItem(activity));
    }

    elements.list.appendChild(fragment);
    showContent();
}

async function loadActivities() {
    showLoading();

    const userId = getAuthenticatedUserId();

    if (userId === null || userId === undefined || String(userId).trim() === '') {
        hideAllSections();
        showMessage(
            'Configuração pendente: não foi possível identificar o usuário autenticado. Faça login novamente ou verifique a configuração de sessão.',
            'warning'
        );
        return;
    }

    try {
        const encodedId = encodeURIComponent(String(userId).trim());
        const response = await httpClient.get(`/api/users/${encodedId}/activities`);

        if (!Array.isArray(response)) {
            throw new Error('Resposta inválida ao carregar as atividades do usuário.');
        }

        renderActivities(response);
    } catch (error) {
        hideAllSections();
        const message =
            error instanceof Error && error.message
                ? error.message
                : 'Não foi possível carregar as atividades. Tente novamente mais tarde.';
        showMessage(message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadActivities();
});