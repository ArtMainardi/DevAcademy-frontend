import { apiClient } from "../../core/api-client.js";

/* =========================================================
   EDITAR CONTEÚDO
   GET /api/contents/{id}  → carrega os dados atuais
   PUT /api/contents/{id}  → { title, body, changeDescription, version }

   Autenticação: JWT, tratado pelo cliente HTTP compartilhado.
   O contrato do PUT exige também X-User-Id, que aqui NÃO é
   autenticação: é lido do módulo de sessão (fonte confiável),
   nunca da tela nem da URL. Quem decide se o usuário pode
   editar é o backend; um 401/403 é exibido, não contornado.
   ========================================================= */

const ENDPOINT = "/api/contents";
const DETAIL_PAGE = "../detail/index.html";
const SITE_NAME = "DevAcademy";

/* O contrato lista X-User-Id no PUT. Use false se o backend real não o exigir. */
const REQUIRES_USER_ID_HEADER = true;

/* Mesmo formato de ID da página de detalhe (inteiro ou UUID) */
const ID_PATTERN =
    /^(\d{1,19}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const elements = {
    region: document.querySelector("#edit-region"),
    loading: document.querySelector("#edit-loading"),
    error: document.querySelector("#edit-error"),
    errorText: document.querySelector("#edit-error-text"),
    retry: document.querySelector("#edit-retry"),
    notFound: document.querySelector("#edit-not-found"),
    form: document.querySelector("#edit-form"),

    message: document.querySelector("#edit-message"),
    conflict: document.querySelector("#edit-conflict"),
    reload: document.querySelector("#edit-reload"),

    version: document.querySelector("#edit-version"),
    title: document.querySelector("#edit-name"),
    titleError: document.querySelector("#edit-name-error"),
    body: document.querySelector("#edit-body"),
    bodyError: document.querySelector("#edit-body-error"),
    change: document.querySelector("#edit-change"),
    changeError: document.querySelector("#edit-change-error"),

    cancel: document.querySelector("#edit-cancel"),
    submit: document.querySelector("#edit-submit"),
    submitLabel: document.querySelector("#edit-submit-label")
};

const defaultSubmitLabel = elements.submitLabel.textContent.trim();

const state = {
    id: null,
    /* Versão recebida da API. É a que vai no PUT; o usuário não a altera. */
    version: null,
    original: { title: "", body: "" },
    requestId: 0,
    isSubmitting: false,
    isLocked: false,
    hasConflict: false
};

/* ---------------------------------------------------------
   Estados da tela
   --------------------------------------------------------- */
function showState(name) {
    const panels = {
        loading: elements.loading,
        error: elements.error,
        "not-found": elements.notFound,
        form: elements.form
    };

    for (const [key, panel] of Object.entries(panels)) {
        panel.hidden = key !== name;
    }

    elements.region.setAttribute(
        "aria-busy",
        name === "loading" ? "true" : "false"
    );
}

function showLoadError(error) {
    elements.errorText.textContent =
        error?.status === 401
            ? "Você precisa entrar na sua conta para editar conteúdos."
            : "Verifique sua conexão e tente novamente.";

    document.title = `Erro ao carregar | ${SITE_NAME}`;
    showState("error");
}

function showNotFound() {
    document.title = `Conteúdo não encontrado | ${SITE_NAME}`;
    showState("not-found");
}

/* ---------------------------------------------------------
   Mensagens e erros de campo
   --------------------------------------------------------- */
function showMessage(text, type = "error") {
    const isSuccess = type === "success";

    elements.message.textContent = text;
    elements.message.classList.toggle("content-form__notice--success", isSuccess);
    elements.message.setAttribute("role", isSuccess ? "status" : "alert");
    elements.message.hidden = false;

    if (!isSuccess) elements.message.focus();
}

function hideMessage() {
    elements.message.hidden = true;
    elements.message.textContent = "";
    elements.message.classList.remove("content-form__notice--success");
}

function setFieldError(input, errorElement, message) {
    errorElement.textContent = message;
    errorElement.hidden = false;
    input.setAttribute("aria-invalid", "true");
}

function clearFieldError(input, errorElement) {
    errorElement.textContent = "";
    errorElement.hidden = true;
    input.removeAttribute("aria-invalid");
}

function clearAllErrors() {
    clearFieldError(elements.title, elements.titleError);
    clearFieldError(elements.body, elements.bodyError);
    clearFieldError(elements.change, elements.changeError);
}

/* ---------------------------------------------------------
   Envio em andamento
   --------------------------------------------------------- */
function updateSubmitState() {
    const disabled = state.isSubmitting || state.isLocked || state.hasConflict;

    elements.submit.disabled = disabled;
    elements.submit.setAttribute("aria-disabled", String(disabled));
    elements.submitLabel.textContent = state.isSubmitting
        ? "Salvando…"
        : defaultSubmitLabel;
}

function setSubmitting(isSubmitting) {
    state.isSubmitting = isSubmitting;
    updateSubmitState();
}

/* Depois de salvar, o formulário não pode ser reenviado */
function lockForm() {
    state.isLocked = true;
    updateSubmitState();

    for (const control of [elements.title, elements.body, elements.change]) {
        control.disabled = true;
    }
}

function showConflict() {
    state.hasConflict = true;
    updateSubmitState();

    elements.conflict.hidden = false;
    elements.reload.focus();
}

function hideConflict() {
    state.hasConflict = false;
    elements.conflict.hidden = true;
    updateSubmitState();
}

/* ---------------------------------------------------------
   ID da URL
   --------------------------------------------------------- */
function getContentId() {
    const value = new URLSearchParams(window.location.search).get("id");
    const id = value ? value.trim() : "";

    return ID_PATTERN.test(id) ? id : null;
}

function buildDetailUrl(id) {
    return `${DETAIL_PAGE}?id=${encodeURIComponent(id)}`;
}

/* ---------------------------------------------------------
   Dados
   --------------------------------------------------------- */
async function fetchContent(id) {
    const content = await apiClient.get(
        `${ENDPOINT}/${encodeURIComponent(id)}`
    );

    /* Sem version não há como enviar o PUT no formato do contrato */
    if (
        !content ||
        typeof content !== "object" ||
        content.id == null ||
        !Number.isInteger(content.version)
    ) {
        throw new Error("Resposta inválida da API.");
    }

    return content;
}

/* Quem é o usuário autenticado: só do módulo de sessão.
   Se não for possível obter, devolve null e o envio é bloqueado. */
async function resolveTrustedUserId() {
    try {
        const session = await import("../../core/session.js");
        const id = await session.getCurrentUserId?.();

        return id == null || id === "" ? null : String(id);
    } catch {
        return null;
    }
}

/* ---------------------------------------------------------
   Carregamento e preenchimento
   --------------------------------------------------------- */
function fillForm(content) {
    const title = typeof content.title === "string" ? content.title : "";
    const body = typeof content.body === "string" ? content.body : "";

    elements.title.value = title;
    elements.body.value = body;
    elements.change.value = "";

    elements.version.textContent = String(content.version);

    state.version = content.version;
    state.original = { title: title.trim(), body: body.trim() };

    document.title = `Editar: ${title.trim() || "Sem título"} | ${SITE_NAME}`;
    elements.cancel.href = buildDetailUrl(state.id);
}

async function loadContent() {
    const requestId = ++state.requestId;

    showState("loading");

    let content;

    try {
        content = await fetchContent(state.id);
    } catch (error) {
        if (requestId !== state.requestId) return;

        /* Inexistente (404) ou sem acesso (403) */
        if (error?.status === 404 || error?.status === 403) {
            showNotFound();
        } else {
            showLoadError(error);
        }

        return;
    }

    if (requestId !== state.requestId) return;

    clearAllErrors();
    hideMessage();
    hideConflict();
    fillForm(content);
    showState("form");
}

/* ---------------------------------------------------------
   Validação e envio
   --------------------------------------------------------- */
function validate() {
    let firstInvalid = null;

    if (!elements.title.value.trim()) {
        setFieldError(elements.title, elements.titleError, "Informe um título.");
        firstInvalid ??= elements.title;
    }

    if (!elements.body.value.trim()) {
        setFieldError(
            elements.body,
            elements.bodyError,
            "Escreva o texto do conteúdo."
        );
        firstInvalid ??= elements.body;
    }

    return firstInvalid;
}

function hasChanges() {
    return (
        elements.title.value.trim() !== state.original.title ||
        elements.body.value.trim() !== state.original.body
    );
}

function buildPayload() {
    return {
        title: elements.title.value.trim(),
        body: elements.body.value.trim(),
        changeDescription: elements.change.value.trim(),
        version: state.version
    };
}

function getErrorMessage(error) {
    switch (error?.status) {
        case 400:
        case 422:
            return "Não foi possível salvar. Revise o título, o texto e a descrição da alteração e tente novamente.";
        case 401:
            return "Sua sessão expirou. Entre novamente para salvar as alterações.";
        case 403:
            return "Você não tem permissão para editar este conteúdo.";
        case 404:
            return "Este conteúdo não existe mais ou não está disponível para você.";
        case undefined:
            return "Não foi possível conectar. Verifique sua conexão e tente novamente.";
        default:
            return "Não foi possível salvar agora. Tente novamente em instantes.";
    }
}

async function handleSubmit(event) {
    event.preventDefault();

    if (state.isSubmitting || state.isLocked || state.hasConflict) return;

    hideMessage();
    clearAllErrors();

    const firstInvalid = validate();

    if (firstInvalid) {
        showMessage("Corrija os campos indicados e tente novamente.");
        firstInvalid.focus();
        return;
    }

    if (!hasChanges()) {
        showMessage("Nenhuma alteração no título ou no texto para salvar.");
        return;
    }

    setSubmitting(true);

    const requestOptions = {};

    if (REQUIRES_USER_ID_HEADER) {
        const userId = await resolveTrustedUserId();

        if (!userId) {
            setSubmitting(false);
            showMessage(
                "Não foi possível identificar sua conta. Entre novamente e tente de novo."
            );
            return;
        }

        requestOptions.headers = { "X-User-Id": userId };
    }

    try {
        await apiClient.put(
            `${ENDPOINT}/${encodeURIComponent(state.id)}`,
            buildPayload(),
            requestOptions
        );
    } catch (error) {
        setSubmitting(false);

        /* Versão desatualizada: outra edição foi salva antes */
        if (error?.status === 409) {
            showConflict();
            return;
        }

        /* 401 e 403 são mostrados como vieram, sem nova tentativa */
        showMessage(getErrorMessage(error));
        return;
    }

    lockForm();
    setSubmitting(false);
    showMessage("Alterações salvas. Abrindo o conteúdo…", "success");
    window.location.assign(buildDetailUrl(state.id));
}

/* ---------------------------------------------------------
   Eventos
   --------------------------------------------------------- */
elements.form.addEventListener("submit", handleSubmit);

elements.title.addEventListener("input", () => {
    clearFieldError(elements.title, elements.titleError);
});

elements.body.addEventListener("input", () => {
    clearFieldError(elements.body, elements.bodyError);
});

elements.change.addEventListener("input", () => {
    clearFieldError(elements.change, elements.changeError);
});

elements.reload.addEventListener("click", async () => {
    await loadContent();

    /* Se o conteúdo voltou, leva o foco ao início do formulário */
    if (!elements.form.hidden) elements.title.focus();
});

elements.retry.addEventListener("click", loadContent);

/* ---------------------------------------------------------
   Início
   --------------------------------------------------------- */
state.id = getContentId();

if (state.id) {
    loadContent();
} else {
    /* ID ausente ou em formato inválido: nem chega a consultar a API */
    showNotFound();
}