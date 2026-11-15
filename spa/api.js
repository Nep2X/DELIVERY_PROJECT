export async function apiJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const error = new Error(data.error || `Request failed (${res.status})`);
    error.status = res.status;
    if (Array.isArray(data.fields)) error.fields = data.fields;
    throw error;
  }
  return data;
}
