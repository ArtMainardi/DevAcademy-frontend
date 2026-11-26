const MESSAGE_TYPES = {
    success: {
        className: "alert-success",
        label: "Sucesso:"
    },
    warning: {
        className: "alert-warning",
        label: "Atenção:"
    },
    error: {
        className: "alert-error",
        label: "Erro:"
    }
};

const MESSAGE_CLASSES = Object.values(MESSAGE_TYPES).map(
    ({ className }) => className
);

export function showFormMessage(target, message, type = "error") {
    if (!(target instanceof HTMLElement)) {
        throw new TypeError("O destino da mensagem deve ser um elemento HTML.");
    }

    const messageType = MESSAGE_TYPES[type];

    if (!messageType) {
        throw new TypeError(
            "Tipo de mensagem inválido. Use success, warning ou error."
        );
    }

    target.classList.add("alert");
    target.classList.remove(...MESSAGE_CLASSES);
    target.classList.add(messageType.className);

    target.setAttribute("role", "status");
    target.setAttribute("aria-live", "polite");
    target.hidden = false;

    target.textContent = `${messageType.label} ${message}`;

    return target;
}