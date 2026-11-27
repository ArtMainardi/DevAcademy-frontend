import { apiClient } from "../../core/api-client.js";

/* =========================================================
   CRIAR CONTEÚDO
   Endpoint: POST /api/contents
   Corpo: { title, body, published, hashtags }

   Autenticação: responsabilidade do cliente HTTP compartilhado
   (JWT). O X-User-Id NÃO é autenticação e, por padrão, não é
   enviado, porque o contrato do POST não o lista.
   ========================================================= */

const ENDPOINT = "/api/contents";
const DETAIL_PAGE = "../detail/index.html";

/* Mude para true somente se o backend real exigir X-User-Id no POST.
   O valor vem do módulo de sessão, nunca de um campo da tela. */
const REQUIRES_USER_ID_HEADER = false;

/* Mesmo formato de ID usado na página de detalhe (inteiro ou UUID) */
const ID_PATTERN =
    /^(\d{1,19}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const elements = {
    form: document.querySelector("#create-form"),
    message: document.querySelector("#create-message"),

    title: document.querySelector("#create-name"),
    titleError: document.querySelector("#create-name-error"),
    body: document.querySelector("#create-body"),
    bodyError: document.querySelector("#create-body-error"),

    hashtagsBox: document.querySelector("#create-hashtags-box"),
    hashtagsInput: document.querySelector("#create-hashtags"),
    hashtagsError: document.querySelector("#create-hashtags-error"),
    hashtagsStatus: document.querySelector("#create-hashtags-status"),
    hashtagTemplate: document.querySelector("#create-hashtag-template"),

    published: document.querySelector("#create-published"),
    cancel: document.querySelector("#create-cancel"),
    submit: document.querySelector("#create-submit"),
    submitLabel: document.querySelector("#create-submit-label")
};

const defaultSubmitLabel = elements.submitLabel.textContent.trim();

const state = {
    hashtags: [],
    isSubmitting: false,
    isLocked: false
};

/* ---------------------------------------------------------
   Mensagens
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
    clearFieldError(elements.hashtagsInput, elements.hashtagsError);
}

/* ---------------------------------------------------------
   Envio em andamento
   --------------------------------------------------------- */
function setSubmitting(isSubmitting) {
    state.isSubmitting = isSubmitting;

    elements.submit.disabled = isSubmitting || state.isLocked;
    elements.submit.setAttribute(
        "aria-disabled",
        String(isSubmitting || state.isLocked)
    );
    elements.submitLabel.textContent = isSubmitting
        ? "Salvando…"
        : defaultSubmitLabel;
}

/* Depois de salvo, o formulário não pode ser enviado de novo,
   para não criar o mesmo conteúdo duas vezes. */
function lockForm() {
    state.isLocked = true;

    elements.submit.disabled = true;
    elements.submit.setAttribute("aria-disabled", "true");

    for (const control of [
        elements.title,
        elements.body,
        elements.hashtagsInput,
        elements.published
    ]) {
        control.disabled = true;
    }
}

/* ---------------------------------------------------------
   Hashtags
   --------------------------------------------------------- */
function normalizeTag(raw) {
    return raw.trim().replace(/^#+/, "").trim();
}

/* Devolve { ok: true } ou { ok: false, message } */
function addHashtag(raw) {
    const tag = normalizeTag(raw);

    if (!tag) return { ok: true };

    if (/[\s,#]/.test(tag)) {
        return {
            ok: false,
            message: "Cada hashtag deve ser uma palavra única, sem espaços."
        };
    }

    const alreadyAdded = state.hashtags.some(
        existing => existing.toLowerCase() === tag.toLowerCase()
    );

    if (alreadyAdded) {
        return { ok: false, message: `A hashtag “${tag}” já foi adicionada.` };
    }

    state.hashtags.push(tag);
    renderHashtags();
    elements.hashtagsStatus.textContent = `Hashtag ${tag} adicionada.`;

    return { ok: true };
}

function removeHashtag(tag) {
    state.hashtags = state.hashtags.filter(existing => existing !== tag);
    renderHashtags();
    elements.hashtagsStatus.textContent = `Hashtag ${tag} removida.`;
    elements.hashtagsInput.focus();
}

function renderHashtags() {
    for (const chip of elements.hashtagsBox.querySelectorAll(".hashtag--removable")) {
        chip.remove();
    }

    for (const tag of state.hashtags) {
        const fragment = elements.hashtagTemplate.content.cloneNode(true);
        const remove = fragment.querySelector('[data-field="remove"]');

        fragment.querySelector('[data-field="tag"]').textContent = tag;
        remove.setAttribute("aria-label", `Remover hashtag ${tag}`);
        remove.addEventListener("click", () => removeHashtag(tag));

        elements.hashtagsBox.insertBefore(fragment, elements.hashtagsInput);
    }
}

/* Transforma o texto digitado em hashtags. Mostra o erro, se houver. */
function commitHashtagText(text) {
    const result = addHashtag(text);

    if (!result.ok) {
        setFieldError(elements.hashtagsInput, elements.hashtagsError, result.message);
    }

    return result.ok;
}

elements.hashtagsInput.addEventListener("keydown", event => {
    const input = elements.hashtagsInput;

    if (event.key === "Enter" || event.key === ",") {
        /* Enter aqui adiciona a hashtag, não envia o formulário */
        event.preventDefault();

        if (commitHashtagText(input.value)) input.value = "";
        return;
    }

    if (event.key === "Backspace" && input.value === "" && state.hashtags.length > 0) {
        removeHashtag(state.hashtags[state.hashtags.length - 1]);
    }
});

elements.hashtagsInput.addEventListener("input", () => {
    clearFieldError(elements.hashtagsInput, elements.hashtagsError);

    const input = elements.hashtagsInput;

    /* Texto colado com vírgulas vira várias hashtags */
    if (input.value.includes(",")) {
        const parts = input.value.split(",");
        const rest = parts.pop();

        for (const part of parts) {
            if (!commitHashtagText(part)) break;
        }

        input.value = rest;
    }
});

elements.hashtagsBox.addEventListener("click", event => {
    if (event.target === elements.hashtagsBox) elements.hashtagsInput.focus();
});

/* ---------------------------------------------------------
   Validação
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

    /* Hashtag digitada e ainda não confirmada entra junto no envio */
    const pending = elements.hashtagsInput.value;

    if (pending.trim()) {
        if (commitHashtagText(pending)) {
            elements.hashtagsInput.value = "";
        } else {
            firstInvalid ??= elements.hashtagsInput;
        }
    }

    return firstInvalid;
}

/* ---------------------------------------------------------
   Envio
   --------------------------------------------------------- */
function buildPayload() {
    return {
        title: elements.title.value.trim(),
        body: elements.body.value.trim(),
        published: elements.published.checked,
        hashtags: [...state.hashtags]
    };
}

/* X-User-Id só de fonte confiável (sessão), nunca de um campo editável */
async function resolveTrustedUserId() {
    try {
        const session = await import("../../core/session.js");
        const id = await session.getCurrentUserId?.();

        return id == null || id === "" ? null : String(id);
    } catch {
        return null;
    }
}

async function buildRequestOptions() {
    if (!REQUIRES_USER_ID_HEADER) return {};

    const userId = await resolveTrustedUserId();

    if (!userId) return null;

    return { headers: { "X-User-Id": userId } };
}

function getErrorMessage(error) {
    switch (error?.status) {
        case 400:
        case 422:
            return "Não foi possível salvar. Revise o título, o texto e as hashtags e tente novamente.";
        case 401:
            return "Sua sessão expirou. Entre novamente para salvar o conteúdo.";
        case 403:
            return "Você não tem permissão para criar conteúdos.";
        case undefined:
            return "Não foi possível conectar. Verifique sua conexão e tente novamente.";
        default:
            return "Não foi possível salvar o conteúdo agora. Tente novamente em instantes.";
    }
}

function openCreatedContent(created) {
    const id = created?.id == null ? "" : String(created.id);

    if (ID_PATTERN.test(id)) {
        showMessage("Conteúdo salvo. Abrindo…", "success");
        window.location.assign(`${DETAIL_PAGE}?id=${encodeURIComponent(id)}`);
        return;
    }

    /* Salvou, mas a resposta não trouxe um ID utilizável */
    showMessage(
        "Conteúdo salvo, mas não foi possível abri-lo automaticamente. Encontre-o em Explorar conteúdos.",
        "success"
    );
    elements.cancel.textContent = "Ir para explorar";
}

async function handleSubmit(event) {
    event.preventDefault();

    if (state.isSubmitting || state.isLocked) return;

    hideMessage();
    clearFieldError(elements.title, elements.titleError);
    clearFieldError(elements.body, elements.bodyError);
    clearFieldError(elements.hashtagsInput, elements.hashtagsError);

    const firstInvalid = validate();

    if (firstInvalid) {
        showMessage("Corrija os campos indicados e tente novamente.");
        firstInvalid.focus();
        return;
    }

    setSubmitting(true);

    const requestOptions = await buildRequestOptions();

    if (requestOptions === null) {
        setSubmitting(false);
        showMessage("Não foi possível identificar sua conta. Entre novamente e tente de novo.");
        return;
    }

    let created;

    try {
        created = await apiClient.post(ENDPOINT, buildPayload(), requestOptions);
    } catch (error) {
        setSubmitting(false);
        showMessage(getErrorMessage(error));
        return;
    }

    lockForm();
    setSubmitting(false);
    openCreatedContent(created);
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