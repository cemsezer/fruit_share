const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

export async function apiFetch(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    throw new Error(formatApiError(data?.error) || data?.message || "Request failed");
  }

  return data;
}

function formatApiError(error) {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error.fieldErrors) {
    const messages = Object.entries(error.fieldErrors)
      .flatMap(([field, fieldMessages]) => fieldMessages.map((message) => `${formatFieldName(field)}: ${message}`));

    if (messages.length > 0) {
      return messages.join("\n");
    }
  }

  if (error.formErrors?.length) {
    return error.formErrors.join("\n");
  }

  return "The request could not be completed. Please check the form and try again.";
}

function formatFieldName(field) {
  return field.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}
