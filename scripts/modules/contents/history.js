import { apiClient } from "../../core/api-client.js";

/* =========================================================
   HISTÓRICO DE ALTERAÇÕES
   Endpoint: GET /api/contents/{id}/history
   Campos lidos de cada item: changedAt, changedByName, description

   Autenticação: JWT, tratado pelo cliente HTTP compartilhado.
   O contrato lista X-User-Id neste endpoint. Ele NÃO é
   autenticação: vem do módulo de sessão (fonte confiável),
   nunca da tela nem da URL. Quem autoriza é o backend.
   ========================================================= */

const ENDPOINT = "/api/contents";
const DETAIL_PAGE = "../detail/index.html";
const SITE_NAME = "DevAcademy";

/* O contrato lista X-User-Id neste endpoint. Use false se o backend real não o exigir. */
const REQUIRES_USER_ID_HEADER = true;

/* Mesmo formato de ID da página de detalhe (inteiro ou UUID) */
const ID_PATTERN =
    /^(\d{1,19}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
});

const elements = {
    back: document.querySelector("#history-back"),
    region: document.querySelector("#history-region"),
    loading: document.querySelector("#history-loading"),
    error: document.querySelector("#history-error"),
    errorText: document.querySelector("#history-error-text"),
    retry: document.querySelector("#history-retry"),
    notFound: document.querySelector("#history-not-found"),
    empty: document.querySelector("#history-empty"),
    list: document.querySelector("#history-list"),
    itemTemplate: document.querySelector("#history-item-template")
};

const state = {
    id: null,
    requestId: 0
};

/* ---------------------------------------------------------
   Estados da tela
   --------------------------------------------------------- */
function showState(name) {
    const panels = {
        loading: elements.loading,
        error: elements.error,
        "not-found": elements.notFound,
        empty: elements.empty,
        list: elements.list
    };

    for (const [key, panel] of Object.entries(panels)) {
        panel.hidden = key !== name;
    }

    elements.region.setAttribute(
        "aria-busy",
        name === "loading" ? "true" : "false"
    );
}

function showError(message) {
    elements.errorText.textContent = message;
    document.title = `Erro ao carregar | ${SITE_NAME}`;
    showState("error");
}

function getLoadErrorMessage(error) {
    return error?.status === 401
        ? "Você precisa entrar na sua conta para ver o histórico."
        : "Verifique sua conexão e tente novamente.";
}

function showNotFound() {
    document.title = `Histórico indisponível | ${SITE_NAME}`;
    showState("not-found");
}

/* ---------------------------------------------------------
   ID da URL
   --------------------------------------------------------- */
function getContentId() {
    const value = new URLSearchParams(window.location.search).get("id");
    const id = value ? value.trim() : "";

    return ID_PATTERN.test(id) ? id : null;
}

/* ---------------------------------------------------------
   Dados
   --------------------------------------------------------- */
/* Quem é o usuário autenticado: só do módulo de sessão.
   Se não for possível obter, devolve null e a consulta não é feita. */
async function resolveTrustedUserId() {
    try {
        const session = await import("../../core/session.js");
        const id = await session.getCurrentUserId?.();

        return id == null || id === "" ? null : String(id);
    } catch {
        return null;
    }
}

async function fetchHistory(id, userId) {
    const options = {};

    if (REQUIRES_USER_ID_HEADER) {
        options.headers = { "X-User-Id": userId };
    }

    const data = await apiClient.get(
        `${ENDPOINT}/${encodeURIComponent(id)}/history`,
        options
    );

    /* Lista simples. Uma página Spring (data.content) também é aceita. */
    const entries = Array.isArray(data) ? data : data?.content;

    if (!Array.isArray(entries)) {
        throw new Error("Resposta inválida da API.");
    }

    return entries.filter(entry => entry && typeof entry === "object");
}

/* ---------------------------------------------------------
   Formatação
   --------------------------------------------------------- */
function parseDate(value) {
    if (!value) return null;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

/* ---------------------------------------------------------
   Renderização
   --------------------------------------------------------- */
function createItem(entry) {
    const fragment = elements.itemTemplate.content.cloneNode(true);
    const field = name => fragment.querySelector(`[data-field="${name}"]`);

    const time = field("date");
    const date = parseDate(entry.changedAt);

    if (date) {
        time.dateTime = date.toISOString();
        time.textContent = dateFormatter.format(date);
    } else {
        time.closest(".content-history__header").remove();
    }

    /* Sem descrição na API, não exibe nada no lugar */
    const description = field("description");
    const descriptionText =
        typeof entry.description === "string" ? entry.description.trim() : "";

    if (descriptionText) {
        description.textContent = descriptionText;
    } else {
        description.remove();
    }

    field("author").textContent =
        typeof entry.changedByName === "string" && entry.changedByName.trim()
            ? entry.changedByName.trim()
            : "autor não informado";

    return fragment;
}

function renderHistory(entries) {
    elements.list.replaceChildren(...entries.map(createItem));
}

/* ---------------------------------------------------------
   Carregamento
   --------------------------------------------------------- */
async function loadHistory() {
    const requestId = ++state.requestId;

    showState("loading");

    let userId = null;

    if (REQUIRES_USER_ID_HEADER) {
        userId = await resolveTrustedUserId();

        if (requestId !== state.requestId) return;

        if (!userId) {
            showError(
                "Não foi possível identificar sua conta. Entre novamente e tente de novo."
            );
            return;
        }
    }

    let entries;

    try {
        entries = await fetchHistory(state.id, userId);
    } catch (error) {
        if (requestId !== state.requestId) return;

        /* Inexistente (404) ou sem acesso (403): não há tentativa de contornar */
        if (error?.status === 404 || error?.status === 403) {
            showNotFound();
        } else {
            showError(getLoadErrorMessage(error));
        }

        return;
    }

    if (requestId !== state.requestId) return;

    document.title = `Histórico de alterações | ${SITE_NAME}`;

    if (entries.length === 0) {
        showState("empty");
        return;
    }

    /* Mantém a ordem em que a API entregou */
    renderHistory(entries);
    showState("list");
}

/* ---------------------------------------------------------
   Eventos
   --------------------------------------------------------- */
elements.retry.addEventListener("click", loadHistory);

/* ---------------------------------------------------------
   Início
   --------------------------------------------------------- */
state.id = getContentId();

if (state.id) {
    elements.back.href = `${DETAIL_PAGE}?id=${encodeURIComponent(state.id)}`;
    loadHistory();
} else {
    /* ID ausente ou em formato inválido: nem chega a consultar a API */
    showNotFound();
}