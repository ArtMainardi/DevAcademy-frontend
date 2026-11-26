import { post } from "../../core/api-client.js";
import { showFormMessage } from "../../components/form-message.js";

const form = document.querySelector("#register-form");
const nameInput = document.querySelector("#register-name");
const emailInput = document.querySelector("#register-email");
const passwordInput = document.querySelector("#register-password");
const confirmationInput = document.querySelector("#register-password-confirmation");
const submitButton = document.querySelector("#register-submit");
const submitLabel = document.querySelector("#register-submit-label");
const spinner = document.querySelector("#register-spinner");
const messageArea = document.querySelector("#register-message");

let isSubmitting = false;

function setLoading(isLoading) {
    isSubmitting = isLoading;
    submitButton.disabled = isLoading;
    submitButton.classList.toggle("is-loading", isLoading);
    submitLabel.textContent = isLoading ? "Criando conta..." : "Criar conta";
    spinner.hidden = !isLoading;
}

function showMessage(message, type) {
    showFormMessage(messageArea, message, type);
}

function getErrorMessage(error) {
    if (error?.status === 409) {
        return "Este email já está cadastrado. Tente entrar ou use outro email.";
    }

    if (error?.status === 400) {
        return "Não foi possível cadastrar. Confira os dados informados.";
    }

    if (error?.status === 0 || error?.name === "TypeError") {
        return "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
    }

    return "Não foi possível criar sua conta. Tente novamente.";
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmation = confirmationInput.value;

    if (!name || !email || !password || !confirmation) {
        showMessage("Preencha todos os campos para continuar.", "error");
        return;
    }

    if (password !== confirmation) {
        showMessage("A confirmação da senha não corresponde à senha informada.", "error");
        confirmationInput.focus();
        return;
    }

    setLoading(true);

    try {
        await post("/api/users", {
            name,
            email,
            password
        });

        showMessage(
            "Conta criada com sucesso! Você será encaminhado para a página de login.",
            "success"
        );

        window.setTimeout(() => {
            window.location.replace("../auth/login.html");
        }, 1200);
    } catch (error) {
        showMessage(getErrorMessage(error), "error");
    } finally {
        setLoading(false);
    }
});