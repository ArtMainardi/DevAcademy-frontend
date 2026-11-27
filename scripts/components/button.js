/*
 * Componente reutilizável de botão.
 *
 * Utiliza as classes do Design System definidas em
 * styles/components.css.
 *
 * Não realiza chamadas à API nem manipula HTML recebido
 * de outros módulos.
 */

// Variantes visuais disponíveis.
const BUTTON_VARIANTS = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    danger: "btn-danger",
    text: "btn-text"
};

/**
 * Cria um botão reutilizável para a aplicação.
 *
 * @param {Object} options
 * @param {string} options.text - Texto exibido no botão.
 * @param {"primary"|"secondary"|"danger"|"text"} [options.variant="primary"]
 * @param {boolean} [options.disabled=false]
 * @param {Function} [options.onClick]
 * @param {"button"|"submit"|"reset"} [options.type="button"]
 * @returns {HTMLButtonElement}
 */
export function createButton({
    text,
    variant = "primary",
    disabled = false,
    onClick,
    type = "button"
} = {}) {
    const button = document.createElement("button");

    // Define a estrutura e a aparência do botão.
    button.classList.add("btn");

    const variantClass = BUTTON_VARIANTS[variant];

    if (variantClass) {
        button.classList.add(variantClass);
    } else {
        button.classList.add(BUTTON_VARIANTS.primary);
    }

    // Define o texto com segurança.
    button.textContent = text ?? "";

    // Define o tipo de botão.
    const validTypes = ["button", "submit", "reset"];

    button.type = validTypes.includes(type)
        ? type
        : "button";

    // Define o estado inicial.
    button.disabled = Boolean(disabled);

    // Associa a função de clique, quando fornecida.
    if (typeof onClick === "function") {
        button.addEventListener("click", onClick);
    }

    return button;
}