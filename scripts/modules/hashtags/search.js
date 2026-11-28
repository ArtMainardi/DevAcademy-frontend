import { httpClient } from '../../core/http.js';

const SUGGEST_DEBOUNCE_MS = 300;

const elements = {
    form: document.getElementById('hashtag-search-form'),
    input: document.getElementById('hashtag-search-input'),
    submitButton: document.getElementById('hashtag-search-submit'),
    clearButton: document.getElementById('hashtag-search-clear'),
    suggestionsList: document.getElementById('hashtag-suggestions-list'),
    messageBox: document.getElementById('hashtag-search-message'),
    messageText: document.getElementById('hashtag-search-message-text'),
    loading: document.getElementById('hashtag-search-loading'),
    empty: document.getElementById('hashtag-search-empty'),
    resultsContainer: document.getElementById('hashtag-search-results'),
    resultsCount: document.getElementById('hashtag-search-results-count'),
    resultsList: document.getElementById('hashtag-search-results-list'),
    searchWrapper: document.querySelector('.hashtag-search')
};

let suggestTimerId = null;
let lastSuggestedPrefix = '';
let lastSearchedQuery = '';
let suggestRequestSeq = 0;
let searchRequestSeq = 0;
let isSearching = false;

function hideMessage() {
    if (!elements.messageBox || !elements.messageText) return;
    elements.messageBox.hidden = true;
    elements.messageText.textContent = '';
    elements.messageBox.classList.remove('alert-error', 'alert-warning', 'alert-success');
}

function showError(message) {
    if (!elements.messageBox || !elements.messageText) return;
    elements.messageBox.classList.remove('alert-warning', 'alert-success');
    elements.messageBox.classList.add('alert-error');
    elements.messageText.textContent = message;
    elements.messageBox.hidden = false;
}

function setExpanded(expanded) {
    if (elements.input) {
        elements.input.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
}

function hideSuggestions() {
    if (elements.suggestionsList) {
        elements.suggestionsList.hidden = true;
        elements.suggestionsList.replaceChildren();
    }
    setExpanded(false);
}

function updateClearButton() {
    if (!elements.clearButton || !elements.input) return;
    elements.clearButton.hidden = elements.input.value.trim().length === 0;
}

function showLoading() {
    if (elements.loading) elements.loading.hidden = false;
    if (elements.empty) elements.empty.hidden = true;
    if (elements.resultsContainer) elements.resultsContainer.hidden = true;
    hideMessage();
}

function showEmpty() {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.empty) elements.empty.hidden = false;
    if (elements.resultsContainer) elements.resultsContainer.hidden = true;
}

function showResults() {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.empty) elements.empty.hidden = true;
    if (elements.resultsContainer) elements.resultsContainer.hidden = false;
}

function resetSearchDisplay() {
    if (elements.loading) elements.loading.hidden = true;
    if (elements.empty) elements.empty.hidden = true;
    if (elements.resultsContainer) elements.resultsContainer.hidden = true;
    if (elements.resultsList) elements.resultsList.replaceChildren();
    if (elements.resultsCount) elements.resultsCount.textContent = '';
    lastSearchedQuery = '';
    hideMessage();
}

function createHashtagTagElement(hashtag) {
    const tag = document.createElement('span');
    tag.className = 'hashtag-tag';

    if (hashtag?.id !== null && hashtag?.id !== undefined) {
        tag.dataset.hashtagId = String(hashtag.id);
    }

    const label = document.createElement('span');
    label.className = 'hashtag-tag-label';
    label.textContent = typeof hashtag?.name === 'string' ? hashtag.name : '';

    tag.appendChild(label);
    return tag;
}

function renderSuggestions(suggestions) {
    if (!elements.suggestionsList) return;

    elements.suggestionsList.replaceChildren();

    if (suggestions.length === 0) {
        hideSuggestions();
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const hashtag of suggestions) {
        const name = typeof hashtag?.name === 'string' ? hashtag.name.trim() : '';
        if (!name) continue;

        const item = document.createElement('li');
        item.className = 'hashtag-suggestion-item';
        item.setAttribute('role', 'option');

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'hashtag-suggestion-btn';

        const tag = createHashtagTagElement(hashtag);
        button.appendChild(tag);

        button.addEventListener('click', () => {
            if (elements.input) {
                elements.input.value = name;
            }
            updateClearButton();
            hideSuggestions();
            executeSearch(name);
        });

        item.appendChild(button);
        fragment.appendChild(item);
    }

    if (fragment.childElementCount === 0) {
        hideSuggestions();
        return;
    }

    elements.suggestionsList.appendChild(fragment);
    elements.suggestionsList.hidden = false;
    setExpanded(true);
}

