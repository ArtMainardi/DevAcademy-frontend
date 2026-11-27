import { post } from "../../core/api-client.js";
import { saveToken } from "../../core/storage.js";
import { showFormMessage } from "../../components/form-message.js";

const form = document.querySelector("#login-form");
const emailInput = document.querySelector("#login-email");
const passwordInput = document.querySelector("#login-password");
const submitButton = document.querySelector("#login-submit");
const submitLabel = document.querySelector("#login-submit-label");
const spinner = document.querySelector("#login-spinner");
const messageArea = document.querySelector("#login-message");

let isSubmitting = false;

function setLoading(isLoading) {
    isSubmitting = isLoading;
    submitButton.disabled = isLoading;
    submitButton.classList.toggle("is-loading", isLoading);
    submitLabel.textContent = isLoading ? "Entrando..." : "Entrar";
    spinner.hidden = !isLoading;
}

function showMessage(message, type = "error") {
    showFormMessage(messageArea, message, type);
}

function getErrorMessage(error) {
    if (error?.status === 401) {
        return typeof error.message === "string" && error.message.trim()
            ? error.message
            : "Email ou senha inválidos.";
    }

    if (error?.status === 0 || error?.name === "TypeError") {
        return "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
    }

    return "Não foi possível entrar. Tente novamente.";
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    const email = emailInput.value.trim();
    const senha = passwordInput.value;

    if (!email || !senha) {
        showMessage("Informe seu email e sua senha.");
        return;
    }

    setLoading(true);

    try {
        const response = await post("/api/auth/login", {
            email,
            senha
        });

        if (typeof response?.token !== "string" || !response.token.trim()) {
            showMessage("O servidor não retornou um token válido. Tente novamente.");
            return;
        }

        saveToken(response.token);

        window.location.replace("../home/index.html");
    } catch (error) {
        showMessage(getErrorMessage(error));
    } finally {
        setLoading(false);
    }
});