function renderSearchResults(results) {
    if (!elements.resultsList) return;

    elements.resultsList.replaceChildren();

    if (results.length === 0) {
        showEmpty();
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const hashtag of results) {
        const item = document.createElement('li');
        item.className = 'hashtag-result-item';

        const info = document.createElement('div');
        info.className = 'hashtag-result-info';

        const tag = createHashtagTagElement(hashtag);
        info.appendChild(tag);

        item.appendChild(info);
        fragment.appendChild(item);
    }

    elements.resultsList.appendChild(fragment);

    if (elements.resultsCount) {
        const total = results.length;
        elements.resultsCount.textContent =
            total === 1 ? '1 hashtag encontrada' : `${total} hashtags encontradas`;
    }

    showResults();
}

async function fetchSuggestions(prefix) {
    const trimmed = prefix.trim();
    if (!trimmed) {
        hideSuggestions();
        return;
    }

    if (trimmed === lastSuggestedPrefix) {
        return;
    }

    lastSuggestedPrefix = trimmed;
    const currentSeq = ++suggestRequestSeq;

    try {
        const params = new URLSearchParams({ prefix: trimmed });
        const response = await httpClient.get(`/api/hashtags/suggest?${params.toString()}`);

        if (currentSeq !== suggestRequestSeq) {
            return;
        }

        if (!Array.isArray(response)) {
            hideSuggestions();
            return;
        }

        renderSuggestions(response);
    } catch {
        if (currentSeq === suggestRequestSeq) {
            hideSuggestions();
        }
    }
}

export async function executeSearch(rawQuery) {
    const query = rawQuery.trim();

    if (!query) {
        resetSearchDisplay();
        return;
    }

    if (isSearching && query === lastSearchedQuery) {
        return;
    }

    isSearching = true;
    lastSearchedQuery = query;
    const currentSeq = ++searchRequestSeq;

    if (elements.submitButton) {
        elements.submitButton.disabled = true;
    }

    hideSuggestions();
    showLoading();

    try {
        const params = new URLSearchParams({ query });
        const response = await httpClient.get(`/api/hashtags/search?${params.toString()}`);

        if (currentSeq !== searchRequestSeq) {
            return;
        }

        if (!Array.isArray(response)) {
            throw new Error('Resposta inválida ao buscar hashtags.');
        }

        renderSearchResults(response);
    } catch (error) {
        if (currentSeq !== searchRequestSeq) {
            return;
        }

        if (elements.loading) elements.loading.hidden = true;
        if (elements.empty) elements.empty.hidden = true;
        if (elements.resultsContainer) elements.resultsContainer.hidden = true;

        const message =
            error instanceof Error && error.message
                ? error.message
                : 'Não foi possível realizar a busca de hashtags. Tente novamente.';
        showError(message);
    } finally {
        if (currentSeq === searchRequestSeq) {
            isSearching = false;
            if (elements.submitButton) {
                elements.submitButton.disabled = false;
            }
        }
    }
}

function handleInput() {
    if (!elements.input) return;

    updateClearButton();

    const value = elements.input.value.trim();

    if (suggestTimerId !== null) {
        window.clearTimeout(suggestTimerId);
        suggestTimerId = null;
    }

    if (!value) {
        lastSuggestedPrefix = '';
        hideSuggestions();
        resetSearchDisplay();
        return;
    }

    suggestTimerId = window.setTimeout(() => {
        suggestTimerId = null;
        fetchSuggestions(value);
    }, SUGGEST_DEBOUNCE_MS);
}

function handleSubmit(event) {
    event.preventDefault();

    if (!elements.input) return;

    if (suggestTimerId !== null) {
        window.clearTimeout(suggestTimerId);
        suggestTimerId = null;
    }

    const query = elements.input.value.trim();

    if (!query) {
        hideSuggestions();
        resetSearchDisplay();
        return;
    }

    executeSearch(query);
}

function handleClear() {
    if (suggestTimerId !== null) {
        window.clearTimeout(suggestTimerId);
        suggestTimerId = null;
    }

    if (elements.input) {
        elements.input.value = '';
        elements.input.focus();
    }

    lastSuggestedPrefix = '';
    updateClearButton();
    hideSuggestions();
    resetSearchDisplay();
}

function handleDocumentClick(event) {
    if (!elements.searchWrapper) return;
    if (!elements.searchWrapper.contains(event.target)) {
        hideSuggestions();
    }
}

function handleInputKeydown(event) {
    if (event.key === 'Escape') {
        hideSuggestions();
    }
}

function bindEvents() {
    if (elements.input) {
        elements.input.addEventListener('input', handleInput);
        elements.input.addEventListener('keydown', handleInputKeydown);
    }

    if (elements.form) {
        elements.form.addEventListener('submit', handleSubmit);
    }

    if (elements.clearButton) {
        elements.clearButton.addEventListener('click', handleClear);
    }

    document.addEventListener('click', handleDocumentClick);
}

document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    updateClearButton();
});